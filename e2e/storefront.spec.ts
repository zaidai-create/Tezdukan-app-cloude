import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

/**
 * The customer app: the demo shopper browses nearby dukans, adds a product and sends the order
 * to the dukan on WhatsApp. Needs the demo seed (three live dukans).
 */
const { auth, storefront, nav } = messages.en;

test("a shopper browses, fills the cart and orders on WhatsApp", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill("03000000006");
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill("TezDukan-Demo-1");
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).toHaveURL(/\/$/);

  await expect(page.getByRole("heading", { name: storefront.categoriesTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: storefront.nearbyTitle })).toBeVisible();
  if (testInfo.project.name === "mobile") {
    for (const label of [nav.home, nav.categories, nav.nearby, nav.cart, nav.account]) {
      await expect(page.getByRole("link", { name: label, exact: true }).last()).toBeVisible();
    }
  }
  await expectAccessible(page);

  await page.goto("/shops/madina-mart", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "Madina Mart" })).toBeVisible();
  await page.getByRole("button", { name: /^Add/ }).first().click();
  await page.getByRole("link", { name: /View cart/i }).click();

  await expect(page).toHaveURL(/\/cart$/);
  await page.getByLabel(storefront.cart.address).fill("House 5, Street 2, Qasimabad");
  const order = page.getByRole("link", { name: storefront.cart.orderWhatsapp });
  await expect(order).toHaveAttribute("href", /wa\.me\/92\d{10}\?text=/);
  await expect(order).toHaveAttribute("href", /Qasimabad/);
});
