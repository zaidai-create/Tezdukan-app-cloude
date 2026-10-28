import { z } from "zod";

/**
 * Shapes of the Phase 2 ordering RPCs (supabase/migrations/20261028120100_ordering_rpcs.sql).
 * Every RPC result is parsed here before the UI touches it.
 */

const paisa = z.number().int();
const id = z.uuid();
const timestamp = z.string().min(10);

export const packUnitSchema = z.object({
  id,
  unit: z.enum(["piece", "dozen", "inner", "carton"]),
  label: z.string(),
  base_qty: z.number().int().positive(),
  is_default: z.boolean(),
});
export type PackUnit = z.infer<typeof packUnitSchema>;

export const schemeSchema = z.object({
  id,
  kind: z.enum(["buy_x_get_y", "slab_discount", "flat_discount", "bundle"]),
  name: z.string(),
  name_ur: z.string().nullable(),
  rules: z.record(z.string(), z.unknown()),
  ends_at: timestamp.nullable(),
});
export type Scheme = z.infer<typeof schemeSchema>;

export const catalogItemSchema = z.object({
  distributor_product_id: id,
  org_id: id,
  org_name: z.string(),
  master_product_id: id.nullable(),
  name: z.string(),
  name_ur: z.string().nullable(),
  brand_id: id.nullable(),
  brand_name: z.string().nullable(),
  brand_slug: z.string().nullable(),
  category_id: id.nullable(),
  category_slug: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  image_path: z.string().nullable(),
  mrp_paisa: paisa,
  price_paisa: paisa,
  moq_base_qty: z.number().int().positive(),
  pack_units: z.array(packUnitSchema),
  scheme: schemeSchema.nullable(),
  in_stock: z.boolean(),
  available_base_qty: z.number().int().nullable(),
  rank: z.number().nullable(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;
export const catalogListSchema = z.array(catalogItemSchema);

export const categoryFacetSchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  name_ur: z.string().nullable(),
  tint: z.string().nullable(),
  image_path: z.string().nullable(),
  product_count: z.number().int(),
});
export type CategoryFacet = z.infer<typeof categoryFacetSchema>;

export const brandFacetSchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  name_ur: z.string().nullable(),
  logo_path: z.string().nullable(),
  product_count: z.number().int(),
});
export type BrandFacet = z.infer<typeof brandFacetSchema>;

export const facetsSchema = z.object({
  categories: z.array(categoryFacetSchema),
  brands: z.array(brandFacetSchema),
  distributors: z.array(
    z.object({
      id,
      name: z.string(),
      logo_path: z.string().nullable(),
      product_count: z.number().int(),
    }),
  ),
});
export type Facets = z.infer<typeof facetsSchema>;

export const bannerSchema = z.object({
  id,
  title: z.string(),
  title_ur: z.string().nullable(),
  subtitle: z.string().nullable(),
  image_path: z.string(),
  link: z.string().nullable(),
  org_id: id.nullable(),
});
export type Banner = z.infer<typeof bannerSchema>;

export const homeFeedSchema = z.object({
  order_again: catalogListSchema,
  deals: catalogListSchema,
  trending: catalogListSchema,
  categories: z.array(categoryFacetSchema),
  brands: z.array(brandFacetSchema),
  delivery: z.array(
    z.object({
      org_id: id,
      org_name: z.string(),
      next_slot_start: timestamp,
      next_slot_end: timestamp,
    }),
  ),
  banners: z.array(bannerSchema),
});
export type HomeFeed = z.infer<typeof homeFeedSchema>;

export const productDetailSchema = z.object({
  item: catalogItemSchema,
  description: z.string().nullable(),
  images: z.array(z.string()),
  schemes: z.array(schemeSchema),
  other_offers: catalogListSchema,
  bought_together: catalogListSchema,
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const lineProblemSchema = z.enum([
  "inactive",
  "below_moq",
  "out_of_stock",
  "insufficient_stock",
]);
export type LineProblem = z.infer<typeof lineProblemSchema>;

export const cartLineSchema = z.object({
  cart_item_id: id,
  distributor_product_id: id,
  item: catalogItemSchema.nullable(),
  pack_unit_id: id,
  pack_label: z.string(),
  base_qty_per_unit: z.number().int().positive(),
  quantity: z.number().int().positive(),
  piece_price_paisa: paisa,
  unit_price_paisa: paisa,
  line_discount_paisa: paisa,
  line_total_paisa: paisa,
  free_base_qty: z.number().int(),
  scheme_applied: z
    .object({ id: z.string(), name: z.string(), name_ur: z.string().nullable() })
    .nullable(),
  problems: z.array(lineProblemSchema),
});
export type CartLine = z.infer<typeof cartLineSchema>;

export const accountStatusSchema = z.enum(["active", "on_hold", "blocked", "none"]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const slotSchema = z.object({ start: timestamp, end: timestamp });
export type Slot = z.infer<typeof slotSchema>;

export const cartGroupSchema = z.object({
  org_id: id,
  org_name: z.string(),
  logo_path: z.string().nullable(),
  account_status: accountStatusSchema,
  credit_limit_paisa: paisa,
  credit_available_paisa: paisa,
  min_order_paisa: paisa,
  delivery_fee_paisa: paisa,
  free_delivery_above_paisa: paisa.nullable(),
  subtotal_paisa: paisa,
  scheme_discount_paisa: paisa,
  delivery_charge_paisa: paisa,
  total_paisa: paisa,
  meets_minimum: z.boolean(),
  short_by_paisa: paisa,
  next_slots: z.array(slotSchema),
  items: z.array(cartLineSchema),
});
export type CartGroup = z.infer<typeof cartGroupSchema>;

export const cartSummarySchema = z.object({
  item_count: z.number().int(),
  total_paisa: paisa,
  groups: z.array(cartGroupSchema),
});
export type CartSummary = z.infer<typeof cartSummarySchema>;

export const emptyCart: CartSummary = { item_count: 0, total_paisa: 0, groups: [] };

export const slotListSchema = z.array(z.object({ slot_start: timestamp, slot_end: timestamp }));

export const placeOrderResultSchema = z.object({
  orders: z.array(z.object({ id, order_number: z.string(), org_id: id, total_paisa: paisa })),
});
export type PlacedOrders = z.infer<typeof placeOrderResultSchema>;

export const reorderResultSchema = z.object({
  added: z.number().int(),
  skipped: z.array(
    z.object({ name: z.string(), reason: z.enum(["unavailable", "pack_unavailable"]) }),
  ),
  cart: cartSummarySchema,
});
export type ReorderResult = z.infer<typeof reorderResultSchema>;

export const ledgerEntrySchema = z.object({
  date: z.string(),
  kind: z.enum(["invoice", "payment", "credit_note", "adjustment"]),
  reference: z.string().nullable(),
  description: z.string().nullable(),
  debit_paisa: paisa,
  credit_paisa: paisa,
  balance_paisa: paisa,
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerSchema = z.object({
  org: z.object({ id, name: z.string(), logo_path: z.string().nullable() }),
  account_status: accountStatusSchema,
  credit_limit_paisa: paisa,
  payment_terms_days: z.number().int(),
  balance_paisa: paisa,
  available_credit_paisa: paisa,
  aging: z.object({
    current: paisa,
    d1_30: paisa,
    d31_60: paisa,
    d61_90: paisa,
    d90_plus: paisa,
  }),
  opening_balance_paisa: paisa,
  entries: z.array(ledgerEntrySchema),
});
export type Ledger = z.infer<typeof ledgerSchema>;

export const shopDistributorSchema = z.object({
  org_id: id,
  name: z.string(),
  logo_path: z.string().nullable(),
  area_name: z.string().nullable(),
  min_order_paisa: paisa,
  delivery_fee_paisa: paisa,
  free_delivery_above_paisa: paisa.nullable(),
  account_status: accountStatusSchema,
  credit_limit_paisa: paisa,
  balance_paisa: paisa,
  product_count: z.number().int(),
  rating: z.number().nullable(),
  rating_count: z.number().int(),
});
export type ShopDistributor = z.infer<typeof shopDistributorSchema>;

export const orderStatusSchema = z.enum([
  "new",
  "confirmed",
  "picking",
  "packed",
  "dispatched",
  "delivered",
  "partially_delivered",
  "returned",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentMethodSchema = z.enum([
  "cod",
  "credit",
  "jazzcash",
  "easypaisa",
  "raast",
  "bank_transfer",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const orderRowSchema = z.object({
  id,
  order_number: z.string(),
  org_id: id,
  status: orderStatusSchema,
  payment_method: paymentMethodSchema,
  payment_status: z.enum(["unpaid", "partially_paid", "paid", "refunded"]),
  total_paisa: paisa,
  ordered_total_paisa: paisa,
  subtotal_paisa: paisa,
  scheme_discount_paisa: paisa,
  delivery_fee_paisa: paisa,
  paid_paisa: paisa,
  delivery_slot_start: timestamp.nullable(),
  delivery_slot_end: timestamp.nullable(),
  created_at: timestamp,
  delivered_at: timestamp.nullable(),
  cancel_reason: z.string().nullable(),
  rating: z.number().int().nullable(),
  notes: z.string().nullable(),
  source: z.string(),
  placed_by_name: z.string().nullable(),
  organizations: z.object({ name: z.string(), logo_path: z.string().nullable() }).nullable(),
});
export type OrderRow = z.infer<typeof orderRowSchema>;

export const orderItemRowSchema = z.object({
  id,
  distributor_product_id: id,
  name: z.string(),
  name_ur: z.string().nullable(),
  image_path: z.string().nullable(),
  pack_label: z.string().nullable(),
  base_qty_per_unit: z.number().int(),
  quantity: z.number().int(),
  base_qty: z.number().int().nullable(),
  unit_price_paisa: paisa,
  line_total_paisa: paisa,
  line_discount_paisa: paisa,
  free_base_qty: z.number().int(),
  delivered_base_qty: z.number().int().nullable(),
  short_base_qty: z.number().int(),
});
export type OrderItemRow = z.infer<typeof orderItemRowSchema>;

export const statusHistoryRowSchema = z.object({
  id,
  from_status: orderStatusSchema.nullable(),
  to_status: orderStatusSchema,
  changed_by_name: z.string().nullable(),
  note: z.string().nullable(),
  created_at: timestamp,
});
export type StatusHistoryRow = z.infer<typeof statusHistoryRowSchema>;
