import { expect, test } from "@playwright/test";

test.skip(!!process.env.BASE_URL, "needs the local mock provider");

// Talk mode with a stand-in microphone and voice: what you "say" is sent, and the reply is read aloud.
test("talk: speak, it sends, the reply is read aloud, then it listens again", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__spoken = [] as string[];
    w.__listens = 0;
    class FakeRecognition {
      lang = "";
      interimResults = false;
      continuous = false;
      onstart: (() => void) | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        const n = ((w.__listens as number) += 1);
        setTimeout(() => {
          this.onstart?.();
          if (n === 1) this.onresult?.({ results: [[{ transcript: "Tell me a fun fact" }]] });
          this.onend?.();
        }, 50);
      }
      abort() {}
    }
    w.webkitSpeechRecognition = FakeRecognition;
    w.SpeechRecognition = FakeRecognition;
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      (w.__spoken as string[]).push(u.text);
      setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 50);
    };
  });
  await page.goto("/app");
  await page.getByRole("button", { name: "Connect a model" }).click();
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: /Custom/ }).click();
  await page.getByLabel("Base URL").fill("http://127.0.0.1:4010/v1");
  await page.getByRole("button", { name: "Check key and connect" }).click();
  await expect(page.getByText("models unlocked")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Talk (hands-free)" }).click();
  await expect(page.locator('[data-role="user"]').last()).toContainText("Tell me a fun fact");
  await expect(page.locator('[data-role="assistant"]').last()).not.toBeEmpty();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __listens: number }).__listens)).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Stop talking" }).click();
  await expect(page.getByRole("button", { name: "Talk (hands-free)" })).toBeVisible();
});
