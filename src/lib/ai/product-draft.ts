import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { productDraftSchema, type ProductDraft } from "@/features/catalog/parse-note";
import { getAiConfig } from "./config";

/**
 * Munshi reading a product for a distributor: a note ("Tapal Danedar 950g, carton 12, rate
 * 1750") and/or a photo of the pack, into form fields. One structured-output call; the app
 * checks every field again before anything is saved.
 */

const nullable = (type: "string" | "number" | "integer") => ({ type: [type, "null"] });

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "name_ur",
    "brand",
    "category",
    "pack_size_label",
    "trade_price_rupees",
    "mrp_rupees",
    "carton_qty",
    "moq_pieces",
    "barcode",
  ],
  properties: {
    name: nullable("string"),
    name_ur: nullable("string"),
    brand: nullable("string"),
    category: nullable("string"),
    pack_size_label: nullable("string"),
    trade_price_rupees: nullable("number"),
    mrp_rupees: nullable("number"),
    carton_qty: nullable("integer"),
    moq_pieces: nullable("integer"),
    barcode: nullable("string"),
  },
} as const;

const SYSTEM = `You help Pakistani grocery distributors add products to their catalog on TezDukan.
They describe a product in English, Roman Urdu or Urdu, or send a photo of the pack. Return the
fields you can read; use null for anything not stated or not visible. Never guess a price.

- name: the product name in English as printed on the pack, with the pack size at the end,
  e.g. "Tapal Danedar Black Tea 950 g".
- name_ur: the Urdu name in Urdu script when it is printed on the pack or you are sure of it.
- brand: one of the known brands when it matches, otherwise the brand as written.
- category: one slug from the category list, or null.
- pack_size_label: a number and unit: "950 g", "1 kg", "500 ml", "1 L".
- trade_price_rupees: the distributor's price to shops for ONE piece ("rate", "TP", "trade",
  "qeemat"). If they give a carton price, divide it by the pieces in the carton.
- mrp_rupees: the retail price for ONE piece ("MRP", "retail", "print"), from the note or the
  printed MRP on the pack.
- carton_qty: pieces in a carton/box/dabba/peti, if stated.
- moq_pieces: minimum order in pieces, if stated.
- barcode: the 8 to 14 digit barcode, if stated or clearly readable.`;

export type DraftInput = {
  note: string;
  photo?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };
  brands: readonly string[];
  categories: readonly { slug: string; name: string }[];
};

export type DraftResult =
  { ok: true; draft: ProductDraft } | { ok: false; error: "not_configured" | "refused" | "failed" };

export async function draftProductWithAi(input: DraftInput): Promise<DraftResult> {
  const config = getAiConfig();
  if (config.AI_PROVIDER !== "anthropic" || !config.ANTHROPIC_API_KEY) {
    return { ok: false, error: "not_configured" };
  }
  const client = new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
    maxRetries: 1,
    timeout: 45_000,
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.photo) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.photo.mediaType, data: input.photo.base64 },
    });
  }
  content.push({
    type: "text",
    text: [
      `Known brands: ${input.brands.join(", ") || "none"}`,
      `Categories (slug: name): ${input.categories.map((c) => `${c.slug}: ${c.name}`).join("; ")}`,
      input.note.trim()
        ? `The distributor wrote: ${input.note.trim()}`
        : "Read the product from the photo.",
    ].join("\n"),
  });

  try {
    const response = await client.beta.messages.create({
      model: config.AI_MODEL_AGENT,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: DRAFT_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "refused" };
    const text = response.content.find((block) => block.type === "text");
    if (!text || text.type !== "text") return { ok: false, error: "failed" };
    const parsed = productDraftSchema.safeParse(JSON.parse(text.text));
    return parsed.success ? { ok: true, draft: parsed.data } : { ok: false, error: "failed" };
  } catch (error) {
    console.error("Munshi product draft failed", error);
    return { ok: false, error: "failed" };
  }
}
