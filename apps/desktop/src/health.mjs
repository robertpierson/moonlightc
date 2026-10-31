// Keeps MoonlightC answering while you're away: nothing may freeze it, and if something does, it heals itself.
// Everything that happens is written to app-health.log in the app's folder (no message content, no keys).
import { app } from "electron";
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
const shared = new SharedArrayBuffer(4);
const counter = new Int32Array(shared);

export function guard({ packaged, exe = process.execPath, after = 90_000 }) {
  // Electron's default for an unexpected error is a blocking error box: the whole app stops until someone at the PC
  // clicks OK. Log it and keep going instead.
  process.on("uncaughtException", (e) => log(`error: ${e?.stack ?? e}`));
  process.on("unhandledRejection", (e) => log(`unhandled: ${e?.stack ?? e}`));
  app.on("child-process-gone", (_e, d) => log(`helper gone: ${d.type} ${d.reason} (${d.exitCode})`));
  if (!packaged) return;
  setInterval(() => Atomics.add(counter, 0, 1), 2000);
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
