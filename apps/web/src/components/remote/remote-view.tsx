"use client";

import "@xterm/xterm/css/xterm.css";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileIcon, Folder, Loader2, Maximize, Minimize, Monitor, Power, Gamepad2, Upload, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { gathered, hifiAudio, ICE, isOnline, whereAmI, joinChannel, leaveChannel, RemoteClient, subscribed, TIER_LABELS, type Tier } from "@/lib/remote";
import { desktop } from "@/lib/desktop";
import { useDevices } from "./your-computers";

type Tab = "screen" | "terminal" | "files" | "chat";
const ALL: Tier[] = ["view", "control", "files", "terminal", "chat"];

/** Control one of your computers from this device. */
export function RemoteView({ deviceId, onSetup, extra, mini, onLive, onOpen, onClose }: { deviceId: string; onSetup: () => void; extra?: React.ReactNode; mini?: boolean; onLive?: (live: boolean) => void; onOpen?: () => void; onClose?: () => void }) {
  const device = useDevices().find((d) => d.id === deviceId);
  const [wanted, setWanted] = useState<Tier[]>(ALL);
  const [client, setClient] = useState<RemoteClient>();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("screen");
  const chRef = useRef<RealtimeChannel | undefined>(undefined);

  const disconnect = async () => {
    await client?.call("disconnect").catch(() => {});
    if (chRef.current) leaveChannel(chRef.current);
    chRef.current = undefined;
    setClient(undefined);
    setTiers([]);
  };
  // Leaving this screen (or closing the tab) ends the session on the PC too, so its orange frame goes away.
  const clientRef = useRef<RemoteClient | undefined>(undefined);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);
  useEffect(() => {
    const end = () => {
      clientRef.current?.call("disconnect").catch(() => {});
      if (chRef.current) leaveChannel(chRef.current);
      chRef.current = undefined;
    };
    addEventListener("pagehide", end);
    return () => {
      removeEventListener("pagehide", end);
      end();
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    let ch: RealtimeChannel | undefined;
    try {
      const here = await desktop()?.device.info();
      if (here?.id === deviceId) throw new Error("That's this PC. Connect to it from your phone, Chromebook or another computer.");
      ch = await joinChannel(deviceId, { key: `client:${crypto.randomUUID()}` });
      const c = new RemoteClient(ch, "screen");
      await subscribed(ch);
      chRef.current = ch;
      const r = await c.call<{ allowed: boolean; tiers?: Tier[]; reason?: string }>("connect", { tiers: wanted, where: await whereAmI() }, 130_000);
      if (!r.allowed) throw new Error(r.reason ?? "The person at the PC didn't allow it.");
      setTiers(r.tiers ?? []);
      setClient(c);
      setTab(r.tiers?.includes("view") ? "screen" : r.tiers?.includes("terminal") ? "terminal" : r.tiers?.includes("files") ? "files" : "chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (ch) leaveChannel(ch);
      chRef.current = undefined;
    }
    setBusy(false);
  };

  useEffect(() => onLive?.(!!client), [client, onLive]);
  // Picture-in-picture while you're elsewhere in the app: watch only (no clicks or keys), back to control on return.
  if (mini)
    return client ? (
      <div className="flex h-full flex-col">
        <div data-pip-handle className="flex cursor-move items-center gap-1 border-b bg-card px-2 py-1 text-xs select-none">
          <span className="min-w-0 flex-1 truncate">{device?.name ?? "Your computer"} · watching</span>
          <Button size="xs" variant="ghost" onClick={onOpen}>
            Back to control
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Disconnect" onClick={() => disconnect().then(onClose)}>
            <Power />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <Screen client={client} control={false} mini />
        </div>
      </div>
    ) : null;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Monitor className="size-5" />
          <h2 className="text-lg font-semibold">{device?.name ?? "Your computer"}</h2>
          {device && <span className="text-sm text-muted-foreground">{isOnline(device) ? "Online" : `Last seen ${new Date(device.last_seen).toLocaleString()}`}</span>}
          <span className="ml-auto" />
          {extra}
          {client && (
            <Button size="sm" variant="destructive" onClick={disconnect}>
              <Power /> Disconnect
            </Button>
          )}
        </div>
        <TwoStepGate onSetup={onSetup} quick>
          {!device ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !device.remote_enabled ? (
            <p className="rounded-xl border p-4 text-sm">Remote control is off on this computer. On it, open MoonlightC and go to Settings &gt; Remote control.</p>
          ) : !client ? (
            <div className="grid justify-items-start gap-3 rounded-xl border p-4">
              <p className="text-sm">Choose what this device may do. The person at the computer has to click Allow.</p>
              <div className="grid gap-1.5">
                {ALL.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={wanted.includes(t)} onChange={() => setWanted((w) => (w.includes(t) ? w.filter((x) => x !== t) : [...w, t]))} />
                    {TIER_LABELS[t]}
                  </label>
                ))}
              </div>
              <Button onClick={connect} disabled={busy || !wanted.length}>
                {busy && <Loader2 className="animate-spin" />} {busy ? "Waiting for Allow on the computer…" : "Connect"}
              </Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              <div role="tablist" aria-label="Remote" className="flex flex-wrap gap-1">
                {(
                  [
                    ["screen", "Screen", "view"],
                    ["terminal", "Terminal", "terminal"],
                    ["files", "Files", "files"],
                    ["chat", "Chat", "chat"],
                  ] as const
                )
                  .filter(([, , t]) => tiers.includes(t))
                  .map(([id, label]) => (
                    <Button key={id} role="tab" aria-selected={tab === id} size="sm" variant={tab === id ? "secondary" : "ghost"} onClick={() => setTab(id)}>
                      {label}
                    </Button>
                  ))}
              </div>
              {tab === "screen" && <Screen client={client} control={tiers.includes("control")} />}
              {tab === "terminal" && <RemoteTerminal client={client} />}
              {tab === "files" && <Files client={client} />}
              {tab === "chat" && <RemoteChat client={client} models={device.local_models} />}
            </div>
          )}
        </TwoStepGate>
      </div>
    </div>
  );
}

type Live = "connecting" | "video" | "pictures";
const ZOOMS = [1, 1.5, 2, 3];
// Game mode: physical keys (e.code) to the PC's key names, so holding W walks.
const CODES = (code: string) =>
  /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase()
  : /^Digit\d$/.test(code) ? code.slice(5)
  : /^F\d{1,2}$/.test(code) ? code.toLowerCase()
  : ({ Space: "space", Enter: "enter", Escape: "escape", Tab: "tab", Backspace: "backspace", ShiftLeft: "shift", ShiftRight: "shift", ControlLeft: "control", ControlRight: "control", AltLeft: "alt", AltRight: "alt", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as Record<string, string>)[code];
const KEYS: Record<string, string> = { Enter: "enter", Backspace: "backspace", Tab: "tab", Escape: "escape", Delete: "delete", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown" };

function Screen({ client, control, mini }: { client: RemoteClient; control: boolean; mini?: boolean }) {
  const [live, setLive] = useState<Live>("connecting");
  const [ready, setReady] = useState(false);
  const [text, setText] = useState("");
  const [zoom, setZoom] = useState(1);
  // The PC's sound comes with the video; it starts muted (browsers only play sound after you choose to).
  const [sound, setSound] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [hasAudio, setHasAudio] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  // Input goes over the direct video connection when it's up (fast), otherwise through the server.
  const dc = useRef<RTCDataChannel | undefined>(undefined);
  const [game, setGame] = useState(false);
  // Mouse moves go on their own lane that never waits or resends (an old move is worthless); keys stay reliable.
  const moves = useRef<RTCDataChannel | undefined>(undefined);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = !sound;
    v.volume = volume;
    if (sound) v.play().catch(() => {});
  }, [sound, volume]);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Fullscreen: the browser's own where it works, otherwise the screen fills the window.
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => !document.fullscreenElement && setFull(false);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = () => {
    if (full) {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setFull(false);
    } else {
      setFull(true);
      box.current?.requestFullscreen?.().catch(() => {});
    }
  };

  // Live video straight from the PC (smooth). If the network won't allow it, pictures instead.
  useEffect(() => {
    let pc: RTCPeerConnection | undefined;
    let done = false;
    const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    (async () => {
      try {
        pc = new RTCPeerConnection({ iceServers: ICE });
        const vt = pc.addTransceiver("video", { direction: "recvonly" });
        // H.264 first: most PCs make it on the graphics chip, so streaming barely uses the PC's processor.
        const codecs = RTCRtpReceiver.getCapabilities?.("video")?.codecs ?? [];
        const h264 = codecs.filter((c) => c.mimeType === "video/H264");
        if (h264.length && vt.setCodecPreferences) vt.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType !== "video/H264")]);
        pc.addTransceiver("audio", { direction: "recvonly" });
        dc.current = pc.createDataChannel("input");
        moves.current = pc.createDataChannel("moves", { ordered: false, maxRetransmits: 0 });
        pc.addEventListener("track", (e) => e.track.kind === "audio" && setHasAudio(true));
        const track = new Promise<MediaStream>((resolve) => pc!.addEventListener("track", (e) => resolve(e.streams[0] ?? new MediaStream([e.track]))));
        const offer = await pc.createOffer();
        await pc.setLocalDescription({ type: "offer", sdp: hifiAudio(offer.sdp) });
        await gathered(pc);
        const r = await client.call<{ sdp: string }>("rtc.offer", { sdp: pc.localDescription?.sdp }, 30_000);
        await pc.setRemoteDescription({ type: "answer", sdp: r.sdp });
        // Show frames as soon as they arrive (no extra buffering), for the lowest delay.
        pc.getReceivers().forEach((rc) => {
          (rc as RTCRtpReceiver & { jitterBufferTarget?: number | null; playoutDelayHint?: number }).jitterBufferTarget = 0;
          (rc as RTCRtpReceiver & { playoutDelayHint?: number }).playoutDelayHint = 0;
        });
        const v = video.current!;
        v.srcObject = await Promise.race([track, timeout(10_000)]);
        await Promise.race([new Promise((resolve) => v.addEventListener("loadeddata", resolve, { once: true })), timeout(10_000)]);
        if (done) return;
        setLive("video");
        setReady(true);
        pc.addEventListener("connectionstatechange", () => {
          if (!done && pc?.connectionState === "failed") setLive("pictures");
        });
      } catch {
        pc?.close();
        client.call("rtc.stop").catch(() => {});
        if (!done) setLive("pictures");
      }
    })();
    return () => {
      done = true;
      pc?.close();
      client.call("rtc.stop").catch(() => {});
    };
  }, [client]);

  // Pictures: each one is drawn only once it's fully loaded, so the screen never blanks between them.
  useEffect(() => {
    if (live !== "pictures") return;
    let on = true;
    const loop = async () => {
      while (on) {
        try {
          const f = await client.call<{ image: string; width: number; height: number }>("frame");
          const img = new Image();
          img.src = `data:image/jpeg;base64,${f.image}`;
          await img.decode();
          const c = canvas.current;
          if (!on || !c) break;
          if (c.width !== f.width || c.height !== f.height) {
            c.width = f.width;
            c.height = f.height;
          }
          c.getContext("2d")?.drawImage(img, 0, 0);
          setReady(true);
        } catch (e) {
          if (on) toast.error(e instanceof Error ? e.message : String(e));
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    };
    loop();
    setTimeout(loop, 150); // a second request in flight roughly doubles the picture rate
    return () => {
      on = false;
    };
  }, [live, client]);

  const input = (a: Record<string, unknown>) => {
    if (a.action === "move_by" && moves.current?.readyState === "open") return void moves.current.send(JSON.stringify(a));
    if (dc.current?.readyState === "open") return void dc.current.send(JSON.stringify(a));
    client.call("input", a).catch((e: Error) => toast.error(e.message));
  };
  // Game mode: keys are held (not typed), the mouse is captured and moves the view, Escape goes to the game.
  useEffect(() => {
    if (!game || !control) return;
    const down = new Set<string>();
    let dx = 0;
    let dy = 0;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (dx || dy) input({ action: "move_by", dx: Math.round(dx), dy: Math.round(dy) });
      dx = dy = 0;
    };
    if (dc.current?.readyState === "open") dc.current.send(JSON.stringify({ action: "hint", hint: "motion" }));
    let lastEsc = 0;
    const key = (e: KeyboardEvent) => {
      const k = CODES(e.code);
      if (!k) return;
      e.preventDefault();
      // Escape twice quickly: leave game mode and full screen. Once: Escape goes to the game.
      if (e.type === "keydown" && k === "escape" && !e.repeat) {
        if (Date.now() - lastEsc < 500) {
          setGame(false);
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          setFull(false);
          return;
        }
        lastEsc = Date.now();
      }
      if (e.type === "keydown") {
        if (down.has(k)) return;
        down.add(k);
        input({ action: "key_down", key: k });
      } else {
        down.delete(k);
        input({ action: "key_up", key: k });
      }
    };
    const move = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      dx += e.movementX;
      dy += e.movementY;
      frame ||= requestAnimationFrame(flush);
    };
    const button = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      e.preventDefault();
      input({ action: e.type === "mousedown" ? "mouse_down" : "mouse_up", button: e.button === 2 ? "right" : "left" });
    };
    const blockMenu = (e: MouseEvent) => document.pointerLockElement && e.preventDefault();
    // The scroll wheel goes to the game (hotbar, zoom), not the page.
    let lastWheel = 0;
    const wheel = (e: WheelEvent) => {
      if (!document.pointerLockElement) return;
      e.preventDefault();
      if (Date.now() - lastWheel < 40 || !e.deltaY) return;
      lastWheel = Date.now();
      input({ action: "wheel", amount: e.deltaY > 0 ? -1 : 1 });
    };
    addEventListener("wheel", wheel, { passive: false });
    addEventListener("keydown", key, true);
    addEventListener("keyup", key, true);
    addEventListener("mousemove", move);
    addEventListener("mousedown", button);
    addEventListener("mouseup", button);
    addEventListener("contextmenu", blockMenu);
    return () => {
      removeEventListener("keydown", key, true);
      removeEventListener("keyup", key, true);
      removeEventListener("mousemove", move);
      removeEventListener("mousedown", button);
      removeEventListener("mouseup", button);
      removeEventListener("contextmenu", blockMenu);
      removeEventListener("wheel", wheel);
      for (const k of down) input({ action: "key_up", key: k });
      if (dc.current?.readyState === "open") dc.current.send(JSON.stringify({ action: "hint", hint: "detail" }));
      if (document.pointerLockElement) document.exitPointerLock();
      (navigator as Navigator & { keyboard?: { unlock(): void } }).keyboard?.unlock();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- input reads the live connection
  }, [game, control]);
  const capture = (el: HTMLElement) => {
    el.requestPointerLock?.();
    // In full screen, Chrome lets the page keep Escape (hold Esc to leave full screen).
    (navigator as Navigator & { keyboard?: { lock(keys?: string[]): Promise<void> } }).keyboard?.lock().catch(() => {});
  };
  // Where on the PC's screen, as fractions (works at any zoom or size).
  const at = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { nx: clamp((e.clientX - r.left) / r.width), ny: clamp((e.clientY - r.top) / r.height) };
  };
  const lastWheel = useRef(0);
  const look = `rounded-lg border bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring ${control ? "cursor-crosshair" : ""}`;
  // Phones and tablets: tap = click, press and hold = right-click, two fingers up/down = scroll.
  const touch = useRef<{ timer?: ReturnType<typeof setTimeout>; held?: boolean; x?: number; y?: number; scrollY?: number }>({});
  const fromTouch = (el: HTMLElement, t: { clientX: number; clientY: number }) => {
    const r = el.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return { nx: clamp((t.clientX - r.left) / r.width), ny: clamp((t.clientY - r.top) / r.height) };
  };
  const phone = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const surface = {
    tabIndex: control ? 0 : -1,
    "aria-label": "Your computer's screen",
    // While controlling, finger gestures go to the PC (not to scrolling or zooming this page).
    style: { width: `${zoom * 100}%`, maxWidth: "none", height: "auto", touchAction: control ? "none" : undefined },
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      if (!control) return;
      const t = touch.current;
      clearTimeout(t.timer);
      t.held = false;
      if (e.touches.length === 2) {
        t.scrollY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        return;
      }
      const el = e.currentTarget;
      const p = e.touches[0];
      t.x = p.clientX;
      t.y = p.clientY;
      t.timer = setTimeout(() => {
        t.held = true;
        input({ action: "right_click", ...fromTouch(el, p) });
      }, 550);
    },
    onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
      const t = touch.current;
      if (e.touches.length === 2 && t.scrollY !== undefined) {
        const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (Math.abs(y - t.scrollY) > 30) {
          input({ action: "scroll", amount: y > t.scrollY ? 3 : -3, ...fromTouch(e.currentTarget, e.touches[0]) });
          t.scrollY = y;
        }
        return;
      }
      if (Math.hypot(e.touches[0].clientX - (t.x ?? 0), e.touches[0].clientY - (t.y ?? 0)) > 10) clearTimeout(t.timer);
    },
    onTouchEnd: () => {
      clearTimeout(touch.current.timer);
      touch.current.scrollY = undefined;
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (!control) return;
      if (touch.current.held) return void (touch.current.held = false);
      if (game) return capture(e.currentTarget);
      e.currentTarget.focus();
      input({ action: "click", ...at(e) });
    },
    onDoubleClick: (e: React.MouseEvent) => {
      if (control && !game) input({ action: "double_click", ...at(e) });
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (!control || game) return;
      e.preventDefault();
      input({ action: "right_click", ...at(e) });
    },
    onWheel: (e: React.WheelEvent) => {
      if (!control || game || Date.now() - lastWheel.current < 120) return;
      lastWheel.current = Date.now();
      input({ action: "scroll", amount: e.deltaY > 0 ? -3 : 3, ...at(e) });
    },
    // Typing while the screen is selected goes straight to the PC.
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!control || game) return;
      const mods = [e.ctrlKey && "control", e.altKey && "alt", e.shiftKey && e.key.length > 1 && "shift"].filter(Boolean) as string[];
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) input({ action: "type", text: e.key });
      else if (KEYS[e.key] || (e.key.length === 1 && (e.ctrlKey || e.altKey))) input({ action: "key", keys: [...mods, KEYS[e.key] ?? e.key.toLowerCase()].join("+") });
      else return;
      e.preventDefault();
    },
  };

  return (
    <div ref={box} className={mini ? "h-full bg-black" : full ? "fixed inset-0 z-50 flex flex-col gap-2 bg-black p-2" : "grid gap-2"}>
      <div className={mini ? "hidden" : "flex flex-wrap items-center gap-2"}>
        <span className="text-xs text-muted-foreground" role="status">
          {live === "video" ? "Live video" : live === "pictures" ? "Pictures (this network blocks live video)" : "Connecting…"}
          {game && " · Game mode: click the screen to capture the mouse; press Esc twice quickly to leave"}
        </span>
        <span className="flex-1" />
        {control && !phone && (
          <>
            <label className="flex items-center gap-2 text-sm" title="Hold keys like WASD, look around with the mouse, and send Escape to the game">
              <Gamepad2 className="size-4" /> Game mode
              <Switch aria-label="Game mode" checked={game} onCheckedChange={setGame} className="data-[state=checked]:bg-emerald-600" />
              <span className={`w-7 text-xs font-semibold ${game ? "text-emerald-600" : "text-muted-foreground"}`}>{game ? "ON" : "OFF"}</span>
            </label>
          </>
        )}
        {live === "video" && hasAudio && (
          <>
            <Button size="icon-sm" variant="secondary" aria-label={sound ? "Turn sound off" : "Turn sound on"} aria-pressed={sound} onClick={() => setSound((v) => !v)}>
              {sound ? <Volume2 /> : <VolumeX />}
            </Button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={!sound}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-primary disabled:opacity-40 sm:w-28"
            />
          </>
        )}
        <Button size="icon-sm" variant="secondary" aria-label="Zoom out" disabled={zoom === ZOOMS[0]} onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])}>
          <ZoomOut />
        </Button>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{zoom * 100}%</span>
        <Button size="icon-sm" variant="secondary" aria-label="Zoom in" disabled={zoom === ZOOMS.at(-1)} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])}>
          <ZoomIn />
        </Button>
        <Button size="sm" variant="secondary" onClick={toggleFull} aria-pressed={full}>
          {full ? <Minimize /> : <Maximize />} {full ? "Exit full screen" : "Full screen"}
        </Button>
      </div>
      <div className={mini ? "h-full [&>*]:!h-full [&>*]:!w-full [&>*]:object-contain" : `overflow-auto rounded-lg ${full ? "min-h-0 flex-1" : "max-h-[75dvh]"}`}>
        <video ref={video} autoPlay playsInline muted {...surface} className={`${look} ${live === "video" ? "block" : "hidden"}`} />
        <canvas ref={canvas} {...surface} className={`${look} ${live === "pictures" && ready ? "block" : "hidden"}`} />
        {!ready && (
          <div className="grid aspect-video place-items-center rounded-lg border text-sm text-muted-foreground">
            <Loader2 className="animate-spin" />
          </div>
        )}
      </div>
      {control && (
        <div className="flex flex-wrap items-center gap-2">
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text) input({ action: "type", text });
              setText("");
            }}
          >
            <Input aria-label="Type on the computer" placeholder="Type text, then press Send" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" variant="outline">
              Send
            </Button>
          </form>
          {["Enter", "Backspace", "Tab", "Escape"].map((k) => (
            <Button key={k} size="sm" variant="outline" onClick={() => input({ action: "key", keys: k.toLowerCase() })}>
              {k}
            </Button>
          ))}
          <Button size="icon-sm" variant="outline" aria-label="Scroll up" onClick={() => input({ action: "scroll", amount: 3 })}>
            <ArrowUp />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Scroll down" onClick={() => input({ action: "scroll", amount: -3 })}>
            <ArrowDown />
          </Button>
        </div>
      )}
    </div>
  );
}

function RemoteTerminal({ client }: { client: RemoteClient }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let termId = "";
    let off = () => {};
    let dispose = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      const term = new Terminal({ fontSize: 13, convertEol: false, theme: { background: "#0b0d12" } });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(box.current!);
      fit.fit();
      dispose = () => term.dispose();
      try {
        const r = await client.call<{ termId: string }>("term.open", { cols: term.cols, rows: term.rows });
        termId = r.termId;
        off = client.listenTerminal(termId, (d) => term.write(d));
        term.onData((d) => client.call("term.write", { termId, data: d }).catch(() => {}));
      } catch (e) {
        term.write(`\r\n${e instanceof Error ? e.message : String(e)}\r\n`);
      }
    })();
    return () => {
      off();
      if (termId) client.call("term.close", { termId }).catch(() => {});
      dispose();
    };
  }, [client]);
  return <div ref={box} data-testid="remote-terminal" className="h-[60vh] overflow-hidden rounded-lg border bg-[#0b0d12] p-2" />;
}

function Files({ client }: { client: RemoteClient }) {
  const [listing, setListing] = useState<{ path: string; parent: string | null; entries: { name: string; dir: boolean; size?: number }[] }>();
  const [busy, setBusy] = useState(false);
  const open = (dir?: string) =>
    client
      .call<typeof listing>("files.list", { dir })
      .then(setListing)
      .catch((e: Error) => toast.error(e.message));
  useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load the home folder once per connection
  }, [client]);
  const download = async (name: string) => {
    setBusy(true);
    try {
      const f = await client.call<{ name: string; data: string }>("files.read", { path: `${listing!.path}/${name}` }, 120_000);
      const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([bytes]));
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {listing?.parent && (
          <Button size="sm" variant="ghost" onClick={() => open(listing.parent!)}>
            <ArrowLeft /> Up
          </Button>
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{listing?.path}</span>
        <Button size="sm" variant="outline" asChild disabled={busy}>
          <label>
            <Upload /> Upload here
            <input
              type="file"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f || !listing) return;
                if (f.size > 10 * 1024 * 1024) return toast.error("Files over 10 MB can't be sent yet.");
                const data = btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer())));
                client
                  .call("files.write", { dir: listing.path, name: f.name, data }, 120_000)
                  .then(() => (toast.success(`${f.name} saved on your computer.`), open(listing.path)))
                  .catch((err: Error) => toast.error(err.message));
              }}
            />
          </label>
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {listing?.entries.map((e) => (
          <li key={e.name}>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => (e.dir ? open(`${listing.path}/${e.name}`) : download(e.name))}>
              {e.dir ? <Folder className="size-4" /> : <FileIcon className="size-4" />}
              <span className="flex-1 truncate">{e.name}</span>
              {!e.dir && (
                <>
                  <span className="text-xs text-muted-foreground">{e.size !== undefined ? `${Math.max(1, Math.round(e.size / 1024))} KB` : ""}</span>
                  <Download className="size-4 text-muted-foreground" />
                </>
              )}
            </button>
          </li>
        ))}
        {listing && !listing.entries.length && <li className="p-3 text-sm text-muted-foreground">Empty folder.</li>}
      </ul>
    </div>
  );
}

function RemoteChat({ client, models }: { client: RemoteClient; models: string[] }) {
  const [model, setModel] = useState(models[0] ?? "");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  if (!models.length) return <p className="text-sm text-muted-foreground">This computer has no local AI models yet. On it, open Settings &gt; Local models and download one.</p>;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      // Listen before asking, so no words are missed.
      const reqId = await new Promise<string>((resolve, reject) => {
        const id = crypto.randomUUID();
        const off = client.listenChat(id, (c) => {
          if (c.delta) setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: m[m.length - 1].content + c.delta }]);
          if (c.error) toast.error(c.error);
          if (c.done) {
            off();
            setBusy(false);
          }
        });
        client.call("chat", { model, messages: next, reqId: id }, 30_000).then(() => resolve(id), reject);
      });
      void reqId;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3">
      <select aria-label="Model on your computer" className="h-9 w-fit rounded-lg border bg-transparent px-2 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
        {models.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      <div className="grid gap-2">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "user" ? "justify-self-end rounded-2xl bg-muted px-3 py-2 text-sm" : "text-sm whitespace-pre-wrap"}>
            {m.content || (busy && i === messages.length - 1 ? "…" : "")}
          </p>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <Input aria-label="Message your computer's model" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the model on your computer" />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
