import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import ur from "../../../messages/ur.json";
import { inScope, type NotificationScope } from "./schemas";
import { notificationText } from "./text";

const tEn = createTranslator({ locale: "en", messages: en, namespace: "notifications" });
const tUr = createTranslator({ locale: "ur", messages: ur, namespace: "notifications" });

describe("notificationText", () => {
  it("writes known events in the reader's language from their facts", () => {
    const n = {
      title: "Please confirm order TD-000123",
      body: "Indus Traders · Rs 25,000. Tap to confirm.",
      data: {
        event: "order.confirmation_requested",
        order_number: "TD-000123",
        org_name: "Indus Traders",
        total_paisa: 2_500_000,
      },
    };
    expect(notificationText(tEn, n)).toEqual({
      title: "Please confirm order TD-000123",
      body: "Indus Traders · Rs 25,000. Tap to confirm.",
    });
    expect(notificationText(tUr, n).title).toBe("آرڈر TD-000123 کنفرم کریں");
  });

  it("keeps the stored body when the event only has a title template", () => {
    const n = {
      title: "New order TD-000124",
      body: "Rehman Kiryana · Rs 12,500",
      data: { event: "order.created", order_number: "TD-000124" },
    };
    expect(notificationText(tUr, n)).toEqual({
      title: "نیا آرڈر TD-000124",
      body: "Rehman Kiryana · Rs 12,500",
    });
  });

  it("falls back to the stored text for events it does not know", () => {
    const n = { title: "Rehman Kiryana", body: "Kal delivery?", data: { event: "chat.message" } };
    expect(notificationText(tEn, n)).toEqual({ title: "Rehman Kiryana", body: "Kal delivery?" });
  });
});

describe("inScope", () => {
  const dukan: NotificationScope = { userId: "u", role: "dukandar", contextId: "shop-1" };
  const distributor: NotificationScope = { userId: "u", role: "distributor", contextId: "org-1" };
  const customer: NotificationScope = { userId: "u", role: "customer", contextId: null };

  it("shows a dukan only its own shop's alerts", () => {
    expect(inScope(dukan, { shop_id: "shop-1", org_id: null })).toBe(true);
    expect(inScope(dukan, { shop_id: null, org_id: "org-1" })).toBe(false);
  });

  it("shows a distributor only its organization's alerts", () => {
    expect(inScope(distributor, { shop_id: null, org_id: "org-1" })).toBe(true);
    expect(inScope(distributor, { shop_id: null, org_id: "org-2" })).toBe(false);
  });

  it("shows a customer only personal alerts", () => {
    expect(inScope(customer, { shop_id: null, org_id: null })).toBe(true);
    expect(inScope(customer, { shop_id: "shop-1", org_id: null })).toBe(false);
  });
});
