import { expect, type Page } from "@playwright/test";

/**
 * Opens the role switcher. Dukandars and distributors have a button for it in the header;
 * shoppers reach it from the avatar menu, because their header shows where the order goes.
 */
export async function openRoleSwitcher(
  page: Page,
  labels: { switchRole: string; menu: string },
): Promise<void> {
  const direct = page.getByRole("button", { name: labels.switchRole }).first();
  const avatar = page.getByRole("button", { name: labels.menu, exact: true }).first();
  await expect(direct.or(avatar).first()).toBeVisible();
  if (await direct.isVisible()) {
    await direct.click();
    return;
  }
  await avatar.click();
  await page.getByRole("menuitem", { name: labels.switchRole }).click();
}
