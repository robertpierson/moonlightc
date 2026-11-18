import { expect, test, type Page } from "@playwright/test";
import { nav, saveSettings } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

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
  const box = page.getByLabel("Message", { exact: true });
  await box.fill(text);
  await box.press("Enter");
}

test("memory meter: a nearly full chat offers to continue in a new chat with a summary", async ({ page }) => {
  await connectMock(page);
  await send(page, "/model other");
  await send(page, "hello there");
  await expect(page.getByText("Echo from mock-other: hello there")).toBeVisible();
  await expect(page.getByText(/\d+% of memory used/)).toBeVisible();
  await page.getByRole("button", { name: "Continue in a new chat" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(/^Continuing from my chat/);
});

test("monthly budget: a reminder near it, and paid messages stop once it's reached", async ({ page }) => {
  await connectMock(page);
  await nav(page, "Usage");
  await page.getByLabel("Monthly budget in dollars").fill("1");
  await page.getByRole("switch", { name: "Stop paid messages when I reach it" }).click();
  await saveSettings(page);
  await nav(page, "Chat");
  await send(page, "/model other");
  await send(page, "one");
  await expect(page.getByText("Echo from mock-other: one")).toBeVisible();
  await send(page, "two");
  await expect(page.getByText("Echo from mock-other: two")).toBeVisible();
  await send(page, "three");
  await expect(page.getByText(/You've reached your monthly budget of \$1\.00/)).toBeVisible();
  await expect(page.getByText("Echo from mock-other: three")).toHaveCount(0);
  // Every paid model waits, even one without a listed price.
  await send(page, "/model fast");
  await send(page, "four");
  await expect(page.getByText("Echo from mock-fast: four")).toHaveCount(0);
});
