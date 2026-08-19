import { expect, test as setup } from "@playwright/test";

const E2E_PASSWORD = "E2e-Password-123!";

// Cold `next dev --turbo` compiles of /register and /chat (which pull in the
// full artifact stack) can exceed 30s on the first hit; production (CI) is
// instant because the app is pre-built.
setup.setTimeout(process.env.CI ? 60_000 : 240_000);

/**
 * Registers (and thereby signs in) a fresh e2e user through the real UI, then
 * persists the session so the chat-facing e2e tests run authenticated.
 *
 * Using the app's own registration means the server performs the DB insert with
 * its own env — the test runner never needs POSTGRES_URL, which CI forks may
 * not receive as a secret. The email is unique per run, so repeat runs never
 * collide with users left in the database.
 */
setup("register and authenticate the e2e user", async ({ page }) => {
  const email = `e2e+${Date.now()}@test.dev`;

  await page.goto("/register");
  await page.getByLabel("First Name").fill("E2E");
  await page.getByLabel("Last Name").fill("User");
  await page.getByPlaceholder("user@acme.com").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Account" }).click();

  // Registration auto-signs-in and pushes toward /onboarding. The composer
  // appearing on /chat proves the session works (onboarding is bypassed via
  // E2E_SKIP_ONBOARDING, which only the test web server sets).
  await page.waitForURL(/\/onboarding|\/chat/, { timeout: 60_000 });
  await page.goto("/chat");
  await expect(page.getByTestId("multimodal-input")).toBeVisible({
    timeout: process.env.CI ? 30_000 : 150_000,
  });

  // Persist the authenticated session for the e2e project.
  await page.context().storageState({
    path: "tests/.auth/e2e-user.json",
  });
});