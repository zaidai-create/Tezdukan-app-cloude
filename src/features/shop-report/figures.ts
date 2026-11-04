/**
 * Small, pure helpers for the sales report, kept apart from the page so they can be tested.
 */

/** Whole-percent change from the previous period; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Profit as a whole percent of the sales it was worked out from; null without costed sales. */
export function marginOf(profitPaisa: number, costedPaisa: number): number | null {
  if (costedPaisa <= 0) return null;
  return Math.round((profitPaisa / costedPaisa) * 100);
}

/** Index of the largest value, or -1 when every value is zero (no peak worth naming). */
export function peakIndex(values: readonly number[]): number {
  let best = -1;
  let bestValue = 0;
  values.forEach((value, index) => {
    if (value > bestValue) {
      best = index;
      bestValue = value;
    }
  });
  return best;
}

/** "6 pm", matching formatTime's lower-case style. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? "am" : "pm"}`;
}

/** "6 pm – 9 pm" for a 3-hour slot that starts at the given hour. */
export function slotLabel(startHour: number): string {
  return `${hourLabel(startHour)} – ${hourLabel(startHour + 3)}`;
}
