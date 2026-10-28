import "server-only";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { conversationDetailSchema, conversationListSchema, type ChatSide } from "./schemas";

/** Server-side chat reads, as the signed-in person (the RPCs decide which side they are). */

export async function getConversations(scope: {
  shopId?: string;
  orgId?: string;
  supportQueue?: boolean;
}) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_conversations", {
    p_shop_id: scope.shopId,
    p_org_id: scope.orgId,
    p_support_queue: scope.supportQueue ?? false,
  });
  if (error) throw new Error(error.message);
  return conversationListSchema.parse(data);
}

export async function getConversation(conversationId: string, as?: ChatSide) {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("conversation_detail", {
    p_conversation_id: conversationId,
    p_as: as,
  });
  if (error) {
    if (error.message === "conversation_not_found") notFound();
    throw new Error(error.message);
  }
  return conversationDetailSchema.parse(data);
}

/** Gets (or starts) a conversation; used by "Chat" buttons before showing the thread. */
export async function openConversation(input: {
  kind: "trade" | "support";
  shopId?: string;
  orgId?: string;
}): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("open_conversation", {
    p_kind: input.kind,
    p_shop_id: input.shopId,
    p_org_id: input.orgId,
  });
  if (error) {
    if (error.message === "not_allowed") notFound();
    throw new Error(error.message);
  }
  if (typeof data !== "string") throw new Error("open_conversation returned no id");
  return data;
}
