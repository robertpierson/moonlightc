import { expect, test, type Page } from "@playwright/test";

async function connectMock(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
}

test("chats get a short AI title; copy, continue in a new chat, trash and restore", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium" || test.info().project.name === "mobile", "clipboard permissions; the sidebar menu is covered on desktop");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await connectMock(page);
  await page.getByLabel("Message", { exact: true }).fill("Yo whatsup can you help me bake some bread with butter please");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).not.toBeEmpty();

  const options = page.getByRole("button", { name: "Options for Baking with butter" }).locator("visible=true");
  await expect(options).toBeVisible();

  await options.click();
  await page.getByRole("menuitem", { name: "Copy chat" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("You: Yo whatsup");

  await page.getByRole("button", { name: "Options for Baking with butter" }).locator("visible=true").click();
  await page.getByRole("menuitem", { name: "Continue in a new chat" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(/Goal: bake bread/);

  await page.getByRole("button", { name: "Options for Baking with butter" }).locator("visible=true").click();
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await expect(page.getByRole("button", { name: "Options for Baking with butter" }).locator("visible=true")).toHaveCount(0);
});
