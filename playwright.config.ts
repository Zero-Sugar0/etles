import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Limit workers to prevent browser crashes */
  workers: process.env.CI ? 2 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: process.env.CI ? 60 * 1000 : 120 * 1000,
  expect: {
    timeout: process.env.CI ? 15 * 1000 : 30 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "e2e",
      testMatch: /e2e\/.*.test.ts/,
      testIgnore: /auth\.test\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/e2e-user.json",
      },
    },
    {
      name: "e2e-auth",
      testMatch: /auth\.test\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm dev",
    url: `${baseURL}/ping`,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
    env: {
      /*
       * Guarantee a non-empty AUTH_SECRET for the spawned server.
       * In CI, GitHub Actions passes `secrets.AUTH_SECRET` which resolves
       * to an empty string when the repository secret is unset, causing
       * NextAuth to throw "MissingSecret" on every /api/auth request.
       * This test-only fallback keeps `pnpm test` green regardless.
       * Playwright merges this over process.env, so other vars are kept.
       */
      AUTH_SECRET:
        process.env.AUTH_SECRET ||
        "e2e-test-only-secret-8f3a47b6c92d1e05a7b4c6d2f9e1a3b5",
      /*
       * tests/e2e/auth.setup.ts seeds and authenticates a test user, and the
       * chat tests sign in through that session. This test-only env skips the
       * Upstash-vector-backed onboarding gate so /chat is reachable without
       * external onboarding state. Real deployments never set it.
       */
      E2E_SKIP_ONBOARDING: process.env.E2E_SKIP_ONBOARDING || "1",
    },
  },
});
