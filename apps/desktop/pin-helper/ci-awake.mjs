// CI only: turns "Keep this PC awake" on for 10 seconds, then off for 10, while ci-test.ps1 asks Windows what's holding it awake.
import { app } from "electron";
import path from "node:path";

const out = process.env.OUT;
app.setPath("userData", out);
const health = await import("../src/health.mjs");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  console.log("on:", health.setStayAwake(true), path.basename(out));
  await wait(10_000);
  console.log("off:", health.setStayAwake(false));
  await wait(10_000);
  app.exit(0);
});
