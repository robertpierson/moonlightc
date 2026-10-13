import path from "node:path";
import { chromium, expect, test, type BrowserContext, type Page, type Worker } from "@playwright/test";

// Loads the real (unpacked) Chrome extension. Desktop Chromium only; it needs its own browser profile.
test.skip(({ isMobile }) => isMobile, "Chrome extensions are desktop-only");
test.skip(!!process.env.BASE_URL, "needs the local mock provider");

const EXT = path.resolve(__dirname, "../../extension");
const SHOP = "https://shop.example/";
const SHOP_HTML = `<!doctype html><title>Moon Shop</title><h1>Moon Shop</h1><p id="msg">Welcome</p>
<button onclick="document.getElementById('msg').textContent='Hi there!'">Say hi</button>
<button onclick="document.getElementById('msg').textContent='Bought!'">Buy now</button>`;

// Each step waits on a model reply plus the extension; give it room when the whole suite runs in parallel.
const slow = expect.configure({ timeout: 15_000 });

let context: BrowserContext;
let worker: Worker;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext("", { channel: "chromium", headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  await context.route(`${SHOP}**`, (r) => r.fulfill({ contentType: "text/html", body: SHOP_HTML }));
});
test.afterAll(() => context?.close());

async function send(app: Page, text: string) {
  await app.getByLabel("Message", { exact: true }).fill(text);
  await app.getByRole("button", { name: "Send message" }).click();
}

test("the AI reads a shared tab, clicks, and risky clicks wait for the person", async ({ baseURL }) => {
  const shop = await context.newPage();
  await shop.goto(SHOP);
  const app = await context.newPage();
  await app.goto(`${baseURL}/app`);
  await slow(app.locator("html")).toHaveAttribute("data-moonc-extension", /\d/);

  // Browser tabs are a Cowork thing. Nothing is shared yet: the AI is told to ask for a tab.
  await app.getByRole("group", { name: "Mode" }).getByRole("button", { name: "Cowork" }).click();
  await app.getByRole("button", { name: "Connect a model" }).click();
  await app.getByLabel("Provider", { exact: true }).click();
  await app.getByRole("option", { name: /Custom/ }).click();
  await app.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await app.getByRole("button", { name: "Check key and connect" }).click();
  await slow(app.getByText("2 models unlocked")).toBeVisible();
  await app.keyboard.press("Escape");
  await send(app, "read my tab");
  await slow(app.locator('[data-role="assistant"]').last()).toContainText("No tab is shared");

  // Share the shop tab (what the popup's "Share this tab" does).
  await worker.evaluate(async (url) => {
    const g = globalThis as unknown as { chrome: { tabs: { query: (q: object) => Promise<{ id: number }[]> } }; mooncShare: (id: number) => Promise<void> };
    const [tab] = await g.chrome.tabs.query({ url: `${url}*` });
    await g.mooncShare(tab.id);
  }, SHOP);

  await send(app, "read my tab");
  await slow(app.getByText("Read a shared tab")).toBeVisible();
  await slow(app.locator('[data-role="assistant"]').last()).toContainText("Moon Shop");

  await send(app, "click say hi");
  await slow(shop.locator("#msg")).toHaveText("Hi there!");

  // "Buy now" is risky: the extension asks in its own window (web pages can't draw over it), and Deny is the default.
  let ask = context.waitForEvent("page");
  await send(app, "buy it");
  let prompt = await ask;
  await slow(prompt.getByRole("heading")).toHaveText('The AI wants to click "Buy now"');
  await prompt.getByRole("button", { name: "Deny" }).click();
  await slow(app.locator('[data-role="assistant"]').last()).toContainText("said no");
  await slow(shop.locator("#msg")).toHaveText("Hi there!");

  ask = context.waitForEvent("page");
  await send(app, "buy it");
  prompt = await ask;
  await prompt.getByRole("button", { name: "Allow" }).click();
  await slow(shop.locator("#msg")).toHaveText("Bought!");
  await slow(app.locator('[data-role="assistant"]').last()).toContainText("Buy now");
});
