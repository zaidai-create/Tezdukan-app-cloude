import { defineConfig, devices } from "@playwright/test";

// Signed-in journeys use the local stack and its demo seed; tests read the same keys as the app.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (CI injects the variables instead).
}

const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
// E2E_DEV=1 runs against `next dev` for quick iteration; the default is a production build,
// which is what users get (static shells, service worker, real bundle sizes).
const serverCommand =
  process.env.E2E_DEV === "1"
    ? `pnpm dev --port ${PORT}`
    : `pnpm build && pnpm start --port ${PORT}`;

const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["Pixel 7"].userAgent,
};
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    locale: "en-PK",
    timezoneId: "Asia/Karachi",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      testIgnore: /screenshots\//,
      use: { ...devices["Desktop Chrome"], ...mobile },
    },
    {
      name: "desktop",
      testIgnore: /screenshots\//,
      use: { ...devices["Desktop Chrome"], ...desktop },
    },
    {
      name: "screenshots-mobile",
      testMatch: /screenshots\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...mobile },
    },
    {
      name: "screenshots-desktop",
      testMatch: /screenshots\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], ...desktop },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: serverCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        // No street-map calls from tests: the address picker falls back to the nearest area.
        env: { GEOCODING_PROVIDER: "sandbox" },
        timeout: 300_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
