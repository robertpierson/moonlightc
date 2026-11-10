// Films the real web app for the Learn page's lessons, and takes the screenshots used on the website.
// Needs: the app running with MOONC_ALLOW_PRIVATE_URLS=1 (BASE, default http://localhost:3000) and scripts/demo/demo-ai.mjs
// on :4011. Headless. For each lesson writes <out>/<lesson>/ frames + frames.txt (ffmpeg concat list) + steps.json
// (seconds where each step starts), and screenshots to <out>/shots/. scripts/demo/README.md has the ffmpeg step.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const out = process.argv[2];
const only = process.argv[3]?.split(","); // optional: film just these lessons (the connect lesson always runs first)
const BASE = process.env.BASE ?? "http://localhost:3000";
fs.mkdirSync(path.join(out, "shots"), { recursive: true });
// A smaller window filmed at 2x: the app's text comes out large enough to read when the film is shown small.
const W = +(process.env.W ?? 960);
const H = +(process.env.H ?? 600);
const SCALE = 2;
const browser = await chromium.launch({ channel: "chromium", headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, colorScheme: "dark" });
const pause = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: path.join(out, "shots", `${name}.png`) });
const type = (loc, text) => loc.pressSequentially(text, { delay: 34 });
const box = () => page.getByLabel("Message", { exact: true });
const settings = () => page.getByRole("button", { name: "Settings", exact: true });

/** Films one lesson: `step(n)` marks where step n starts. */
async function film(name, run) {
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const file = `f${String(frames.length).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * SCALE, maxHeight: H * SCALE, everyNthFrame: 1 });
  const marks = [];
  await pause(500);
  try {
    await run((n) => (marks[n] = Date.now() / 1000));
  } catch (e) {
    await shot(`failed-${name}`);
    console.log(`FAILED ${name}: ${e.message.split("\n")[0]}`);
  }
  await pause(1200);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  if (!frames.length) return;
  const lines = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 0.5;
    lines.push(`file '${f.file}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file}'`);
  fs.writeFileSync(path.join(dir, "frames.txt"), lines.join("\n"));
  const t0 = frames[0].t;
  fs.writeFileSync(path.join(dir, "steps.json"), JSON.stringify(marks.map((m) => +Math.max(0, m - t0).toFixed(2))));
  console.log(`${name}: ${frames.length} frames, ${(frames.at(-1).t - t0).toFixed(1)} s, steps ${marks.length}`);
}
const want = (name) => !only || only.includes(name);

// 1. Connect a model (always filmed: every other lesson needs the connection).
await page.goto(`${BASE}/app`);
await box().waitFor();
await pause(800);
await film("connect", async (step) => {
  step(0);
  await page.getByRole("button", { name: "Connect a model" }).click();
  await pause(1600);
  step(1);
  await page.getByLabel("Provider", { exact: true }).click();
  await pause(1800);
  await page.getByRole("option", { name: /Custom/ }).click();
  await pause(600);
  step(2);
  await type(page.getByLabel("Base URL"), "http://127.0.0.1:4011/v1");
  await pause(400);
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await page.getByText("3 models unlocked").waitFor({ timeout: 15000 });
  await pause(1600);
  await page.keyboard.press("Escape");
  await pause(500);
  step(3);
  await box().click();
  await type(box(), "Plan a 3-day trip to Chicago on a budget");
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByText("Ventra day pass").waitFor({ timeout: 30000 });
});
await shot("chat");
// Name the stand-in connection honestly in the model menu (otherwise it shows the server's address).
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("moonc:v1") ?? "{}");
  for (const c of s.connections ?? []) c.label = "Sample answers";
  localStorage.setItem("moonc:v1", JSON.stringify(s));
});
await page.reload();
await box().waitFor();
// Back into the trip chat, so the next lesson continues the same conversation.
await page.getByRole("region", { name: "Recent" }).getByText("Chicago trip on a budget").first().click();
await page.getByText("Ventra day pass").waitFor();
await pause(800);

if (want("switch"))
  await film("switch", async (step) => {
    step(0);
    await page.getByRole("combobox", { name: "Choose model" }).click();
    await pause(1500);
    await shot("models");
    step(1);
    await page.getByRole("option", { name: /^gpt/ }).click();
    await pause(700);
    step(2);
    await box().click();
    await type(box(), "Make it a packing list");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText("Sunglasses for the beach day").waitFor({ timeout: 30000 });
  });

if (want("projects"))
  await film("projects", async (step) => {
    step(0);
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Projects" }).click();
    await pause(1000);
    await page.getByRole("button", { name: "New project" }).click();
    await pause(600);
    step(1);
    await type(page.getByLabel("Project name"), "Study buddy");
    await type(page.getByLabel("Instructions for every chat in this project"), "Explain things simply and end with one quiz question.");
    await pause(500);
    await page.getByRole("button", { name: "Save project" }).click();
    await pause(1400);
    await shot("projects");
    step(2);
    await page.getByRole("button", { name: "New chat in this project" }).first().click();
    await box().waitFor();
    await pause(600);
    await box().click();
    await type(box(), "How do volcanoes erupt?");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText("why does magma rise").waitFor({ timeout: 30000 });
  });

if (want("code"))
  await film("code", async (step) => {
    step(0);
    await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Code", exact: true }).click();
    await pause(900);
    await page.getByRole("button", { name: "New code project" }).click();
    await pause(400);
    await type(page.getByLabel("Name"), "Tip calculator");
    await page.getByRole("button", { name: "Create project" }).click();
    await pause(800);
    step(1);
    const ask = page.getByLabel("Describe a change");
    await ask.click();
    await type(ask, "Build a tip calculator that splits the bill");
    await page.getByRole("button", { name: "Send to code assistant" }).click();
    await page.getByText("Built a tip calculator").first().waitFor({ timeout: 30000 });
    await pause(1200);
    step(2);
    await page.getByRole("tab", { name: "Preview" }).click();
    const app = page.getByTestId("code-preview").frameLocator("iframe").first();
    await app.getByRole("heading", { name: "Tip calculator" }).waitFor({ timeout: 60000 });
    await pause(1200);
    await shot("code");
    await app.getByRole("button", { name: "20%" }).click();
    await pause(700);
    await app.getByLabel("People").fill("3");
    await pause(1500);
    await page.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Chat" }).click();
    await pause(500);
  });

if (want("private"))
  await film("private", async (step) => {
    step(0);
    await page.getByRole("button", { name: "New chat" }).first().click();
    await pause(500);
    await page.getByRole("button", { name: "Mode", exact: true }).filter({ hasText: "General" }).click();
    await pause(1000);
    await page.getByRole("menuitemradio", { name: "Private" }).click();
    await pause(1500);
    await shot("private");
    step(1);
    await box().click();
    await type(box(), "Help me write a birthday message for my sister");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.getByText("borrowed sweater").waitFor({ timeout: 30000 });
    await pause(1500);
    step(2);
    await page.getByRole("button", { name: "New chat" }).first().click();
    await pause(1800);
  });

if (want("memory"))
  await film("memory", async (step) => {
    step(0);
    await settings().click();
    await pause(700);
    await page.getByRole("button", { name: "Memory" }).click();
    await pause(1200);
    const toggle = page.getByLabel("Let the AI remember things");
    if (!(await toggle.isChecked())) {
      await toggle.click();
      await pause(700);
      await page.getByRole("button", { name: "Save changes" }).click();
    }
    await pause(900);
    step(1);
    page.once("dialog", (d) => d.accept("I'm vegetarian and I live in Chicago."));
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("list", { name: "Memories" }).waitFor();
    await pause(700);
    const save = page.getByRole("button", { name: "Save changes" });
    if (await save.isVisible()) await save.click();
    await pause(1500);
    await shot("memory");
    step(2);
    await page.getByLabel("Delete memory").first().click();
    await pause(1800);
    await page.keyboard.press("Escape");
    await pause(400);
  });

if (want("theme"))
  await film("theme", async (step) => {
    step(0);
    await settings().click();
    await pause(700);
    await page.getByRole("button", { name: "Appearance" }).click();
    await pause(1200);
    step(1);
    const radios = page.getByRole("radiogroup", { name: "Theme" }).getByRole("radio");
    const n = await radios.count();
    for (let i = 1; i < Math.min(n, 4); i++) {
      await radios.nth(i).click();
      await pause(1300);
    }
    await shot("theme");
    step(2);
    await radios.nth(0).click();
    await pause(900);
    await page.getByRole("button", { name: "Save changes" }).click();
    await pause(1200);
    await page.keyboard.press("Escape");
  });

// Screenshots of screens that need a company's key to use: what someone sees before adding one.
const screens = [
  ["studio", async () => page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Studio" }).click()],
  ["connections", async () => (await settings().click(), page.getByRole("button", { name: "Connectors" }).click())],
  ["plugins", async () => (await settings().click(), page.getByRole("button", { name: /Plugins/ }).click())],
];
for (const [name, open] of screens) {
  try {
    await page.goto(`${BASE}/app`);
    await box().waitFor();
    await open();
    await pause(1500);
    await shot(name);
  } catch (e) {
    console.log(`no shot ${name}: ${e.message.split("\n")[0]}`);
  }
}
await browser.close();
