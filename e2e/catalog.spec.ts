import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { deleteOrgProductsNamed } from "./support/admin";
import { messages } from "./support/messages";

/**
 * A distributor adds a product by writing one line for Munshi (Sandbox parser locally), saves
 * it, finds it in the catalog, and hides it from dukans. The product is removed afterwards.
 */
const { auth, catalog } = messages.en;
const PREFIX = "Testo Chai";

test.describe("catalog", () => {
  test.afterAll(async () => {
    await deleteOrgProductsNamed(PREFIX).catch(() => undefined);
  });

  test("a distributor adds a product with Munshi and hides it", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const code = String(1000 + Math.floor(Math.random() * 8999));
    const name = `${PREFIX} ${code} 475 g`;

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(auth.phoneLabel).fill("03000000003");
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill("TezDukan-Demo-1");
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.goto("/distributor/catalog");
    await expect(page.getByRole("heading", { level: 1, name: catalog.title })).toBeVisible();
    await page.getByRole("link", { name: catalog.add }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: catalog.form.newTitle }),
    ).toBeVisible();

    await page
      .getByLabel(catalog.form.munshiTitle)
      .fill(`testo chai ${code} 475g, carton 24, rate 640, MRP 720`);
    await page.getByRole("button", { name: catalog.form.munshiFill }).click();
    await expect(page.getByText(catalog.form.munshiFilled)).toBeVisible();
    await expect(page.getByLabel(catalog.form.name, { exact: true })).toHaveValue(name);
    await expect(page.getByLabel(catalog.form.carton)).toHaveValue("24");
    await expect(page.getByText(/Dukans earn Rs 80 per piece/)).toBeVisible();
    if (testInfo.project.name.includes("mobile")) await expectAccessible(page);

    await page.getByRole("button", { name: catalog.form.save }).click();
    await expect(page).toHaveURL(/\/distributor\/catalog$/, { timeout: 20_000 });
    await expect(page.getByText(`${name} saved.`)).toBeVisible();

    await page.getByLabel(catalog.searchLabel).fill(code);
    await page.getByLabel(catalog.searchLabel).press("Enter");
    const toggle = page.getByRole("switch", { name: `${catalog.showInShop}: ${name}` });
    await expect(toggle).toBeChecked({ timeout: 15_000 });
    await toggle.click();
    await expect(page.getByText(`${name} is hidden from dukans.`)).toBeVisible();
    await expect(toggle).not.toBeChecked();
  });
});
