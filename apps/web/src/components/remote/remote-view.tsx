"use client";

import "@xterm/xterm/css/xterm.css";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileIcon, Folder, Loader2, Maximize, Minimize, Monitor, Power, Gamepad2, Upload, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TwoStepGate } from "@/components/account/two-step-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { gathered, hifiAudio, iceServers, isOnline, whereAmI, joinChannel, leaveChannel, RemoteClient, subscribed, TIER_LABELS, type Tier } from "@/lib/remote";
import { desktop } from "@/lib/desktop";
import { useDevices } from "./your-computers";

type Tab = "screen" | "terminal" | "files";
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
      setTab(r.tiers?.includes("view") ? "screen" : r.tiers?.includes("terminal") ? "terminal" : "files");
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
          {client && tiers.includes("control") && <PowerMenu client={client} />}
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
const SHORTCUTS = [
  ["Close window (Alt+F4)", "alt+f4"],
  ["Switch window (Alt+Tab)", "alt+tab"],
  ["Task Manager (Ctrl+Shift+Esc)", "control+shift+escape"],
  ["Show desktop (Win+D)", "command+d"],
  ["Start menu (Win)", "command"],
  ["Close tab (Ctrl+W)", "control+w"],
] as const;
const MODS: Record<string, string> = { Shift: "shift", Control: "control", Alt: "alt" };
const KEYS: Record<string, string> = { Enter: "enter", Backspace: "backspace", Tab: "tab", Escape: "escape", Delete: "delete", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Home: "home", End: "end", PageUp: "pageup", PageDown: "pagedown" };

function Screen({ client, control, mini }: { client: RemoteClient; control: boolean; mini?: boolean }) {
  const [live, setLive] = useState<Live>("connecting");
  const [why, setWhy] = useState("");
  const [rtcTry, setRtcTry] = useState(0);
  const heldMods = useRef(new Set<string>());
  // Copy and paste between this device and the PC (text).
  const pasteToPc = async () => {
    const text = await navigator.clipboard.readText().catch(() => undefined);
    if (text === undefined) return toast.error("Allow clipboard access to paste on the PC.");
    await client.call("clipboard.set", { text }).catch((e: Error) => toast.error(e.message));
    input({ action: "key", keys: "control+v" });
  };
  const copyFromPc = async (quiet = false) => {
    const r = await client.call<{ text: string }>("clipboard.get").catch(() => undefined);
    if (!r) return;
    await navigator.clipboard.writeText(r.text).then(
      () => !quiet && toast.success("Copied from the PC."),
      () => !quiet && toast.error("Allow clipboard access to copy here."),
    );
  };
  // Windows' sign-in/lock screen can't be seen or typed on by any app; say so instead of showing a frozen picture.
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const check = () => client.call<{ locked: boolean }>("status").then((r) => setLocked(!!r.locked)).catch(() => {});
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [client]);
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

  // Live video straight from the PC (smooth). If that fails, once more the simplest way (no sound, default video
  // format); only then pictures.
  useEffect(() => {
    let pc: RTCPeerConnection | undefined;
    let done = false;
    const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    const start = async (simple: boolean) => {
      pc?.close();
      pc = new RTCPeerConnection({ iceServers: await iceServers() });
      const vt = pc.addTransceiver("video", { direction: "recvonly" });
      // H.264 first: most PCs make it on the graphics chip, so streaming barely uses the PC's processor.
      const codecs = RTCRtpReceiver.getCapabilities?.("video")?.codecs ?? [];
      const h264 = codecs.filter((c) => c.mimeType === "video/H264");
      if (!simple && h264.length && vt.setCodecPreferences) vt.setCodecPreferences([...h264, ...codecs.filter((c) => c.mimeType !== "video/H264")]);
      if (!simple) pc.addTransceiver("audio", { direction: "recvonly" });
      dc.current = pc.createDataChannel("input");
      moves.current = pc.createDataChannel("moves", { ordered: false, maxRetransmits: 0 });
      const conn = pc;
      conn.addEventListener("track", (e) => e.track.kind === "audio" && setHasAudio(true));
      const track = new Promise<MediaStream>((resolve) => conn.addEventListener("track", (e) => e.track.kind === "video" && resolve(e.streams[0] ?? new MediaStream([e.track]))));
      const offer = await conn.createOffer();
      await conn.setLocalDescription({ type: "offer", sdp: simple ? offer.sdp : hifiAudio(offer.sdp) });
      await gathered(conn);
      const r = await client.call<{ sdp: string }>("rtc.offer", { sdp: conn.localDescription?.sdp, noAudio: simple }, 30_000);
      await conn.setRemoteDescription({ type: "answer", sdp: r.sdp });
      // Show frames as soon as they arrive (no extra buffering), for the lowest delay.
      conn.getReceivers().forEach((rc) => {
        (rc as RTCRtpReceiver & { jitterBufferTarget?: number | null; playoutDelayHint?: number }).jitterBufferTarget = 0;
        (rc as RTCRtpReceiver & { playoutDelayHint?: number }).playoutDelayHint = 0;
      });
      const v = video.current!;
      v.srcObject = await Promise.race([track, timeout(10_000)]);
      await Promise.race([new Promise((resolve) => v.addEventListener("loadeddata", resolve, { once: true })), timeout(10_000)]);
    };
    const why = (e: unknown) => `${e instanceof Error ? e.message : String(e)} (${pc?.connectionState ?? "no connection"}, ice ${pc?.iceConnectionState ?? "-"})`;
    (async () => {
      let first = "";
      for (const simple of [false, true]) {
        try {
          await start(simple);
          if (done) return;
          setLive("video");
          setReady(true);
          // Dropped (Wi-Fi blip, new network): connect live video again by itself a few times, then pictures.
          pc!.addEventListener("connectionstatechange", () => {
            if (done || pc?.connectionState !== "failed") return;
            if (rtcTry < 3) setTimeout(() => !done && setRtcTry((n) => n + 1), 1500);
            else setLive("pictures");
          });
          return;
        } catch (e) {
          client.call("rtc.stop").catch(() => {});
          // Say (and log on the PC) why, so a failure that isn't the network can be fixed.
          const w = why(e);
          client.call("note", { text: `live video ${simple ? "retry" : "first try"} failed on the viewer: ${w}` }).catch(() => {});
          if (!simple) first = w;
          if (done) return;
          if (simple) {
            pc?.close();
            setWhy(first === w ? w : `${first}; then ${w}`);
            setLive("pictures");
          }
        }
      }
    })();
    return () => {
      done = true;
      pc?.close();
      client.call("rtc.stop").catch(() => {});
    };
  }, [client, rtcTry]);

  // Pictures (networks that block live video): sized to this screen, and when zoomed in only the part you can see is
  // sent, at full detail, so small text stays readable. Two requests in flight; each picture is drawn once loaded.
  useEffect(() => {
    if (live !== "pictures") return;
    let on = true;
    let old = false; // a PC on an older MoonlightC only has whole-screen pictures
    let full = { w: 16, h: 9 };
    let seq = 0;
    let drawn = 0;
    let fails = 0;
    const one = async () => {
      while (on) {
        const c = canvas.current;
        try {
          if (!c) throw new Error("not ready");
          if (old) {
            const f = await client.call<{ image: string; width: number; height: number }>("frame");
            const img = new Image();
            img.src = `data:image/jpeg;base64,${f.image}`;
            await img.decode();
            if (!on) break;
            if (c.width !== f.width || c.height !== f.height) [c.width, c.height] = [f.width, f.height];
            c.getContext("2d")?.drawImage(img, 0, 0);
            setReady(true);
            continue;
          }
          const dpr = Math.min(devicePixelRatio || 1, 2);
          const r = c.getBoundingClientRect();
          const W = Math.max(320, Math.min(3840, Math.round((r.width || 960) * dpr)));
          const H = Math.round((W * full.h) / full.w);
          if (c.width !== W || c.height !== H) [c.width, c.height] = [W, H];
          // The visible part of the (possibly zoomed) screen, as fractions.
          const v = c.parentElement?.getBoundingClientRect() ?? r;
          const x0 = Math.max(r.left, v.left, 0), x1 = Math.min(r.right, v.right, innerWidth);
          const y0 = Math.max(r.top, v.top, 0), y1 = Math.min(r.bottom, v.bottom, innerHeight);
          const rw = r.width || 1, rh = r.height || 1;
          const crop = x1 > x0 && y1 > y0 ? { x: (x0 - r.left) / rw, y: (y0 - r.top) / rh, w: (x1 - x0) / rw, h: (y1 - y0) / rh } : { x: 0, y: 0, w: 1, h: 1 };
          const mine = ++seq;
          const f = await client.call<{ url: string; fullW: number; fullH: number }>("shot", { crop, maxW: Math.round(crop.w * W), q: 0.72 }, 20_000);
          const img = new Image();
          img.src = f.url;
          await img.decode();
          if (!on) break;
          if (f.fullW && f.fullH && (f.fullW !== full.w || f.fullH !== full.h)) full = { w: f.fullW, h: f.fullH };
          if (mine < drawn) continue; // a newer picture is already on screen
          drawn = mine;
          fails = 0;
          if (c.height !== Math.round((c.width * full.h) / full.w)) continue; // size changed; next one fits
          c.getContext("2d")?.drawImage(img, crop.x * c.width, crop.y * c.height, crop.w * c.width, crop.h * c.height);
          setReady(true);
        } catch (e) {
          if (!on) break;
          const msg = e instanceof Error ? e.message : String(e);
          // An older PC app, or the quick capture isn't available there: whole-screen pictures instead.
          if (!old && (/Unknown request/i.test(msg) || ++fails >= 2)) {
            old = true;
            continue;
          }
          if (msg !== "not ready") toast.error(msg);
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    };
    one();
    setTimeout(one, 150);
    return () => {
      on = false;
    };
  }, [live, client]);

  const input = (a: Record<string, unknown>) => {
    if ((a.action === "move_by" || a.action === "move") && moves.current?.readyState === "open") return void moves.current.send(JSON.stringify(a));
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
  const touch = useRef<{ timer?: ReturnType<typeof setTimeout>; held?: boolean; x?: number; y?: number; scrollY?: number; last?: number }>({});
  // A mouse (not a finger): hovering moves the PC's pointer; press, move, release drags; the PC itself sees clicks
  // and double-clicks from the presses. Moves are sent at most once a frame.
  const fromFinger = () => Date.now() - (touch.current.last ?? 0) < 1000;
  const pointer = useRef<{ raf?: number; at?: { nx: number; ny: number }; down?: boolean }>({});
  const moveTo = (p: { nx: number; ny: number }) => {
    pointer.current.at = p;
    if (pointer.current.raf) return;
    pointer.current.raf = requestAnimationFrame(() => {
      pointer.current.raf = undefined;
      if (pointer.current.at) input({ action: "move", ...pointer.current.at });
    });
  };
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
      t.last = Date.now();
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
    // Fingers: a tap is a click (a mouse uses the press and release below).
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (!control) return;
      if (touch.current.held) return void (touch.current.held = false);
      if (game) return capture(e.currentTarget);
      e.currentTarget.focus();
      if (fromFinger()) input({ action: "click", ...at(e) });
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (control && !game && !fromFinger()) moveTo(at(e));
    },
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      if (!control || game || fromFinger() || e.button !== 0) return;
      e.currentTarget.focus();
      pointer.current.down = true;
      input({ action: "mouse_down", ...at(e) });
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (!pointer.current.down || e.button !== 0) return;
      pointer.current.down = false;
      input({ action: "mouse_up", ...at(e) });
    },
    // Letting go outside the picture still lets go on the PC (nothing stays held).
    onMouseLeave: (e: React.MouseEvent) => {
      if (!pointer.current.down) return;
      pointer.current.down = false;
      input({ action: "mouse_up", ...at(e) });
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
      // Shift, Ctrl and Alt are held down on the PC while you hold them (Shift+click, selecting with Shift, etc.).
      // Ctrl+V pastes what this device copied; Ctrl+C on the PC also lands on this device.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        return void pasteToPc();
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "c" || e.key === "C" || e.key === "x" || e.key === "X")) {
        e.preventDefault();
        input({ action: "key", keys: `control+${e.key.toLowerCase()}` });
        return void setTimeout(() => copyFromPc(true), 350);
      }
      const mod = MODS[e.key];
      if (mod) {
        e.preventDefault();
        if (!e.repeat && !heldMods.current.has(mod)) {
          heldMods.current.add(mod);
          input({ action: "key_down", key: mod });
        }
        return;
      }
      const mods = [e.ctrlKey && "control", e.altKey && "alt", e.shiftKey && e.key.length > 1 && "shift"].filter(Boolean) as string[];
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) input({ action: "type", text: e.key });
      else if (KEYS[e.key] || (e.key.length === 1 && (e.ctrlKey || e.altKey))) input({ action: "key", keys: [...mods, KEYS[e.key] ?? e.key.toLowerCase()].join("+") });
      else return;
      e.preventDefault();
    },
    onKeyUp: (e: React.KeyboardEvent) => {
      const mod = MODS[e.key];
      if (!mod || !heldMods.current.delete(mod)) return;
      e.preventDefault();
      input({ action: "key_up", key: mod });
    },
    // Leaving the screen lets go of any held Shift/Ctrl/Alt, so none gets stuck on the PC.
    onBlur: () => {
      for (const m of heldMods.current) input({ action: "key_up", key: m });
      heldMods.current.clear();
    },
  };

  return (
    <div ref={box} className={mini ? "h-full bg-black" : full ? "fixed inset-0 z-50 flex flex-col gap-2 bg-black p-2" : "grid gap-2"}>
      {locked && !mini && (
        <p role="alert" className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          Your PC is on the Windows sign-in or lock screen. Windows doesn&apos;t let any app type there, so someone at the PC has to sign in. If &quot;Sign in to Windows by itself&quot; is set up on the PC, Power &gt; Restart brings it back by itself.
        </p>
      )}
      <div className={mini ? "hidden" : "flex flex-wrap items-center gap-2"}>
        <span className="text-xs text-muted-foreground" role="status">
          {live === "video" ? "Live video" : live === "pictures" ? `Pictures (live video didn't start${why ? `: ${why}` : ""})` : "Connecting…"}
          {live === "pictures" && (
            <button
              className="ml-2 underline"
              onClick={() => {
                setLive("connecting");
                setRtcTry((n) => (n >= 3 ? 0 : n) + 1);
              }}
            >
              Try live video again
            </button>
          )}
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
          {/* Keys a Chromebook or phone can't send (or keeps for itself). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Shortcuts
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void pasteToPc()}>Paste from this device</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyFromPc()}>Copy the PC&apos;s clipboard here</DropdownMenuItem>
              {SHORTCUTS.map(([label, keys]) => (
                <DropdownMenuItem key={keys} onSelect={() => input({ action: "key", keys })}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

const POWER = [
  ["sleep", "Sleep", "Put this PC to sleep? You can't wake it from here unless Wake-on-LAN or a smart plug is set up (Settings > Remote control on the PC)."],
  ["restart", "Restart", "Restart this PC in 30 seconds? After it restarts, someone has to sign in to Windows before MoonlightC is back."],
  ["shutdown", "Shut down", "Shut down this PC in 30 seconds? You can't turn it back on from here unless Wake-on-LAN or a smart plug is set up."],
] as const;

/** Lock, sleep, restart or shut down the PC (asks first; restart and shut down can be cancelled on the PC). */
function PowerMenu({ client }: { client: RemoteClient }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary">
          <Power /> Power
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {POWER.map(([what, label, ask]) => (
          <DropdownMenuItem
            key={what}
            onSelect={() => {
              if (!confirm(ask)) return;
              client
                .call("power", { what })
                .then(() => toast.success(what === "sleep" ? "Going to sleep." : `${label} in 30 seconds.`))
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
