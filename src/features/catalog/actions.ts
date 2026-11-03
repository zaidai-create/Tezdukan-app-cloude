"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireDistributor } from "@/features/distributor/data";
import { draftProductWithAi } from "@/lib/ai/product-draft";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogReference, getOrgStarterPack } from "./data";
import { catalogErrorKey, type CatalogErrorKey } from "./errors";
import { hasDetails, parseProductNote, type ProductDraft } from "./parse-note";
import {
  productInputSchema,
  starterChoiceSchema,
  type ProductInput,
  type StarterChoice,
} from "./schemas";

/**
 * Catalog writes for the distributor's active organization. The organization always comes
 * from the session, never from the client.
 */

export type CatalogResult<T> = { ok: true; data: T } | { ok: false; error: CatalogErrorKey };

export async function saveProduct(input: ProductInput): Promise<CatalogResult<{ id: string }>> {
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { orgId } = await requireDistributor("/distributor/catalog");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_distributor_product", {
    p_org_id: orgId,
    p_product: parsed.data,
  });
  if (error) return { ok: false, error: catalogErrorKey(error) };
  refresh();
  return { ok: true, data: { id: z.uuid().parse(data) } };
}

export async function setProductActive(
  productId: string,
  active: boolean,
): Promise<CatalogResult<null>> {
  if (!z.uuid().safeParse(productId).success) return { ok: false, error: "product_not_found" };
  const { orgId } = await requireDistributor("/distributor/catalog");
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("distributor_products")
    .update({ is_active: active })
    .eq("id", productId)
    .eq("org_id", orgId)
    .select("id");
  if (error) return { ok: false, error: catalogErrorKey(error) };
  if (!data.length) return { ok: false, error: "not_allowed" };
  refresh();
  return { ok: true, data: null };
}

const draftInput = z.object({
  note: z.string().max(1000),
  photo: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      // ~3.75 MB of image once decoded: plenty for a phone photo resized in the browser.
      base64: z.string().max(5_000_000),
    })
    .optional(),
});

export type DraftOutcome =
  | { ok: true; mode: "ai" | "sandbox"; draft: ProductDraft }
  | { ok: false; reason: "empty" | "photo_needs_ai" };

/**
 * Munshi fills the product form. With an AI key it reads the note and/or photo with Claude;
 * without one (or if Claude fails) a note is read by the Sandbox parser and says so.
 */
export async function draftProduct(input: z.input<typeof draftInput>): Promise<DraftOutcome> {
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "empty" };
  await requireDistributor("/distributor/catalog/new");
  const { note, photo } = parsed.data;
  if (!note.trim() && !photo) return { ok: false, reason: "empty" };

  const reference = await getCatalogReference();
  const brands = reference.brands.map((b) => b.name);
  const ai = await draftProductWithAi({
    note,
    photo,
    brands,
    categories: reference.categories,
  });
  if (ai.ok && hasDetails(ai.draft)) return { ok: true, mode: "ai", draft: ai.draft };

  if (!note.trim()) return { ok: false, reason: "photo_needs_ai" };
  const draft = parseProductNote(note, brands);
  return hasDetails(draft) ? { ok: true, mode: "sandbox", draft } : { ok: false, reason: "empty" };
}

/**
 * Adds the chosen common products in one go. Only ids, trade prices and stock come from the
 * browser; names, photos, aisles and MRP are read again from the catalogue here.
 */
export async function addStarterProducts(
  choices: StarterChoice[],
): Promise<CatalogResult<{ added: number }>> {
  const parsed = starterChoiceSchema.safeParse(choices);
  if (!parsed.success) return { ok: false, error: "generic" };
  const { orgId } = await requireDistributor("/distributor/catalog");
  const pack = new Map((await getOrgStarterPack(orgId, 40)).map((item) => [item.id, item]));
  const supabase = await getSupabaseServerClient();
  let added = 0;
  for (const choice of parsed.data) {
    const item = pack.get(choice.id);
    if (!item) continue;
    const { error } = await supabase.rpc("save_distributor_product", {
      p_org_id: orgId,
      p_product: {
        master_product_id: item.id,
        name: item.name,
        name_ur: item.name_ur,
        brand_id: item.brand_id,
        category_id: item.category_id,
        pack_size_label: item.pack_size_label,
        barcode: item.barcode,
        image_path: item.image_path,
        mrp_paisa: item.mrp_paisa,
        trade_price_paisa: choice.trade_price_paisa,
        moq_base_qty: 1,
        carton_qty:
          item.units_per_carton && item.units_per_carton >= 2 ? item.units_per_carton : null,
        stock_in_qty: choice.stock_in_qty,
      },
    });
    if (error) {
      if (added > 0) refresh();
      return { ok: false, error: catalogErrorKey(error) };
    }
    added += 1;
  }
  refresh();
  return { ok: true, data: { added } };
}
