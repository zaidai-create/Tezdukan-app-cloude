/**
 * Money is always an integer number of paisa (Rs 1 = 100 paisa). Values stay far below 2^53,
 * so plain numbers are safe; never store or add rupees as floats.
 */
export type Paisa = number;

export const PAISA_PER_RUPEE = 100;

const grouping = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const groupingWithPaisa = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function isPaisa(value: unknown): value is Paisa {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Parses rupees typed by a person ("1,250", "1250.5", "Rs 99") into paisa.
 * Returns null for anything that is not a plain non-negative amount with at most 2 decimals.
 */
export function parseRupees(input: string): Paisa | null {
  const cleaned = input
    .trim()
    .replace(/^rs\.?\s*/i, "")
    .replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  const paisa = Number(whole) * PAISA_PER_RUPEE + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paisa) ? paisa : null;
}

/** Rupees as a number for display maths only (charts). Never feed back into money logic. */
export function paisaToRupees(paisa: Paisa): number {
  return paisa / PAISA_PER_RUPEE;
}

export function rupeesToPaisa(rupees: number): Paisa {
  return Math.round(rupees * PAISA_PER_RUPEE);
}

/**
 * "Rs 1,250" — decimals only when there are paisa ("Rs 1,250.50").
 * `signed` prefixes + for positive amounts (ledgers); negatives always show a minus.
 */
export function formatRs(paisa: Paisa, options: { signed?: boolean } = {}): string {
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const body =
    abs % PAISA_PER_RUPEE === 0
      ? grouping.format(abs / PAISA_PER_RUPEE)
      : groupingWithPaisa.format(abs / PAISA_PER_RUPEE);
  const sign = negative ? "−" : options.signed && paisa > 0 ? "+" : "";
  return `${sign}Rs ${body}`;
}

/** Price × quantity. Loose quantities (kg, litre) round to the nearest paisa. */
export function lineTotal(unitPaisa: Paisa, quantity: number): Paisa {
  return Math.round(unitPaisa * quantity);
}

export function sumPaisa(values: readonly Paisa[]): Paisa {
  return values.reduce((total, value) => total + value, 0);
}

/** Margin on selling price, in percent with one decimal (e.g. 14.3). */
export function marginPercent(costPaisa: Paisa, sellPaisa: Paisa): number {
  if (sellPaisa <= 0) return 0;
  return Math.round(((sellPaisa - costPaisa) / sellPaisa) * 1000) / 10;
}

/** Discount of `price` against `mrp`, as a whole percent (for "12% OFF" badges). */
export function discountPercent(pricePaisa: Paisa, mrpPaisa: Paisa): number {
  if (mrpPaisa <= 0 || pricePaisa >= mrpPaisa) return 0;
  return Math.round(((mrpPaisa - pricePaisa) / mrpPaisa) * 100);
}
