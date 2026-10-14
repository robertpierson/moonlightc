"use client";

import type { MooncBridge } from "./desktop";
import type { Req } from "./remote";

const OLLAMA = "http://127.0.0.1:11434";

export async function localModels(): Promise<string[]> {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`);
    const d = (await r.json()) as { models?: { name: string }[] };
    return (d.models ?? []).map((m) => m.name).slice(0, 50);
  } catch {
    return [];
  }
}

/** The PC side of remote control: turns requests into desktop-app calls. Every call is permission-checked there too. */
export function createHostHandler(
  b: MooncBridge,
  send: (event: string, payload: unknown) => void,
) {
  const terms = new Map<
    string,
    { owner: string; off: () => void; flush: ReturnType<typeof setInterval> }
  >();
  const closeTerm = (id: string) => {
    const t = terms.get(id);
    if (!t) return;
    t.off();
    clearInterval(t.flush);
    b.terminals.kill(id);
    terms.delete(id);
  };
  const ownTerm = (req: Req) => {
    const id = String(req.params?.termId ?? "");
    if (terms.get(id)?.owner !== req.from)
      throw new Error("That terminal isn't yours.");
    return id;
  };
  const need = async (req: Req, tier: string) => {
    if (!(await b.remote.allowed(req.from, tier)))
      throw new Error(
        "This device isn't allowed to do that. Connect again and allow it on the PC.",
      );
  };

  const handle = async (req: Req): Promise<unknown> => {
    const p = req.params ?? {};
    switch (req.method) {
      case "hello":
        return { name: (await b.device.info()).name };
      case "connect":
        return b.remote.connect(
          { id: req.from, name: req.fromName },
          Array.isArray(p.tiers) ? (p.tiers as string[]) : [],
        );
      case "disconnect":
        for (const [id, t] of terms) if (t.owner === req.from) closeTerm(id);
        return b.remote.end(req.from, "disconnected from the other device");
      case "frame":
        return b.remote.frame(req.from);
      case "input":
        return b.remote.input(req.from, p as never);
      case "files.list":
        return b.remote.list(req.from, p.dir as string | undefined);
      case "files.read":
        return b.remote.read(req.from, String(p.path ?? ""));
      case "files.write":
        return b.remote.write(
          req.from,
          String(p.dir ?? ""),
          String(p.name ?? ""),
          String(p.data ?? ""),
        );
      case "term.open": {
        await need(req, "terminal");
        const t = await b.terminals.create({
          cols: Number(p.cols) || 100,
          rows: Number(p.rows) || 30,
        });
        let buf = "";
        const off = b.terminals.onData(t.id, (d) => (buf += d));
        // Batch output so the channel isn't flooded.
        const flush = setInterval(() => {
          if (!buf) return;
          send("term", {
            to: req.from,
            termId: t.id,
            data: buf.slice(-60_000),
          });
          buf = "";
        }, 80);
        terms.set(t.id, { owner: req.from, off, flush });
        return { termId: t.id };
      }
      case "term.write":
        await need(req, "terminal");
        b.terminals.write(ownTerm(req), String(p.data ?? "").slice(0, 10_000));
        return { ok: true };
      case "term.close":
        closeTerm(ownTerm(req));
        return { ok: true };
      case "models":
        await need(req, "chat");
        return { models: await localModels() };
      case "chat": {
        await need(req, "chat");
        const reqId = String(p.reqId ?? req.id).slice(0, 64);
        // Stream the local model's answer back as it's written.
        (async () => {
          try {
            const r = await fetch(`${OLLAMA}/api/chat`, {
              method: "POST",
              body: JSON.stringify({
                model: String(p.model ?? ""),
                messages: p.messages,
                stream: true,
              }),
            });
            if (!r.ok || !r.body)
              throw new Error(
                `The local model didn't answer (${r.status}). Is Ollama running?`,
              );
            const reader = r.body.getReader();
            const dec = new TextDecoder();
            let rest = "";
            let pending = "";
            let last = Date.now();
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              rest += dec.decode(value, { stream: true });
              const lines = rest.split("\n");
              rest = lines.pop() ?? "";
              for (const l of lines)
                if (l.trim())
                  pending +=
                    (JSON.parse(l) as { message?: { content?: string } })
                      .message?.content ?? "";
              if (pending && Date.now() - last > 120) {
                send("chat", { to: req.from, reqId, delta: pending });
                pending = "";
                last = Date.now();
              }
            }
            send("chat", { to: req.from, reqId, delta: pending, done: true });
          } catch (e) {
            send("chat", {
              to: req.from,
              reqId,
              error: e instanceof Error ? e.message : String(e),
              done: true,
            });
          }
        })();
        return { started: true };
      }
      default:
        throw new Error("Unknown request.");
    }
  };

  /** When sessions end on the PC (panic key, timeout, revoke), close their terminals too. */
  const sessionsChanged = (alive: string[]) => {
    for (const [id, t] of terms) if (!alive.includes(t.owner)) closeTerm(id);
  };
  const closeAll = () => {
    for (const id of [...terms.keys()]) closeTerm(id);
  };
  return { handle, sessionsChanged, closeAll };
}
