// Makes the Chrome Web Store images in apps/extension/store/ from the real extension (headless, nothing pops up).
// Run from the repo: node apps/extension/scripts/store-shots.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const EXT = path.join(here, "..");
const OUT = path.join(EXT, "store");
const { chromium } = createRequire(path.join(EXT, "..", "web", "package.json"))("@playwright/test");

const SHOP = "https://shop.example/";
const SHOP_HTML = `<!doctype html><title>Moon Shop</title><style>
body{margin:0;font:16px system-ui;color:#0b1530;background:#f6f8fb}header{padding:28px 64px;background:#fff;border-bottom:1px solid #e3e7ee;font-weight:700;font-size:22px}
main{display:grid;grid-template-columns:1.2fr 1fr;gap:48px;padding:56px 64px}.img{aspect-ratio:4/3;border-radius:20px;background:linear-gradient(160deg,#dfe5ef,#b9c3d4)}
h1{margin:0;font-size:40px;letter-spacing:-.02em}p{color:#4f5a74;line-height:1.6}.price{font-size:28px;font-weight:600;margin:16px 0}
button{font:inherit;font-weight:600;padding:14px 26px;border-radius:999px;border:0;background:#0b1530;color:#fff}</style>
<header>Moon Shop</header><main><div class="img"></div><div><h1>Desk lamp, brushed steel</h1><div class="price">$48.00</div>
<p>Warm light, a weighted base and a 2 m cable. Ships in 2 days.</p><button>Add to cart</button></div></main>`;

const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const id = new URL(worker.url()).host;
await ctx.route(`${SHOP}**`, (r) => r.fulfill({ contentType: "text/html", body: SHOP_HTML }));

// 1: a shared tab, with the banner the extension shows on it.
const shop = await ctx.newPage();
await shop.goto(SHOP);
const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: "https://shop.example/*" }))[0].id);
await worker.evaluate((t) => globalThis.mooncShare(t), tabId);
await shop.waitForSelector("#moonc-shared-banner");
await shop.screenshot({ path: path.join(OUT, "1-shared-tab.png") });

// 2: the popup (as it looks on the shared shop tab) and 3: the "allow this step?" window, each on a soft background.
async function framed(file, url, w, h) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  // The popup asks Chrome for the active tab; point that at the shop tab, as if it were opened there.
  await p.addInitScript((t) => {
    if (globalThis.chrome?.tabs) chrome.tabs.query = async () => [{ id: t, url: "https://shop.example/" }];
  }, tabId);
  await p.goto(url);
  await p.waitForTimeout(600);
  const png = (await p.screenshot()).toString("base64");
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto("about:blank");
  await p.setContent(`<body style="margin:0;height:800px;display:grid;place-items:center;background:linear-gradient(180deg,#cdd6e6,#f4f6fa)">
    <img src="data:image/png;base64,${png}" style="width:${w * 1.5}px;border-radius:16px;box-shadow:0 30px 80px -20px rgba(11,21,48,.45)"></body>`);
  await p.screenshot({ path: path.join(OUT, file) });
  await p.close();
}
await framed("2-popup.png", `chrome-extension://${id}/popup.html`, 300, 330);
await framed("3-confirm.png", `chrome-extension://${id}/confirm.html?${new URLSearchParams({ id: "x", what: 'click "Add to cart"', site: "shop.example" })}`, 440, 190);

// Small promo tile, 440x280.
const tile = await ctx.newPage();
await tile.setViewportSize({ width: 440, height: 280 });
await tile.setContent(`<body style="margin:0;height:280px;display:grid;place-items:center;font:600 30px system-ui;letter-spacing:-.02em;color:#0b1530;background:linear-gradient(180deg,#cdd6e6,#f4f6fa)">
  <div style="display:flex;gap:16px;align-items:center"><img src="data:image/png;base64,${fs.readFileSync(path.join(EXT, "icons", "128.png")).toString("base64")}" width="72" height="72">MoonlightC</div></body>`);
await tile.waitForTimeout(500);
await tile.screenshot({ path: path.join(OUT, "promo-440x280.png") });

await ctx.close();
console.log("ok");
