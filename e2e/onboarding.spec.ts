import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createConfirmedUser, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * A brand-new account is asked how it will use TezDukan and registers its dukan. Locally new
 * dukans wait for approval; with the testing flag on they are approved and land on /dukan.
 */
const { auth, onboarding } = messages.en;
const PASSWORD = "dukan-e2e-123";

test.describe("onboarding", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = `0396${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
    await createConfirmedUser(`+92${phone.slice(1)}`, PASSWORD, "Naveed Shah");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(`+92${phone.slice(1)}`).catch(() => undefined);
  });

  test("a new account chooses dukan and registers it", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: auth.signIn }).click();

    await expect(page).toHaveURL(/\/start$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: onboarding.title })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("link", { name: new RegExp(onboarding.dukan.title) }).click();

    await expect(page.getByRole("heading", { name: onboarding.form.dukanTitle })).toBeVisible();
    await page.getByLabel(onboarding.form.dukanName).fill("Naveed General Store");
    await page.getByRole("combobox", { name: onboarding.form.area }).click();
    await page.getByRole("option", { name: "Latifabad Unit 6" }).click();
    await page.getByLabel(onboarding.form.address).fill("Shop 12, Main Market");
    await page.getByRole("button", { name: onboarding.form.submitDukan }).click();

    await expect(
      page
        .getByRole("heading", { name: onboarding.form.pendingTitle })
        .or(page.getByText("Naveed General Store is ready. Welcome to TezDukan!")),
    ).toBeVisible({ timeout: 20_000 });
  });
});
