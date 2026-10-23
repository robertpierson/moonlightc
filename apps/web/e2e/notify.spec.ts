import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

test("a reply that finishes while you're elsewhere shows a notification (when switched on)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__notes = [] as string[];
    w.__hidden = false;
    Object.defineProperty(document, "hidden", { get: () => w.__hidden });
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(title: string, o?: { body?: string }) {
        (w.__notes as string[]).push(`${title}: ${o?.body ?? ""}`);
      }
      close() {}
    }
    w.Notification = FakeNotification;
  });
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const raw = localStorage.getItem("moonc:v1");
    const s = raw ? JSON.parse(raw) : {};
    localStorage.setItem("moonc:v1", JSON.stringify({ ...s, notifyDone: true }));
  });
  await page.reload();
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__hidden = true));
  await page.getByLabel("Message", { exact: true }).fill("Say hi");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __notes: string[] }).__notes.length)).toBe(1);
});
