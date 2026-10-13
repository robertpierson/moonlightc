import { expect, test } from "@playwright/test";

test("home page shows the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("MoonlightC");
  await expect(page.getByRole("heading", { name: "MoonlightC" })).toBeVisible();
});
