// Remote control of this PC from your other devices (SPEC §8). Requests arrive through the app page, which listens on
// a private channel only the signed-in owner can join (with two-step sign-in). Everything that touches this PC runs
// here, and only after the person at this PC approved that device: native prompt, visible frame while connected,
// Ctrl+Alt+Shift+M ends it, 15 idle minutes end it, and every action is written to an audit log.
import { app, BrowserWindow, dialog, Notification, screen } from "electron";
import { execFile, exec as runShell } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { captureJpeg, hold, releaseAll, runAction, screenPixels } from "./computer.mjs";

const IDLE_MS = 15 * 60_000;
const MAX_FILE = 10 * 1024 * 1024;
export const TIERS = { view: "See the screen and hear its sound", control: "Use the mouse and keyboard", files: "Browse, download and upload files in your home folder", terminal: "Run commands in a terminal", chat: "Chat with the AI models on this PC" };
const INPUTS = new Set(["click", "double_click", "right_click", "move", "type", "key", "scroll", "key_down", "key_up", "mouse_down", "mouse_up", "move_by", "wheel"]);
const HOLDS = new Set(["key_down", "key_up", "mouse_down", "mouse_up", "move_by", "wheel"]);

const sessions = new Map(); // clientId -> { name, tiers, startedAt, timer }
let overlay;
let scale = 1;
// Windows' sign-in/lock screen: no app can see or type on it (Windows' own rule), so devices are told instead.
let locked = false;
export const setLocked = (v) => (locked = !!v);
export const status = () => ({ locked });
const listeners = new Set();
export const onState = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const state = () => [...sessions.entries()].map(([id, s]) => ({ clientId: id, name: s.name, tiers: s.tiers, startedAt: s.startedAt }));
const emit = () => listeners.forEach((fn) => fn(state()));

const file = (n) => path.join(app.getPath("userData"), n);
function audit(action, detail = {}) {
  fs.appendFileSync(file("remote-audit.jsonl"), JSON.stringify({ at: new Date().toISOString(), action, ...detail }) + "\n");
}
export function readAudit(limit = 200) {
  try {
    return fs.readFileSync(file("remote-audit.jsonl"), "utf8").trim().split("\n").slice(-limit).reverse().map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
export function grants() {
  try {
    return JSON.parse(fs.readFileSync(file("remote-grants.json"), "utf8"));
  } catch {
    return [];
  }
}
const saveGrants = (list) => fs.writeFileSync(file("remote-grants.json"), JSON.stringify(list), { mode: 0o600 });
export function revoke(clientId) {
  saveGrants(grants().filter((g) => g.clientId !== clientId));
  end(clientId, "access removed on this PC");
  audit("revoke", { clientId });
  return grants();
}

/** Stable id and name for this computer (the id is how your other devices find it). */
export function deviceInfo() {
  let id;
  try {
    id = JSON.parse(fs.readFileSync(file("device.json"), "utf8")).id;
  } catch {}
  if (!id) {
    id = crypto.randomUUID();
    fs.writeFileSync(file("device.json"), JSON.stringify({ id }));
  }
  // The wired network adapter's hardware address, for waking this PC from the router (Wake-on-LAN).
  const nics = Object.entries(os.networkInterfaces()).flatMap(([n, list]) => (list ?? []).filter((a) => !a.internal && a.mac !== "00:00:00:00:00:00").map((a) => ({ n, mac: a.mac })));
  const mac = (nics.find((x) => /ethernet|eth|en0/i.test(x.n)) ?? nics[0])?.mac;
  return { id, name: os.hostname().slice(0, 80), os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux", version: app.getVersion(), mac };
}

function showOverlay() {
  if (overlay) return overlay.webContents.executeJavaScript(`document.getElementById("who").textContent=${JSON.stringify(names())}`).catch(() => {});
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({ ...bounds, frame: false, transparent: true, alwaysOnTop: true, focusable: false, skipTaskbar: true, hasShadow: false, resizable: false, webPreferences: { sandbox: true } });
  overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.loadURL(
    "data:text/html;charset=utf-8," +
      encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;box-sizing:border-box;border:4px solid #f59e0b;background:transparent;font-family:system-ui">
<div style="position:fixed;top:0;left:50%;transform:translateX(-50%);background:#111827;color:#fde68a;padding:6px 14px;border-radius:0 0 10px 10px;font-size:13px">
Remote control: <span id="who">${names().replace(/[<>&]/g, "")}</span> connected · Ctrl+Alt+Shift+M to disconnect</div></body></html>`),
  );
}
const names = () => [...sessions.values()].map((s) => s.name).join(", ");

export function end(clientId, reason = "disconnected") {
  const ids = clientId ? [clientId] : [...sessions.keys()];
  for (const id of ids) {
    const s = sessions.get(id);
    if (!s) continue;
    clearTimeout(s.timer);
    sessions.delete(id);
    audit("end", { clientId: id, name: s.name, reason });
    releaseAll();
  }
  if (!watching()) {
    overlay?.destroy();
    overlay = undefined;
  } else showOverlay();
  emit();
}

// "Use this PC's AI models" only: no screen, files or keyboard, so no frame on screen and no idle cut-off.
const modelsOnly = (tiers) => tiers.every((t) => t === "chat" || t === "files" || t === "terminal");
const watching = () => [...sessions.values()].some((s) => !modelsOnly(s.tiers));

function touch(clientId) {
  const s = sessions.get(clientId);
  if (!s) return;
  clearTimeout(s.timer);
  if (modelsOnly(s.tiers)) return;
  s.timer = setTimeout(() => end(clientId, "idle for 15 minutes"), IDLE_MS);
}

function need(clientId, tier) {
  const s = sessions.get(clientId);
  if (!s) throw new Error("Not connected. Connect again from your other device.");
  if (!s.tiers.includes(tier)) throw new Error(`This device wasn't allowed to ${TIERS[tier].toLowerCase()}.`);
  touch(clientId);
}
export const allowed = (clientId, tier) => {
  try {
    need(clientId, tier);
    return true;
  } catch {
    return false;
  }
};

// "Trust my devices": skip the Allow prompt for this account's own devices (they already need two-step sign-in).
// Only the person at this PC can turn it on (it's not reachable from the remote channel).
export const trusted = () => {
  try {
    return JSON.parse(fs.readFileSync(file("remote-trust.json"), "utf8")).on === true;
  } catch {
    return false;
  }
};
export const setTrusted = (on) => (fs.writeFileSync(file("remote-trust.json"), JSON.stringify({ on: !!on }), { mode: 0o600 }), audit(on ? "trust.on" : "trust.off", {}), trusted());

// Automated tests of unpackaged builds can't click native dialogs; installed apps always ask a person.
const autoApprove = () => !app.isPackaged && process.env.MOONC_E2E_AUTO_APPROVE === "1";

// "Only allow remote control from certain places" (off by default): network addresses and/or countries.
// The other device brings a note signed by the MoonlightC website saying where it is; this PC checks it there.
const SITE = process.env.MOONC_SITE || "https://moonlightc.vercel.app";
export function places() {
  try {
    return { on: false, list: [], blocked: [], ...JSON.parse(fs.readFileSync(file("remote-places.json"), "utf8")) };
  } catch {
    return { on: false, list: [], blocked: [] };
  }
}
export function setPlaces(p) {
  const clean = {
    on: !!p?.on,
    list: (Array.isArray(p?.list) ? p.list : []).slice(0, 50).map((x) => ({ kind: x.kind === "country" ? "country" : "ip", value: String(x.value ?? "").trim().slice(0, 64), label: String(x.label ?? "").slice(0, 60) })).filter((x) => x.value),
    blocked: (Array.isArray(p?.blocked) ? p.blocked : places().blocked).slice(0, 20),
  };
  fs.writeFileSync(file("remote-places.json"), JSON.stringify(clean), { mode: 0o600 });
  audit("places", { on: clean.on, count: clean.list.length });
  return clean;
}
const matches = (place, w) =>
  place.kind === "country" ? place.value.toUpperCase() === String(w.country).toUpperCase() : place.value.endsWith("*") ? String(w.ip).startsWith(place.value.slice(0, -1)) : place.value === w.ip;
async function fromAllowedPlace(where) {
  const p = places();
  if (!p.on) return true;
  const ok = await fetch(`${SITE}/api/attest/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(where ?? {}) })
    .then((r) => r.json())
    .then((d) => d.ok === true)
    .catch(() => false);
  if (ok && p.list.some((x) => matches(x, where))) return true;
  const seen = { ip: String(where?.ip ?? "unknown"), country: String(where?.country ?? ""), city: String(where?.city ?? ""), at: new Date().toISOString(), verified: ok };
  setPlaces({ ...p, blocked: [seen, ...p.blocked.filter((b) => b.ip !== seen.ip)] });
  return false;
}

/** A device asks to connect. Remembered devices skip the prompt for the access they already have. */
export async function connect(parent, client, wanted, where) {
  const id = String(client?.id ?? "").slice(0, 64);
  const name = String(client?.name ?? "Another device").slice(0, 60);
  const tiers = [...new Set((Array.isArray(wanted) ? wanted : []).filter((t) => t in TIERS))];
  if (!id || !tiers.length) throw new Error("Nothing to allow.");
  // Seeing or controlling the screen: only from allowed places, when that setting is on.
  if (tiers.some((t) => t === "view" || t === "control") && !(await fromAllowedPlace(where))) {
    audit("deny.place", { clientId: id, name, ip: where?.ip, country: where?.country });
    return { allowed: false, reason: "Remote control isn't allowed from this place. On the PC, open Settings > Remote control to allow it." };
  }
  const remembered = grants().find((g) => g.clientId === id);
  // Your own devices (same account, two-step sign-in, checked by the server) may use this PC's AI models, and let
  // the AI work in your home folder (each change and command is approved on that device), without asking here.
  // Seeing or controlling the screen still asks.
  let ok = (!!remembered && tiers.every((t) => remembered.tiers.includes(t))) || trusted() || modelsOnly(tiers);
  if (ok && !remembered) audit(modelsOnly(tiers) ? "approve.models" : "approve.trusted", { clientId: id, name, tiers });
  if (!ok) {
    const r = autoApprove()
      ? { response: 0, checkboxChecked: false }
      : await dialog.showMessageBox(parent, {
          type: "warning",
          buttons: ["Allow", "Don't allow"],
          defaultId: 1,
          cancelId: 1,
          title: "Remote control request",
          message: `Allow "${name}" to control this PC?`,
          detail: `It's asking to:\n${tiers.map((t) => `• ${TIERS[t]}`).join("\n")}\n\nAn orange frame shows while it's connected. Press Ctrl+Alt+Shift+M at any time to disconnect. It disconnects by itself after 15 idle minutes.`,
          checkboxLabel: "Remember this device (you can remove it in Settings > Remote control)",
        });
    ok = r.response === 0;
    audit(ok ? "approve" : "deny", { clientId: id, name, tiers });
    if (ok && r.checkboxChecked) saveGrants([...grants().filter((g) => g.clientId !== id), { clientId: id, name, tiers, at: new Date().toISOString() }]);
  }
  if (!ok) return { allowed: false };
  const prev = sessions.get(id);
  if (prev) clearTimeout(prev.timer);
  sessions.set(id, { name, tiers, startedAt: Date.now() });
  touch(id);
  audit("connect", { clientId: id, name, tiers });
  if (!modelsOnly(tiers)) {
    showOverlay();
    new Notification({ title: "Remote control", body: `${name} is connected. Ctrl+Alt+Shift+M disconnects.` }).show();
  }
  emit();
  return { allowed: true, tiers };
}

export async function frame(clientId) {
  need(clientId, "view");
  // Realtime messages have a size cap; busy screens get a smaller, softer frame instead of not arriving at all.
  let f = await captureJpeg(860, 45);
  if (f.image.length > 160_000) f = await captureJpeg(760, 35);
  if (f.image.length > 160_000) f = await captureJpeg(720, 30);
  scale = f.scale;
  return { image: f.image, width: f.width, height: f.height };
}

export async function input(clientId, a) {
  need(clientId, "control");
  if (!a || !INPUTS.has(a.action)) throw new Error("Unknown action.");
  // Game mode sends many small events; they skip the activity log (one "game input" entry per session would be noise).
  if (HOLDS.has(a.action)) return (hold(a), { ok: true });
  // Positions can come as fractions of the screen (0-1), which works at any size the other device shows it.
  const frac = (v) => typeof v === "number" && v >= 0 && v <= 1;
  if (frac(a.nx) && frac(a.ny)) {
    const s = screenPixels();
    a = { ...a, x: Math.round(a.nx * (s.width - 1)), y: Math.round(a.ny * (s.height - 1)) };
    audit("input", { clientId, action: a.action, x: a.x, y: a.y, keys: a.keys, chars: a.text ? String(a.text).length : undefined });
    if (a.action === "scroll") await runAction({ action: "move", x: a.x, y: a.y }, 1);
    await runAction(a, 1);
    return { ok: true };
  }
  audit("input", { clientId, action: a.action, x: a.x, y: a.y, keys: a.keys, chars: a.text ? String(a.text).length : undefined });
  await runAction(a, scale);
  return { ok: true };
}

// Live video of the screen: the app may open one screen stream within a few seconds of a device with "see the
// screen" asking for it. Nothing else can start a capture.
let streamGrant = 0;
export function allowStream(clientId) {
  need(clientId, "view");
  streamGrant = Date.now();
  audit("stream", { clientId });
  return true;
}
export const takeStreamGrant = () => {
  const ok = Date.now() - streamGrant < 10_000 && [...sessions.values()].some((s) => s.tiers.includes("view"));
  streamGrant = 0;
  return ok;
};

// Files: only inside the home folder (links included, resolved before checking).
function inHome(p) {
  const home = fs.realpathSync.native(os.homedir());
  const abs = path.resolve(home, String(p ?? ""));
  let real = abs;
  try {
    real = fs.realpathSync.native(abs);
  } catch {
    real = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs));
  }
  const rel = path.relative(home, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Only files in your home folder are available.");
  return { real, home };
}
export function list(clientId, dir) {
  need(clientId, "files");
  const { real, home } = inHome(dir || ".");
  audit("files.list", { clientId, path: real });
  const entries = fs.readdirSync(real, { withFileTypes: true }).filter((e) => !e.name.startsWith(".")).slice(0, 1000);
  return {
    path: real,
    parent: real === home ? null : path.dirname(real),
    entries: entries.map((e) => {
      let size;
      try {
        size = e.isFile() ? fs.statSync(path.join(real, e.name)).size : undefined;
      } catch {}
      return { name: e.name, dir: e.isDirectory(), size };
    }),
  };
}
export function read(clientId, p) {
  need(clientId, "files");
  const { real } = inHome(p);
  const st = fs.statSync(real);
  if (!st.isFile()) throw new Error("That's a folder.");
  if (st.size > MAX_FILE) throw new Error("Files over 10 MB can't be downloaded remotely yet.");
  audit("files.download", { clientId, path: real });
  return { name: path.basename(real), data: fs.readFileSync(real).toString("base64") };
}
export function write(clientId, dir, name, data) {
  need(clientId, "files");
  const clean = String(name ?? "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 200);
  if (!clean) throw new Error("Pick a file name.");
  const buf = Buffer.from(String(data ?? ""), "base64");
  if (buf.length > MAX_FILE) throw new Error("Files over 10 MB can't be uploaded remotely yet.");
  const { real } = inHome(path.join(String(dir || "."), clean));
  fs.writeFileSync(real, buf);
  audit("files.upload", { clientId, path: real, bytes: buf.length });
  return { saved: real };
}

/** Lock, sleep, restart or shut down this PC (needs "use the mouse and keyboard"). Restart and shut down wait 30
 * seconds, so someone at the PC can cancel with "shutdown /a". */
export function power(clientId, what) {
  need(clientId, "control");
  if (process.platform !== "win32") throw new Error("Power controls work on Windows PCs.");
  const name = sessions.get(clientId)?.name ?? "another device";
  const note = `MoonlightC: ${name} asked for this. To cancel, run: shutdown /a`;
  const cmds = {
    lock: ["rundll32.exe", ["user32.dll,LockWorkStation"]],
    sleep: ["powershell.exe", ["-NoProfile", "-Command", "Start-Sleep 2; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"]],
    // /g: with "sign in by itself" (or Windows' restart sign-in) on, Windows signs back in after the restart.
    restart: ["shutdown.exe", ["/g", "/t", "30", "/c", note]],
    shutdown: ["shutdown.exe", ["/s", "/t", "30", "/c", note]],
  };
  const c = cmds[what];
  if (!c) throw new Error("Unknown power action.");
  audit("power", { clientId, name, what });
  execFile(c[0], c[1], { windowsHide: true }, () => {});
  return { ok: true };
}

/** Run one command (the AI on your other device asked, and you approved it there). Output is capped. */
export function exec(clientId, command, cwd) {
  need(clientId, "terminal");
  const cmd = String(command ?? "").slice(0, 2000);
  if (!cmd.trim()) throw new Error("No command.");
  const dir = cwd ? inHome(cwd).real : fs.realpathSync.native(os.homedir());
  audit("exec", { clientId, command: cmd.slice(0, 200), cwd: dir });
  return new Promise((resolve) => {
    runShell(cmd, { cwd: dir, timeout: 120_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const cap = (t) => (t.length > 20_000 ? `${t.slice(0, 10_000)}\n…\n${t.slice(-10_000)}` : t);
      resolve({ exitCode: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: cap(String(stdout)), stderr: cap(String(stderr)), timedOut: !!err?.killed });
    });
  });
}
