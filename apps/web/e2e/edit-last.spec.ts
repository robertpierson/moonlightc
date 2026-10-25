import { expect, test, type Page } from "@playwright/test";

// These use the local mock provider (e2e/mock-openai.mjs), so they only run against a local server.
test.skip(!!process.env.BASE_URL, "needs the local mock provider");

// Any uncaught error in the page fails the test, even if the UI happens to look fine.
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function connectMock(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("ArrowUp in the empty message box edits the last message you sent, Esc cancels", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await connectMock(page);
  const box = page.getByLabel("Message", { exact: true });
  const edit = page.getByLabel("Edit message");

  // Nothing sent yet: ArrowUp does nothing.
  await box.focus();
  await page.keyboard.press("ArrowUp");
  await expect(edit).toHaveCount(0);

  await send(page, "first");
  await expect(page.getByText("Echo from mock-fast: first")).toBeVisible();
  // The reply has finished (the Stop button is gone).
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();

  // Text in the box, or a modifier key held: ArrowUp is just the cursor key.
  await box.fill("draft");
  await page.keyboard.press("ArrowUp");
  await expect(edit).toHaveCount(0);
  await box.fill("");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(edit).toHaveCount(0);

  // Empty box: the last message opens for editing, focused, with the cursor at the end.
  await page.keyboard.press("ArrowUp");
  await expect(edit).toHaveValue("first");
  await expect(edit).toBeFocused();
  await page.keyboard.type("!");
  await expect(edit).toHaveValue("first!");

  // Esc cancels the edit, keeps the message as it was, and puts the cursor back in the message box.
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);
  await expect(page.locator('[data-role="user"]').last()).toContainText("first");
  await expect(page.locator('[data-role="user"]').last()).not.toContainText("first!");
  await expect(box).toBeFocused();

  // Open it again and resend the edited text.
  await page.keyboard.press("ArrowUp");
  await expect(edit).toHaveValue("first");
  await edit.fill("second");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Echo from mock-fast: second")).toBeVisible();
  await expect(page.getByText("Echo from mock-fast: first")).toHaveCount(0);
});

test("ArrowUp does nothing while a reply is being written", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut");
  await connectMock(page);
  await send(page, "be slow");
  await expect(page.getByText(/word3/)).toBeVisible();
  await page.getByLabel("Message", { exact: true }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByLabel("Edit message")).toHaveCount(0);
  await page.getByRole("button", { name: "Stop generating" }).click();
});
