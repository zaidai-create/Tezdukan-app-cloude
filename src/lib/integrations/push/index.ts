import "server-only";
import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Web Push adapter. The real sender signs each message with the VAPID keys and hands it to
 * the browser's push service (FCM for Chrome on Android). Without keys the Sandbox sender
 * delivers nothing and says so: outbox rows are marked `sandbox`, and the app shows in-app
 * alerts only.
 */

export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

export type PushPayload = {
  title: string;
  body?: string;
  /** Path inside the app to open on tap, e.g. /dukan/orders/<id>. */
  link?: string;
  /** Collapses repeats (same order, same chat) into one notification on the phone. */
  tag?: string;
};

export type PushResult =
  | { status: "sent" }
  | { status: "sandbox" }
  /** The subscription is gone for good (unsubscribed, app uninstalled): stop using it. */
  | { status: "expired" }
  | { status: "failed"; error: string };

export interface PushSender {
  readonly provider: "web_push" | "sandbox";
  send(subscription: PushSubscriptionKeys, payload: PushPayload): Promise<PushResult>;
}

const sandboxSender: PushSender = {
  provider: "sandbox",
  async send() {
    return { status: "sandbox" };
  },
};

function webPushSender(publicKey: string, privateKey: string): PushSender {
  webpush.setVapidDetails(serverEnv.VAPID_SUBJECT, publicKey, privateKey);
  return {
    provider: "web_push",
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          // Order updates matter for hours, not days; the push service drops them after that.
          { TTL: 6 * 60 * 60, urgency: "high" },
        );
        return { status: "sent" };
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error ? error.statusCode : null;
        if (statusCode === 404 || statusCode === 410) return { status: "expired" };
        return { status: "failed", error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}

let sender: PushSender | null = null;

export function getPushSender(): PushSender {
  if (sender) return sender;
  const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv.VAPID_PRIVATE_KEY;
  sender = publicKey && privateKey ? webPushSender(publicKey, privateKey) : sandboxSender;
  return sender;
}

/** Whether phone notifications are real (keys set) or Sandbox, for labels in the UI. */
export function pushMode(): PushSender["provider"] {
  return getPushSender().provider;
}
