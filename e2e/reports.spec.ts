import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createDukandar, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/** A dukandar opens the hisab from Home, sees a clear empty state, and switches the period. */
const { auth, shopDash, shopReport: r } = messages.en;
const PASSWORD = "dukan-e2e-123";

const throwawayNumber = () => `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;

async function signIn(page: Page, phone: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/dukan$/);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

test.describe("hisab", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = throwawayNumber();
    await createDukandar(toE164(phone), PASSWORD, "Hisab Kiryana");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("opens from Home and switches between periods", async ({ page }) => {
    await signIn(page, phone);
    await page.getByRole("link", { name: shopDash.report }).click();
    await expect(page).toHaveURL(/\/dukan\/reports$/);
    await expect(page.getByRole("heading", { name: r.title, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: r.emptyTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: r.ranges.today })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expectAccessible(page);

    await page.getByRole("link", { name: r.ranges.week }).click();
    await expect(page).toHaveURL(/range=week/);
    await expect(page.getByRole("link", { name: r.ranges.week })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
