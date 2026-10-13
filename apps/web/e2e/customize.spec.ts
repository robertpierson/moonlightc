import { expect, test, type Page } from "@playwright/test";

async function go(page: Page, section: string) {
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name: section, exact: true }).click();
}

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
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await expect(page.getByRole("button", { name: "Studio", exact: true }).locator("visible=true")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Customize", exact: true }).locator("visible=true")).toHaveCount(1);
});

test("theme picker, editor and reset", async ({ page }) => {
  await page.goto("/app");
  await go(page, "Customize");
  await page.getByRole("radio", { name: /Paper/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.getByText("Theme editor").click();
  await page.getByLabel("primary color", { exact: true }).fill("#ff0000");
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#ff0000");
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
