import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

test("out of credit: one click to a free model, and the reply is tried again", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/credit/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("3 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Message", { exact: true }).fill("I'm broke, say hi");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "out of credit" })).toBeVisible();
  await page.getByRole("button", { name: "Use a free model" }).click();
  await expect(page.getByText("Echo from mock-free:free")).toBeVisible();
});
