import { expect, test } from "@playwright/test";
import { nav } from "./helpers";

// Runs against the live site, where accounts are switched on. Uses a made-up email: no account is created.
test.skip(!process.env.BASE_URL, "accounts are only switched on for the deployed site");

test("sign-in page works and explains a wrong password", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: "Sign in to MoonlightC" })).toBeVisible();
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("not-the-right-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
});

test("owner-only and signed-in pages send you to sign in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin\?next=%2Fadmin|\/signin\?next=\/admin/);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/signin/);
});

test("Settings > Account offers sign-in", async ({ page }) => {
  await page.goto("/app");
  await nav(page, "Settings");
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("link", { name: "Sign in or create an account" })).toBeVisible();
});
