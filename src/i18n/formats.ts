import type { Formats } from "next-intl";

/**
 * Shared ICU formats. Dates are always DD/MM/YYYY (spec) regardless of UI language, so
 * date helpers in `src/lib/format.ts` format with en-GB; these presets cover in-message use.
 */
export const formats = {
  dateTime: {
    short: { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Karachi" },
    time: { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    percent: { style: "percent", maximumFractionDigits: 1 },
  },
} satisfies Formats;
