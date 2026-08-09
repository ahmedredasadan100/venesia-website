import { defineConfig, devices } from "playwright/test";

const localBaseUrl = "http://127.0.0.1:3100";
const baseURL = process.env.E2E_BASE_URL?.replace(/\/$/u, "") || localBaseUrl;
const usesExternalServer = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".tmp-qa/playwright/results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { outputFolder: ".tmp-qa/playwright/report", open: "never" }]],
  use: {
    baseURL,
    locale: "ar-EG",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: usesExternalServer
    ? undefined
    : {
        command: "npm run start -- --hostname 127.0.0.1 --port 3100",
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
