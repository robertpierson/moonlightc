import { expect, test } from "@playwright/test";
import { nav, openMenu, saveSettings } from "./helpers";

const go = nav;

test("distros restyle the app and change which sections show", async ({ page }) => {
  await page.goto("/app");
  await go(page, "Customize");
  await page.getByRole("button", { name: /^Forge/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: /^Moon\b/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await go(page, "Chat");
  await expect(page.getByLabel("Message", { exact: true })).toHaveClass(/min-h-32/);
  await openMenu(page);
  await expect(page.getByRole("button", { name: "Studio", exact: true }).locator("visible=true")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true }).locator("visible=true")).toHaveCount(1);
});

test("theme picker, editor and reset", async ({ page }) => {
  await page.goto("/app");
  await go(page, "Customize");
  await page.getByRole("radio", { name: /Paper/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.getByText("Theme editor").click();
  await page.getByLabel("primary color", { exact: true }).fill("#ff0000");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#ff0000");
  await saveSettings(page);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await go(page, "Customize");
  await page.getByRole("button", { name: "Reset everything to default" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("a shared distro link asks before applying", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permission");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/app");
  await go(page, "Customize");
  await page.getByRole("radio", { name: /Midnight/ }).click();
  await page.getByLabel("Save your current setup").fill("Night Owl");
  await page.getByRole("button", { name: "Copy share link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("/app?distro=");

  await page.getByRole("button", { name: "Reset everything to default" }).click();
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page.getByRole("dialog", { name: "Apply shared distro" })).toContainText("Night Owl");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "midnight");
  await page.getByRole("button", { name: "Apply Night Owl" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
});

test("shortcuts can be rebound", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard");
  await page.goto("/app");
  await go(page, "Customize");
  await page.getByRole("button", { name: "Change shortcut for Command palette" }).click();
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByRole("button", { name: "Change shortcut for Command palette" })).toHaveText(/Ctrl\+Shift\+L/);
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByPlaceholder("Type a command, chat or model…")).toBeVisible();
});

test("profile name and picture, and saving your own theme", async ({ page }) => {
  await page.goto("/app");
  await nav(page, "Settings");
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Profile" }).click();
  await page.getByLabel("Your name").fill("Shawn Moon");
  // A 1x1 PNG is enough to exercise the picture path.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await expect(page.locator('img[src^="data:image/jpeg"]').first()).toBeAttached();
  await go(page, "Chat");
  await expect(page.getByRole("heading", { name: "What can I help with, Shawn?" })).toBeVisible();
  await openMenu(page);
  await expect(page.getByText("Shawn Moon").locator("visible=true")).toHaveCount(1);
  await page.keyboard.press("Escape");

  await go(page, "Customize");
  await page.getByRole("radio", { name: /Paper/ }).click();
  await page.getByText("Theme editor").click();
  await page.getByLabel("primary color", { exact: true }).fill("#123456");
  await page.getByLabel("Theme name").fill("Night ink");
  await page.getByRole("button", { name: "Save as my theme" }).click();
  await page.getByRole("radio", { name: /Moonlight/ }).first().click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  await page.getByRole("radiogroup", { name: "My themes" }).getByRole("radio", { name: "Night ink" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#123456");
});

test("Settings changes wait for Save; Reset puts them back; leaving with unsaved changes is blocked", async ({ page }) => {
  await page.goto("/app");
  await go(page, "Settings");
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Profile" }).click();
  const bar = page.getByRole("region", { name: "Unsaved changes" });
  await expect(bar).toHaveCount(0);
  await page.getByLabel("Your name").fill("Draft name");
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue("");
  await expect(bar).toHaveCount(0);

  await page.getByLabel("Your name").fill("Saved name");
  await openMenu(page);
  await page.getByRole("group", { name: "Mode" }).locator("visible=true").getByRole("button", { name: "Chat" }).click();
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.keyboard.press("Escape");
  await expect(bar).toContainText("Careful");
  await expect(page.getByRole("navigation", { name: "Settings" })).toBeVisible();
  await bar.getByRole("button", { name: "Save changes" }).click();
  await expect(bar).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "What can I help with, Saved?" })).toBeVisible();
});
