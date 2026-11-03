import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createConfirmedUser, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * Google Play requires account deletion from the app and from a web link: /data-deletion
 * works signed out (how to ask) and signed in (the request, then sign-out).
 */
const { auth, dataDeletion: d } = messages.en;
const PASSWORD = "leave-e2e-123";
const throwawayNumber = () => `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

test("anyone can open the deletion page and see how to ask", async ({ page }) => {
  await page.goto("/data-deletion");
  await expect(page.getByRole("heading", { level: 1, name: d.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: d.signedOutTitle })).toBeVisible();
  await expectAccessible(page);
});

test.describe("signed in", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = throwawayNumber();
    await createConfirmedUser(toE164(phone), PASSWORD, "Leaving User");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("a person asks to delete their account and is signed out", async ({ page }) => {
    await page.goto("/login?next=/data-deletion", { waitUntil: "networkidle" });
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page).toHaveURL(/\/data-deletion$/);

    const submit = page.getByRole("button", { name: d.button });
    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox").check();
    await submit.click();
    await expect(page.getByRole("heading", { name: d.doneTitle })).toBeVisible({ timeout: 15_000 });

    // Signed out: the app is protected again.
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });
});
