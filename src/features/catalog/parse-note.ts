import { z } from "zod";

/**
 * A product as Munshi drafts it from a distributor's note or photo. Every field may be
 * missing; prices are rupees per piece (converted to paisa at the form's edge).
 */
export const productDraftSchema = z.object({
  name: z.string().nullable(),
  name_ur: z.string().nullable(),
  brand: z.string().nullable(),
  category: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  trade_price_rupees: z.number().nonnegative().nullable(),
  mrp_rupees: z.number().nonnegative().nullable(),
  carton_qty: z.number().int().positive().nullable(),
  moq_pieces: z.number().int().positive().nullable(),
  barcode: z.string().nullable(),
});
export type ProductDraft = z.infer<typeof productDraftSchema>;

export const emptyDraft: ProductDraft = {
  name: null,
  name_ur: null,
  brand: null,
  category: null,
  pack_size_label: null,
  trade_price_rupees: null,
  mrp_rupees: null,
  carton_qty: null,
  moq_pieces: null,
  barcode: null,
};

const NUMBER = String.raw`(\d[\d,]*(?:\.\d{1,2})?)`;
const amount = (value: string | undefined) => {
  if (!value) return null;
  const n = Number(value.replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
};

const units: Record<string, string> = {
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  gr: "g",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  ml: "ml",
  l: "L",
  ltr: "L",
  litre: "L",
  liter: "L",
  litres: "L",
  liters: "L",
};

const patterns = {
  pack: new RegExp(
    String.raw`(\d+(?:\.\d+)?)\s*(kgs?|kilo|grams?|gms?|gr|g|ml|litres?|liters?|ltr|l)\b`,
    "i",
  ),
  cartonAfter: new RegExp(
    String.raw`(?:carton|cartoon|ctn|box|dabba|peti)\s*(?:of|ka|ke|me|mein|main|=|:)?\s*(\d{1,5})\b`,
    "i",
  ),
  cartonBefore: new RegExp(
    String.raw`\b(\d{1,5})\s*(?:wala|walay|wali|pcs?|pieces?)?\s*(?:carton|cartoon|ctn|box|dabba|peti)\b`,
    "i",
  ),
  trade: new RegExp(
    String.raw`(?:rate|trade|tp|t\.p\.?|price|qeemat|qimat|daam)\s*(?:rs\.?|rupees?)?\s*[:=]?\s*${NUMBER}`,
    "i",
  ),
  mrp: new RegExp(
    String.raw`(?:mrp|m\.r\.p\.?|retail|print(?:ed)?)\s*(?:price)?\s*(?:rs\.?|rupees?)?\s*[:=]?\s*${NUMBER}`,
    "i",
  ),
  moq: new RegExp(
    String.raw`(?:moq|min(?:imum)?(?:\s*order)?|kam\s*se\s*kam)\s*[:=]?\s*(\d{1,5})`,
    "i",
  ),
  barcode: /\b(\d{8,14})\b/,
};

function titleCase(words: string): string {
  return words
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^[a-z]/.test(w) ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * The Sandbox Munshi: reads the usual ways distributors write a product down ("Tapal
 * Danedar 950g, carton 12, rate 1750, MRP 1950", "Shan biryani 50 gm 12 wala dabba tp 95")
 * without AI. Known brand names come from the catalog.
 */
export function parseProductNote(text: string, brands: readonly string[]): ProductDraft {
  let rest = ` ${text.replace(/\s+/g, " ").trim()} `;
  const take = (re: RegExp) => {
    const match = re.exec(rest);
    if (match) rest = rest.replace(match[0], " ");
    return match;
  };

  const mrp = take(patterns.mrp);
  const trade = take(patterns.trade);
  const moq = take(patterns.moq);
  const carton = take(patterns.cartonAfter) ?? take(patterns.cartonBefore);
  const barcode = take(patterns.barcode);
  const pack = take(patterns.pack);

  const unit = pack?.[2] ? units[pack[2].toLowerCase()] : undefined;
  const packLabel = pack?.[1] && unit ? `${pack[1]} ${unit}` : null;

  const words = rest
    .replace(/\brs\.?\b|\brupees?\b/gi, " ")
    .replace(/[,;:|/]+/g, " ")
    .replace(/\b(?:ka|ke|ki|wala|wali|walay|and|aur|of)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lower = ` ${words.toLowerCase()} `;
  const brand =
    [...brands]
      .sort((a, b) => b.length - a.length)
      .find(
        (b) => lower.includes(` ${b.toLowerCase()} `) || lower.includes(` ${b.toLowerCase()}`),
      ) ?? null;
  const base = titleCase(words);
  const name = base ? (packLabel ? `${base} ${packLabel}` : base) : null;

  return {
    ...emptyDraft,
    name: name && name.length >= 2 ? name : null,
    brand,
    pack_size_label: packLabel,
    trade_price_rupees: amount(trade?.[1]),
    mrp_rupees: amount(mrp?.[1]),
    carton_qty: carton?.[1] && Number(carton[1]) >= 2 ? Number(carton[1]) : null,
    moq_pieces: moq?.[1] && Number(moq[1]) >= 1 ? Number(moq[1]) : null,
    barcode: barcode?.[1] ?? null,
  };
}

/** Whether a draft says anything worth filling the form with. */
export function hasDetails(draft: ProductDraft): boolean {
  return Object.values(draft).some((value) => value !== null);
}
