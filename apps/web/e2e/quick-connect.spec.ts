import { expect, test } from "@playwright/test";

test("quick connect opens the key page and picks up the copied key", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "clipboard permissions");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  const quick = page.getByRole("region", { name: "Quick connect" });
  const popup = page.waitForEvent("popup");
  await quick.getByRole("button", { name: "ChatGPT" }).click();
  expect((await popup).url()).toContain("platform.openai.com");
  await expect(quick.getByRole("status")).toContainText("Waiting for your ChatGPT key");
  // Something that isn't a key is ignored; a key is filled in and checked straight away.
  await page.evaluate(() => navigator.clipboard.writeText("hello there"));
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(quick.getByRole("status")).toBeVisible();
  await page.evaluate(() => navigator.clipboard.writeText("sk-not-a-real-key-1234567890"));
  await page.evaluate(() => dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("API key", { exact: true })).toHaveValue("sk-not-a-real-key-1234567890");
  await expect(page.getByRole("alert")).toContainText("OpenAI rejected this key");
});
