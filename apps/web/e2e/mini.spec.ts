import { expect, test } from "@playwright/test";

// The tray panel, with a stand-in for the desktop app's bridge (the real tray can't be clicked from a test).
const bridge = () => {
  const calls: unknown[][] = [];
  const rec = (name: string, result?: unknown) => async (...a: unknown[]) => (calls.push([name, ...a]), result);
  Object.assign(window, { __calls: calls });
  Object.assign(window, {
    moonc: {
      platform: "win32",
      version: "9.9.9",
      device: { info: async () => ({ id: "d1", name: "testpc" }) },
      secrets: { get: async () => null, set: async () => {} },
      settings: { get: async () => ({ openAtLogin: true, keepRunning: false }), setKeepRunning: rec("keep", true) },
      remote: {
        state: async () => [
          { clientId: "abc", name: "Chromebook", tiers: ["chat"], startedAt: 0 },
          { clientId: "abc:screen", name: "Chromebook", tiers: ["view"], startedAt: 0 },
        ],
        onState: () => () => {},
        end: rec("end"),
      },
      mini: { open: rec("open"), quickAsk: rec("quickAsk"), hide: rec("hide"), quit: rec("quit") },
      onDeepLink: () => () => {},
    },
  });
};
const calls = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls);

test.use({ viewport: { width: 340, height: 580 }, colorScheme: "dark" });

test("tray panel: real status, one row per device, working switches and shortcuts", async ({ page }) => {
  await page.addInitScript(bridge);
  await page.goto("/mini");
  await expect(page.getByText("testpc · 9.9.9")).toBeVisible();

  // A device's two sessions are one row; Disconnect ends both.
  await expect(page.getByText("Chromebook")).toHaveCount(1);
  await page.getByRole("button", { name: "Disconnect" }).click();
  expect(await calls(page)).toEqual(expect.arrayContaining([expect.arrayContaining(["end", "abc"]), expect.arrayContaining(["end", "abc:screen"])]));

  // Remote control saves right away, where the main window reads it.
  await page.getByRole("switch", { name: "Remote control" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("moonc:v1") ?? "{}").remoteEnabled)).toBe(true);

  // Always on is off by default; on, Quit becomes Restart.
  const quit = page.getByRole("button", { name: "Quit", exact: true });
  await expect(quit).toBeVisible();
  await page.getByRole("switch", { name: "Always on" }).click();
  await expect(page.getByRole("button", { name: "Restart", exact: true })).toBeVisible();
  expect(await calls(page)).toContainEqual(["keep", true]);

  await page.getByRole("button", { name: "Code", exact: true }).click();
  await page.getByRole("button", { name: "Quick ask" }).click();
  await page.keyboard.press("Escape");
  const all = await calls(page);
  expect(all).toContainEqual(["open", "code"]);
  expect(all).toContainEqual(["quickAsk"]);
  expect(all).toContainEqual(["hide"]);
  await page.screenshot({ path: "test-results/mini-panel.png" });
});

test("outside the desktop app it points to the real app", async ({ page }) => {
  await page.goto("/mini");
  await expect(page.getByRole("link", { name: "Open MoonlightC" })).toHaveAttribute("href", "/app");
});
