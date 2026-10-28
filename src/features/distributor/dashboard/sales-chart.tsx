import { cn } from "cn";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatRs } from "@/lib/money";
import type { Dashboard } from "../schemas";

/**
 * Seven columns, one per day, grown from a single baseline. One series in the brand green, so
 * no legend: the card title names it. Today's value sits on its cap; every other value is in
 * the hover/focus tooltip, and each column is labelled for screen readers.
 */
export async function SalesChart({ days, title }: { days: Dashboard["sales_7d"]; title: string }) {
  const [format, t] = await Promise.all([getFormatter(), getTranslations("distributor.dashboard")]);
  const max = Math.max(1, ...days.map((d) => d.value_paisa));
  const dayLabel = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00+05:00`), {
      weekday: "short",
      timeZone: "Asia/Karachi",
    });

  return (
    <figure aria-label={title} className="flex flex-col gap-3">
      <div className="relative flex h-40 items-end justify-between gap-0.5 border-b border-border px-1">
        {days.map((day, index) => {
          const today = index === days.length - 1;
          const height = day.value_paisa === 0 ? 0 : Math.max(4, (day.value_paisa / max) * 100);
          return (
            <div
              key={day.date}
              tabIndex={0}
              role="img"
              aria-label={`${dayLabel(day.date)}: ${formatRs(day.value_paisa)}, ${t("ordersCount", { count: day.orders })}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
            >
              {today && day.value_paisa > 0 ? (
                <span aria-hidden className="num mb-1 text-xs font-bold whitespace-nowrap text-ink">
                  {formatRs(day.value_paisa)}
                </span>
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  day.value_paisa === 0 && "h-0",
                )}
                style={day.value_paisa === 0 ? undefined : { height: `${height}%` }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full z-10 mb-1 hidden min-w-28 rounded-md bg-ink px-2.5 py-1.5 text-center text-xs text-surface shadow-float group-hover:block group-focus-visible:block"
              >
                <span className="block font-semibold">{dayLabel(day.date)}</span>
                <span className="num block">{formatRs(day.value_paisa)}</span>
                <span className="num block opacity-80">
                  {t("ordersCount", { count: day.orders })}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="flex justify-between gap-0.5 px-1">
        {days.map((day, index) => (
          <span
            key={day.date}
            className={cn(
              "flex-1 text-center text-xs",
              index === days.length - 1 ? "font-bold text-ink" : "text-muted",
            )}
          >
            {dayLabel(day.date)}
          </span>
        ))}
      </div>
    </figure>
  );
}
