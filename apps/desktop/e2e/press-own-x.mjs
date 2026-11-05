// Runs on CI only (it moves the mouse). A press on the app's own X, with the release coming through the main thread,
// exactly as a remote device does it. LET_GO=1: the watchdog thread frees it. LET_GO=0: no help, to show the freeze.
import robot from "@jitsi/robotjs";
import { app, BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";

const out = process.env.OUT;
const help = process.env.LET_GO === "1";
app.setPath("userData", out);
const health = await import("../src/health.mjs");
const result = { help, closed: false, longestStallMs: 0 };
const save = () => fs.writeFileSync(path.join(out, "result.json"), JSON.stringify(result));

app.whenReady().then(async () => {
  // Only the worker's "restart" command would use this; nothing here should start a second Electron.
  health.guard({ packaged: true, exe: "C:\\Windows\\System32\\whoami.exe", after: 25_000 });
  const win = new BrowserWindow({ width: 800, height: 500, alwaysOnTop: true });
  await win.loadURL("data:text/html,<h1>press test</h1>");
  win.show();
  win.focus();
  await new Promise((r) => setTimeout(r, 2000));

  let last = Date.now();
  setInterval(() => {
    result.longestStallMs = Math.max(result.longestStallMs, Date.now() - last);
    last = Date.now();
    save();
  }, 100);
  win.on("close", (e) => {
    e.preventDefault();
    result.closed = true;
    save();
    setTimeout(() => app.exit(0), 1000);
  });

  const b = win.getBounds();
  robot.moveMouse(b.x + b.width - 22, b.y + 15);
  if (help) health.setHeld(true);
  robot.mouseToggle("down", "left");
  setTimeout(() => {
    robot.mouseToggle("up", "left");
    result.remoteReleaseRan = true;
    save();
  }, 200);
  setTimeout(() => app.exit(0), 40_000);
});
