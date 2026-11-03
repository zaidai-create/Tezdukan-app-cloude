import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createDukandar, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * A new dukandar stocks the shop from Products: the common-products pack adds a dozen items
 * in one tap, then one is re-priced and its stock counted.
 */
const { auth, shopProducts: p } = messages.en;
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

test.describe("products", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = throwawayNumber();
    await createDukandar(toE164(phone), PASSWORD, "Sana Products");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("a new dukan adds common products in one tap and re-prices one", async ({ page }) => {
    await signIn(page, phone);
    await page.goto("/dukan/products", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: p.starter.title })).toBeVisible();
    await expectAccessible(page);

    const addAll = page.getByRole("button", { name: /^Add \d+ products$/ });
    await addAll.click();
    await expect(page.getByText(/products added$/)).toBeVisible({ timeout: 15_000 });

    const shelf = page.getByRole("list", { name: p.title });
    const first = shelf.getByRole("listitem").first().getByRole("button");
    await expect(first).toContainText(/in stock/);
    await first.click();
    const price = page.getByRole("dialog").getByLabel(p.sellPrice);
    await price.fill("999");
    await page.getByRole("dialog").getByRole("button", { name: p.save }).click();
    await expect(page.getByText(/updated$/)).toBeVisible();
    await expect(shelf).toContainText("Rs 999");
  });
});
