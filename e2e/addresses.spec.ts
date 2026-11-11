import { expect, test } from "@playwright/test";
import { expectAccessible } from "./support/a11y";
import { createConfirmedUser, deleteUserByPhone } from "./support/admin";
import { messages } from "./support/messages";

/**
 * A new shopper says where they live with the map, sees the dukans that deliver there, and
 * can change their mind. The pin is the phone's location (Heerabad, where demo dukans deliver).
 */
const { auth, addresses, storefront } = messages.en;
const PASSWORD = "address-e2e-123";

test.use({
  geolocation: { latitude: 25.3941, longitude: 68.3713 },
  permissions: ["geolocation"],
});

test.describe("addresses", () => {
  let phone = "";

  test.beforeAll(async () => {
    phone = `0397${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`;
    await createConfirmedUser(`+92${phone.slice(1)}`, PASSWORD, "Sana Memon");
  });

  test.afterAll(async () => {
    await deleteUserByPhone(`+92${phone.slice(1)}`).catch(() => undefined);
  });

  test("a new shopper adds an address on the map and sees nearby dukans", async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: baseURL ?? "" }]);
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByLabel(auth.phoneLabel).fill(phone);
    await page.getByLabel(auth.passwordLabel, { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: auth.signIn }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

    // Nothing is shown until the shopper says where to deliver.
    await expect(page.getByRole("heading", { name: storefront.location.title })).toBeVisible();
    await page.getByRole("link", { name: addresses.add }).click();
    await expect(page.getByRole("heading", { name: addresses.addTitle })).toBeVisible();
    // The bare city centre is nobody's address: saving waits for a pin.
    await expect(page.getByRole("button", { name: addresses.save })).toBeDisabled();
    await expectAccessible(page);

    await page.getByRole("button", { name: addresses.useCurrent }).click();
    await expect(page.getByText(/dukans? delivers? here/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(addresses.line1)).not.toHaveValue("");

    await page.getByLabel(addresses.line1).fill("Street 4, Heerabad, Hyderabad");
    await page.getByLabel(addresses.line2).fill("House 9");
    await page.getByLabel(addresses.landmark).fill("Near the masjid");
    await page.getByRole("radio", { name: storefront.cart.labels.Work }).click();
    await page.getByRole("button", { name: addresses.save }).click();

    // Back on the home screen: the address is where orders go, and dukans appear.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByText("House 9, Street 4, Heerabad, Hyderabad").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: storefront.nearbyTitle })).toBeVisible();

    await page.goto("/addresses", { waitUntil: "networkidle" });
    await expect(page.getByRole("radio", { checked: true })).toContainText("Street 4, Heerabad");
    await expect(page.getByText(addresses.default)).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Edit Work address" }).click();
    await expect(page.getByRole("heading", { name: addresses.editTitle })).toBeVisible();
    await expect(page.getByLabel(addresses.line2)).toHaveValue("House 9");
    await page.getByRole("button", { name: addresses.delete }).click();
    await page.getByRole("dialog").getByRole("button", { name: addresses.delete }).click();
    await expect(page).toHaveURL(/\/addresses(\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: addresses.empty })).toBeVisible();
  });
});
