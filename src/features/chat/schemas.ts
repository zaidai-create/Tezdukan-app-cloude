import { z } from "zod";

/** Shapes of the chat RPCs (supabase/migrations/20261029090200_chat.sql). */

const id = z.uuid();
const timestamp = z.string().min(10);

export const chatSideSchema = z.enum(["shop", "org", "user", "staff", "system", "assistant"]);
export type ChatSide = z.infer<typeof chatSideSchema>;

export const conversationCardSchema = z.object({
  id,
  kind: z.enum(["trade", "support"]),
  shop_id: id.nullable(),
  org_id: id.nullable(),
  status: z.enum(["open", "closed"]),
  /** Support only: who answers now, the TezDukan assistant (AI) or the team. */
  support_mode: z.enum(["assistant", "team"]).nullable().optional(),
  team_requested_at: timestamp.nullable().optional(),
  my_side: chatSideSchema,
  last_message_at: timestamp.nullable(),
  last_message_preview: z.string().nullable(),
  last_sender_side: chatSideSchema.nullable(),
  unread: z.number().int(),
  counterpart: z.object({
    name: z.string(),
    image_path: z.string().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    bucket: z.string().nullable(),
  }),
});
export type ConversationCard = z.infer<typeof conversationCardSchema>;
export const conversationListSchema = z.array(conversationCardSchema);

export const chatMessageSchema = z.object({
  id,
  conversation_id: id,
  sender_id: id.nullable(),
  sender_side: chatSideSchema,
  sender_name: z.string().nullable(),
  body: z.string(),
  order_id: id.nullable(),
  order_number: z.string().nullable().optional(),
  created_at: timestamp,
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const conversationDetailSchema = z.object({
  conversation: conversationCardSchema,
  messages: z.array(chatMessageSchema),
  has_more: z.boolean(),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

/** System messages carry a code the app translates. */
export const SYSTEM_CODES = {
  support_auto_reply: "autoReply",
  support_offer_team: "offerTeam",
  support_team_requested: "teamRequested",
  support_assistant_unavailable: "assistantUnavailable",
  support_assistant_retry: "assistantRetry",
} as const;
