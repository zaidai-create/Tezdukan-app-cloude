import { test } from "@playwright/test";

/**
 * Screenshots of every public screen for design review: `pnpm screenshots` writes them to
 * e2e/__screenshots__/<viewport>/. English, Urdu (right to left) and dark mode.
 */
const screens = [
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "verify", path: "/verify?phone=%2B923001234567&mode=signup" },
  { name: "forgot-password", path: "/forgot-password" },
  { name: "offline", path: "/~offline" },
  { name: "design-system", path: "/dev/design-system", fullPage: true },
];

const variants: { id: string; cookies: Record<string, string> }[] = [
  { id: "en", cookies: {} },
  { id: "ur", cookies: { NEXT_LOCALE: "ur" } },
  { id: "en-dark", cookies: { td_theme: "dark" } },
];

for (const variant of variants) {
  for (const screen of screens) {
    test(`${screen.name} (${variant.id})`, async ({ page, context, baseURL }, testInfo) => {
      await context.addCookies(
        Object.entries(variant.cookies).map(([name, value]) => ({
          name,
          value,
          url: baseURL ?? "",
        })),
      );
      await page.goto(screen.path);
      await page.evaluate(() => document.fonts.ready);
      const viewport = testInfo.project.name.replace("screenshots-", "");
      await page.screenshot({
        path: `e2e/__screenshots__/${viewport}/${screen.name}-${variant.id}.png`,
        fullPage: screen.fullPage ?? false,
        animations: "disabled",
      });
    });
  }
}
