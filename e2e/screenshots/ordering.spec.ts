import { expect, type Page, test } from "@playwright/test";
import { clearCarts, createDukandar, deleteUserByPhone } from "../support/admin";
import { messages } from "../support/messages";

/**
 * Screenshots of the Phase 2 ordering screens for design review (`pnpm screenshots`). Read-only
 * screens use the demo dukan; the cart and checkout use a fresh dukan per run so parallel
 * viewports never share a cart. Needs the demo seed (`pnpm seed`).
 */
type Variant = { id: string; locale: "en" | "ur"; theme: "light" | "dark" };
const english: Variant = { id: "en", locale: "en", theme: "light" };
const variants: Variant[] = [
  english,
  { id: "ur", locale: "ur", theme: "light" },
  { id: "en-dark", locale: "en", theme: "dark" },
];

async function signIn(
  page: Page,
  baseURL: string | undefined,
  phone: string,
  password: string,
  variant: Variant,
) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: variant.locale, url: baseURL ?? "" },
    { name: "td_theme", value: variant.theme, url: baseURL ?? "" },
  ]);
  const t = messages[variant.locale].auth;
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(t.phoneLabel).fill(phone);
  await page.getByLabel(t.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: t.signIn }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dukan"));
}

async function capture(page: Page, name: string, viewport: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `e2e/__screenshots__/${viewport}/${name}.png`,
    animations: "disabled",
  });
}

const viewportOf = (name: string) => name.replace("screenshots-", "");

async function orderId(page: Page, number: string) {
  await page.goto("/dukan/orders?tab=past");
  const href = await page.getByRole("link", { name: new RegExp(number) }).getAttribute("href");
  return href ?? "/dukan/orders";
}

const pages: { name: string; path: string; variants: Variant[] }[] = [
  { name: "dukan-categories", path: "/dukan/categories", variants: [english] },
  { name: "dukan-category", path: "/dukan/categories/tea-coffee", variants: [english] },
  { name: "dukan-search", path: "/dukan/search?q=tapal", variants: [english] },
  { name: "dukan-orders", path: "/dukan/orders", variants },
  { name: "dukan-ledger", path: "/dukan/ledger", variants: [english] },
  { name: "dukan-distributors", path: "/dukan/distributors", variants: [english] },
];

for (const screen of pages) {
  for (const variant of screen.variants) {
    test(`${screen.name} (${variant.id})`, async ({ page, baseURL }, testInfo) => {
      await signIn(page, baseURL, "0300 0000002", "TezDukan-Demo-1", variant);
      await page.goto(screen.path);
      await capture(page, `${screen.name}-${variant.id}`, viewportOf(testInfo.project.name));
    });
  }
}

for (const variant of variants) {
  test(`order detail and statement (${variant.id})`, async ({ page, baseURL }, testInfo) => {
    await signIn(page, baseURL, "0300 0000002", "TezDukan-Demo-1", variant);
    const viewport = viewportOf(testInfo.project.name);
    await page.goto(await orderId(page, "TD-000104"));
    await capture(page, `dukan-order-delivered-${variant.id}`, viewport);
    await page.goto("/dukan/orders");
    await page.getByRole("link", { name: /TD-000108/ }).click();
    await page.waitForURL(/\/dukan\/orders\/[0-9a-f-]{36}$/);
    await capture(page, `dukan-order-open-${variant.id}`, viewport);
    await page.goto("/dukan/ledger");
    await page
      .getByRole("link", { name: /Indus Traders/ })
      .first()
      .click();
    await page.waitForURL(/\/dukan\/ledger\/[0-9a-f-]{36}$/);
    await capture(page, `dukan-statement-${variant.id}`, viewport);
  });
}

test("product sheet (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000002", "TezDukan-Demo-1", english);
  await page.goto("/dukan/categories/dairy");
  await page
    .getByRole("article", { name: "Olper's Full Cream Milk 1 L" })
    .first()
    .getByRole("button", { name: "Olper's Full Cream Milk 1 L", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(messages.en.ordering.schemes)).toBeVisible();
  await capture(page, "dukan-product-sheet-en", viewportOf(testInfo.project.name));
});

test.describe("cart and checkout", () => {
  const national = `0399${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
  const e164 = `+92${national.slice(1)}`;
  let userId = "";
  test.beforeAll(async () => {
    userId = (await createDukandar(e164, "dukan-e2e-123", "Saima Khan")).userId;
  });
  test.afterEach(async () => {
    await clearCarts(userId);
  });
  test.afterAll(async () => {
    await deleteUserByPhone(e164).catch(() => undefined);
  });

  for (const variant of [english, { id: "ur", locale: "ur", theme: "light" } as Variant]) {
    test(`cart and checkout (${variant.id})`, async ({ page, baseURL }, testInfo) => {
      const o = messages[variant.locale].ordering;
      const viewport = viewportOf(testInfo.project.name);
      await signIn(page, baseURL, national, "dukan-e2e-123", variant);
      // A few lines from both distributors: the first result of each search.
      for (const query of ["olpers", "surf excel", "shan biryani"]) {
        await page.goto(`/dukan/search?q=${encodeURIComponent(query)}`);
        const add = page.locator('[data-slot="add-to-cart"]').first();
        await add.getByRole("button").click();
        await expect(add).toHaveAttribute("data-state", "added");
      }
      await page.goto("/dukan/cart");
      await expect(page.getByRole("heading", { name: o.cart.title })).toBeVisible();
      await capture(page, `dukan-cart-${variant.id}`, viewport);
      await page.goto("/dukan/checkout");
      await expect(page.getByRole("heading", { name: o.checkout.title })).toBeVisible();
      await capture(page, `dukan-checkout-${variant.id}`, viewport);
    });
  }
});
