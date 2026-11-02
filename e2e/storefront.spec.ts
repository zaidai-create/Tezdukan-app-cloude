import { type Browser, expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

/**
 * The customer app end to end: the demo shopper browses, orders from TezDukan in the app, and
 * the demo dukandar accepts it from Online orders. Needs the demo seed (three live dukans).
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

test("a shopper orders in the app and the dukandar accepts it", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const base = baseURL ?? "";
  const shopper = await signedIn(browser, base, "03000000006");
  await expect(shopper).toHaveURL(/\/$/);
  await expect(shopper.getByRole("heading", { name: storefront.categoriesTitle })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    for (const label of [nav.home, nav.categories, nav.nearby, nav.cart, nav.account]) {
      await expect(shopper.getByRole("link", { name: label, exact: true }).last()).toBeVisible();
    }
  }
  await expectAccessible(shopper);

  await shopper.goto(`${base}/shops/tezdukan`, { waitUntil: "networkidle" });
  await expect(shopper.getByRole("heading", { level: 1, name: "TezDukan" })).toBeVisible();
  // Two items clear TezDukan's Rs 300 minimum order.
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("button", { name: /^Add/ }).first().click();
  await shopper.getByRole("link", { name: /View cart/i }).click();

  await expect(shopper).toHaveURL(/\/cart$/);
  await shopper.getByLabel(storefront.cart.address).fill("House 5, Street 2, Latifabad Unit 6");
  await shopper.getByRole("button", { name: /^Place order/ }).click();
  await expect(shopper).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1$/, { timeout: 20_000 });
  await expect(shopper.getByText(customerOrders.placedTitle)).toBeVisible();
  const orderNumber = (await shopper.locator("header p.num").first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^C-\d{6}$/);

  const dukandar = await signedIn(browser, base, "03000000002");
  await dukandar.goto(`${base}/dukan/customer-orders`, { waitUntil: "networkidle" });
  await dukandar.getByRole("link").filter({ hasText: orderNumber }).click();
  await expect(dukandar.getByRole("heading", { level: 1, name: orderNumber })).toBeVisible();
  await dukandar.getByRole("button", { name: customerOrders.actions.accept }).click();
  await expect(dukandar.getByText(customerOrders.moved.accepted)).toBeVisible();

  await shopper.reload({ waitUntil: "networkidle" });
  await expect(shopper.getByText(customerOrders.status.accepted).first()).toBeVisible();

  await dukandar.context().close();
  await shopper.context().close();
});
