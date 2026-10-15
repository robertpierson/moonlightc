import { expect, test } from "@playwright/test";
import { nav } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

test("describe an app: the AI writes files, it runs live, changes can be seen and undone, and it downloads", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await nav(page, "Code");
  await page.getByRole("button", { name: "New code project" }).click();
  await page.getByLabel("Name").fill("Tips");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByLabel("Describe a change").fill("build: a tip calculator");
  await page.getByRole("button", { name: "Send to code assistant" }).click();
  await expect(page.getByText("Made a tip calculator")).toBeVisible({ timeout: 20000 });

  // Live preview, built in the app (no outside service), in a sandboxed iframe.
  await page.getByRole("tab", { name: "Preview" }).click();
  const preview = page.getByTestId("code-preview").frameLocator("iframe").first();
  await expect(preview.getByRole("heading", { name: "Tip calculator" })).toBeVisible({ timeout: 45000 });

  await page.getByRole("tab", { name: /Changes/ }).click();
  await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "App.js" }).click();
  await expect(page.getByText("Made a tip calculator").last()).toBeVisible();
  await page.getByRole("button", { name: "Undo this change" }).click();
  await expect(page.getByText("Undo: Made a tip calculator")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "More project actions" }).click();
  await page.getByRole("menuitem", { name: "Download .zip" }).click();
  expect((await download).suggestedFilename()).toBe("Tips.zip");
});
