import { expect, test } from "@playwright/test";

// Chrome only offers "Install" over HTTPS, so this runs against a deployed URL (BASE_URL).
test("Chrome considers the web app installable", async ({ page, browserName }) => {
  test.skip(!process.env.BASE_URL || browserName !== "chromium", "needs an https deployment");
  await page.goto("/app");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
});
