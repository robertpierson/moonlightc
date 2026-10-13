import { expect, test, type Page } from "@playwright/test";
import { nav, openMenu } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

async function connect(page: Page) {
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("Chat and Code have their own sidebars; only recent chats show; chats move into projects", async ({ page }) => {
  // 20 old chats and one project, as if the person had been using MoonlightC for a while.
  await page.addInitScript(() => {
    if (localStorage.getItem("moonc:v1")) return;
    const chats = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, title: `Old chat ${i + 1}`, messages: [], updatedAt: 1_000 + i }));
    localStorage.setItem("moonc:v1", JSON.stringify({ connections: [], chats, favorites: [], modes: [], projects: [{ id: "p1", name: "Bakery", instructions: "", files: [], createdAt: 1 }] }));
  });
  await page.goto("/app");
  await openMenu(page);
  const sidebar = page.getByRole("navigation", { name: "Chats" }).locator("visible=true");
  const recent = sidebar.getByRole("region", { name: "Recent" });
  await expect(recent.getByRole("listitem")).toHaveCount(15);
  await expect(recent).toContainText("Old chat 20");
  await expect(recent).not.toContainText("Old chat 5");
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("visible=true").getByRole("button", { name: "Studio" })).toBeVisible();

  // Move a chat into the project from its menu, then see it inside the project folder.
  await recent.getByRole("button", { name: "Options for Old chat 20" }).click();
  await page.getByRole("menuitem", { name: "Move to project" }).click();
  await page.getByRole("menuitem", { name: "Bakery" }).click();
  await sidebar.getByRole("button", { name: "Expand Bakery" }).click();
  await expect(sidebar.getByRole("region", { name: "Your projects" })).toContainText("Old chat 20");

  // Older chats live on the All chats page.
  await sidebar.getByRole("button", { name: /All chats \(20\)/ }).click();
  await expect(page.getByRole("heading", { name: "All chats" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Old chat 1");

  // Code has its own sidebar: no chat sections, projects in folders.
  await nav(page, "Code");
  await openMenu(page);
  await expect(page.getByRole("navigation", { name: "Code projects" }).locator("visible=true")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("visible=true").getByRole("button", { name: "Studio" })).toHaveCount(0);
  await page.getByRole("button", { name: "New folder" }).locator("visible=true").click();
  await page.getByLabel("Folder name").locator("visible=true").fill("Client work");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "New project in Client work" }).locator("visible=true").click();
  await page.getByLabel("Name").fill("Menu site");
  await page.getByRole("button", { name: "Create project" }).click();
  await openMenu(page);
  await expect(page.getByRole("region", { name: "Folder Client work" }).locator("visible=true")).toContainText("Menu site");
});

test("code permission modes: Ask before changes waits for Apply; Bypass asks to confirm first", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/app");
  await connect(page);
  await nav(page, "Code");
  await page.getByRole("button", { name: "New code project" }).click();
  await page.getByLabel("Name").fill("Tips");
  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("combobox", { name: "Permission mode" }).click();
  await page.getByRole("option", { name: /Ask before changes/ }).click();
  await page.getByLabel("Describe a change").fill("build: a tip calculator");
  await page.getByRole("button", { name: "Send to code assistant" }).click();
  const ask = page.getByRole("group", { name: "Apply this change?" });
  await expect(ask).toContainText("/App.js");
  await ask.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Made a tip calculator")).toBeVisible({ timeout: 20000 });

  await page.getByRole("combobox", { name: "Permission mode" }).click();
  await page.getByRole("option", { name: /Bypass permissions/ }).click();
  await expect(page.getByRole("dialog", { name: "Bypass permissions?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("combobox", { name: "Permission mode" })).toHaveText(/Ask before changes/);
});

test("Settings > Usage adds up tokens per model; Cowork shows what it can use", async ({ page }) => {
  await page.goto("/app");
  await connect(page);
  await page.getByLabel("Message", { exact: true }).fill("hello there");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Echo from mock-fast: hello there")).toBeVisible();
  await nav(page, "Usage");
  await expect(page.getByRole("region", { name: "By model" })).toContainText("mock-fast");
  await expect(page.getByRole("region", { name: "Limits and credits" })).toContainText("127.0.0.1");

  await nav(page, "Chat");
  await openMenu(page);
  await page.getByRole("group", { name: "Mode" }).locator("visible=true").getByRole("button", { name: "Cowork" }).click();
  await expect(page.getByRole("region", { name: "What Cowork can use" })).toContainText("needs the desktop app");
  await expect(page.getByRole("button", { name: "Use this PC" })).toHaveCount(0);
});
