import { type Browser, expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

/**
 * The customer app end to end: the demo shopper browses and searches, orders from TezDukan in
 * the app, the demo dukandar accepts and delivers it from Online orders, and the shopper rates
 * what they bought. Needs the demo seed (three live dukans).
 */
const { auth, storefront, nav, customerOrders } = messages.en;
const DEMO_PASSWORD = "TezDukan-Demo-1";

async function signedIn(browser: Browser, baseURL: string, phone: string) {
  const context = await browser.newContext({ locale: "en-PK", timezoneId: "Asia/Karachi" });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL }]);
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

test("a shopper searches, orders, and rates what the dukandar delivered", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const base = baseURL ?? "";
  const shopper = await signedIn(browser, base, "03000000006");
  await expect(shopper).toHaveURL(/\/$/);
  await expect(shopper.getByRole("heading", { name: storefront.nearbyTitle })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    for (const label of [nav.home, nav.categories, nav.nearby, nav.cart, nav.account]) {
      await expect(shopper.getByRole("link", { name: label, exact: true }).last()).toBeVisible();
    }
  }
  await expectAccessible(shopper);

  // Categories are grouped the way a shopper thinks of them.
  await shopper.goto(`${base}/categories`, { waitUntil: "networkidle" });
  await expect(shopper.getByRole("heading", { name: storefront.groups.kitchen })).toBeVisible();

  // Search understands Roman Urdu: "doodh" finds milk, and a product opens up close.
  await shopper.goto(`${base}/search`, { waitUntil: "networkidle" });
  await shopper.getByRole("searchbox", { name: storefront.searchLabel }).fill("doodh");
  const found = shopper.locator('[data-slot="product-tile"]').filter({ hasText: /milk/i }).first();
  await expect(found).toBeVisible();
  await found.getByRole("heading").getByRole("button").click();
  const sheet = shopper.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: storefront.product.addToCart })).toBeVisible();
  await expectAccessible(shopper);
  await sheet.getByRole("button", { name: storefront.product.close }).click();
  await expect(sheet).toBeHidden();

  await shopper.goto(`${base}/shops/tezdukan`, { waitUntil: "networkidle" });
  await expect(shopper.getByRole("heading", { level: 1, name: "TezDukan" })).toBeVisible();
  // Two items clear TezDukan's Rs 300 minimum order.
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("link", { name: /View cart/i }).click();

  await expect(shopper).toHaveURL(/\/cart$/);
  // The demo shopper has a saved address, so checkout shows it instead of empty fields.
  await expect(shopper.getByText(storefront.cart.addressTitle, { exact: true })).toBeVisible();
  await shopper.getByRole("button", { name: storefront.cart.instructions.callOnArrival }).click();
  // If something is missing, just leave it out.
  await shopper.getByRole("radio", { name: storefront.cart.unavailable.remove }).click();
  await shopper.getByRole("button", { name: /^Place order/ }).click();
  await expect(shopper).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1$/, { timeout: 20_000 });
  // The "Order placed!" moment, then the tracking screen underneath.
  await expect(shopper.getByText(customerOrders.celebrate.title)).toBeVisible();
  await shopper.getByRole("button", { name: customerOrders.celebrate.track }).click();
  const orderNumber =
    (await shopper.locator("header [data-order-number]").first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^C-\d{6}$/);

  const dukandar = await signedIn(browser, base, "03000000002");
  await dukandar.goto(`${base}/dukan/customer-orders`, { waitUntil: "networkidle" });
  await dukandar.getByRole("link").filter({ hasText: orderNumber }).click();
  await expect(dukandar.getByRole("heading", { level: 1, name: orderNumber })).toBeVisible();
  await dukandar.getByRole("button", { name: customerOrders.actions.accept }).click();
  await expect(dukandar.getByText(customerOrders.moved.accepted)).toBeVisible();

  // One item is not on the shelf: the dukandar sees the customer's choice and removes it.
  await expect(dukandar.getByText(customerOrders.unavailable.choice.remove)).toBeVisible();
  await dukandar
    .getByRole("button", { name: customerOrders.unavailable.notAvailable })
    .first()
    .click();
  await dukandar.getByRole("button", { name: customerOrders.unavailable.remove }).click();
  await expect(dukandar.getByText(customerOrders.unavailable.removed)).toBeVisible();

  await shopper.reload({ waitUntil: "networkidle" });
  await expect(shopper.getByText(customerOrders.status.accepted).first()).toBeVisible();
  await expect(shopper.getByText(customerOrders.unavailable.changesTitle)).toBeVisible();

  // Delivered: the shopper gives stars to what they bought, with one tap.
  await dukandar.getByRole("button", { name: customerOrders.actions.delivered }).click();
  await expect(dukandar.getByText(customerOrders.moved.delivered)).toBeVisible();
  await shopper.reload({ waitUntil: "networkidle" });
  await expect(
    shopper.getByRole("heading", { name: customerOrders.rateItems.title }),
  ).toBeVisible();
  await shopper
    .getByRole("radio", { name: /^5 stars for/ })
    .first()
    .click();
  await expect(shopper.getByText(customerOrders.rateItems.saved)).toBeVisible();

  // Something was missing: the shopper reports it in two taps; it goes to support and the dukan.
  await shopper.getByRole("button", { name: customerOrders.problem.button }).click();
  await shopper.getByRole("radio", { name: customerOrders.problem.reasons.missing_item }).click();
  await shopper.getByRole("button", { name: customerOrders.problem.send }).click();
  await expect(shopper.getByText(customerOrders.problem.sent)).toBeVisible();
  await expect(shopper.getByText(customerOrders.problem.reported)).toBeVisible();

  await dukandar.context().close();
  await shopper.context().close();
});

test("checkout shows the bill and the cancel rule; the shopper cancels from the order's menu", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const base = baseURL ?? "";
  const shopper = await signedIn(browser, base, "03000000006");
  await shopper.goto(`${base}/shops/tezdukan`, { waitUntil: "networkidle" });
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("link", { name: /View cart/i }).click();
  await expect(shopper).toHaveURL(/\/cart$/);

  // What the big apps show before the order goes: the bill, change for cash, the cancel rule.
  await expect(shopper.getByRole("heading", { name: storefront.cart.bill.title })).toBeVisible();
  await expect(shopper.getByRole("heading", { name: storefront.cart.forget.title })).toBeVisible();
  await shopper.getByRole("radio", { name: /^For Rs 1,000$/ }).click();
  await expect(shopper.getByText(storefront.cart.policy.packed)).toBeVisible();
  await expectAccessible(shopper);
  await shopper.getByRole("button", { name: /^Place order/ }).click();
  await expect(shopper).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1$/, { timeout: 20_000 });
  await shopper.getByRole("button", { name: customerOrders.celebrate.track }).click();
  // The note to the dukan says to bring change.
  await expect(shopper.getByText(/Bring change for Rs 1,000/)).toBeVisible();

  // Cancel is tucked in the ⋮ menu; while the order is new it is free, with a reason.
  await shopper.getByRole("button", { name: customerOrders.menu.label }).click();
  await shopper.getByRole("menuitem", { name: customerOrders.menu.cancel }).click();
  const sheet = shopper.getByRole("dialog");
  await expect(sheet.getByText(customerOrders.cancel.freeHint)).toBeVisible();
  await expect(sheet.getByRole("button", { name: customerOrders.cancel.confirm })).toBeDisabled();
  await sheet.getByRole("radio", { name: customerOrders.cancel.reasons.mistake }).click();
  await sheet.getByRole("button", { name: customerOrders.cancel.confirm }).click();
  await expect(shopper.getByText(customerOrders.cancel.done)).toBeVisible();
  await expect(shopper.getByText(customerOrders.cancel.reasons.mistake)).toBeVisible();

  await shopper.context().close();
});
