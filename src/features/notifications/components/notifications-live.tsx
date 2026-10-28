"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePathname, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/haptics";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { inScope, notificationSchema, type NotificationScope } from "../schemas";
import { notificationText } from "../text";

/** A short two-tone chime for new orders (Web Audio: no file to download). */
function chime() {
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.5);
    [880, 1320].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.14);
      oscillator.stop(context.currentTime + 0.5);
    });
    setTimeout(() => void context.close(), 800);
  } catch {
    // Audio is a nicety; browsers may block it before the first tap.
  }
}

/**
 * Listens for new notifications over Realtime while the app is open: refreshes the bell,
 * shows a toast (with a chime for new orders), and refreshes the screen when an order on it
 * changed. Mounted once per shell.
 */
export function NotificationsLive({ scope }: { scope: NotificationScope }) {
  const t = useTranslations("notifications");
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  // The latest values, read from the Realtime callback without resubscribing.
  const latest = useRef({ t, router, pathname, scope });
  useEffect(() => {
    latest.current = { t, router, pathname, scope };
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`notifications:${scope.userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${scope.userId}`,
        },
        (event) => {
          const { t, router, pathname, scope } = latest.current;
          void queryClient.invalidateQueries({ queryKey: ["notifications", scope.userId] });
          const row = notificationSchema.safeParse(event.new);
          if (!row.success || !inScope(scope, row.data)) return;
          const n = row.data;

          if (n.kind === "chat") void queryClient.invalidateQueries({ queryKey: ["chat"] });
          // Already looking at it: the screen updates itself, no toast needed.
          if (n.link && pathname === n.link) {
            router.refresh();
            return;
          }
          if (n.kind === "order" || n.kind === "delivery") {
            const orderId = typeof n.data.order_id === "string" ? n.data.order_id : null;
            if (orderId && pathname.includes(orderId)) router.refresh();
            if (pathname.endsWith("/orders") || pathname === "/distributor") router.refresh();
          }
          if (n.data.event === "order.created") chime();

          const text = notificationText(t, n);
          haptic("success");
          toast(text.title, {
            description: text.body ?? undefined,
            action: n.link
              ? {
                  label: t("view"),
                  onClick: () => {
                    if (n.link) router.push(n.link);
                  },
                }
              : undefined,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, scope.userId]);

  return null;
}
