import { expect, test, type Page } from "@playwright/test";
import { openMenu } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock servers");

async function openConnections(page: Page) {
  await openMenu(page);
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

  await openMenu(page);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByLabel("Message", { exact: true }).fill("add 2 3");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Allow the AI to use add (calc)?")).toBeVisible();
  await page.getByRole("button", { name: "Allow once" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("sum=5");
});

test("connectors that need a sign-in: discovery, registration, PKCE, then tools", async ({ page }) => {
  await page.goto("/app");
  await openConnections(page);
  await page.getByRole("button", { name: "Add a connector" }).click();
  await page.getByLabel("Name").fill("Notes");
  await page.getByLabel("Server URL").fill("http://127.0.0.1:4040/mcp");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  // The fake server's sign-in page approves at once and sends us back to the app.
  await expect(page.getByText("Notes connected with 1 tools")).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("list", { name: "Your connectors" })).toContainText("Notes");
  await expect(page.getByRole("button", { name: "Sign in again" })).toBeVisible();
  expect(page.url()).not.toContain("mcpauth");
});

test("one-click gallery starts the service's own sign-in", async ({ page }) => {
  let asked = "";
  await page.route("**/api/mcp/auth", async (r) => {
    asked = r.request().postDataJSON().url;
    await r.fulfill({ json: { result: "REDIRECT", authorizationUrl: "http://127.0.0.1:4040/authorize-fake", state: "s1", clientInformation: {}, codeVerifier: "v" } });
  });
  await page.route("http://127.0.0.1:4040/authorize-fake", (r) => r.fulfill({ body: "Notion sign-in page", contentType: "text/plain" }));
  await page.goto("/app");
  await openConnections(page);
  await page.getByRole("region", { name: "One-click connections" }).getByRole("button", { name: /Notion/ }).click();
  await expect(page.getByText("Notion sign-in page")).toBeVisible();
  expect(asked).toBe("https://mcp.notion.com/mcp");
});

test("X: a wrong bearer token is refused with a clear message", async ({ page }) => {
  await page.goto("/app");
  await openConnections(page);
  await page.getByLabel("X bearer token").fill("not-a-real-token");
  await page.getByRole("button", { name: "Check and connect" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "X rejected this token" })).toBeVisible({ timeout: 15000 });
});
