import { expect, type Page, test } from "@playwright/test";
import { messages } from "../support/messages";
import { openRoleSwitcher } from "../support/roles";

/**
 * Screenshots of the signed-in shells for design review (`pnpm screenshots`): every role's home,
 * the account page, the role switcher, the Munshi sheet, notifications, chat and the distributor
 * portal. Needs the demo seed (`pnpm seed`).
 */
const { auth, nav, notifications } = messages.en;
const ur = messages.ur;
const DEMO_PASSWORD = "TezDukan-Demo-1";

type Variant = { id: string; locale: "en" | "ur"; theme: "light" | "dark" };
const english: Variant = { id: "en", locale: "en", theme: "light" };
const variants: Variant[] = [
  english,
  { id: "ur", locale: "ur", theme: "light" },
  { id: "en-dark", locale: "en", theme: "dark" },
];

async function signIn(page: Page, baseURL: string | undefined, phone: string, variant: Variant) {
  await page.context().addCookies([
    { name: "NEXT_LOCALE", value: variant.locale, url: baseURL ?? "" },
    { name: "td_theme", value: variant.theme, url: baseURL ?? "" },
  ]);
  const t = variant.locale === "ur" ? ur.auth : auth;
  await page.goto("/login");
  await page.getByLabel(t.phoneLabel).fill(phone);
  await page.getByLabel(t.passwordLabel, { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: t.signIn }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
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

const homes = [
  { role: "dukandar", phone: "0300 0000002", path: /\/dukan$/ },
  { role: "distributor", phone: "0300 0000003", path: /\/distributor$/ },
  { role: "booker", phone: "0300 0000004", path: /\/booker$/ },
  { role: "rider", phone: "0300 0000005", path: /\/rider$/ },
  { role: "customer", phone: "0300 0000006", path: /\/$/ },
  { role: "admin", phone: "0300 0000001", path: /\/admin$/ },
];

for (const home of homes) {
  for (const variant of home.role === "dukandar" ? variants : [english]) {
    test(`${home.role} home (${variant.id})`, async ({ page, baseURL }, testInfo) => {
      await signIn(page, baseURL, home.phone, variant);
      await expect(page).toHaveURL(home.path);
      await capture(
        page,
        `home-${home.role}-${variant.id}`,
        testInfo.project.name.replace("screenshots-", ""),
      );
    });
  }
}

test("account page (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000002", english);
  await page.goto("/dukan/account");
  await capture(page, "account-dukandar-en", testInfo.project.name.replace("screenshots-", ""));
});

for (const variant of variants) {
  test(`role switcher (${variant.id})`, async ({ page, baseURL }, testInfo) => {
    // Opens the switcher without choosing, so the shared demo profile is unchanged.
    await signIn(page, baseURL, "0300 0000007", variant);
    const text = variant.locale === "ur" ? ur : messages.en;
    await openRoleSwitcher(page, { switchRole: text.roles.switchRole, menu: text.common.menu });
    await expect(page.getByRole("dialog")).toBeVisible();
    await capture(
      page,
      `role-switcher-${variant.id}`,
      testInfo.project.name.replace("screenshots-", ""),
    );
  });
}

test("Munshi sheet (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000002", english);
  // The phone's raised mic, or the desktop button (exact: "Search or ask Munshi" also matches).
  const munshi = testInfo.project.name.endsWith("mobile")
    ? page.getByRole("button", { name: nav.munshiHint })
    : page.getByRole("button", { name: nav.munshi, exact: true });
  await munshi.first().click();
  await expect(page.getByRole("dialog", { name: nav.munshi })).toBeVisible();
  await capture(page, "munshi-en", testInfo.project.name.replace("screenshots-", ""));
});

test("notifications (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000002", english);
  await page
    .getByRole("button", { name: notifications.title })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await capture(page, "notifications-en", testInfo.project.name.replace("screenshots-", ""));
});

test("dukan chat list (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000002", english);
  await page.goto("/dukan/chat");
  await capture(page, "dukan-chat-en", testInfo.project.name.replace("screenshots-", ""));
});

const distributorScreens = [
  { name: "distributor-orders", path: "/distributor/orders" },
  { name: "distributor-catalog", path: "/distributor/catalog" },
  { name: "distributor-catalog-new", path: "/distributor/catalog/new" },
  { name: "distributor-chat", path: "/distributor/chat" },
];

for (const screen of distributorScreens) {
  for (const variant of screen.name === "distributor-catalog" ? variants : [english]) {
    test(`${screen.name} (${variant.id})`, async ({ page, baseURL }, testInfo) => {
      await signIn(page, baseURL, "0300 0000003", variant);
      await page.goto(screen.path);
      await capture(
        page,
        `${screen.name}-${variant.id}`,
        testInfo.project.name.replace("screenshots-", ""),
      );
    });
  }
}

test("distributor order (en)", async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL, "0300 0000003", english);
  await page.goto("/distributor/orders?tab=done");
  await page
    .getByRole("link", { name: /TD-\d+/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/distributor\/orders\/[0-9a-f-]+$/);
  await capture(page, "distributor-order-en", testInfo.project.name.replace("screenshots-", ""));
});
