import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createConfirmedUser, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * A brand-new account lands on the shopping home and applies for a dukan from Account: the
 * business, then the owner's CNIC and a photo of the shop. It waits for the TezDukan team; the
 * demo admin approves it from Approvals, and the applicant's status page says it is ready.
 */
const { auth, onboarding, account, applications, admin } = messages.en;
const PASSWORD = "dukan-e2e-123";
const DEMO_PASSWORD = "TezDukan-Demo-1";
// A tiny real PNG: the phone shrinks every photo before upload, so it must decode.
const PHOTO = {
  name: "photo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
};

test.describe("onboarding", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = `0396${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
    await createConfirmedUser(`+92${phone.slice(1)}`, PASSWORD, "Naveed Shah");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(`+92${phone.slice(1)}`).catch(() => undefined);
  });

  test("a new account applies for a dukan and an admin approves it", async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const shopName = `Naveed Store ${phone.slice(-4)}`;
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: auth.signIn }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await page.goto("/account", { waitUntil: "networkidle" });
    await expectAccessible(page);
    await page.getByRole("link", { name: account.registerDukan }).first().click();

    await expect(page.getByRole("heading", { name: onboarding.form.dukanTitle })).toBeVisible();
    await page.getByLabel(onboarding.form.dukanName).fill(shopName);
    await page.getByRole("combobox", { name: onboarding.form.area }).click();
    await page.getByRole("option", { name: "Latifabad Unit 6" }).click();
    await page.getByLabel(onboarding.form.address).fill("Shop 12, Main Market");
    await page.getByRole("button", { name: onboarding.form.next }).click();

    // Documents: the submit button waits until the CNIC and all three photos are in.
    const submit = page.getByRole("button", { name: onboarding.form.submitDukan });
    await expect(submit).toBeDisabled();
    await page.getByLabel(onboarding.documents.cnic).fill("4130312345671");
    await expect(page.getByLabel(onboarding.documents.cnic)).toHaveValue("41303-1234567-1");
    await page.getByLabel(onboarding.documents.front).setInputFiles(PHOTO);
    await page.getByLabel(onboarding.documents.back).setInputFiles(PHOTO);
    await page.getByLabel(onboarding.documents.shopPhoto).setInputFiles(PHOTO);
    await expect(page.getByText(onboarding.documents.added)).toHaveCount(3, { timeout: 20_000 });
    await expectAccessible(page);
    await submit.click();

    await expect(page).toHaveURL(/\/register\/status\?sent=1$/, { timeout: 20_000 });
    await expect(page.getByText(applications.sentTitle)).toBeVisible();
    await expect(page.getByText(applications.pending, { exact: true })).toBeVisible();

    // The TezDukan team sees the documents and approves.
    const team = await browser.newContext({ locale: "en-PK", timezoneId: "Asia/Karachi" });
    await team.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
    const adminPage = await team.newPage();
    await adminPage.goto("/login", { waitUntil: "networkidle" });
    await adminPage.getByLabel(auth.phoneLabel).fill("03000000001");
    await adminPage.getByLabel(auth.passwordLabel, { exact: true }).fill(DEMO_PASSWORD);
    await adminPage.getByRole("button", { name: auth.signIn }).click();
    await expect(adminPage).not.toHaveURL(/\/login/);
    await adminPage.goto("/admin/approvals", { waitUntil: "networkidle" });
    const card = adminPage.getByRole("listitem").filter({ hasText: shopName });
    await expect(card.getByText("41303-1234567-1")).toBeVisible();
    await expect(card.getByRole("img", { name: admin.approvals.cnicFront })).toBeVisible();
    await card.getByRole("button", { name: admin.actions.approve }).click();
    await expect(adminPage.getByText(admin.actions.approved)).toBeVisible();
    // Once approved, the documents stay one tap away on the dukan in the directory.
    await adminPage.goto(`/admin/shops?q=${encodeURIComponent(shopName)}`, {
      waitUntil: "networkidle",
    });
    const row = adminPage.getByRole("listitem").filter({ hasText: shopName });
    await expect(row.getByTitle(admin.list.cnicSent).filter({ visible: true })).toBeVisible();
    await row.getByRole("button").first().click();
    const sheet = adminPage.getByRole("dialog");
    await expect(sheet.getByText("41303-1234567-1")).toBeVisible();
    await expect(sheet.getByRole("img", { name: admin.approvals.cnicBack })).toBeVisible();
    await team.close();

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(applications.approved, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: applications.openDukan })).toBeVisible();
  });
});
