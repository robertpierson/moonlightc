import { expect, test } from "@playwright/test";

test("course: take a lesson, answer its question, and see your progress", async ({ page, request }) => {
  await page.goto("/course");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/The MoonlightC course/);
  await expect(page.getByText("Start whenever you like.")).toBeVisible();

  // Every lesson page exists.
  const links = await page.locator("a[href^='/course/']").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  expect(links.length).toBeGreaterThan(15);
  for (const h of links) expect((await request.get(h)).status(), h).toBe(200);

  await page.getByRole("link", { name: "Start lesson 1" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What MoonlightC is");
  const check = page.getByRole("region", { name: "Check yourself" });
  await check.getByLabel("MoonlightC, with a markup").check();
  await expect(check.getByText("Not quite. Try another answer.")).toBeVisible();
  await check.getByLabel("The AI company, directly, with your own key").check();
  await expect(check.getByText(/^Right\./)).toBeVisible();
  await expect(check.getByText("Lesson done")).toBeVisible();

  await page.getByRole("navigation", { name: "Lessons" }).getByRole("link", { name: /Connect your first model/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connect your first model");
  await page.getByRole("link", { name: "Course", exact: true }).first().click();
  await expect(page.getByText(/^1 of \d+ lessons done$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/course/first-key");
});
