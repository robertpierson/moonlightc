import type { Page } from "@playwright/test";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** On phones the sections live in a slide-out menu; open it first (waiting for the app to load). */
export async function openMenu(page: Page) {
  if (isPhone(page)) await page.getByRole("button", { name: "Open chats" }).click();
}

export async function nav(page: Page, name: string) {
  await openMenu(page);
  await page.getByRole("button", { name, exact: true }).click();
}
