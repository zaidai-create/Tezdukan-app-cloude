import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createDukandar, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * Phase 2 journeys: a dukandar finds stock, orders it from a distributor and follows the
 * order; the cart splits by distributor with each one's minimum; the demo dukan's order
 * history and distributor khata read from real data. Needs the demo seed (`pnpm seed`).
 * Journeys that place orders use their own fresh dukan, so runs never share a cart.
 */
const { auth, ordering: o, product } = messages.en;
const PASSWORD = "dukan-e2e-123";

const throwawayNumber = () => `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;
/** Fills simple ICU arguments ("{name}", "{count, number}") with plain values. */
const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}(, [a-z]+)?\\}`), value),
    template,
  );

async function signIn(page: Page, phone: string, password = PASSWORD) {
  // Wait for the form to hydrate: typing earlier can be reset when React takes over.
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/dukan$/);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

test.describe("ordering", () => {
  // Made in beforeAll: Playwright can run it again in the same worker, and a user with orders
  // is never fully deleted, so each run needs its own number.
  let phone = "";

  test.beforeAll(async () => {
    phone = throwawayNumber();
    await createDukandar(toE164(phone), PASSWORD, "Bilal Ahmed");
  });

  test.afterAll(async () => {
    // The shop and its (cancelled) order stay: orders are financial records.
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("a dukandar finds a product, orders it and can cancel the order", async ({ page }) => {
    await signIn(page, phone);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Delivery");
    await expectAccessible(page);

    // Search by a typo and add a carton.
    await page.getByRole("link", { name: o.searchHint }).click();
    await expect(page).toHaveURL(/\/dukan\/search/);
    await page.getByLabel(o.searchLabel).fill("tapal danedr");
    const name = "Tapal Danedar Black Tea 950 g";
    const card = page.getByRole("article", { name }).first();
    await expect(card).toBeVisible();
    await card.getByRole("radio", { name: fill(o.pieces, { count: "12" }) }).click();
    await card.getByRole("button", { name: fill(product.addNamed, { name }) }).click();
    await expect(card.getByLabel(fill(product.quantityInCart, { count: "1" }))).toBeVisible();

    // The cart bar appears and leads to the cart, split by distributor.
    const cartBar = page.locator('[data-slot="cart-bar"]');
    await expect(cartBar).toContainText("1 item");
    await cartBar.click();
    await expect(page).toHaveURL(/\/dukan\/cart$/);
    await expect(page.getByRole("heading", { name: o.cart.title })).toBeVisible();
    await expectAccessible(page);

    // Checkout with cash on delivery and the first slot.
    await page.getByRole("link", { name: /Checkout/ }).click();
    await expect(page).toHaveURL(/\/dukan\/checkout$/);
    await expect(page.getByRole("radio", { name: new RegExp(o.checkout.cod) })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expectAccessible(page);
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(page).toHaveURL(/\/dukan\/orders\/placed\?ids=/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: o.success.title })).toBeVisible();
    await page.getByRole("link", { name: o.success.track }).click();

    // The order page shows the delivery code; cancel it.
    await expect(page).toHaveURL(/\/dukan\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText(o.order.deliveryCode)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: o.order.cancel }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: o.order.cancelReasons.mistake }).click();
    await dialog.getByRole("button", { name: o.order.cancel }).click();
    await expect(page.getByText(o.status.cancelled).first()).toBeVisible();
  });

  test("the cart shows each distributor's minimum before checkout", async ({ page }) => {
    await signIn(page, phone);
    await page.goto("/dukan/search?q=shan%20biryani");
    const card = page.getByRole("article", { name: "Shan Biryani Masala 50 g" }).first();
    await expect(card).toBeVisible();
    await card.getByRole("radio", { name: o.unitPiece }).click();
    await card
      .getByRole("button", { name: fill(product.addNamed, { name: "Shan Biryani Masala 50 g" }) })
      .click();
    await page.goto("/dukan/cart");
    await expect(page.getByText(/to reach .*'s minimum of/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Checkout/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Leave the cart empty for the next run.
    await page
      .getByRole("button", { name: fill(product.decrease, { name: "Shan Biryani Masala 50 g" }) })
      .click();
    await expect(page.getByRole("heading", { name: o.cart.emptyTitle })).toBeVisible();
  });
});

test("the demo dukan sees its orders and its distributor khata", async ({ page }) => {
  await signIn(page, "0300 0000002", "TezDukan-Demo-1");
  await page.goto("/dukan/orders?tab=past");
  await expect(page.getByText("TD-000104")).toBeVisible();
  await page.goto("/dukan/ledger");
  await expect(page.getByRole("heading", { name: o.ledger.title })).toBeVisible();
  await page.getByRole("link", { name: /Indus Traders/ }).click();
  await expect(page.getByRole("heading", { name: o.ledger.statement })).toBeVisible();
  await expect(page.getByText(o.ledger.kind.credit_note)).toBeVisible();
  await expectAccessible(page);
});
