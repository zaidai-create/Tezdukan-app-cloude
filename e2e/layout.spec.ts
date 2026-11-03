import { expect, type Page, test } from "@playwright/test";
import { messages } from "./support/messages";

/**
 * No screen may scroll sideways on a phone (a long address or a badge in a scroll row once
 * widened whole pages). Checks the main screens of each side at 390 px.
 */
const { auth } = messages.en;
const PASSWORD = "TezDukan-Demo-1";

const screens: Record<string, string[]> = {
  "0300 0000006": ["/", "/categories", "/shops", "/shops/tezdukan", "/cart", "/orders", "/account"],
  "0300 0000002": [
    "/dukan",
    "/dukan/products",
    "/dukan/customer-orders",
    "/dukan/wholesale",
    "/dukan/ledger",
  ],
  "0300 0000003": ["/distributor", "/distributor/orders", "/distributor/catalog"],
};

async function signIn(page: Page, phone: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel(auth.phoneLabel).fill(phone);
  await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: auth.signIn }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test.beforeEach(async ({ context, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phones only: wide screens have room to spare.");
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

for (const [phone, paths] of Object.entries(screens)) {
  test(`screens fit the phone width (${phone})`, async ({ page }) => {
    await signIn(page, phone);
    for (const path of paths) {
      await page.goto(path, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
}
