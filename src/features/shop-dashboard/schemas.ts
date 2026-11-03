import { z } from "zod";
import { customerOrderStatuses } from "@/features/customer-orders/schemas";

const paisa = z.coerce.number().int();

export const shopDashboardSchema = z.object({
  shop: z.object({ name: z.string(), slug: z.string(), is_live: z.boolean() }),
  today: z.object({ sales_paisa: paisa, orders: z.number().int(), delivered: z.number().int() }),
  counts: z.object({ new: z.number().int(), active: z.number().int() }),
  week: z.array(z.object({ day: z.string(), sales_paisa: paisa })),
  queue: z.array(
    z.object({
      id: z.uuid(),
      order_number: z.string(),
      customer_name: z.string().nullable(),
      status: z.enum(customerOrderStatuses),
      total_paisa: paisa,
      items_count: z.number().int(),
      created_at: z.string(),
      address: z.string().nullable(),
      items_preview: z.string().nullable(),
    }),
  ),
  low_stock: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      qty_on_hand: z.coerce.number(),
      low_stock_threshold: z.coerce.number(),
    }),
  ),
  stock: z.object({ products: z.number().int(), low: z.number().int(), value_paisa: paisa }),
  incoming: z.object({ orders: z.number().int(), total_paisa: paisa }),
});
export type ShopDashboard = z.infer<typeof shopDashboardSchema>;
export type QueueOrder = ShopDashboard["queue"][number];
