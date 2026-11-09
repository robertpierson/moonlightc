// Films the real web app for the website's demo video. Needs: the app running on :3000 with MOONC_ALLOW_PRIVATE_URLS=1,
// and scripts/demo/demo-ai.mjs on :4011. Headless (nothing opens on screen). Writes JPEG frames + an ffmpeg concat
// list to the folder given as the first argument; scripts/demo/README.md has the ffmpeg step.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
// A 1280x800 window filmed at 1.5x, so text stays crisp when the video is shown large.
const W = 1280;
const H = 800;
const SCALE = 1.5;
const browser = await chromium.launch({ channel: "chromium", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: "dark" });
const pause = (ms) => page.waitForTimeout(ms);

// Before filming: connect the stand-in AI and start from a clean chat.
await page.goto("http://localhost:3000/app");
await page.getByRole("button", { name: "Connect a model" }).click();
await page.getByLabel("Provider", { exact: true }).click();
await page.getByRole("option", { name: /Custom/ }).click();
await page.getByLabel("Base URL").fill("http://127.0.0.1:4011/v1");
await page.getByRole("button", { name: "Check key and connect" }).click();
await page.getByText("3 models unlocked").waitFor({ timeout: 15000 }).catch(async (e) => {
  await page.screenshot({ path: path.join(out, "connect-failed.png") });
  throw e;
});
await page.keyboard.press("Escape");
// Name the stand-in connection honestly in the model menu (otherwise it shows the server's address).
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("moonc:v1") ?? "{}");
  for (const c of s.connections ?? []) c.label = "Sample answers";
  localStorage.setItem("moonc:v1", JSON.stringify(s));
});
await page.reload();
await page.getByLabel("Message", { exact: true }).waitFor();
await pause(1200);

// Film with the DevTools screencast: sharper than Playwright's built-in recorder.
const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
  fs.writeFileSync(path.join(out, file), Buffer.from(data, "base64"));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
const marks = {};
const mark = (name) => (marks[name] = Date.now() / 1000);
await pause(800);

// 1. Ask something.
mark("chat");
const box = page.getByLabel("Message", { exact: true });
await box.click();
mark("type1");
await box.pressSequentially("Plan a 3-day trip to Chicago on a budget", { delay: 38 });
await pause(350);
await page.getByRole("button", { name: "Send message" }).click();
mark("sent1");
await page.getByText("Ventra day pass").waitFor({ timeout: 30000 });
mark("done1");
await pause(1800);

// 2. Switch models mid-conversation.
mark("switch");
await page.getByRole("combobox", { name: "Choose model" }).click();
mark("picker");
await pause(900);
await page.getByRole("option", { name: /^gpt/ }).click();
await pause(500);
await box.click();
mark("type2");
await box.pressSequentially("Make it a packing list", { delay: 40 });
await pause(300);
await page.getByRole("button", { name: "Send message" }).click();
mark("sent2");
await page.getByText("Sunglasses for the beach day").waitFor({ timeout: 30000 });
mark("done2");
await pause(1800);

// 3. Build an app in the Code tab and use it.
mark("code");
await page.getByRole("button", { name: "Code", exact: true }).click();
await pause(900);
await page.getByRole("button", { name: "New code project" }).click();
mark("dialog");
await pause(400);
await page.getByLabel("Name").pressSequentially("Tip calculator", { delay: 35 });
await page.getByRole("button", { name: "Create project" }).click();
await pause(800);
const ask = page.getByLabel("Describe a change");
await ask.click();
mark("type3");
await ask.pressSequentially("Build a tip calculator that splits the bill", { delay: 36 });
await page.getByRole("button", { name: "Send to code assistant" }).click();
mark("sent3");
await page.getByText("Built a tip calculator").first().waitFor({ timeout: 30000 });
await pause(1200);
mark("preview");
await page.getByRole("tab", { name: "Preview" }).click();
const app = page.getByTestId("code-preview").frameLocator("iframe").first();
await app.getByRole("heading", { name: "Tip calculator" }).waitFor({ timeout: 60000 });
mark("app");
await pause(1500);
await app.getByRole("button", { name: "20%" }).click();
await pause(900);
await app.getByLabel("People").fill("3");
await pause(2500);
mark("end");

await cdp.send("Page.stopScreencast");
await browser.close();

// ffmpeg concat list: each frame lasts until the next one.
const lines = [];
frames.forEach((f, i) => {
  const next = frames[i + 1]?.t ?? f.t + 0.5;
  lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
});
lines.push(`file '${frames.at(-1).file}'`);
fs.writeFileSync(path.join(out, "frames.txt"), lines.join("\n"));
const t0 = frames[0].t;
fs.writeFileSync(path.join(out, "chapters.json"), JSON.stringify(Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +(v - t0).toFixed(2)]))));
console.log(`${frames.length} frames, ${(frames.at(-1).t - t0).toFixed(1)} s`, marks && Object.keys(marks).join(","));
