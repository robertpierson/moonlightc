"use client";

import { reportError } from "./analytics";
import type { MooncBridge } from "./desktop";
import { claudeText } from "./claude-code";
import { getState } from "./store";
import { gathered, hifiAudio, iceServers, type Req } from "./remote";

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
  // One screen capture per connected device, shared by live video and pictures: Windows may refuse a second capture
  // in the same app (with administrator rights it does). Sound if the system allows it, otherwise video only.
  const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
  const captures = new Map<string, Promise<MediaStream>>();
  const capture = (id: string) => {
    let c = captures.get(id);
    if (!c) {
      c = (async () => {
        await b.remote.allowStream(id);
        try {
          return await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60 } }, audio });
        } catch (err) {
          void b.remote.note(id, `screen capture with sound failed: ${err instanceof Error ? err.message : String(err)}`);
          await new Promise((r) => setTimeout(r, 600)); // let Windows let go of the failed capture
          await b.remote.allowStream(id);
          return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 60 } }, audio: false });
        }
      })();
      captures.set(id, c);
      c.catch(() => captures.delete(id));
    }
    return c;
  };
  // Pictures mode (networks that block live video): cut from that live capture, far quicker than fresh screenshots.
  const shots = new Map<string, Promise<HTMLVideoElement>>();
  const shotSource = (id: string) => {
    let s = shots.get(id);
    if (!s) {
      s = (async () => {
        const video = document.createElement("video");
        video.muted = true;
        video.srcObject = new MediaStream((await capture(id)).getVideoTracks());
        await video.play();
        return video;
      })();
      shots.set(id, s);
      s.catch(() => shots.delete(id));
    }
    return s;
  };
  const uploads = new Map<string, { from: string; parts: string[]; at: number }>();
  const closeRtc = (id: string) => {
    const r = rtc.get(id);
    if (!r) return;
    r.stream.getTracks().forEach((t) => t.stop()); // its own copies; the capture stays for pictures
    r.pc.close();
    rtc.delete(id);
  };
  // The device disconnected: stop capturing the screen for it.
  const closeShot = (id: string) => {
    closeRtc(id);
    shots.delete(id);
    captures
      .get(id)
      ?.then((st) => st.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
    captures.delete(id);
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
          p.where,
        );
      case "rtc.offer": {
        let step = "permission";
        try {
          await need(req, "view");
          closeRtc(req.from);
          step = "screen capture";
          // Copies of the shared capture (60 frames a second; the graphics chip encodes it). Sound only on the first try.
          const shared = await capture(req.from);
          const stream = new MediaStream((p.noAudio ? shared.getVideoTracks() : shared.getTracks()).map((t) => t.clone()));
          stream.getVideoTracks().forEach((t) => (t.contentHint = "detail"));
          stream.getAudioTracks().forEach((t) => (t.contentHint = "music"));
          step = "video connection";
          const pc = new RTCPeerConnection({ iceServers: await iceServers() });
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
                if (a.action === "hint") {
                  const motion = a.hint === "motion";
                  stream.getVideoTracks().forEach((t) => {
                    t.contentHint = motion ? "motion" : "detail";
                    t.applyConstraints({ frameRate: { ideal: 60 } }).catch(() => {});
                  });
                  // Game mode: a bit smaller picture that never stutters (quicker to encode, send and decode).
                  pc.getSenders()
                    .filter((s) => s.track?.kind === "video")
                    .forEach((s) => {
                      const p = s.getParameters();
                      if (!p.encodings?.length) return;
                      p.encodings[0].scaleResolutionDownBy = motion ? 1.5 : 1;
                      (p as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = motion ? "maintain-framerate" : "balanced";
                      s.setParameters(p).catch(() => {});
                    });
                  return;
                }
                b.remote.input(req.from, a).catch(() => {});
              } catch {}
            }),
          );
          step = "video setup";
          await pc.setRemoteDescription({ type: "offer", sdp: String(p.sdp ?? "") });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription({ type: "answer", sdp: hifiAudio(answer.sdp) });
          tune();
          step = "network check";
          await gathered(pc);
          return { sdp: pc.localDescription?.sdp };
        } catch (e) {
          const m = `PC ${step}: ${e instanceof Error ? e.message : String(e)}`;
          reportError(m, "remote");
          void b.remote.note(req.from, m);
          throw new Error(m);
        }
      }
      case "clipboard.get":
        await need(req, "control");
        return b.remote.clipboardGet(req.from);
      case "clipboard.set":
        await need(req, "control");
        return b.remote.clipboardSet(req.from, String(p.text ?? ""));
      case "status":
        await need(req, "view");
        return b.remote.status();
      // The viewer's own errors, written to this PC's activity log (so a broken live video can be fixed).
      case "note":
        await need(req, "view");
        return b.remote.note(req.from, String(p.text ?? "").slice(0, 500));
      case "power":
        await need(req, "control");
        return b.remote.power(req.from, p.what as "lock" | "sleep" | "restart" | "shutdown");
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
          let e: { type?: string; subtype?: string; is_error?: boolean; session_id?: string; result?: string; message?: { content?: Parameters<typeof claudeText>[0] } };
          try {
            e = JSON.parse(raw);
          } catch {
            return;
          }
          const text = e.type === "assistant" ? claudeText(e.message?.content) : "";
          if (text || e.session_id) send("chat", { to: req.from, reqId, delta: text, session: e.session_id });
          if (e.type === "result" || e.type === "exit") {
            off();
            send("chat", { to: req.from, reqId, done: true, ...(e.type === "result" && (e.is_error || e.subtype !== "success") ? { error: e.result || "Claude Code stopped." } : {}) });
          }
        });
        // The permission is this PC's own setting (Settings > Code permission), never the other device's say.
        await b.claude.run(runId, String(p.prompt ?? "").slice(0, 100_000), p.session ? String(p.session) : undefined, String(p.model ?? ""), p.effort ? String(p.effort) : undefined, getState().codePermission ?? "auto");
        return { started: true };
      }
      case "rtc.stop":
        closeRtc(req.from);
        return { ok: true };
      case "disconnect":
        closeRtc(req.from);
        for (const [id, t] of terms) if (t.owner === req.from) closeTerm(id);
        return b.remote.end(req.from, "disconnected from the other device");
      case "shot": {
        await need(req, "view");
        const video = await shotSource(req.from);
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const c = (p.crop ?? {}) as { x?: number; y?: number; w?: number; h?: number };
        const f = (v: unknown, d: number) => (typeof v === "number" && v >= 0 && v <= 1 ? v : d);
        const cw = Math.max(0.02, f(c.w, 1));
        const ch = Math.max(0.02, f(c.h, 1));
        const sx = Math.min(f(c.x, 0), 1 - cw) * vw;
        const sy = Math.min(f(c.y, 0), 1 - ch) * vh;
        const sw = cw * vw;
        const sh = ch * vh;
        const out = Math.max(64, Math.round(Math.min(Number(p.maxW) || 1280, 1920, sw)));
        const oh = Math.max(36, Math.round((out * sh) / sw));
        const canvas = new OffscreenCanvas(out, oh);
        canvas.getContext("2d")!.drawImage(video, sx, sy, sw, sh, 0, 0, out, oh);
        const blob = await canvas.convertToBlob({ type: "image/webp", quality: Math.min(0.9, Math.max(0.3, Number(p.q) || 0.72)) });
        const url = await new Promise<string>((done) => {
          const r = new FileReader();
          r.onload = () => done(String(r.result));
          r.readAsDataURL(blob);
        });
        return { url, fullW: vw, fullH: vh };
      }
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
      // A file in pieces (messages have a size cap): kept until the last piece, then written like files.write.
      case "files.part": {
        await need(req, "files");
        const id = String(p.upload ?? "").slice(0, 64);
        const i = Number(p.i);
        const n = Number(p.n);
        if (!id || !(n > 0 && n <= 200) || !(i >= 0 && i < n)) throw new Error("Bad upload.");
        const got = uploads.get(id) ?? { from: req.from, parts: Array<string>(n), at: Date.now() };
        if (got.from !== req.from) throw new Error("Bad upload.");
        got.parts[i] = String(p.data ?? "");
        uploads.set(id, got);
        for (const [k, u] of uploads) if (Date.now() - u.at > 10 * 60_000) uploads.delete(k);
        if (got.parts.filter((x) => typeof x === "string").length < n) return { ok: true }; // (filter skips missing pieces)
        uploads.delete(id);
        return b.remote.write(req.from, String(p.dir ?? ""), String(p.name ?? ""), got.parts.join(""));
      }
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
    for (const id of [...captures.keys()]) if (!alive.includes(id)) closeShot(id);
  };
  const closeAll = () => {
    for (const id of [...terms.keys()]) closeTerm(id);
    for (const id of [...rtc.keys()]) closeRtc(id);
    for (const id of [...captures.keys()]) closeShot(id);
  };
  return { handle, sessionsChanged, closeAll };
}
