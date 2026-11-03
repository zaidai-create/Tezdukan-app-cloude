import { z } from "zod";

const paisa = z.number().int().min(0).max(100_000_000);

export const starterItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  image_path: z.string().nullable(),
  mrp_paisa: z.number().int(),
  category_name: z.string(),
});
export const starterPackSchema = z.array(starterItemSchema);
export type StarterItem = z.infer<typeof starterItemSchema>;

export const masterMatchSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    pack_size_label: z.string().nullable(),
    image_path: z.string().nullable(),
    mrp_paisa: z.number().int().nullable(),
    category_name: z.string().nullable(),
  }),
);
export type MasterMatch = z.infer<typeof masterMatchSchema>[number];

export const shopProductSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  name_ur: z.string().nullable(),
  pack_size_label: z.string().nullable(),
  image_path: z.string().nullable(),
  selling_price_paisa: z.number().int(),
  mrp_paisa: z.number().int().nullable(),
  qty_on_hand: z.coerce.number(),
  low_stock_threshold: z.coerce.number(),
  is_visible_online: z.boolean(),
  is_loose: z.boolean(),
});
export const shopProductsSchema = z.array(shopProductSchema);
export type ShopProduct = z.infer<typeof shopProductSchema>;

export const addItemSchema = z
  .object({
    master_product_id: z.uuid().optional(),
    name: z.string().trim().min(2).max(160).optional(),
    pack_size_label: z.string().trim().max(60).optional(),
    selling_price_paisa: paisa,
    qty: z.number().int().min(0).max(100_000).default(0),
  })
  .refine((item) => item.master_product_id || item.name, { message: "name" });
export const addItemsSchema = z.array(addItemSchema).min(1).max(60);
export type AddItem = z.input<typeof addItemSchema>;

export const updateProductSchema = z.object({
  id: z.uuid(),
  selling_price_paisa: paisa,
  qty: z.number().min(0).max(1_000_000),
  is_visible_online: z.boolean(),
});
export type UpdateProduct = z.infer<typeof updateProductSchema>;

export const addResultSchema = z.object({ added: z.number().int(), updated: z.number().int() });
