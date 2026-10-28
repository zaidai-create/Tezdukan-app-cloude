export const catalogErrorKeys = [
  "name_required",
  "price_required",
  "price_above_mrp",
  "invalid_moq",
  "invalid_carton",
  "invalid_stock",
  "invalid_barcode",
  "invalid_image",
  "not_allowed",
  "product_not_found",
] as const;

export type CatalogErrorKey = (typeof catalogErrorKeys)[number] | "generic" | "offline";

export function catalogErrorKey(error: unknown): CatalogErrorKey {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const message =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (catalogErrorKeys as readonly string[]).includes(message)
    ? (message as CatalogErrorKey)
    : "generic";
}
