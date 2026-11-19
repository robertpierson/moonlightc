// PC storage: your other devices (same account, two-step sign-in) keep files in one folder on this PC, like a
// private cloud drive. Only the person at this PC can turn it on. MoonlightC only reads and writes bytes in that
// folder: it never opens or runs anything there, has no terminal, screen or other folders through it, sends deletes
// to the Recycle Bin, marks every file as downloaded from the internet (Windows warns before running one), and keeps
// a space limit. Every change is written to the remote-control activity log.
import { app, shell } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { allowed, audit } from "./remote.mjs";
import { cleanName, freeName, inside, PART, usedBytes } from "./storage-core.mjs";

const DIR = path.join(os.homedir(), "MoonlightC Storage");
const CONFIG = () => path.join(app.getPath("userData"), "storage.json");
// Room always left free on the drive, whatever the limit says.
const KEEP_FREE = 5 * 1024 ** 3;
const MAX_CHUNK = 256 * 1024;

const config = () => {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG(), "utf8"));
    return { on: c.on === true, maxGB: Number(c.maxGB) > 0 ? Number(c.maxGB) : 100 };
  } catch {
    return { on: false, maxGB: 100 };
  }
};
export const isOn = () => config().on;

const ensureDir = () => fs.mkdirSync(DIR, { recursive: true });
const freeDisk = () => {
  try {
    const s = fs.statfsSync(DIR);
    return s.bavail * s.bsize;
  } catch {
    return 0;
  }
};

// The folder's total size, counted at most every 15 seconds (counting a big folder takes a moment).
let usage = { at: 0, n: 0 };
const used = (fresh = false) => {
  if (fresh || Date.now() - usage.at > 15_000) usage = { at: Date.now(), n: usedBytes(DIR) };
  return usage.n;
};

let swept = false;
/** Leftovers from uploads that never finished (the app closed mid-way). */
function sweep() {
  if (swept) return;
  swept = true;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith(PART)) fs.rmSync(p, { force: true });
    }
  };
  try {
    walk(DIR);
  } catch {}
}

// ---------- For the person at this PC (Settings > PC storage) ----------
export function settings() {
  const c = config();
  if (c.on) {
    ensureDir();
    sweep();
  }
  return { ...c, dir: DIR, used: c.on ? used(true) : 0, free: c.on ? freeDisk() : 0 };
}
export function setSettings(next) {
  const c = { on: next?.on === true, maxGB: Math.min(100_000, Math.max(1, Math.round(Number(next?.maxGB) || 100))) };
  fs.writeFileSync(CONFIG(), JSON.stringify(c), { mode: 0o600 });
  audit(c.on ? "storage.on" : "storage.off", { maxGB: c.maxGB });
  return settings();
}
/** Show the folder in File Explorer (the folder itself; nothing inside is opened). */
export function openFolder() {
  ensureDir();
  return shell.openPath(DIR);
}

// ---------- For your other devices ----------
function need(clientId) {
  if (!isOn()) throw new Error("PC storage is off on this PC. Turn it on there in Settings > PC storage.");
  if (!allowed(clientId, "storage")) throw new Error("Not connected to this PC's storage. Open it again.");
  ensureDir();
}
const uploads = new Map(); // id -> { clientId, tmp, dir, name, size, got, fd }

export function list(clientId, rel) {
  need(clientId);
  const { real, rel: here } = inside(DIR, rel);
  if (!fs.statSync(real).isDirectory()) throw new Error("That's a file, not a folder.");
  const entries = [];
  for (const e of fs.readdirSync(real, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name.endsWith(PART) || entries.length >= 5000) continue;
    if (!e.isDirectory() && !e.isFile()) continue; // links and devices aren't shown
    let st;
    try {
      st = fs.statSync(path.join(real, e.name));
    } catch {
      continue;
    }
    entries.push({ name: e.name, dir: e.isDirectory(), size: e.isFile() ? st.size : undefined, at: st.mtimeMs });
  }
  const c = config();
  return { path: here, entries, used: used(), max: c.maxGB * 1024 ** 3, free: freeDisk() };
}

export function mkdir(clientId, rel, name) {
  need(clientId);
  const { real } = inside(DIR, [rel, cleanName(name)].filter(Boolean).join("/"));
  if (fs.existsSync(real)) throw new Error("Something with that name is already there.");
  fs.mkdirSync(real);
  audit("storage.folder", { clientId, path: real });
  return { ok: true };
}

export async function remove(clientId, rel) {
  need(clientId);
  const { real, base } = inside(DIR, rel);
  if (real === base) throw new Error("The storage folder itself can't be removed.");
  await shell.trashItem(real);
  audit("storage.recycle", { clientId, path: real });
  return { ok: true };
}

export function rename(clientId, rel, name) {
  need(clientId);
  const from = inside(DIR, rel);
  if (from.real === from.base) throw new Error("The storage folder itself can't be renamed.");
  const to = path.join(path.dirname(from.real), cleanName(name));
  inside(DIR, path.relative(from.base, to));
  if (fs.existsSync(to)) throw new Error("Something with that name is already there.");
  fs.renameSync(from.real, to);
  audit("storage.rename", { clientId, from: from.real, to });
  return { ok: true };
}

export function begin(clientId, rel, name, size) {
  need(clientId);
  const bytes = Number(size);
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Bad file size.");
  const { real: dir } = inside(DIR, rel);
  if (!fs.statSync(dir).isDirectory()) throw new Error("That folder is gone.");
  const clean = cleanName(name);
  const pending = [...uploads.values()].reduce((n, u) => n + u.size, 0);
  const c = config();
  if (used(true) + pending + bytes > c.maxGB * 1024 ** 3) throw new Error(`Not enough room: this PC's storage limit is ${c.maxGB} GB. Make room, or raise the limit on the PC.`);
  if (freeDisk() - pending - bytes < KEEP_FREE) throw new Error("The PC's drive is almost full.");
  const id = randomUUID();
  const tmp = path.join(dir, `${id}${PART}`);
  uploads.set(id, { clientId, tmp, dir, name: clean, size: bytes, got: 0, fd: fs.openSync(tmp, "w", 0o600) });
  return { id };
}

const upload = (clientId, id) => {
  const u = uploads.get(String(id));
  if (!u || u.clientId !== clientId) throw new Error("That upload isn't going any more. Send the file again.");
  return u;
};

export function write(clientId, id, offset, data) {
  need(clientId);
  const u = upload(clientId, id);
  const buf = Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data ?? []));
  const at = Number(offset);
  if (buf.length > MAX_CHUNK || !Number.isSafeInteger(at) || at < 0 || at + buf.length > u.size) throw new Error("Bad upload piece.");
  fs.writeSync(u.fd, buf, 0, buf.length, at);
  u.got += buf.length;
  return { got: u.got };
}

export function finish(clientId, id) {
  need(clientId);
  const u = upload(clientId, id);
  uploads.delete(String(id));
  fs.closeSync(u.fd);
  if (u.got !== u.size) {
    fs.rmSync(u.tmp, { force: true });
    throw new Error("Part of the file went missing on the way. Send it again.");
  }
  const name = freeName(u.dir, u.name);
  const final = path.join(u.dir, name);
  fs.renameSync(u.tmp, final);
  // "Downloaded from the internet": if someone double-clicks a program here, Windows warns first.
  if (process.platform === "win32") {
    try {
      fs.writeFileSync(`${final}:Zone.Identifier`, "[ZoneTransfer]\r\nZoneId=3\r\n");
    } catch {}
  }
  audit("storage.upload", { clientId, path: final, bytes: u.size });
  return { name };
}

export function cancel(clientId, id) {
  const u = uploads.get(String(id));
  if (!u || u.clientId !== clientId) return { ok: true };
  uploads.delete(String(id));
  try {
    fs.closeSync(u.fd);
  } catch {}
  fs.rmSync(u.tmp, { force: true });
  return { ok: true };
}
/** A device's session ended: drop its unfinished uploads. */
export function dropClients(alive) {
  for (const [id, u] of uploads) if (!alive.includes(u.clientId)) cancel(u.clientId, id);
}

export function stat(clientId, rel) {
  need(clientId);
  const { real } = inside(DIR, rel);
  const st = fs.statSync(real);
  if (!st.isFile()) throw new Error("That's a folder.");
  audit("storage.download", { clientId, path: real, bytes: st.size });
  return { name: path.basename(real), size: st.size };
}

export function read(clientId, rel, offset, length) {
  need(clientId);
  const { real } = inside(DIR, rel);
  const at = Number(offset);
  const len = Math.min(MAX_CHUNK, Math.max(0, Number(length) || 0));
  if (!Number.isSafeInteger(at) || at < 0) throw new Error("Bad download piece.");
  const fd = fs.openSync(real, "r");
  try {
    const buf = Buffer.alloc(len);
    const n = fs.readSync(fd, buf, 0, len, at);
    return new Uint8Array(buf.buffer, buf.byteOffset, n);
  } finally {
    fs.closeSync(fd);
  }
}
