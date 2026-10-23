import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

test("starter ideas fill the message box (nothing is sent)", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Plan my week" })).toHaveCount(0); // no model yet
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Plan my week" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(/^Help me plan my week/);
  await expect(page.locator('[data-role="user"]')).toHaveCount(0);
});
