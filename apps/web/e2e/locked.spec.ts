import { expect, test } from "@playwright/test";
import { openMenu } from "./helpers";

test("locked chats: hidden from the list until the PIN; unlock brings them back", async ({ page }) => {
  test.skip(test.info().project.name === "mobile", "the sidebar chat menu is covered on desktop");
  await page.goto("/app");
  await openMenu(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Privacy & data", exact: true }).click();
  await page.getByText("Import", { exact: true }).locator("input[type=file]").setInputFiles({
    name: "conversations.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([{ uuid: "55555555-5555-4555-8555-555555555555", name: "Secret plans", updated_at: "2026-10-01T10:00:00Z", chat_messages: [{ sender: "human", text: "hi" }, { sender: "assistant", text: "hello" }] }])),
  });
  await expect(page.getByText("Imported 1 chat")).toBeVisible();
  await page.goto("/app");

  const nav = page.getByRole("navigation", { name: "Chats" });
  await nav.getByRole("button", { name: "Options for Secret plans" }).click({ force: true });
  await page.getByRole("menuitem", { name: "Lock chat" }).click();
  await page.getByLabel("PIN", { exact: true }).fill("2468");
  await page.getByLabel("PIN again").fill("2468");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(nav.getByText("Secret plans")).toHaveCount(0);

  await nav.getByRole("button", { name: /Locked \(1\)/ }).click();
  await page.getByRole("button", { name: "Show locked chats" }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1111");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("Wrong PIN.")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  const locked = page.getByRole("region", { name: "Locked chats" });
  await expect(locked.getByText("Secret plans")).toBeVisible();
  await locked.getByRole("button", { name: "Unlock" }).click();
  await expect(nav.getByText("Secret plans")).toBeVisible();
});
