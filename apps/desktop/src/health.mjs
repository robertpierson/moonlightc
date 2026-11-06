// Keeps MoonlightC answering while you're away: nothing may freeze it, and if something does, it heals itself.
// Everything that happens is written to app-health.log in the app's folder (no message content, no keys).
import { app } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const logFile = () => path.join(app.getPath("userData"), "app-health.log");

export function log(what) {
  try {
    const f = logFile();
    if (fs.existsSync(f) && fs.statSync(f).size > 1_000_000) fs.renameSync(f, f + ".old");
    fs.appendFileSync(f, `${new Date().toISOString()} ${String(what).slice(0, 500)}\n`);
  } catch {
    // Logging must never be the thing that breaks.
  }
}

// The main thread ticks this counter; a watchdog thread reads it, which works even while the main thread is frozen.
const shared = new SharedArrayBuffer(8);
const counter = new Int32Array(shared);
/** A remote device is holding a mouse button down (the watchdog thread lets go if the main thread gets stuck on it). */
export const setHeld = (on) => Atomics.store(counter, 1, on ? 1 : 0);

export function guard({ packaged, exe = process.execPath, after = 90_000 }) {
  // Electron's default for an unexpected error is a blocking error box: the whole app stops until someone at the PC
  // clicks OK. Log it and keep going instead.
  process.on("uncaughtException", (e) => log(`error: ${e?.stack ?? e}`));
  process.on("unhandledRejection", (e) => log(`unhandled: ${/** @type {Error} */ (e)?.stack ?? e}`));
  app.on("child-process-gone", (_e, d) => log(`helper gone: ${d.type} ${d.reason} (${d.exitCode})`));
  if (!packaged) return;
  setInterval(() => Atomics.add(counter, 0, 1), 1000);
  // If the main part of the app stops answering for 90 seconds, end this copy from outside (it can't end itself while
  // frozen) and start a fresh one in the tray.
  // Packaged, the file is unpacked next to app.asar (see asarUnpack): threads can't start from inside the archive.
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "watchdog.cjs").replace("app.asar" + path.sep, "app.asar.unpacked" + path.sep);
  new Worker(script, { workerData: { shared, log: logFile(), exe, after, pid: process.pid } }).unref();
}

/** The window's page (where remote control is answered): reload it if it crashes or hangs for 30 seconds. */
export function watchWindow(win) {
  let hung;
  const wc = win.webContents;
  wc.on("render-process-gone", (_e, d) => {
    log(`page gone: ${d.reason} (${d.exitCode}); reloading`);
    if (d.reason !== "clean-exit") setTimeout(() => !win.isDestroyed() && wc.reload(), 1000);
  });
  wc.on("unresponsive", () => {
    log("page not responding");
    clearTimeout(hung);
    hung = setTimeout(() => {
      if (win.isDestroyed()) return;
      log("page hung for 30 s; restarting it");
      wc.forcefullyCrashRenderer();
      setTimeout(() => !win.isDestroyed() && wc.reload(), 1000);
    }, 30_000);
  });
  wc.on("responsive", () => clearTimeout(hung));
}

// "Always on" (Settings > General, off by default): if MoonlightC is closed, for any reason, it comes back. A small
// hidden helper waits for this copy to end and starts a new one. Windows' process service (WMI) starts the helper, or
// it would end together with the app. Turning the setting off, an update or a Windows shutdown stops the comeback.
const keepFile = () => path.join(app.getPath("userData"), "keep-running.json");
const readKeep = () => {
  try {
    return JSON.parse(fs.readFileSync(keepFile(), "utf8"));
  } catch {
    return {};
  }
};
const writeKeep = (k) => fs.writeFileSync(keepFile(), JSON.stringify(k));
export const keepRunning = () => readKeep().on === true;

let helper = false;
export function startKeeper(exe = process.execPath) {
  if (helper || !keepRunning()) return;
  helper = true;
  const enc = (cmd) => Buffer.from(cmd, "utf16le").toString("base64");
  const quote = (s) => `'${s.replace(/'/g, "''")}'`;
  const wait = [
    `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue`,
    "Start-Sleep 3",
    // Never in the middle of an install.
    "while (Get-Process -Name 'MoonlightC-Setup*','Un_A','Au_' -ErrorAction SilentlyContinue) { Start-Sleep 3 }",
    `$k = Get-Content -Raw -LiteralPath ${quote(keepFile())} | ConvertFrom-Json`,
    `if ($k.on -and -not $k.skip) { Start-Process -FilePath ${quote(exe)} -ArgumentList '--hidden' }`,
  ].join("; ");
  const line = `powershell.exe -NoProfile -WindowStyle Hidden -EncodedCommand ${enc(wait)}`;
  const launch = `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${line}'; ProcessStartupInformation = $si } | Out-Null`;
  const ps = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-EncodedCommand", enc(launch)], { stdio: "ignore", windowsHide: true });
  ps.on("error", (e) => {
    helper = false;
    log(`always on helper failed: ${e.message}`);
  });
}

/** Called once at startup: this copy is running, so the "don't come back" from an update or shutdown is used up. */
export function keeperReady(exe) {
  const k = readKeep();
  if (k.skip) writeKeep({ on: k.on === true });
  startKeeper(exe);
}
export function setKeepRunning(on, exe) {
  writeKeep({ on: !!on });
  startKeeper(exe);
  return keepRunning();
}
/** This close is meant to stick (an update, or Windows shutting down). */
export const skipKeeper = () => writeKeep({ on: keepRunning(), skip: true });
