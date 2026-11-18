import { expect, test } from "@playwright/test";

// Every site page fits every kind of screen: no sideways scrolling and the main heading in view.
const SIZES = [
  [360, 740, "small phone"],
  [412, 915, "big phone"],
  [768, 1024, "tablet"],
  [1024, 600, "netbook"],
  [1366, 768, "Chromebook / laptop"],
  [1920, 1080, "desktop"],
  [2560, 1080, "ultrawide"],
  [900, 420, "phone sideways"],
] as const;
const PAGES = ["/", "/download", "/models", "/remote", "/code", "/extension", "/learn", "/course", "/course/ship", "/questions"];

test.describe("every page fits every screen", () => {
  test.skip(({ isMobile }) => isMobile, "sizes are set by hand here");
  for (const [w, h, name] of SIZES) {
    test(`${name} ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(over, `${path} scrolls sideways by ${over}px`).toBeLessThanOrEqual(0);
        const h1 = await page.getByRole("heading", { level: 1 }).boundingBox();
        expect(h1!.x, `${path} heading starts off screen`).toBeGreaterThanOrEqual(0);
        expect(h1!.x + h1!.width, `${path} heading runs off screen`).toBeLessThanOrEqual(w + 1);
      }
    });
  }
});

test.describe("the app fits every screen too", () => {
  test.skip(({ isMobile }) => isMobile, "sizes are set by hand here");
  for (const [w, h, name] of SIZES) {
    test(`app ${name} ${w}x${h}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/app");
      const box = page.getByLabel("Message", { exact: true });
      await expect(box).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(over, `the app scrolls sideways by ${over}px`).toBeLessThanOrEqual(0);
      const b = (await box.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      expect(b.y + b.height, "the message box is below the screen").toBeLessThanOrEqual(h + 1);
    });
  }
});
