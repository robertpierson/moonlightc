import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
// Vercel preview deployments are login-protected; this header lets tests through (secret lives in .env.local / CI secrets).
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = process.env.BASE_URL && bypass ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" } : undefined;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL, extraHTTPHeaders, screenshot: "only-on-failure", launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : [
        { command: "node e2e/mock-openai.mjs", url: "http://127.0.0.1:4010/v1/models", reuseExistingServer: false },
        { command: "node e2e/mock-mcp.mjs", port: 4020, reuseExistingServer: false },
        { command: "node e2e/mock-google.mjs", port: 4030, reuseExistingServer: false },
        { command: "node e2e/mock-mcp-oauth.mjs", port: 4040, reuseExistingServer: false },
        { command: "pnpm start", url: baseURL, reuseExistingServer: true, env: {
            MOONC_ALLOW_PRIVATE_URLS: "1",
            // Fake Google so the sign-in and Gmail flow can be tested end to end.
            GOOGLE_CLIENT_ID: "test-client",
            GOOGLE_CLIENT_SECRET: "test-secret",
            MOONC_TEST_OPENROUTER: "http://127.0.0.1:4010",
            MOONC_TEST_GOOGLE_AUTH_URL: "http://127.0.0.1:4030/auth",
            MOONC_TEST_GOOGLE_TOKEN_URL: "http://127.0.0.1:4030/token",
            MOONC_TEST_GOOGLE_API: "http://127.0.0.1:4030",
            SPOTIFY_CLIENT_ID: "test-spotify",
            SPOTIFY_CLIENT_SECRET: "test-spotify-secret",
            MOONC_TEST_SPOTIFY_AUTH_URL: "http://127.0.0.1:4030/spotify/authorize",
            MOONC_TEST_SPOTIFY_TOKEN_URL: "http://127.0.0.1:4030/spotify/token",
            MOONC_TEST_SPOTIFY_API: "http://127.0.0.1:4030",
          },
        },
      ],
});
