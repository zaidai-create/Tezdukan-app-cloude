"use client";

import { Copy, MessageSquareShare } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";

/** The dukan's own link, to send to regular customers on WhatsApp. */
export function ShareCard({ url, name }: { url: string; name: string }) {
  const t = useTranslations("onlineDukan");
  const text = t("shareText", { name, url });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      haptic("success");
      toast.success(t("copied"));
    } catch {
      toast.error(t("errors.generic"));
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <div>
        <h2 className="font-heading text-lg font-bold text-ink">{t("shareTitle")}</h2>
        <p className="text-sm text-muted">{t("shareHint")}</p>
      </div>
      <p
        dir="ltr"
        className="num truncate rounded-md bg-subtle px-3 py-2.5 text-sm font-medium text-ink"
      >
        {url}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft px-3 text-sm font-semibold text-primary-strong"
        >
          <MessageSquareShare aria-hidden className="size-5" strokeWidth={1.75} />
          {t("shareWhatsapp")}
        </a>
        <button
          type="button"
          onClick={copy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-soft px-3 text-sm font-semibold text-primary-strong"
        >
          <Copy aria-hidden className="size-5" strokeWidth={1.75} />
          {t("copy")}
        </button>
      </div>
    </section>
  );
}
