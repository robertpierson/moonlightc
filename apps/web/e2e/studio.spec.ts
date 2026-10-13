import { expect, test, type Page } from "@playwright/test";
import { openMenu } from "./helpers";

// Provider calls are replaced with fakes here; real-key runs happen at the phase gate.
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function withFalKey(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("moonc:v1")) return;
    localStorage.setItem(
      "moonc:v1",
      JSON.stringify({ connections: [{ id: "f1", providerId: "fal", apiKey: "fal-test", label: "fal (images, video, audio)", models: [], addedAt: 0 }], chats: [], favorites: [], modes: [] }),
    );
  });
  await page.route("**/api/studio/models", async (r) => {
    const kind = r.request().postDataJSON().kind;
    await r.fulfill({ json: { models: [{ id: `fal-ai/test-${kind}`, name: `Test ${kind} model` }] } });
  });
  await page.goto("/app");
  await openMenu(page);
  await page.getByRole("button", { name: "Studio" }).click();
}

test("studio needs a media key first", async ({ page }) => {
  await page.goto("/app");
  await openMenu(page);
  await page.getByRole("button", { name: "Studio" }).click();
  await page.getByRole("button", { name: "Add a key" }).click();
  await expect(page.getByRole("dialog", { name: "Models and keys" })).toBeVisible();
});

test("generate an image, keep it in the gallery, remix and send to chat", async ({ page }) => {
  let sent: Record<string, unknown> = {};
  await page.route("**/api/studio/generate", async (r) => {
    sent = r.request().postDataJSON();
    await r.fulfill({ json: { mediaType: "image/png", base64: PNG, meta: { fal: { seed: 42 } } } });
  });
  await withFalKey(page);
  await expect(page.getByRole("combobox", { name: "Studio model" })).toHaveText(/Test image model/);
  await page.getByLabel("Describe what you want").fill("a moon over the sea");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Saved to your gallery.")).toBeVisible();
  expect(sent).toMatchObject({ kind: "image", modelId: "fal-ai/test-image", prompt: "a moon over the sea", aspectRatio: "1:1" });
  const card = page.getByRole("listitem").filter({ hasText: "a moon over the sea" });
  await expect(card.getByText(/seed 42/)).toBeVisible();

  await page.reload();
  await openMenu(page);
  await page.getByRole("button", { name: "Studio" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "a moon over the sea" })).toBeVisible();

  await page.getByRole("listitem").filter({ hasText: "a moon over the sea" }).getByRole("button", { name: "Send to chat" }).click();
  await expect(page.getByRole("list", { name: "Attachments" })).toBeVisible();
});

test("video: start, poll until done, download into the gallery", async ({ page }) => {
  let polls = 0;
  await page.route("**/api/studio/video", async (r) => {
    const b = r.request().postDataJSON();
    if (b.action !== "status") return r.fulfill({ json: { operation: { id: "op1" } } });
    polls++;
    await r.fulfill({ json: polls < 2 ? { status: "pending" } : { status: "completed", url: "https://media.example/v.mp4", mediaType: "video/mp4" } });
  });
  await page.route("https://media.example/v.mp4", (r) => r.fulfill({ body: Buffer.from("fake-mp4"), contentType: "video/mp4" }));
  await withFalKey(page);
  await page.getByRole("tab", { name: "Video" }).click();
  await expect(page.getByRole("combobox", { name: "Studio model" })).toHaveText(/Test video model/);
  await page.getByLabel("Describe what you want").fill("waves at night");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Saved to your gallery.")).toBeVisible({ timeout: 30000 });
  expect(polls).toBe(2);
});
