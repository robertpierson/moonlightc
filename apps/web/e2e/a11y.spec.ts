import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// WCAG 2.1 AA checks on every screen, in light and dark.
async function audit(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

async function nav(page: Page, name: string) {
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await page.waitForTimeout(300);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ["/", "/download", "/privacy"]) {
      test(`page ${path}`, async ({ page }) => {
        await page.goto(path);
        expect(await audit(page)).toEqual([]);
      });
    }

    test("app screens", async ({ page }) => {
      await page.goto("/app");
      await page.getByLabel("Message", { exact: true }).waitFor();
      expect(await audit(page), "chat").toEqual([]);
      for (const s of ["Studio", "Connections", "Mods", "Customize"]) {
        await nav(page, s);
        expect(await audit(page), s).toEqual([]);
      }
    });
  });
}
