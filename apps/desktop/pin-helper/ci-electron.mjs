// CI only, at normal rights: the box's code inside real Electron with the watchdog thread running, as in the installed app.
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const out = process.env.OUT;
app.setPath("userData", out);
const health = await import("../src/health.mjs");
const box = await import("../src/credential-box.mjs");
app.whenReady().then(async () => {
  health.guard({ packaged: true, exe: "C:\\Windows\\System32\\whoami.exe", after: 25_000 });
  await new Promise((r) => setTimeout(r, 3000)); // the watchdog has loaded its own copy by now
  const result = { inFront: box.boxInFront() };
  const position = () => ({ x: 0, y: 0 });
  result.typed = await box.sendToBox({ action: "type", text: "electronuser" }, position);
  result.enter = await box.sendToBox({ action: "key", keys: "enter" }, position);
  box.closeBox();
  await new Promise((r) => setTimeout(r, 500));
  fs.writeFileSync(path.join(out, "electron.json"), JSON.stringify(result));
  app.exit(0);
});
