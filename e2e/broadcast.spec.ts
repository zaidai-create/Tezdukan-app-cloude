import { type Browser, expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

/**
 * The TezDukan team sends a notification from the admin dashboard (here to one person by phone
 * number) and it reaches that person's notifications at once.
 */
const { auth, admin, notifications } = messages.en;
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

test("an admin sends a notification and the person sees it", async ({ browser, baseURL }) => {
  test.setTimeout(90_000);
  const base = baseURL ?? "";
  const title = `Free delivery ${Date.now().toString().slice(-5)}`;

  const team = await signedIn(browser, base, "03000000001");
  await team.goto(`${base}/admin/broadcast`, { waitUntil: "networkidle" });
  await expect(team.getByRole("heading", { level: 1, name: admin.broadcast.title })).toBeVisible();
  await team.getByRole("radio", { name: admin.broadcast.audience.one }).click();
  await team.getByLabel(admin.broadcast.phone).fill("03000000006");
  await team.getByLabel(admin.broadcast.titleLabel).fill(title);
  await team.getByLabel(admin.broadcast.bodyLabel).fill("Order from any dukan near you today.");
  await expectAccessible(team);
  await team.getByRole("button", { name: admin.broadcast.send, exact: true }).click();
  await team.getByRole("button", { name: admin.broadcast.confirmSend }).click();
  await expect(team.getByText(/^Sent to 1 person/)).toBeVisible();
  await expect(team.getByText(title).first()).toBeVisible();
  await team.context().close();

  const shopper = await signedIn(browser, base, "03000000006");
  await shopper
    .getByRole("button", { name: new RegExp(`^${notifications.title}`) })
    .first()
    .click();
  await expect(shopper.getByRole("dialog").getByText(title)).toBeVisible();
  await shopper.context().close();
});
