import { expect, test } from "@playwright/test";
import { openMenu } from "./helpers";

test("imports chats from a Claude export, once (no duplicates)", async ({ page }) => {
  await page.goto("/app");
  const file = {
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([{ uuid: "44444444-4444-4444-8444-444444444444", name: "Trip to Kyoto", updated_at: "2026-10-01T10:00:00Z", chat_messages: [{ sender: "human", text: "Plan 3 days in Kyoto" }, { sender: "assistant", text: "Day 1: Fushimi Inari..." }] }])),
  };
  await openMenu(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Privacy & data", exact: true }).click();
  const input = page.getByText("Import", { exact: true }).locator("input[type=file]");
  await input.setInputFiles(file);
  await expect(page.getByText("Imported 1 chat from Claude.")).toBeVisible();
  await input.setInputFiles(file);
  await expect(page.getByText("Imported 0 chats from Claude.")).toBeVisible();
  await page.goto("/app");
  await openMenu(page);
  await expect(page.getByText("Trip to Kyoto").locator("visible=true").first()).toBeVisible();
});
