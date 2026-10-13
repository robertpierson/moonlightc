import { expect, type Page } from "@playwright/test";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** On phones the sections live in a slide-out menu. Wait for any previous menu to finish closing, open it, confirm. */
export async function openMenu(page: Page) {
  if (!isPhone(page)) return;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open chats" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

// These live inside Settings now.
const SETTINGS: Record<string, string> = { Connections: "Connectors", Customize: "Appearance", Mods: "Plugins & mods", "Local models": "Local models", Memory: "Memory", Usage: "Usage" };

export async function nav(page: Page, name: string) {
  await openMenu(page);
  if (SETTINGS[name]) {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: SETTINGS[name], exact: true }).click();
    return;
  }
  await page.getByRole("button", { name, exact: true }).click();
}
