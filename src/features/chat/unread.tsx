"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { create } from "zustand";
import { Link } from "@/i18n/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Unread chat messages for the nav dock and header (the nav has no session of its own). */
export const useChatUnread = create<{ count: number; set: (count: number) => void }>((set) => ({
  count: 0,
  set: (count) => set({ count }),
}));

/**
 * Keeps the unread count for the active dukan or distributor fresh. Realtime chat
 * notifications and reading a thread invalidate ["chat", ...], which refetches this.
 */
export function ChatUnreadSync({ shopId, orgId }: { shopId?: string; orgId?: string }) {
  const setCount = useChatUnread((s) => s.set);
  const { data } = useQuery({
    queryKey: ["chat", "unread", shopId ?? null, orgId ?? null],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: count, error } = await getSupabaseBrowserClient().rpc("chat_unread_count", {
        p_shop_id: shopId,
        p_org_id: orgId,
      });
      if (error) throw new Error(error.message);
      return typeof count === "number" ? count : 0;
    },
  });
  useEffect(() => {
    if (data !== undefined) setCount(data);
  }, [data, setCount]);
  return null;
}

/** Header chat button with the unread count (dukandar: the dock has no room for a tab). */
export function ChatHeaderButton({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("chat");
  const count = useChatUnread((s) => s.count);
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-subtle",
        className,
      )}
    >
      <MessageCircle aria-hidden className="size-[22px]" strokeWidth={1.75} />
      <span className="sr-only">
        {t("open")}
        {count > 0 ? `, ${t("unread", { count })}` : ""}
      </span>
      {count > 0 ? (
        <span
          aria-hidden
          className="num absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-action px-1 text-[11px] leading-none font-bold text-on-action ring-2 ring-surface"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
