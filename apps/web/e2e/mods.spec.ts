import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { nav } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

// Serve the registry and example mod from the repo instead of GitHub, so the test is deterministic.
const ex = path.resolve(__dirname, "../../../examples/mods");
async function fakeRegistry(page: Page) {
  await page.route("https://raw.githubusercontent.com/robertpierson/moonlightc-mods/main/**", (r) => {
    const rel = new URL(r.request().url()).pathname.split("/main/")[1];
    const file = rel === "index.json" ? path.join(ex, "index.json") : path.join(ex, rel.replace(/^mods\//, ""));
    return r.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith(".json") ? "application/json" : "text/plain" });
  });
}


test("install the example mod: its tool, command, mode, theme and panel all work", async ({ page }) => {
  await fakeRegistry(page);
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await nav(page, "Mods");
  await page.getByRole("list", { name: "Featured" }).getByRole("button", { name: "View Unit Converter" }).click();
  const dialog = page.getByRole("dialog", { name: "Install Unit Converter?" });
  await expect(dialog).toContainText("convert_units");
  await expect(dialog).toContainText("Give the AI new tools");
  await dialog.getByRole("button", { name: "Install" }).click();
  await expect(page.getByText("Unit Converter installed.")).toBeVisible();
  await expect(page.frameLocator('iframe[title="Unit converter"]').locator("#out")).toHaveText(/0\.621371 mi/);

  // The AI uses the mod's tool (runs in the sandbox).
  await nav(page, "Chat");
  await page.getByLabel("Message", { exact: true }).fill("convert 10 km to mi");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("6.213712");

  // Slash command expands before sending.
  await page.getByLabel("Message", { exact: true }).fill("/tldr the moon is bright");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("three short bullet points");

  // Mode and theme from the mod.
  await page.getByRole("button", { name: "Mode", exact: true }).click();
  await page.getByRole("menuitem", { name: "More options" }).click();
  await expect(page.getByRole("menuitemradio", { name: "Explain like I'm 5" })).toBeVisible();
  await page.keyboard.press("Escape");
  await nav(page, "Customize");
  await page.getByRole("button", { name: "Aurora" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"))).toBe("#2fbf9b");
});
