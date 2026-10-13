import { expect, test } from "@playwright/test";
import { nav } from "./helpers";

test("home page: hero, links and footer all work", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveTitle("MoonlightC");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Every AI,\s*one window\./);

  // Every internal link on the page resolves.
  const hrefs = await page.locator("a[href^='/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);

  await page.getByRole("link", { name: "Open web app" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  expect(errors).toEqual([]);
});

test("download page offers the right next step for this device", async ({ page, isMobile }) => {
  await page.goto("/download");
  await expect(page.getByRole("heading", { name: "Get MoonlightC" })).toBeVisible();
  const primary = page.getByRole("link", { name: /Download for|Open the web app/ }).first();
  await expect(primary).toBeVisible();
  if (isMobile) await expect(primary).toContainText("Android");
  await expect(page.getByText("Safari on iPhone or iPad")).toBeVisible();
});

test("PWA: manifest and service worker are served", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("MoonlightC");
  expect(m.icons.length).toBeGreaterThanOrEqual(3);
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  expect((await request.get("/sw.js")).status()).toBe(200);
});

test("privacy and terms pages load", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms", level: 1 })).toBeVisible();
});

test("account pages stay hidden until accounts are set up", async ({ page, request }) => {
  test.skip(!!process.env.NEXT_PUBLIC_SUPABASE_URL, "accounts are configured");
  for (const path of ["/signin", "/onboarding", "/admin"]) expect((await request.get(path)).status()).toBe(404);
  expect((await request.post("/api/account/delete")).status()).toBe(404);
  await page.goto("/app");
  await nav(page, "Settings");
  await expect(page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Account" })).toHaveCount(0);
});
