"use server";

import { after } from "next/server";
import { z } from "zod";
import { flushPushOutboxQuietly } from "@/features/notifications/dispatch";
import { answerSupportChat } from "@/features/support-ai/answer";
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
  const message = chatMessageSchema.parse(data);
  after(flushPushOutboxQuietly);
  // In a support chat the TezDukan assistant answers first; its reply arrives over Realtime.
  if (sentToAssistant.safeParse(data).success && message.sender_side !== "staff") {
    after(async () => {
      await answerSupportChat(conversationId, message.id);
      await flushPushOutboxQuietly();
    });
  }
  return { ok: true, data: message };
}

const sentToAssistant = z.object({ support_mode: z.literal("assistant") });

/** "Yes, connect me": the support chat goes to the TezDukan team, who are notified. */
export async function requestSupportTeam(conversationId: string): Promise<ChatResult<null>> {
  const id = z.uuid().safeParse(conversationId);
  if (!id.success) return { ok: false, error: "conversation_not_found" };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("request_support_team", { p_conversation_id: id.data });
  if (error) return { ok: false, error: chatErrorKey(error) };
  after(flushPushOutboxQuietly);
  return { ok: true, data: null };
}
