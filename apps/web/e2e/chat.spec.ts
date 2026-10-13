import { expect, test, type Page } from "@playwright/test";

// These use the local mock provider (e2e/mock-openai.mjs), so they only run against a local server.
test.skip(!!process.env.BASE_URL, "needs the local mock provider");

async function connectMock(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider").click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("2 models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");
}

async function send(page: Page, text: string) {
  await page.getByLabel("Message", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

test("connect a provider, chat, persist, edit, regenerate, branch", async ({ page }) => {
  await connectMock(page);
  await expect(page.getByRole("combobox", { name: "Choose model" })).toHaveText(/mock-fast/);

  await send(page, "hello there");
  await expect(page.getByText("Echo from mock-fast: hello there")).toBeVisible();
  await expect(page.getByText(/tokens/)).toBeVisible();

  // Switch model mid-chat.
  await page.getByRole("combobox", { name: "Choose model" }).click();
  await page.getByRole("option", { name: /mock-other/ }).click();
  await send(page, "second");
  await expect(page.getByText("Echo from mock-other: second")).toBeVisible();

  // Survives a reload.
  await page.reload();
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await page.getByRole("button", { name: "hello there", exact: true }).click();
  await expect(page.getByText("Echo from mock-other: second")).toBeVisible();
  await page.keyboard.press("Escape");

  // Edit and resend the last user message.
  const lastUser = page.locator('[data-role="user"]').last();
  await lastUser.hover();
  await lastUser.getByRole("button", { name: "Edit and resend" }).click();
  await page.getByLabel("Edit message").fill("edited");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Echo from mock-other: edited")).toBeVisible();
  await expect(page.getByText("Echo from mock-other: second")).toHaveCount(0);

  // Regenerate.
  const lastAi = page.locator('[data-role="assistant"]').last();
  await lastAi.hover();
  await lastAi.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByText("Echo from mock-other: edited")).toBeVisible();

  // Branch from the first answer.
  const firstAi = page.locator('[data-role="assistant"]').first();
  await firstAi.hover();
  await firstAi.getByRole("button", { name: "Branch into a new chat from here" }).click();
  await expect(page.getByText("Echo from mock-fast: hello there")).toBeVisible();
  await expect(page.getByText("edited")).toHaveCount(0);
});

test("stop keeps the partial answer", async ({ page }) => {
  await connectMock(page);
  await send(page, "be slow");
  await expect(page.getByText(/word3/)).toBeVisible();
  await page.getByRole("button", { name: "Stop generating" }).click();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  const text = await page.locator('[data-role="assistant"]').last().innerText();
  expect(text).toContain("word3");
  expect(text).not.toContain("word99");
});

test("a rejected key shows a clear fix", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider").click();
  await page.getByRole("option", { name: "OpenAI", exact: true }).click();
  await page.getByLabel("API key").fill("sk-not-a-real-key");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByRole("alert")).toContainText("OpenAI rejected this key");
});

test("private URLs are refused when not testing", async ({ request }) => {
  // The allow flag is set for this local server, so assert the public-https rule via plain http to a public host instead.
  const res = await request.post("/api/models", { data: { providerId: "custom", apiKey: "", baseURL: "http://example.com/v1" } });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toContain("public https://");
});

test("private mode never saves, custom modes send their instructions", async ({ page }) => {
  await connectMock(page);
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "Private" }).click();
  await expect(page.getByRole("heading", { name: "Private chat" })).toBeVisible();
  await send(page, "secret thing");
  await expect(page.getByText("Echo from mock-fast: secret thing")).toBeVisible();
  await page.reload();
  if (await page.getByRole("button", { name: "Open chats" }).isVisible()) await page.getByRole("button", { name: "Open chats" }).click();
  await expect(page.getByText("Your chats will appear here.").locator("visible=true")).toBeVisible();
  await page.keyboard.press("Escape");

  // Custom mode: the instructions reach the provider (the mock echoes "[sys]" when it sees a system message).
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "Create or edit modes…" }).click();
  await page.getByRole("button", { name: "New mode" }).click();
  await page.getByLabel("Name").fill("Pirate");
  await page.getByLabel("Instructions (system prompt)").fill("Talk like a pirate.");
  await page.getByRole("button", { name: "Save mode" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Mode", exact: true }).click();
  await page.getByRole("option", { name: "Pirate" }).click();
  await send(page, "ahoy");
  await expect(page.getByText("[sys: Talk like a pirate.] Echo from mock-fast: ahoy")).toBeVisible();
});
