import { expect, test } from "@playwright/test";
import { nav } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local fake Google");

test("connect Google with a real OAuth round trip, then the AI searches Gmail", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await nav(page, "Connections");
  await page.getByRole("button", { name: "Connect Google" }).click();
  await expect(page.getByText("Google connected as shawn@example.com.")).toBeVisible();
  expect(page.url()).not.toContain("#"); // tokens removed from the address bar
  await nav(page, "Connections");
  await expect(page.getByRole("region", { name: "Google" })).toContainText("shawn@example.com");

  await nav(page, "Chat");
  await page.getByLabel("Message", { exact: true }).fill("check my email");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Used gmail search (google)")).toBeVisible();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Lunch at noon?");

  await page.getByLabel("Message", { exact: true }).fill("what channels are on my youtube?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Moon Science");
});

test("a forged sign-in result is refused", async ({ request }) => {
  const res = await request.get("/api/oauth/google/callback?code=test-code&state=forged", { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers().location).toContain("oauth_error=");
});

test("Spotify: sign in, then the AI says what's playing", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("moonc:v1")) return;
    localStorage.setItem("moonc:v1", JSON.stringify({ connections: [{ id: "m", providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4010/v1", label: "Mock", models: [{ id: "mock-fast", name: "mock-fast" }], addedAt: 0 }], lastModel: { connectionId: "m", modelId: "mock-fast" }, chats: [], favorites: [], modes: [] }));
  });
  await page.goto("/app");
  await nav(page, "Connections");
  await page.getByRole("button", { name: "Connect Spotify" }).click();
  await expect(page.getByText("Spotify connected as shawn@music.example.")).toBeVisible();
  await nav(page, "Chat");
  await page.getByLabel("Message", { exact: true }).fill("what's playing?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Clair de Lune");
});
