import { z } from "zod";

export const reportRanges = ["today", "yesterday", "week", "month"] as const;
export type ReportRange = (typeof reportRanges)[number];

/** The ?range= query value; anything unknown falls back to today. */
export const reportRangeSchema = z.enum(reportRanges).catch("today");

const totalsSchema = z.object({
  sales_paisa: z.number().int(),
  orders: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  in_progress: z.number().int().nonnegative(),
  in_progress_paisa: z.number().int().nonnegative(),
  customers: z.number().int().nonnegative(),
  avg_bill_paisa: z.number().int().nonnegative(),
  goods_paisa: z.number().int().nonnegative(),
  costed_paisa: z.number().int().nonnegative(),
  profit_paisa: z.number().int(),
});
export type ReportTotals = z.infer<typeof totalsSchema>;

export const salesReportSchema = z.object({
  range: z.enum(reportRanges),
  from: z.string(),
  to: z.string(),
  totals: totalsSchema,
  previous: totalsSchema,
  series: z.array(
    z.object({
      start_hour: z.number().int().min(0).max(23).nullable(),
      day: z.string().nullable(),
      sales_paisa: z.number().int().nonnegative(),
      orders: z.number().int().nonnegative(),
    }),
  ),
  top_products: z.array(
    z.object({
      name: z.string(),
      name_ur: z.string().nullable(),
      unit: z.string(),
      qty: z.number().nonnegative(),
      sales_paisa: z.number().int().nonnegative(),
    }),
  ),
});
export type SalesReport = z.infer<typeof salesReportSchema>;
