import { hash } from "bcrypt-ts";
import { expect, test as setup } from "@playwright/test";
import postgres from "postgres";

const E2E_EMAIL = "e2e@test.dev";
const E2E_PASSWORD = "E2e-Password-123!";

// Cold `next dev --turbo` compiles of the /chat route (which pulls in the full
// artifact stack) can exceed 30s on the first hit; production (CI) is instant.
setup.setTimeout(process.env.CI ? 60_000 : 240_000);

/**
 * Seeds a deterministic test user directly in Postgres and authenticates
 * through the real login UI, persisting the session so the chat-facing e2e
 * tests (which /chat now requires) run as a signed-in user.
 *
 * Safe to re-run: the user insert is skipped when the email already exists,
 * and the stored hash is regenerated only on first insert (bcrypt compare is
 * verified by NextAuth's credentials provider on every login).
 */
setup("seed and authenticate the e2e user", async ({ page }) => {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      "POSTGRES_URL is required to seed the e2e test user. Configure it in .env.local or via CI secrets."
    );
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    const existing =
      await sql`select id from "User" where email = ${E2E_EMAIL} limit 1`;
    if (existing.length === 0) {
      const passwordHash = await hash(E2E_PASSWORD, 10);
      await sql`
        insert into "User" (email, password, "firstName", "lastName")
        values (${E2E_EMAIL}, ${passwordHash}, 'E2E', 'User')
      `;
    }
  } finally {
    await sql.end();
  }

  // Log in through the real UI (NextAuth credentials flow).
  await page.goto("/login");
  await page.getByPlaceholder("user@acme.com").fill(E2E_EMAIL);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  // The login page pushes to /chat on success. Give the first (cold) dev
  // compile of /chat time to finish, then verify the composer is reachable.
  await page.waitForURL(/\/chat/, { timeout: 60_000 });
  await page.goto("/chat");
  await expect(page.getByTestId("multimodal-input")).toBeVisible({
    timeout: process.env.CI ? 30_000 : 150_000,
  });

  // Persist the authenticated session for the e2e project.
  await page.context().storageState({
    path: "tests/.auth/e2e-user.json",
  });
});