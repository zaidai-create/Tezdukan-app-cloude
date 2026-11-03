import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

/** First launch: splash, the three posters, then sign-in; later launches go straight there. */
const { welcome, auth } = messages.en;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
});

test("a new device sees the welcome posters once, then signs in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: welcome.slides.customers.title })).toBeVisible();
  await expectAccessible(page);

  await page.getByRole("button", { name: welcome.next, exact: true }).click();
  await expect(page.getByRole("heading", { name: welcome.slides.dukandar.title })).toBeVisible();
  await page.getByRole("button", { name: welcome.next, exact: true }).click();
  await expect(page.getByRole("heading", { name: welcome.slides.distributor.title })).toBeVisible();
  await page.getByRole("link", { name: welcome.haveAccount }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: auth.google })).toBeVisible();

  // Seen once: the app now opens on sign-in.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
