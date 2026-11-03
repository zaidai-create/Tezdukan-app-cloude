"use client";

import { useCallback, useEffect, useState } from "react";
import { publicEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * This browser's Web Push subscription. "sandbox" means the app has no push key yet: alerts
 * still arrive inside the open app (Realtime), never on the home screen.
 */
export type PushState = "loading" | "unsupported" | "sandbox" | "blocked" | "off" | "on";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const { error } = await getSupabaseBrowserClient().rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_user_agent: navigator.userAgent,
  });
  if (error) throw new Error(error.message);
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refreshState = useCallback(async () => {
    if (!supported()) return setState("unsupported");
    if (!publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return setState("sandbox");
    if (Notification.permission === "denied") return setState("blocked");
    const subscription = await currentSubscription().catch(() => null);
    if (subscription && Notification.permission === "granted") {
      // Re-save on every visit: the person signed in on this phone may have changed.
      await save(subscription).catch(() => undefined);
      return setState("on");
    }
    setState("off");
  }, []);

  useEffect(() => {
    // Reading the browser's permission and subscription is async: it has to start here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshState();
  }, [refreshState]);

  const enable = useCallback(async (): Promise<boolean> => {
    const key = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!supported() || !key) return false;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return false;
      }
      // The service worker normally registers on first load; never wait on it forever.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("service worker not ready")), 10_000),
        ),
      ]);
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key),
        }));
      await save(subscription);
      setState("on");
      return true;
    } catch {
      setState("off");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await getSupabaseBrowserClient().rpc("unregister_push_subscription", {
          p_endpoint: subscription.endpoint,
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
