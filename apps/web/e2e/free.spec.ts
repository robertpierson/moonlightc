import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

test("Free: a model at its limit is skipped and the next free model answers", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  // The free-plan companies are listed, each opening its key page.
  const start = page.getByRole("region", { name: "Start free" });
  await expect(start.getByRole("button", { name: "Groq" })).toBeVisible();
  await expect(start.getByRole("button", { name: "Cerebras" })).toBeVisible();

  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /^OpenRouter/ }).click();
  await page.getByLabel("API key", { exact: true }).fill("sk-or-free-plan-test");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("3 models unlocked")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Use OpenRouter in Free" })).toBeChecked();
  await page.keyboard.press("Escape");

  await page.getByRole("combobox", { name: "Choose model" }).click();
  await page.getByRole("option", { name: /^Free/ }).click();
  await expect(page.getByRole("combobox", { name: "Choose model" })).toHaveText(/Free/);

  await page.getByLabel("Message", { exact: true }).fill("hello from free");
  await page.getByRole("button", { name: "Send message" }).click();
  // mock-big-70b:free is tried first (bigger) and answers 429; the next free model replies, and says so.
  await expect(page.getByText("Echo from mock-small-8b:free: hello from free")).toBeVisible();
  await expect(page.getByText("Free: OpenRouter, mock-small-8b:free")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /limit|error|went wrong/i })).toHaveCount(0);
});

test("Free: switching a key out of Free removes Free from the model menu", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /^OpenRouter/ }).click();
  await page.getByLabel("API key", { exact: true }).fill("sk-or-free-plan-test");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("3 models unlocked")).toBeVisible();
  await page.getByRole("switch", { name: "Use OpenRouter in Free" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Choose model" }).click();
  await expect(page.getByRole("option", { name: /^Free/ })).toHaveCount(0);
});
