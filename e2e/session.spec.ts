import { expect, type Page, test } from "@playwright/test";
import { deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * Phase 1 exit journeys against the local stack with the demo seed (`pnpm seed`): sign up and
 * verify, sign in to each role's home, stay signed in, switch roles without signing out, and
 * sign out.
 */
const { auth, roles, home, common } = messages.en;
const DEMO_PASSWORD = "TezDukan-Demo-1";

async function signIn(page: Page, phone: string) {
  await page.goto("/login");
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: auth.signIn }).click();
}

// The device has chosen English, as if the user tapped it on the sign-in screen. Without a
// choice, sign-in adopts the profile's saved language (some demo users read Roman Urdu or Urdu).
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

const greeting = (name: string) => home.greetingNamed.replace("{name}", name);

test("a dukandar lands on the dukan home and stays signed in", async ({ page }) => {
  await signIn(page, "0300 0000002");
  await expect(page).toHaveURL(/\/dukan$/);
  await expect(page.getByRole("heading", { name: greeting("Ahmed") })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/dukan$/);
  await expect(page.getByRole("heading", { name: greeting("Ahmed") })).toBeVisible();
});

test("a distributor lands on the distributor dashboard", async ({ page }) => {
  await signIn(page, "0300 0000003");
  await expect(page).toHaveURL(/\/distributor$/);
  await expect(page.getByRole("heading", { name: greeting("Faisal") })).toBeVisible();
});

test("a signed-in visitor to the sign-in page goes home instead", async ({ page }) => {
  await signIn(page, "0300 0000006");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
});

test("one account switches roles without signing out", async ({ page }, testInfo) => {
  // Each viewport uses its own multi-role account: the active role lives on the profile.
  await signIn(page, testInfo.project.name === "mobile" ? "0300 0000007" : "0300 0000008");
  await expect(page).toHaveURL(/\/(dukan|distributor)?$/);

  await page.getByRole("button", { name: roles.switchRole }).first().click();
  await page.getByRole("button", { name: /Indus Traders/ }).click();
  await expect(page).toHaveURL(/\/distributor$/);

  await page.getByRole("button", { name: roles.switchRole }).first().click();
  await page.getByRole("button", { name: /TezDukan/ }).click();
  await expect(page).toHaveURL(/\/dukan$/);

  // Back to shopping, which is also where the next run starts.
  await page.getByRole("button", { name: roles.switchRole }).first().click();
  await page.getByRole("button", { name: roles.customer }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("signing out returns to sign in and protects the app again", async ({ page }) => {
  await signIn(page, "0300 0000006");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account");
  await page.getByRole("button", { name: common.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});

test.describe("sign up", () => {
  // A number from a range no operator uses, different per run and per viewport.
  const phone = `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
  const e164 = `+92${phone.slice(1)}`;

  test.afterAll(async () => {
    await deleteUserByPhone(e164);
  });

  test("a new number signs up, verifies with the Sandbox code and lands home", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel(auth.nameLabel).fill("Bilal Qureshi");
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.newPasswordLabel).fill("dukan-e2e-123");
    await page.getByRole("button", { name: auth.signUp }).click();

    await expect(page).toHaveURL(/\/verify\?/);
    const code = page.locator("p", { hasText: auth.sandboxCodeLabel }).locator("span[dir=ltr]");
    await expect(code).toHaveText(/^\d{6}$/, { timeout: 15_000 });
    await page.getByLabel(auth.codeLabel).pressSequentially((await code.textContent()) ?? "");

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: greeting("Bilal") })).toBeVisible();
  });
});
