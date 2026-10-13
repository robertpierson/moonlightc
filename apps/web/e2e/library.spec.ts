import { expect, test, type Page } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

async function nav(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("projects add their instructions and files; memory is saved by the AI and reused", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await nav(page, "Projects & memory");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill("Bakery");
  await page.getByLabel("Instructions for every chat in this project").fill("Answer in French.");
  await page.locator('input[type="file"]').setInputFiles({ name: "menu.txt", mimeType: "text/plain", buffer: Buffer.from("croissant 3 euros") });
  await expect(page.getByRole("list", { name: "Project files" })).toContainText("menu.txt");
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByRole("switch").first().click(); // memory on
  await page.getByRole("button", { name: "New chat in this project" }).click();

  await send(page, "hello");
  const answer = page.locator('[data-role="assistant"]').last();
  await expect(answer).toContainText("Answer in French.");
  await expect(answer).toContainText("croissant 3 euros");

  await send(page, "remember that my cat is Miso");
  await expect(page.getByText("Remembered: my cat is Miso")).toBeVisible();

  await nav(page, "Projects & memory");
  await expect(page.getByRole("list", { name: "Memories" })).toContainText("my cat is Miso");

  await nav(page, "New chat");
  await send(page, "what is my cat called?");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("my cat is Miso");
});
