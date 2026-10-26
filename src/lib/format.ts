/**
 * Dates and numbers. Dates are DD/MM/YYYY in Asia/Karachi everywhere, whatever the UI
 * language (spec), so these helpers fix the locale instead of following the UI locale.
 */
export const TIME_ZONE = "Asia/Karachi";

type DateInput = Date | string | number;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const timeFormat = new Intl.DateTimeFormat("en-PK", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});
const isoDayFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});
const numberFormat = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 });

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** 25/10/2026 */
export function formatDate(value: DateInput): string {
  return dateFormat.format(toDate(value));
}

/** 3:45 pm */
export function formatTime(value: DateInput): string {
  return timeFormat.format(toDate(value)).toLowerCase().replace(/\s+/g, " ");
}

/** 25/10/2026, 3:45 pm */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** The business day in Pakistan as YYYY-MM-DD (for "today's sales" and similar queries). */
export function businessDay(value: DateInput = new Date()): string {
  return isoDayFormat.format(toDate(value));
}

/** 1,250 or 2.5 (quantities, counts). */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
