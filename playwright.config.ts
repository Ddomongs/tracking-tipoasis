import { defineConfig, devices } from "@playwright/test";
import { INTERNAL_TEST_PASSWORD } from "./tests/internal-auth";

const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  webServer: skipWebServer
    ? undefined
    : {
        command: "npm run dev -- --port 43210",
        url: "http://127.0.0.1:43210",
        reuseExistingServer: true,
        timeout: 120_000,
        env: { INTERNAL_ACCESS_PASSWORD: INTERNAL_TEST_PASSWORD }
      },
  use: {
    baseURL: "http://127.0.0.1:43210",
    trace: "on-first-retry",
    // Customers are in Korea; CI runners are UTC, so pin the browser clock zone.
    timezoneId: "Asia/Seoul",
    locale: "ko-KR"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
