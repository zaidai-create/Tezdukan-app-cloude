import { expect, type Page, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { messages } from "./support/messages";

const { en, ur } = messages;
const html = (page: Page) => page.locator("html");

test("switching to Urdu mirrors the layout and is remembered", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: "اردو" }).click();

  await expect(html(page)).toHaveAttribute("dir", "rtl");
  await expect(html(page)).toHaveAttribute("lang", "ur");
  await expect(page.getByRole("heading", { name: ur.auth.loginTitle })).toBeVisible();
  await expect(page.getByRole("radio", { name: "اردو" })).toHaveAttribute("aria-checked", "true");

  await page.reload();
  await expect(html(page)).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: ur.auth.loginTitle })).toBeVisible();

  await page.getByRole("radio", { name: "English" }).click();
  await expect(html(page)).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: en.auth.loginTitle })).toBeVisible();
});

test("Roman Urdu reads left to right", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("radio", { name: "Roman Urdu" }).click();
  await expect(html(page)).toHaveAttribute("lang", "ur-Latn");
  await expect(html(page)).toHaveAttribute("dir", "ltr");
});

test.describe("in Urdu", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "ur", url: baseURL ?? "" }]);
  });

  test("phone numbers stay left to right", async ({ page }) => {
    await page.goto("/login");
    await expect(html(page)).toHaveAttribute("dir", "rtl");
    const phone = page.getByLabel(ur.auth.phoneLabel);
    await phone.fill("03001234567");
    await expect(phone).toHaveValue("03001234567");
    await expect(phone.locator("xpath=ancestor::*[@dir][1]")).toHaveAttribute("dir", "ltr");
  });

  test("sign in meets WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await expectAccessible(page);
  });
});
