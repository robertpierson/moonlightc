import { expect, test } from "@playwright/test";

test("a shared-chat link that was turned off says so", async ({ page }) => {
  await page.goto("/share/aaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByText("This shared chat doesn't exist anymore.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
