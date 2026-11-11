import { expect, type Page, test } from "@playwright/test";
import { createConfirmedUser, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";
import { openRoleSwitcher } from "./support/roles";

/**
 * Phase 1 exit journeys against the local stack with the demo seed (`pnpm seed`): sign up and
 * verify, sign in to each role's home, stay signed in, switch roles without signing out, and
 * sign out.
 */
const { auth, roles, home, common, shopDash } = messages.en;
const DEMO_PASSWORD = "TezDukan-Demo-1";
const switcherLabels = { switchRole: roles.switchRole, menu: common.menu };

async function signIn(page: Page, phone: string) {
  // Wait for the form to come alive: typing into it before hydration can be wiped.
  await page.goto("/login", { waitUntil: "networkidle" });
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
  await expect(page.getByText(greeting("Ahmed"))).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/dukan$/);
  await expect(page.getByText(greeting("Ahmed"))).toBeVisible();
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

  await openRoleSwitcher(page, switcherLabels);
  await page.getByRole("button", { name: /Indus Traders/ }).click();
  await expect(page).toHaveURL(/\/distributor$/);

  await openRoleSwitcher(page, switcherLabels);
  await page.getByRole("button", { name: /TezDukan/ }).click();
  await expect(page).toHaveURL(/\/dukan$/);
  // Staff without khata access still get a working Home, not an error.
  await expect(page.getByRole("heading", { name: shopDash.liveOrders })).toBeVisible();

  // Back to shopping, which is also where the next run starts.
  await openRoleSwitcher(page, switcherLabels);
  await page.getByRole("button", { name: roles.customer }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("signing out returns to sign in and protects the app again", async ({ page }) => {
  await signIn(page, "0300 0000006");
  await expect(page).toHaveURL(/\/$/);
  // Wait for hydration: a tap before the click handler attaches does nothing.
  await page.goto("/account", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: common.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
});

/** A number from the unused 0399 range, different per run and per viewport. */
const throwawayNumber = () => `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;

test.describe("sign up", () => {
  const phone = throwawayNumber();
  const e164 = toE164(phone);

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

test.describe("password reset", () => {
  // Its own verified account: sign-up just texted the other number, and SMS codes are limited
  // to one every 30 seconds per number.
  const phone = throwawayNumber();
  const e164 = toE164(phone);

  test.beforeAll(async () => {
    await createConfirmedUser(e164, "dukan-e2e-123", "Zainab Shah");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(e164);
  });

  test("a forgotten password is reset with an SMS code", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByRole("button", { name: auth.sendCode }).click();

    await expect(page).toHaveURL(/\/verify\?.*mode=recovery/);
    const code = page.locator("p", { hasText: auth.sandboxCodeLabel }).locator("span[dir=ltr]");
    await expect(code).toHaveText(/^\d{6}$/, { timeout: 15_000 });
    await page.getByLabel(auth.codeLabel).pressSequentially((await code.textContent()) ?? "");

    await expect(page).toHaveURL(/\/forgot-password\/new$/, { timeout: 15_000 });
    await page.getByLabel(auth.newPasswordLabel).fill("dukan-e2e-456");
    await page.getByRole("button", { name: auth.updatePassword }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // The new password works from a fresh device.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill("dukan-e2e-456");
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page.getByRole("heading", { name: greeting("Zainab") })).toBeVisible();
  });
});

test("Ctrl+K opens the command palette and jumps to a page", async ({ page }) => {
  await signIn(page, "0300 0000002");
  await expect(page).toHaveURL(/\/dukan$/);
  // The shortcut listener attaches on hydration; a key pressed before it is simply lost.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: messages.en.command.title });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill(messages.en.nav.account);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dukan\/account$/);
});

test("a question typed into the palette goes to Munshi", async ({ page }) => {
  await signIn(page, "0300 0000002");
  await expect(page).toHaveURL(/\/dukan$/);
  // The shortcut listener attaches on hydration; a key pressed before it is simply lost.
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("dialog", { name: messages.en.command.title })
    .getByRole("combobox")
    .fill("aaj ki sale");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: messages.en.nav.munshi })).toBeVisible();
  await expect(page.getByRole("textbox", { name: messages.en.munshi.inputLabel })).toHaveValue(
    "aaj ki sale",
  );
});
