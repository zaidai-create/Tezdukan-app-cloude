import { BadgeCheck, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "cn";
import { formatDate } from "@/lib/format";
import type { ShopReview } from "../schemas";

/** The latest comments customers left after a delivered order. Hidden until there is one. */
export async function ShopReviews({
  reviews,
  rating,
  count,
}: {
  reviews: ShopReview[];
  rating: number | null;
  count: number;
}) {
  if (reviews.length === 0) return null;
  const t = await getTranslations("storefront.reviews");
  return (
    <section className="flex flex-col gap-3" aria-labelledby="shop-reviews">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="shop-reviews" className="font-heading text-lg font-bold text-ink lg:text-xl">
          {t("title")}
        </h2>
        {rating !== null ? (
          <p className="num text-sm font-semibold text-muted">
            {t("summary", { rating: rating.toFixed(1), count })}
          </p>
        ) : null}
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="flex items-center gap-0.5"
                role="img"
                aria-label={t("stars", { count: review.rating })}
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    aria-hidden
                    strokeWidth={1.75}
                    className={cn(
                      "size-4",
                      index < review.rating ? "fill-awning text-awning" : "text-border-strong",
                    )}
                  />
                ))}
              </span>
              <span className="num text-sm text-muted">{formatDate(review.created_at)}</span>
            </div>
            <p dir="auto" className="text-base text-ink">
              {review.comment}
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <BadgeCheck aria-hidden className="size-4 text-primary" strokeWidth={1.75} />
              {t("verified")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
