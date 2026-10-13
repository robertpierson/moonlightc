import { expect, test } from "@playwright/test";
import { nav } from "./helpers";

test.skip(!!process.env.BASE_URL, "needs the local fakes");

test("scan Gmail receipts for subscriptions, see the monthly total, get a renewal reminder", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("moonc:v1")) return;
    localStorage.setItem(
      "moonc:v1",
      JSON.stringify({
        connections: [{ id: "m", providerId: "custom", apiKey: "", baseURL: "http://127.0.0.1:4010/v1", label: "Mock", models: [{ id: "mock-fast", name: "mock-fast" }], addedAt: 0 }],
        lastModel: { connectionId: "m", modelId: "mock-fast" },
        oauth: { google: { accessToken: "g-access", expiresAt: Date.now() + 3_600_000, scopes: [], enabled: true, email: "shawn@example.com" } },
        chats: [],
        favorites: [],
        modes: [],
      }),
    );
  });
  await page.goto("/app");
  await nav(page, "Subscriptions");
  await page.getByRole("button", { name: "Scan my Gmail" }).click();
  await expect(page.getByText(/Found 1 subscriptions in 1 receipts/)).toBeVisible();
  const list = page.getByRole("list", { name: "Your subscriptions" });
  await expect(list).toContainText("Netflix Standard");
  await expect(list.getByRole("link", { name: /Manage/ })).toHaveAttribute("href", "https://www.netflix.com/account");
  await expect(page.getByRole("region", { name: "Monthly total" })).toContainText("15.49");

  // Add one renewing tomorrow: a reminder shows after reload.
  await page.getByText("Add one yourself").click();
  await page.getByLabel("Service").fill("Gym");
  await page.getByLabel("Price").fill("30");
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA"); // local YYYY-MM-DD
  await page.getByLabel("Next renewal").fill(tomorrow);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(list).toContainText("Gym");
  await page.reload();
  await expect(page.getByText("Gym renews tomorrow ($30.00).")).toBeVisible();
});
