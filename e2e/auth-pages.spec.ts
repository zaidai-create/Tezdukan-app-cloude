import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

const { auth, validation } = messages.en;

test.describe("sign in", () => {
  test("shows the brand, a +92 phone field and a password field", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: auth.loginTitle })).toBeVisible();
    await expect(page.getByRole("img", { name: "TezDukan" }).first()).toBeVisible();
    await expect(page.getByLabel(auth.phoneLabel)).toBeVisible();
    await expect(page.getByText("+92", { exact: true })).toBeVisible();
    await expect(page.getByLabel(auth.passwordLabel, { exact: true })).toBeVisible();
  });

  test("checks the form before sending it", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page.getByText(validation.phoneRequired)).toBeVisible();
    await expect(page.getByText(validation.passwordRequired)).toBeVisible();

    await page.getByLabel(auth.phoneLabel).fill("12345");
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill("not-checked-yet");
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page.getByText(validation.phoneInvalid)).toBeVisible();
  });

  test("shows and hides the password", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel(auth.passwordLabel, { exact: true });
    await password.fill("secret-123");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: auth.showPassword }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: auth.hidePassword }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("links to account creation and password reset", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: auth.createAccount }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("heading", { name: auth.signupTitle })).toBeVisible();

    await page.goto("/login");
    await page.getByRole("link", { name: auth.forgotPassword }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("meets WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await expectAccessible(page);
  });
});

test("signed-out visitors go to sign in, keeping the page they wanted", async ({ page }) => {
  await page.goto("/dukan");
  await expect(page).toHaveURL(/\/login\?next=%2Fdukan$/);
});

test.describe("sign up", () => {
  test("asks for a name, a valid number and a password of 8+ characters", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("button", { name: auth.signUp }).click();
    await expect(page.getByText(validation.nameShort)).toBeVisible();
    await expect(page.getByText(validation.phoneRequired)).toBeVisible();

    await page.getByLabel(auth.newPasswordLabel).fill("short");
    await page.getByRole("button", { name: auth.signUp }).click();
    await expect(page.getByText(validation.passwordShort)).toBeVisible();
  });

  test("meets WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/signup");
    await expectAccessible(page);
  });
});

test("forgot password meets WCAG 2.1 AA", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByLabel(auth.phoneLabel)).toBeVisible();
  await expectAccessible(page);
});

test.describe("code entry", () => {
  // E2E runs with SMS in Sandbox: no provider keys, codes go to the outbox.
  test.skip(
    (process.env.SMS_PROVIDER ?? "sandbox") !== "sandbox",
    "Only applies while SMS runs in Sandbox",
  );

  test("shows the Sandbox SMS panel without waiting for the code", async ({ page }) => {
    // Hold back the code lookup (a Server Action POST): the panel must not depend on it.
    await page.route("**/*", (route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"]
        ? route.abort()
        : route.fallback(),
    );
    await page.goto("/verify?phone=%2B923001234567&mode=signup");
    await expect(page.getByText(auth.sandboxSmsTitle)).toBeVisible();
    await expect(page.getByText(auth.sandboxUnavailable)).toBeVisible();
  });

  test("meets WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/verify?phone=%2B923001234567&mode=signup");
    await expect(page.getByLabel(auth.codeLabel)).toBeVisible();
    await expectAccessible(page);
  });
});

test.describe("phone field", () => {
  test("spaces the number while typing and accepts pasted +92 numbers", async ({ page }) => {
    await page.goto("/login");
    const phone = page.getByLabel(auth.phoneLabel);
    await phone.pressSequentially("03001234567");
    await expect(phone).toHaveValue("0300 1234567");
    await phone.fill("+92 300-765-4321");
    await expect(phone).toHaveValue("300 7654321");
  });
});

test("warns when Caps Lock is on", async ({ page }) => {
  await page.goto("/login");
  const password = page.getByLabel(auth.passwordLabel, { exact: true });
  await password.focus();
  await password.dispatchEvent("keydown", { key: "A", modifierCapsLock: true });
  await expect(page.getByText(auth.capsLockOn)).toBeVisible();
  await password.dispatchEvent("keydown", { key: "a", modifierCapsLock: false });
  await expect(page.getByText(auth.capsLockOn)).toBeHidden();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the finished logo straight away", async ({ page }) => {
    await page.goto("/login");
    const wordmark = page.locator('[data-part="wordmark"]').filter({ visible: true }).first();
    await expect(wordmark).toHaveCSS("opacity", "1");
  });
});

test("a tap before the page has loaded its scripts never puts the password in the URL", async ({
  page,
}) => {
  // Without the app's JavaScript the form is visible but not hydrated, as on a slow phone.
  await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel(auth.phoneLabel).fill("03001234567");
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill("secret-password");
  await page.getByRole("button", { name: auth.signIn }).click();
  await page.waitForLoadState("load");
  expect(page.url()).not.toContain("secret-password");
  expect(page.url()).not.toContain("password=");
});
