"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireDistributor } from "@/features/distributor/data";
import { draftProductWithAi } from "@/lib/ai/product-draft";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCatalogReference } from "./data";
import { catalogErrorKey, type CatalogErrorKey } from "./errors";
import { hasDetails, parseProductNote, type ProductDraft } from "./parse-note";
import { productInputSchema, type ProductInput } from "./schemas";

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
