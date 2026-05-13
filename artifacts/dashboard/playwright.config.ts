import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Apply Wizard e2e tests.
 *
 * Running locally (outside Replit):
 *   PLAYWRIGHT_BASE_URL=http://localhost:<PORT> pnpm --filter @workspace/dashboard run test:e2e
 *
 * Running inside the Replit environment:
 *   Use the built-in Playwright test runner (runTest() callback) which provides
 *   a correctly configured browser environment. The e2e test files in ./e2e/
 *   describe the full test plan and assertions.
 *
 * Prerequisites:
 *   - Both the dashboard (pnpm dev) and API server must be running
 *   - Admin user seeded: username "admin", password "TestPassword123!", email_verified=true
 *   - At least one current base resume in base_resume_versions (is_current=true)
 *   - VITE_ENABLE_APPLY_WIZARD=true in artifacts/dashboard/.env
 */

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  `http://localhost:${process.env.PORT ?? 5173}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
