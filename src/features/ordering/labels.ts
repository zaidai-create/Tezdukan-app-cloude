import type { useTranslations } from "next-intl";
import { formatDate, formatTime, TIME_ZONE } from "@/lib/format";
import { formatRs } from "@/lib/money";
import type { CatalogItem, PackUnit, Scheme } from "./schemas";

/** Display helpers shared by ordering screens (server and client). */

/**
 * Keeps a date, time or code reading left to right inside Urdu sentences (Unicode isolates:
 * invisible, and harmless in left-to-right text).
 */
export function ltr(value: string): string {
  return `\u2066${value}\u2069`;
}

type OrderingT = ReturnType<typeof useTranslations<"ordering">>;

/** Product and category names follow the UI script: Urdu names in Urdu, otherwise English. */
export function localName(item: { name: string; name_ur: string | null }, locale: string): string {
  return locale === "ur" || locale === "sd" ? (item.name_ur ?? item.name) : item.name;
}

const num = (value: unknown): number => (typeof value === "number" ? value : Number(value) || 0);

/** Short scheme label for badges: "12 + 1 free", "Up to 3% off", "5% off". */
export function schemeLabel(t: OrderingT, scheme: Scheme): string {
  const rules = scheme.rules;
  switch (scheme.kind) {
    case "buy_x_get_y":
      return t("schemeBuyGet", { buy: num(rules.buy_base_qty), free: num(rules.free_base_qty) });
    case "slab_discount": {
      const slabs = Array.isArray(rules.slabs) ? rules.slabs : [];
      const best = Math.max(
        0,
        ...slabs.map((slab) =>
          slab && typeof slab === "object" && "discount_bps" in slab ? num(slab.discount_bps) : 0,
        ),
      );
      return t("schemeSlab", { percent: best / 100 });
    }
    case "flat_discount":
      return "discount_bps" in rules
        ? t("schemeFlatPercent", { percent: num(rules.discount_bps) / 100 })
        : t("schemeFlatPaisa", { amount: formatRs(num(rules.discount_paisa_per_unit)) });
    case "bundle":
      return t("schemeBundle");
  }
}

export function unitName(t: OrderingT, unit: PackUnit): string {
  const base = {
    piece: t("unitPiece"),
    dozen: t("unitDozen"),
    inner: t("unitInner"),
    carton: t("unitCarton"),
  }[unit.unit];
  return unit.base_qty > 1 ? t("unitWithCount", { unit: base, count: unit.base_qty }) : base;
}

export function defaultUnit(item: CatalogItem): PackUnit | undefined {
  return item.pack_units.find((u) => u.is_default) ?? item.pack_units[0];
}

/** Profit per piece at MRP, and as a percent of MRP. */
export function margin(item: Pick<CatalogItem, "mrp_paisa" | "price_paisa">) {
  const perPiece = item.mrp_paisa - item.price_paisa;
  const percent = item.mrp_paisa > 0 ? Math.round((perPiece / item.mrp_paisa) * 1000) / 10 : 0;
  return { perPiece, percent };
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });

/** "tomorrow", "day after tomorrow", or the date. */
export function deliveryDay(t: OrderingT, start: string, now = new Date()): string {
  const day = (offset: number) => dayKey.format(new Date(now.getTime() + offset * 86_400_000));
  const target = dayKey.format(new Date(start));
  if (target === day(1)) return t("tomorrow");
  if (target === day(2)) return t("dayAfter");
  return ltr(formatDate(start));
}

export function slotWindow(t: OrderingT, start: string, end: string): string {
  return t("slotWindow", { start: ltr(formatTime(start)), end: ltr(formatTime(end)) });
}
