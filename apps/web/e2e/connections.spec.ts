import { expect, test, type Page } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock servers");

async function openConnections(page: Page) {
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name: "Connections" }).click();
}

test("add an MCP connector, then the AI uses its tool after the user approves", async ({ page }) => {
  // Chat model: the mock OpenAI-compatible provider.
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // A wrong token gives a clear error.
  await openConnections(page);
  await page.getByRole("button", { name: "Add a connector" }).click();
  await page.getByLabel("Name").fill("Calc");
  await page.getByLabel("Server URL").fill("http://127.0.0.1:4020/mcp");
  await page.getByLabel("Access token (optional)").fill("wrong");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't connect to Calc" })).toBeVisible();

  await page.getByLabel("Access token (optional)").fill("test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Calc connected with 1 tools")).toBeVisible();
  await expect(page.getByRole("list", { name: "Your connectors" })).toContainText("Calc");

  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("add 2 3");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Allow the AI to use add (calc)?")).toBeVisible();
  await page.getByRole("button", { name: "Allow once" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("sum=5");
});
