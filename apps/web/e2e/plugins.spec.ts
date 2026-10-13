import { expect, test, type Page } from "@playwright/test";
import { nav } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

// A fake GitHub repo holding one Claude plugin, so the test doesn't depend on the network.
const FILES: Record<string, string> = {
  ".claude-plugin/plugin.json": JSON.stringify({ name: "acme", description: "Acme helpers", version: "1.2.0" }),
  "skills/haiku/SKILL.md": "---\nname: haiku\ndescription: Write haiku about anything\n---\nAlways answer in a 5-7-5 haiku.",
  "commands/shout.md": "---\ndescription: Shout it\nargument-hint: [text]\n---\nRepeat this loudly: $ARGUMENTS",
  "agents/pirate.md": "---\nname: Pirate captain\ndescription: Talks like a pirate\n---\nArr, talk like a pirate.",
  ".mcp.json": JSON.stringify({ mcpServers: { local: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.js"] } } }),
  "hooks/hooks.json": "{}",
};

async function fakeGitHub(page: Page) {
  await page.route("https://api.github.com/repos/acme/tools/git/trees/**", (r) =>
    r.fulfill({ json: { tree: Object.keys(FILES).map((path) => ({ path, type: "blob" })) }, headers: { "access-control-allow-origin": "*" } }),
  );
  await page.route("https://raw.githubusercontent.com/acme/tools/HEAD/**", (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.split("/HEAD/")[1]);
    return FILES[rel] !== undefined ? r.fulfill({ body: FILES[rel], headers: { "access-control-allow-origin": "*" } }) : r.fulfill({ status: 404, body: "" });
  });
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("install a Claude plugin: skill, slash command and agent mode all work", async ({ page }) => {
  await fakeGitHub(page);
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");

  await nav(page, "Mods");
  await page.getByLabel("GitHub link or owner/repo").fill("https://github.com/acme/tools");
  await page.getByRole("button", { name: "Find plugin" }).click();
  const preview = page.getByRole("region", { name: "Plugin acme" });
  await expect(preview).toContainText("1 skill, 1 command, 1 mode");
  await expect(preview).toContainText("/shout [text]: Shout it");
  await expect(preview).toContainText("Hooks");
  await expect(preview).toContainText('MCP server "local"');
  await preview.getByRole("button", { name: "Install plugin" }).click();
  await expect(page.getByRole("list", { name: "Installed plugins" })).toContainText("acme");

  await nav(page, "Chat");
  await send(page, "/shout hello moon");
  await expect(page.getByText("Echo from mock-fast: Repeat this loudly: hello moon")).toBeVisible();

  await send(page, "please use skill acme:haiku");
  await expect(page.getByText("Using skill acme:haiku")).toBeVisible();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("5-7-5 haiku");

  await page.getByRole("button", { name: "Mode", exact: true }).click();
  await page.getByRole("menuitem", { name: "More options" }).click();
  await page.getByRole("menuitemradio", { name: "Pirate captain" }).click();
  await expect(page.getByRole("button", { name: "Mode", exact: true })).toHaveText(/Pirate captain/);
  await send(page, "ahoy");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("[sys: Arr, talk like a pirate.");
});

test("a link that isn't GitHub gets a clear message", async ({ page }) => {
  await page.goto("/app");
  await nav(page, "Mods");
  await page.getByLabel("GitHub link or owner/repo").fill("https://example.com/plugin");
  await page.getByRole("button", { name: "Find plugin" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Paste a GitHub link" })).toBeVisible();
});
