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

test("commands: / opens the menu, prompts fill in, /model switches, your own command works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await connectMock(page);
  const box = page.getByLabel("Message", { exact: true });

  // Typing "/" lists the commands; typing more narrows them; Tab fills one in.
  await box.fill("/");
  const menu = page.getByRole("listbox", { name: "Commands" });
  await expect(menu.getByRole("option", { name: /\/translate/ })).toBeVisible();
  await box.fill("/tra");
  await expect(menu.getByRole("option").first()).toContainText("/translate");
  await box.press("Tab");
  await expect(box).toHaveValue("/translate ");
  await box.pressSequentially("french good morning");
  await box.press("Enter");
  await expect(page.getByText("Echo from mock-fast: Translate this into french. Reply with only the translation:")).toBeVisible();

  // An app command does its thing without messaging the AI.
  await box.fill("/model other");
  await box.press("Escape");
  await box.press("Enter");
  await expect(page.getByText("Switched to mock-other.")).toBeVisible();
  await expect(box).toHaveValue("");
  await box.fill("/summarize");
  await box.press("Escape");
  await box.press("Enter");
  await expect(page.getByText(/Echo from mock-other: Summarize our conversation so far/)).toBeVisible();

  // Your own command, made in Settings > Commands.
  await nav(page, "Settings");
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Commands", exact: true }).click();
  await page.getByLabel("Name").fill("shout");
  await page.getByLabel("What it sends").fill("Say this loudly: {input}");
  await page.getByRole("button", { name: "Add command" }).click();
  await expect(page.getByText("/shout", { exact: true })).toBeVisible();
  await saveSettings(page);
  await nav(page, "Chat");
  await box.fill("/sh");
  await expect(page.getByRole("listbox", { name: "Commands" }).getByRole("option").first()).toContainText("Yours");
  await box.fill("/shout hello");
  await box.press("Escape");
  await box.press("Enter");
  await expect(page.getByText("Echo from mock-other: Say this loudly: hello")).toBeVisible();
  expect(errors).toEqual([]);
});
