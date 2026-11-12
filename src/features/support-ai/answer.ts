import "server-only";
import { z } from "zod";
import { GeminiError, geminiGenerate, hasGemini, type GeminiContent } from "@/lib/ai/gemini";
import { getSupabaseAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { faqText } from "./faq";
import { replyLanguage } from "./language";

/**
 * The TezDukan assistant's turn in a support chat. Runs on the server after the person's
 * message is saved: reads the chat and the person's own recent orders, asks Gemini for a short
 * answer grounded in the support FAQ, and writes it with the service role. When it cannot help
 * (or the person is upset or asks for a human) it adds "Should I connect you with my team?".
 * If the AI is not set up or fails, the chat goes to the team at once, so nobody is left
 * waiting for an answer that will not come.
 *
 * Audited use of the admin client: it reads only this conversation, its messages and the
 * orders of the person (or dukan/distributor) the conversation belongs to.
 */

const conversationSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  support_mode: z.string(),
  user_id: z.uuid().nullable(),
  shop_id: z.uuid().nullable(),
  org_id: z.uuid().nullable(),
});

const messageSchema = z.object({
  id: z.uuid(),
  sender_side: z.string(),
  body: z.string(),
  created_at: z.string(),
});

const replySchema = z.object({
  reply: z.string().trim().min(1).max(1200),
  offer_team: z.boolean(),
});

const REPLY_JSON_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "The answer to send, short, in the person's language." },
    offer_team: {
      type: "boolean",
      description:
        "True when the assistant cannot fully solve it, the person is upset, asks for a person, or it involves money, a dispute, an account problem or anything not in the FAQ.",
    },
  },
  required: ["reply", "offer_team"],
} as const;

const SYSTEM = `You are the TezDukan Assistant, the first answer in TezDukan's support chat. TezDukan is a grocery app in Hyderabad, Sindh, Pakistan: customers order from nearby dukans (kiryana shops) and dukandars buy stock from distributors.

How to answer:
- When the person asks about their order ("where is my order", "kab aayega"), use the account facts: name the latest order's number, dukan and status in one line, then what they can do (call the dukan from the order, or wait for the next step).
- Answer ONLY from the FAQ and the account facts below. Never invent features, fees, times, phone numbers, refunds or promises. If the answer is not there, say you will pass it to the team and set offer_team to true.
- Be short: 1 to 3 short sentences, like a helpful shop assistant on WhatsApp. Use the app's own words for buttons and screens (for example: Account > Orders, Report a problem, Place order).
- Reply in the same language and script the person wrote in: English, Urdu script, or Roman Urdu (Urdu in English letters). Sindhi in Sindhi script is fine too.
- Greetings ("salam", "hi"): greet back warmly and ask how you can help, in one line. offer_team false.
- Never ask for passwords, OTP codes or card numbers. Never share anyone else's details.
- Set offer_team to true when: the person asks for a human / the team / a call; they are angry or upset; it is about money owed, a refund claim, a damaged or missing item that needs checking, an account or sign-in problem you cannot fix, a registration decision, or anything outside the FAQ; or the same question comes back unsolved. When offer_team is true, do not ask the question yourself: the app shows "Should I connect you with my team?" with Yes and No buttons right after your answer.
- If the person says no to the team or says thanks, close politely and ask if there is anything else. offer_team false.`;

const ORDER_STATUS_WORDS: Record<string, string> = {
  placed: "placed, waiting for the dukan to accept",
  accepted: "accepted by the dukan",
  packed: "packed",
  out_for_delivery: "on the way",
  delivered: "delivered",
  cancelled: "cancelled",
  rejected: "rejected by the dukan",
};

async function accountFacts(conversation: z.infer<typeof conversationSchema>): Promise<string> {
  const admin = getSupabaseAdminClient();
  if (conversation.user_id) {
    const { data } = await admin
      .from("customer_orders")
      .select("order_number, shop_name, status, total_paisa, created_at, rejected_reason")
      .eq("customer_id", conversation.user_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3);
    const orders = z
      .array(
        z.object({
          order_number: z.string(),
          shop_name: z.string(),
          status: z.string(),
          total_paisa: z.number(),
          created_at: z.string(),
          rejected_reason: z.string().nullable(),
        }),
      )
      .catch([])
      .parse(data ?? []);
    if (orders.length === 0) return "This customer has no orders yet.";
    return [
      "This customer's latest orders (newest first):",
      ...orders.map(
        (order) =>
          `- ${order.order_number} from ${order.shop_name}, Rs ${Math.round(order.total_paisa / 100)}, ${ORDER_STATUS_WORDS[order.status] ?? order.status}${order.rejected_reason ? ` (reason: ${order.rejected_reason})` : ""}, placed ${order.created_at.slice(0, 16).replace("T", " ")} UTC`,
      ),
    ].join("\n");
  }
  if (conversation.shop_id) {
    const { data } = await admin
      .from("shops")
      .select("name, status")
      .eq("id", conversation.shop_id)
      .maybeSingle();
    const shop = z.object({ name: z.string(), status: z.string() }).safeParse(data);
    return shop.success
      ? `This chat is from the dukandar of "${shop.data.name}" (registration status: ${shop.data.status}).`
      : "This chat is from a dukandar.";
  }
  if (conversation.org_id) {
    const { data } = await admin
      .from("organizations")
      .select("name, status")
      .eq("id", conversation.org_id)
      .maybeSingle();
    const org = z.object({ name: z.string(), status: z.string() }).safeParse(data);
    return org.success
      ? `This chat is from the distributor "${org.data.name}" (registration status: ${org.data.status}).`
      : "This chat is from a distributor.";
  }
  return "";
}

/** Writes the assistant's answer to the newest message in a support chat, if it still needs one. */
export async function answerSupportChat(conversationId: string, messageId: string): Promise<void> {
  if (!hasAdminClient()) return;
  const admin = getSupabaseAdminClient();
  const { data: row } = await admin
    .from("conversations")
    .select("id, kind, support_mode, user_id, shop_id, org_id")
    .eq("id", conversationId)
    .maybeSingle();
  const conversation = conversationSchema.safeParse(row);
  if (
    !conversation.success ||
    conversation.data.kind !== "support" ||
    conversation.data.support_mode !== "assistant"
  ) {
    return;
  }

  if (!hasGemini()) {
    await admin.rpc("support_assistant_unavailable", { p_conversation_id: conversationId });
    return;
  }

  let failedJustBefore = false;
  try {
    const { data: recent } = await admin
      .from("chat_messages")
      .select("id, sender_side, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(14);
    const messages = z
      .array(messageSchema)
      .parse(recent ?? [])
      .reverse();
    // Two messages sent quickly: the later call answers both, with the whole conversation.
    const lastFromPerson = messages
      .filter((message) => ["user", "shop", "org"].includes(message.sender_side))
      .at(-1);
    if (!lastFromPerson || lastFromPerson.id !== messageId) return;
    // The assistant's last word before this message was "try again": this is the second try.
    const before = messages.filter((message) => message.created_at < lastFromPerson.created_at);
    failedJustBefore =
      before.findLast((message) => !["user", "shop", "org"].includes(message.sender_side))?.body ===
      "support_assistant_retry";

    const contents: GeminiContent[] = [];
    for (const message of messages) {
      if (message.sender_side === "system") continue;
      const role = ["user", "shop", "org"].includes(message.sender_side) ? "user" : "model";
      const text =
        message.sender_side === "staff" ? `(TezDukan team) ${message.body}` : message.body;
      const previous = contents.at(-1);
      // Gemini wants turns to alternate; join neighbours from the same side.
      if (previous && previous.role === role) previous.parts.push({ text });
      else contents.push({ role, parts: [{ text }] });
    }
    if (contents[0]?.role === "model") contents.shift();
    if (contents.length === 0) return;

    const facts = await accountFacts(conversation.data);
    const result = await geminiGenerate({
      system: `${SYSTEM}\n\nFAQ:\n${faqText()}\n\nAccount facts:\n${facts || "None."}\n\nReply language for this answer: ${replyLanguage(lastFromPerson.body)}. Translate the FAQ wording into it.`,
      contents,
      jsonSchema: REPLY_JSON_SCHEMA,
      model: "fast",
      temperature: 0.2,
      // It runs after the response, so it can wait a little longer for a busy model.
      attemptMs: 10_000,
      totalMs: 26_000,
    });
    const reply = replySchema.parse(JSON.parse(result.text));
    await admin.rpc("post_support_assistant_reply", {
      p_conversation_id: conversationId,
      p_body: reply.reply,
      p_offer_team: reply.offer_team,
    });
  } catch (error) {
    // Bad JSON, a blocked answer, quota or a timeout. The first time, ask the person to try
    // again (the free AI tier is sometimes busy for a moment); twice in a row, the team answers.
    console.error(
      "support assistant failed",
      error instanceof GeminiError ? error.message : error instanceof Error ? error.name : error,
    );
    if (failedJustBefore) {
      await admin.rpc("support_assistant_unavailable", { p_conversation_id: conversationId });
    } else {
      await admin.rpc("post_support_assistant_note", {
        p_conversation_id: conversationId,
        p_code: "support_assistant_retry",
      });
    }
  }
}
