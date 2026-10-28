"use server";

import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { chatErrorKey, type ChatErrorKey } from "./errors";
import { chatMessageSchema, chatSideSchema, type ChatMessage } from "./schemas";

export type ChatResult<T> = { ok: true; data: T } | { ok: false; error: ChatErrorKey };

const sendInput = z.object({
  conversationId: z.uuid(),
  body: z.string().trim().min(1).max(2000),
  orderId: z.uuid().optional(),
  as: chatSideSchema.optional(),
});

/** Sends one message; the other side is notified and gets a phone push after the response. */
export async function sendChatMessage(
  input: z.input<typeof sendInput>,
): Promise<ChatResult<ChatMessage>> {
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "message_empty" };
  const { conversationId, body, orderId, as } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("send_chat_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_order_id: orderId,
    p_as: as,
  });
  if (error) return { ok: false, error: chatErrorKey(error) };
  after(flushPushOutboxQuietly);
  return { ok: true, data: chatMessageSchema.parse(data) };
}
