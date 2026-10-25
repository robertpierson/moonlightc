import { expect, test } from "@playwright/test";
import { openMenu } from "./helpers";

test("Settings > What's new lists recent changes", async ({ page }) => {
  await page.goto("/app");
  await openMenu(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "What's new", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What's new" })).toBeVisible();
  await expect(page.getByText("Locked chats: hide chats behind a PIN", { exact: false })).toBeVisible();
});
