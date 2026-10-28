import "server-only";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/locales";
import { getPushSender } from "@/lib/integrations/push";
import { getSupabaseAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { notificationKindSchema } from "./schemas";
import { notificationText } from "./text";

/**
 * Delivers queued push messages (message_outbox, channel `push`). Called right after an
 * action that notifies someone (via `after()`, so the person never waits on it) and by the
 * scheduled /api/push/flush job for anything left over. Each message goes to every active
 * subscription of its recipient, in the recipient's language.
 */

const payloadSchema = z.object({
  notification_id: z.uuid(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
});

const claimedSchema = z.array(
  z.object({ id: z.uuid(), to_user_id: z.uuid().nullable(), payload: z.unknown() }),
);

export async function flushPushOutbox(limit = 50): Promise<{ claimed: number }> {
  if (!hasAdminClient()) return { claimed: 0 };
  const admin = getSupabaseAdminClient();
  const sender = getPushSender();

  const { data, error } = await admin.rpc("claim_push_messages", { p_limit: limit });
  if (error) throw new Error(error.message);
  const messages = claimedSchema.parse(data);

  for (const message of messages) {
    const payload = payloadSchema.safeParse(message.payload);
    if (!payload.success || !message.to_user_id) {
      await admin
        .from("message_outbox")
        .update({ status: "failed", error: "Unreadable push payload" })
        .eq("id", message.id);
      continue;
    }
    const [{ data: subscriptions }, { data: profile }] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", message.to_user_id)
        .eq("is_active", true),
      admin.from("profiles").select("locale").eq("id", message.to_user_id).maybeSingle(),
    ]);
    const locale = profile?.locale && isLocale(profile.locale) ? profile.locale : defaultLocale;
    const t = await getTranslations({ locale, namespace: "notifications" });
    const text = notificationText(t, payload.data);
    const tag =
      typeof payload.data.data.order_id === "string"
        ? `order-${payload.data.data.order_id}`
        : typeof payload.data.data.conversation_id === "string"
          ? `chat-${payload.data.data.conversation_id}`
          : payload.data.notification_id;

    const results = await Promise.all(
      (subscriptions ?? []).map(async (subscription) => {
        const result = await sender.send(subscription, {
          title: text.title,
          body: text.body ?? undefined,
          link: payload.data.link ?? undefined,
          tag,
        });
        if (result.status === "expired") {
          await admin
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("id", subscription.id);
        }
        return result;
      }),
    );

    const sent = results.some((r) => r.status === "sent");
    const failure = results.find((r) => r.status === "failed");
    await admin
      .from("message_outbox")
      .update({
        status: sender.provider === "sandbox" ? "sandbox" : sent || !failure ? "sent" : "failed",
        provider: sender.provider,
        sent_at: sent ? new Date().toISOString() : null,
        error: failure?.status === "failed" ? failure.error.slice(0, 500) : null,
      })
      .eq("id", message.id);
  }
  return { claimed: messages.length };
}

/** Flush without ever failing the caller: push is best effort, the in-app alert is the record. */
export async function flushPushOutboxQuietly(): Promise<void> {
  try {
    await flushPushOutbox();
  } catch (error) {
    console.error("push outbox flush failed", error);
  }
}
