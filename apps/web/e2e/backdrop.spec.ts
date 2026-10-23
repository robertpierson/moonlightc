import { expect, test } from "@playwright/test";
import { nav, saveSettings } from "./helpers";

// A tiny PNG (1x1 purple pixel).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("background: your own picture, an effect and colour sliders, kept after reload", async ({ page }) => {
  await page.goto("/app");
  await nav(page, "Customize");
  await page.getByText("Choose picture, GIF or video").locator("input[type=file]").setInputFiles({ name: "bg.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("html")).toHaveAttribute("data-backdrop", "");
  const pic = page.locator("div[aria-hidden] > img");
  await expect(pic).toHaveCount(1);
  await page.getByRole("radio", { name: "Lanterns" }).click();
  await expect(page.locator("div[aria-hidden] > canvas")).toHaveCount(1);
  await page.getByLabel(/^Hue/).fill("90");
  await expect(pic).toHaveCSS("filter", /hue-rotate\(90deg\)/);
  await saveSettings(page);
  await page.reload();
  await expect(page.locator("div[aria-hidden] > img")).toHaveCount(1);
  await nav(page, "Customize");
  await expect(page.getByRole("radio", { name: "Lanterns" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Remove picture" }).click();
  await expect(page.locator("div[aria-hidden] > img")).toHaveCount(0);
});
