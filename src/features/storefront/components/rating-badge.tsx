import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";

/**
 * A dukan's stars from delivered orders: "4.8 (23)". A dukan nobody has rated yet says "New"
 * instead of showing an empty or zero rating.
 */
export async function RatingBadge({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count: number;
  className?: string;
}) {
  const t = await getTranslations("storefront.rating");
  const base =
    "num inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap";

  if (rating === null || count === 0) {
    return <span className={cn(base, "bg-tint-amber text-awning-ink", className)}>{t("new")}</span>;
  }
  return (
    <span
      className={cn(base, "bg-tint-amber text-ink", className)}
      aria-label={t("label", { rating: rating.toFixed(1), count })}
    >
      <Star aria-hidden className="size-3.5 fill-awning text-awning" strokeWidth={1.75} />
      <span aria-hidden>{rating.toFixed(1)}</span>
      <span aria-hidden className="font-medium text-muted">
        {t("count", { count })}
      </span>
    </span>
  );
}
