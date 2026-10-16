"use client";

import type { MooncBridge } from "./desktop";
import { gathered, hifiAudio, ICE, type Req } from "./remote";

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
  // Live screen video, one per connected device (only for devices allowed to see the screen).
  const rtc = new Map<string, { pc: RTCPeerConnection; stream: MediaStream }>();
  const closeRtc = (id: string) => {
    const r = rtc.get(id);
    if (!r) return;
    r.stream.getTracks().forEach((t) => t.stop());
    r.pc.close();
    rtc.delete(id);
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
      case "rtc.offer": {
        await need(req, "view");
        closeRtc(req.from);
        // With the PC's sound where the system allows it; video only otherwise.
        await b.remote.allowStream(req.from);
        // Game and music sound as it is: no call-style echo/noise filtering or volume leveling.
        const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60, max: 60 } }, audio }).catch(async () => {
          await b.remote.allowStream(req.from);
          return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60, max: 60 } }, audio: false });
        });
        stream.getVideoTracks().forEach((t) => (t.contentHint = "detail"));
        stream.getAudioTracks().forEach((t) => (t.contentHint = "music"));
        const pc = new RTCPeerConnection({ iceServers: ICE });
        rtc.set(req.from, { pc, stream });
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        // Room for sharp, smooth video and clear sound on a good connection (WebRTC lowers it when the network is slow).
        const tune = () =>
          pc.getSenders().forEach((s) => {
            const p = s.getParameters();
            if (!p.encodings?.length) return;
            p.encodings[0].maxBitrate = s.track?.kind === "audio" ? 192_000 : 8_000_000;
            if (s.track?.kind === "video") p.encodings[0].maxFramerate = 60;
            s.setParameters(p).catch(() => {});
          });
        pc.addEventListener("connectionstatechange", () => {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") closeRtc(req.from);
        });
        // Mouse and keyboard over the same direct connection (much faster than the server channel);
        // every event is still checked by the desktop app ("use the mouse and keyboard" must be allowed).
        pc.addEventListener("datachannel", (e) =>
          e.channel.addEventListener("message", (m) => {
            try {
              const a = JSON.parse(String(m.data));
              // Game mode asks for smooth motion over sharp text (and back again when it ends).
              if (a.action === "hint") return stream.getVideoTracks().forEach((t) => (t.contentHint = a.hint === "motion" ? "motion" : "detail"));
              b.remote.input(req.from, a).catch(() => {});
            } catch {}
          }),
        );
        await pc.setRemoteDescription({ type: "offer", sdp: String(p.sdp ?? "") });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription({ type: "answer", sdp: hifiAudio(answer.sdp) });
        tune();
        await gathered(pc);
        return { sdp: pc.localDescription?.sdp };
      }
      // Claude Code on this PC, for your other devices (needs "chat with the AI models on this PC").
      case "claude.status":
        await need(req, "chat");
        return b.claude.status();
      case "claude": {
        await need(req, "chat");
        const reqId = String(p.reqId ?? req.id).slice(0, 64);
        const runId = crypto.randomUUID();
        const off = b.claude.onEvent((id, raw) => {
          if (id !== runId) return;
          let e: { type?: string; subtype?: string; is_error?: boolean; session_id?: string; result?: string; message?: { content?: { type: string; text?: string }[] } };
          try {
            e = JSON.parse(raw);
          } catch {
            return;
          }
          const text = e.type === "assistant" ? (e.message?.content ?? []).flatMap((c) => (c.type === "text" && c.text ? [c.text] : [])).join("\n\n") : "";
          if (text || e.session_id) send("chat", { to: req.from, reqId, delta: text, session: e.session_id });
          if (e.type === "result" || e.type === "exit") {
            off();
            send("chat", { to: req.from, reqId, done: true, ...(e.type === "result" && (e.is_error || e.subtype !== "success") ? { error: e.result || "Claude Code stopped." } : {}) });
          }
        });
        await b.claude.run(runId, String(p.prompt ?? "").slice(0, 100_000), p.session ? String(p.session) : undefined, String(p.model ?? ""), p.effort ? String(p.effort) : undefined);
        return { started: true };
      }
      case "rtc.stop":
        closeRtc(req.from);
        return { ok: true };
      case "disconnect":
        closeRtc(req.from);
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
      case "exec":
        return b.remote.exec(req.from, String(p.command ?? ""), p.cwd ? String(p.cwd) : undefined);
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
    for (const id of [...rtc.keys()]) if (!alive.includes(id)) closeRtc(id);
  };
  const closeAll = () => {
    for (const id of [...terms.keys()]) closeTerm(id);
    for (const id of [...rtc.keys()]) closeRtc(id);
  };
  return { handle, sessionsChanged, closeAll };
}
