import { test } from "@playwright/test";
import { nav } from "../helpers";
test("shots", async ({ page }, info) => {
  await page.goto("/app");
  await page.getByLabel("Message", { exact: true }).waitFor();
  await page.screenshot({ path: `../../docs/screens/r-chat-${info.project.name}.png` });
  await nav(page, "Settings");
  await page.screenshot({ path: `../../docs/screens/r-settings-${info.project.name}.png` });
  await page.getByRole("navigation", { name: "Settings" }).getByRole("button", { name: "Modes" }).click();
  await page.screenshot({ path: `../../docs/screens/r-modes-${info.project.name}.png` });
});
