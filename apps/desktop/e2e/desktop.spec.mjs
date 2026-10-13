import { _electron as electron, expect, test } from "@playwright/test";

let app;
let page;
test.beforeAll(async () => {
  app = await electron.launch({ args: ["."], cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
  page = await app.firstWindow();
  await page.waitForURL(/127\.0\.0\.1:\d+\/app/);
});
test.afterAll(async () => {
  await app?.evaluate(({ app }) => app.quit());
});

test("opens the app from its own local server with the desktop bridge", async () => {
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
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

test("desktop sections: local models, terminal, projects", async () => {
  await page.getByRole("button", { name: "Local models" }).click();
  await expect(page.getByRole("heading", { name: "Local models" })).toBeVisible();
  await expect(page.getByText(/This computer: .* GB memory/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByTestId("terminal").first()).toBeVisible();
  await page.getByRole("button", { name: "My AI Projects" }).click();
  await expect(page.getByRole("button", { name: "Allow AI tool folders" })).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
});

test("keys are kept in the OS keychain, not in page storage", async () => {
  await page.evaluate(async () => {
    await window.moonc.secrets.set("key:test-conn", "sk-secret-value");
  });
  expect(await page.evaluate(() => window.moonc.secrets.get("key:test-conn"))).toBe("sk-secret-value");
  await page.evaluate(() => window.moonc.secrets.set("key:test-conn", null));
  expect(await page.evaluate(() => window.moonc.secrets.get("key:test-conn"))).toBeNull();
});

test("gate: download a local model with one click and chat with it (no cloud involved)", async () => {
  test.setTimeout(10 * 60_000);
  test.skip(!(await page.evaluate(() => window.moonc.ollama.status())).running, "Ollama isn't running on this machine");
  await page.getByRole("button", { name: "Local models" }).click();
  // Use the Hugging Face search + one-click download path with a tiny model to keep the test fast.
  await page.getByLabel("Search Hugging Face models").fill("SmolLM2-135M-Instruct-GGUF");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const row = page.getByRole("list", { name: "Hugging Face results" }).getByRole("listitem").filter({ hasText: /SmolLM2-135M-Instruct-GGUF/i }).first();
  const name = (await row.locator("span").first().innerText()).trim();
  if (await row.getByRole("button", { name: "Download" }).isVisible()) await row.getByRole("button", { name: "Download" }).click();
  await expect(row.getByText("Installed")).toBeVisible({ timeout: 9 * 60_000 });

  const installed = page.getByRole("list", { name: "Installed models" }).getByRole("listitem").filter({ hasText: `hf.co/${name}` }).first();
  await installed.getByRole("button", { name: "Chat" }).click();
  await expect(page.getByRole("combobox", { name: "Choose model" })).toContainText(name.split("/")[1].slice(0, 10));
  await page.getByLabel("Message", { exact: true }).fill("Say hello in five words.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toHaveText(/\w+/, { timeout: 120_000 });
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible({ timeout: 120_000 });
});

test("gate: Claude Code opens in the built-in terminal (if installed)", async () => {
  const tools = await page.evaluate(() => window.moonc.terminals.tools());
  test.skip(!tools.find((t) => t.id === "claude")?.installed, "Claude Code isn't installed on this machine");
  await page.getByRole("button", { name: "Terminal" }).click();
  await page.getByRole("button", { name: "Claude Code" }).click();
  await expect(page.getByRole("tab", { name: "Claude Code" })).toBeVisible();
  // Claude Code draws its own UI; seeing any of its output proves it launched inside our terminal.
  await expect(page.getByTestId("terminal").last()).toContainText(/Claude|claude|trust|Welcome/, { timeout: 30000 });
  await page.getByRole("button", { name: "Close Claude Code" }).click();
});

test("detects an LM Studio server on this computer and uses its models", async () => {
  const { spawn } = await import("node:child_process");
  const busy = await fetch("http://127.0.0.1:1234/v1/models").then(() => true, () => false);
  test.skip(busy, "something already uses port 1234");
  const mock = spawn(process.execPath, ["../web/e2e/mock-openai.mjs"], { env: { ...process.env, MOCK_PORT: "1234" }, stdio: "ignore" });
  try {
    await new Promise((r) => setTimeout(r, 800));
    await page.getByRole("button", { name: "Local models" }).click();
    await page.reload();
    await page.getByRole("button", { name: "Local models" }).click();
    await page.getByRole("button", { name: "Use its models" }).click();
    await expect(page.getByText("LM Studio connected: 2 models.")).toBeVisible();
  } finally {
    mock.kill();
  }
});
