import { _electron as electron, expect, test } from "@playwright/test";

let app;
let page;
test.beforeAll(async () => {
  app = await electron.launch({ args: ["."], cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
  page = await app.firstWindow();
  await page.waitForURL(/127\.0\.0\.1:\d+\/app/);
});
test.afterAll(async () => {
  await app?.evaluate(({ app }) => {
    app.isQuitting = true;
    app.quit();
  });
});

test("opens the app from its own local server with the desktop bridge", async () => {
  await expect(page.getByRole("button", { name: "Connect a model" })).toBeVisible();
  const info = await page.evaluate(() => ({ platform: window.moonc?.platform, version: window.moonc?.version, node: typeof window.require }));
  expect(info.platform).toBe(process.platform);
  expect(info.version).toMatch(/\d+\.\d+\.\d+/);
  expect(info.node).toBe("undefined"); // no Node.js in pages
});

test("reads hardware", async () => {
  const hw = await page.evaluate(() => window.moonc.hardware());
  expect(hw.ramGB).toBeGreaterThan(0);
  expect(hw.cores).toBeGreaterThan(0);
});

test("runs a real terminal", async () => {
  const cmd = process.platform === "win32" ? 'echo ("moon-ok-" + 6*7)' : "echo moon-ok-$((6*7))";
  const out = await page.evaluate(
    (cmd) =>
      new Promise(async (resolve) => {
        let buf = "";
        const t = await window.moonc.terminals.create({ cols: 80, rows: 24 });
        window.moonc.terminals.onData(t.id, (d) => {
          buf += d;
          if (buf.includes("moon-ok-42")) {
            window.moonc.terminals.kill(t.id);
            resolve(buf);
          }
        });
        window.moonc.terminals.write(t.id, "echo moon-ok-$((6*7))\r");
      }),
  );
  expect(out).toContain("moon-ok-42");
});

test("pages can call the local API", async () => {
  const status = await page.evaluate(() => fetch("/api/models", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.status));
  expect(status).toBe(400); // same-origin call reaches the handler (bad body)
});
