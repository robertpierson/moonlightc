import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL, screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : [
        { command: "node e2e/mock-openai.mjs", url: "http://127.0.0.1:4010/v1/models", reuseExistingServer: true },
        { command: "pnpm start", url: baseURL, reuseExistingServer: true, env: { MOONC_ALLOW_PRIVATE_URLS: "1" } },
      ],
});
