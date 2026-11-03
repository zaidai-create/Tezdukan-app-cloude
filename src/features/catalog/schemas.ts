import { z } from "zod";

/** Shapes of the catalog RPCs (supabase/migrations/20261029090400_catalog_management.sql). */

const id = z.uuid();
const paisa = z.number().int();

export const catalogFilterSchema = z.enum(["all", "active", "out_of_stock", "inactive"]);
export type CatalogFilter = z.infer<typeof catalogFilterSchema>;

export const catalogRowSchema = z.object({
  id,
  name: z.string(),
  name_ur: z.string().nullable(),
  sku: z.string(),
  barcode: z.string().nullable(),
  brand_id: id.nullable(),
  brand_name: z.string().nullable(),
  category_id: id.nullable(),
  category_name: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  image_path: z.string().nullable(),
  master_product_id: id.nullable(),
  description: z.string().nullable(),
  mrp_paisa: paisa,
  trade_price_paisa: paisa,
  moq_base_qty: z.number().int(),
  is_active: z.boolean(),
  carton_qty: z.number().int().nullable(),
  available_base_qty: z.number().int().nullable(),
  updated_at: z.string(),
});
export type CatalogRow = z.infer<typeof catalogRowSchema>;

export const orgCatalogSchema = z.object({
  counts: z.object({
    all: z.number().int(),
    active: z.number().int(),
    out_of_stock: z.number().int(),
    inactive: z.number().int(),
  }),
  items: z.array(catalogRowSchema),
});
export type OrgCatalog = z.infer<typeof orgCatalogSchema>;

export const masterMatchSchema = z.object({
  id,
  name: z.string(),
  name_ur: z.string().nullable(),
  brand_id: id.nullable(),
  brand_name: z.string().nullable(),
  category_id: id.nullable(),
  category_name: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  barcode: z.string().nullable(),
  units_per_carton: z.number().int().nullable(),
  mrp_paisa: paisa.nullable(),
  image_path: z.string().nullable(),
});
export type MasterMatch = z.infer<typeof masterMatchSchema>;

export const referenceSchema = z.object({
  brands: z.array(z.object({ id, name: z.string() })),
  categories: z.array(z.object({ id, slug: z.string(), name: z.string() })),
});
export type CatalogReference = z.infer<typeof referenceSchema>;

/** What the form sends to save_distributor_product. Prices are paisa per piece. */
export const productInputSchema = z.object({
  id: id.optional(),
  master_product_id: id.nullable().optional(),
  name: z.string().trim().min(2).max(160),
  name_ur: z.string().trim().max(160).optional(),
  brand_id: id.nullable().optional(),
  category_id: id.nullable().optional(),
  pack_size_label: z.string().trim().max(40).optional(),
  barcode: z
    .string()
    .trim()
    .regex(/^(\d{8,14})?$/)
    .optional(),
  image_path: z.string().max(300).nullable().optional(),
  trade_price_paisa: z.number().int().positive(),
  mrp_paisa: z.number().int().nonnegative(),
  moq_base_qty: z.number().int().min(1).max(100_000),
  carton_qty: z.number().int().min(2).max(10_000).nullable(),
  stock_in_qty: z.number().int().min(0).max(10_000_000).optional(),
  stock_expiry_date: z.iso.date().optional(),
  is_active: z.boolean(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const orgStarterItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  brand_id: z.uuid().nullable(),
  category_id: z.uuid(),
  category_name: z.string(),
  pack_size_label: z.string().nullable(),
  barcode: z.string().nullable(),
  image_path: z.string().nullable(),
  mrp_paisa: z.number().int(),
  units_per_carton: z.number().int().nullable(),
});
export const orgStarterPackSchema = z.array(orgStarterItemSchema);
export type OrgStarterItem = z.infer<typeof orgStarterItemSchema>;

export const starterChoiceSchema = z
  .array(
    z.object({
      id: z.uuid(),
      trade_price_paisa: z.number().int().min(1).max(100_000_000),
      stock_in_qty: z.number().int().min(0).max(1_000_000),
    }),
  )
  .min(1)
  .max(40);
export type StarterChoice = z.infer<typeof starterChoiceSchema>[number];
