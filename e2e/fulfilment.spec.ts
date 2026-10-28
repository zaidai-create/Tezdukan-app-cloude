import { type Browser, expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createDukandar, deleteUserByPhone, placeBigOrder } from "./support/admin";
import { messages } from "./support/messages";

/**
 * Phase 3 journey across two phones: a big order needs the dukandar's confirmation before the
 * distributor can ship it; the distributor asks in the app, the dukandar confirms, the order
 * is confirmed, sent for delivery and delivered with the dukandar's 4-digit code.
 * Uses its own fresh dukan (so runs never share an order) and the demo distributor.
 */
const { auth, distributor: d, ordering: o } = messages.en;
const PASSWORD = "dukan-e2e-123";
const DEMO_PASSWORD = "TezDukan-Demo-1";
const DISTRIBUTOR = "03000000003";

const throwawayNumber = () => `0398${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
const toE164 = (national: string) => `+92${national.slice(1)}`;
const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}(, [a-z]+)?\\}`), value),
    template,
  );

async function signedIn(browser: Browser, baseURL: string, phone: string, password: string) {
  const context = await browser.newContext({ locale: "en-PK", timezoneId: "Asia/Karachi" });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL }]);
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(password);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}

test.describe("distributor fulfilment", () => {
  const phone = throwawayNumber();
  let order: { id: string; order_number: string };

  test.beforeAll(async () => {
    const { shopId } = await createDukandar(toE164(phone), PASSWORD, "Usman Ghani");
    order = await placeBigOrder(toE164(phone), PASSWORD, shopId);
  });

  test.afterAll(async () => {
    // The shop and its delivered order stay: orders and invoices are financial records.
    await deleteUserByPhone(toE164(phone)).catch(() => undefined);
  });

  test("a big order is confirmed with the dukandar, shipped and delivered with the code", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const base = baseURL ?? "";
    const distributor = await signedIn(browser, base, DISTRIBUTOR, DEMO_PASSWORD);
    const dukandar = await signedIn(browser, base, phone, PASSWORD);

    // The inbox flags the order: it needs a call before it ships.
    await distributor.goto(`${base}/distributor/orders`);
    const card = distributor.getByRole("link").filter({ hasText: order.order_number });
    await expect(card).toBeVisible();
    await expect(card.getByText(d.inbox.callToConfirm)).toBeVisible();

    await card.click();
    await expect(distributor.getByRole("heading", { name: d.order.confirm.title })).toBeVisible();
    const confirm = distributor.getByRole("button", { name: d.order.actions.confirm });
    await expect(confirm).toBeDisabled();
    await expectAccessible(distributor);
    await distributor.getByRole("button", { name: d.order.confirm.askInApp }).click();
    await toast(distributor, d.order.confirm.askedToast);

    // The dukandar is asked in the app and confirms.
    await dukandar.goto(`${base}/dukan/orders/${order.id}`);
    await expect(
      dukandar.getByRole("heading", { name: fill(o.order.confirmAsked, { org: "Indus Traders" }) }),
    ).toBeVisible();
    await dukandar.getByRole("button", { name: o.order.confirmButton }).click();
    await toast(dukandar, fill(o.order.confirmDone, { org: "Indus Traders" }));

    // Now the distributor can confirm and send it out.
    await distributor.reload();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await toast(distributor, d.order.actions.confirmed);
    await distributor.getByRole("button", { name: d.order.actions.dispatch }).click();
    await toast(distributor, d.order.actions.dispatched);

    // The dukandar reads the delivery code to the rider.
    await dukandar.reload();
    const code =
      (
        await dukandar
          .getByText(/^\d{4}$/)
          .first()
          .textContent()
      )?.trim() ?? "";
    expect(code).toMatch(/^\d{4}$/);

    await distributor.getByRole("button", { name: d.order.actions.deliver }).click();
    await distributor.getByLabel(d.order.deliver.otpLabel).fill(code);
    await distributor.getByRole("button", { name: d.order.deliver.submit }).click();
    await toast(distributor, /INV-/);

    await dukandar.reload();
    await expect(dukandar.getByText(o.status.delivered).first()).toBeVisible();

    await distributor.context().close();
    await dukandar.context().close();
  });
});
