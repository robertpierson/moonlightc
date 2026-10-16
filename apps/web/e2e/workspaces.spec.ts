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
  await expect(recent.getByRole("listitem")).toHaveCount(5);
  await expect(recent).toContainText("Old chat 20");
  await expect(recent).not.toContainText("Old chat 15");
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("visible=true").getByRole("button", { name: "Studio" })).toBeVisible();

  // Move a chat into the project from its menu, then see it inside the project folder.
  await recent.getByRole("button", { name: "Options for Old chat 20" }).click();
  await page.getByRole("menuitem", { name: "Move to project" }).click();
  await page.getByRole("menuitem", { name: "Bakery" }).click();
  await sidebar.getByRole("button", { name: "Expand Bakery" }).click();
  await expect(sidebar.getByRole("region", { name: "Your projects" })).toContainText("Old chat 20");

  // Older chats live behind "See more".
  await sidebar.getByRole("button", { name: /See more \(15\)/ }).click();
  await expect(page.getByRole("heading", { name: "All chats" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Old chat 1");

  // Code has its own sidebar: no chat sections, projects in folders.
  await nav(page, "Code");
  await openMenu(page);
  await expect(page.getByRole("navigation", { name: "Code projects" }).locator("visible=true")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" }).locator("visible=true").getByRole("button", { name: "Studio" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Code projects" }).locator("visible=true").getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill("Menu site");
  await page.getByRole("button", { name: "Create project" }).click();
  await openMenu(page);
  await expect(page.getByRole("list", { name: "Chats in Menu site" }).locator("visible=true")).toContainText("No chats yet");
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
  const plans = page.getByRole("region", { name: "Your plans" });
  await expect(plans).toContainText("tokens");
  await page.getByLabel("Plan name").fill("Claude Pro");
  await page.getByLabel("Monthly price in US dollars").fill("20");
  await page.getByRole("button", { name: "Add plan" }).click();
  await expect(plans).toContainText("Claude Pro");
  await expect(plans).toContainText("$20.00 in plans");

  await nav(page, "Chat");
  await openMenu(page);
  await page.getByRole("group", { name: "Mode" }).locator("visible=true").getByRole("button", { name: "Cowork" }).click();
  await expect(page.getByRole("region", { name: "What Cowork can use" })).toContainText("needs the desktop app");
  // Live site (accounts on): a signed-out phone is pointed at sign-in to reach its home PC.
  if (process.env.BASE_URL) await expect(page.getByRole("region", { name: "What Cowork can use" })).toContainText("to work on your home PC");
  await expect(page.getByRole("button", { name: "Use this PC" })).toHaveCount(0);
});

test("code projects hold several chats, saved and reopened", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/app");
  await connect(page);
  await nav(page, "Code");
  await page.getByRole("button", { name: "New code project" }).click();
  await page.getByLabel("Name").fill("Tips");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Describe a change").fill("hello code");
  await page.getByRole("button", { name: "Send to code assistant" }).click();
  await expect(page.getByText("Echo from mock-fast: hello code")).toBeVisible();
  await openMenu(page);
  const chats = page.getByRole("list", { name: "Chats in Tips" }).locator("visible=true");
  await expect(chats).toContainText("hello code");
  // A second chat in the same project starts empty; the first one comes back when opened.
  await page.getByRole("button", { name: "New chat in Tips" }).locator("visible=true").click();
  await expect(page.getByText("Echo from mock-fast: hello code")).toHaveCount(0);
  await openMenu(page);
  await chats.getByRole("button", { name: "hello code", exact: true }).click();
  await expect(page.getByText("Echo from mock-fast: hello code")).toBeVisible();
  await page.reload();
  await nav(page, "Code");
  await openMenu(page);
  await page.getByRole("list", { name: "Chats in Tips" }).locator("visible=true").getByRole("button", { name: "hello code", exact: true }).click();
  await expect(page.getByText("Echo from mock-fast: hello code")).toBeVisible();
  // One chat can be deleted without deleting the project.
  await openMenu(page);
  const list = page.getByRole("list", { name: "Chats in Tips" }).locator("visible=true");
  await list.getByRole("button", { name: "Options for chat hello code" }).click();
  await page.getByRole("menuitem", { name: "Move to Trash" }).click();
  await expect(list).not.toContainText("hello code");
  // Code has its own Trash: restoring puts the chat back in its project.
  // Deleting the open chat returns to the project, which closes the phone's menu; open it again there.
  await page.waitForTimeout(500);
  if ((await page.getByRole("dialog").count()) === 0) await openMenu(page);
  await page.getByText("Trash (1)").locator("visible=true").click();
  await page.getByRole("button", { name: "Restore hello code" }).locator("visible=true").click();
  await expect(list).toContainText("hello code");
  await expect(page.getByRole("button", { name: "Options for Tips" }).locator("visible=true")).toBeVisible();
});
