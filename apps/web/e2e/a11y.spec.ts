import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { nav as go } from "./helpers";

// WCAG 2.1 AA checks on every screen, in light and dark.
async function audit(page: Page) {
  // Colors are checked once entrance fades have finished (mid-fade text is see-through on purpose).
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity && !(a.timeline && !(a.timeline instanceof DocumentTimeline))).map((a) => a.finished.catch(() => {}))));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`);
}

async function nav(page: Page, name: string) {
  await go(page, name);
  await page.waitForTimeout(300);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const path of ["/", "/models", "/download", "/learn", "/course", "/course/claude-code", "/questions", "/privacy"]) {
      test(`page ${path}`, async ({ page }) => {
        await page.goto(path);
        expect(await audit(page)).toEqual([]);
      });
    }

    test("app screens", async ({ page }) => {
      await page.goto("/app");
      await page.getByLabel("Message", { exact: true }).waitFor();
      expect(await audit(page), "chat").toEqual([]);
      for (const s of ["Studio", "Projects", "Settings", "Connections", "Mods", "Customize", "Usage", "Memory", "Cowork", "Code"]) {
        await nav(page, s);
        expect(await audit(page), s).toEqual([]);
      }
      // Every Appearance option (Full control), Commands, and the / menu open in the message box.
      await nav(page, "Customize");
      await page.getByRole("radio", { name: /^Full control/ }).click();
      expect(await audit(page), "Appearance, Full control").toEqual([]);
      await nav(page, "Commands");
      expect(await audit(page), "Commands").toEqual([]);
      await nav(page, "Chat");
      await page.getByLabel("Message", { exact: true }).fill("/");
      expect(await audit(page), "command menu").toEqual([]);
    });
  });
}
