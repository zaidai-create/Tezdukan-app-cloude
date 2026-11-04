import { z } from "zod";

/** Results of the admin_* RPCs. Numbers from SQL sums and counts arrive as JSON numbers. */

const n = z.number();
const text = z.string().nullable();

export const adminRanges = ["today", "week", "month"] as const;
export type AdminRange = (typeof adminRanges)[number];
export const adminRangeSchema = z.enum(adminRanges).catch("today");

const kpisSchema = z.object({
  customer_paisa: n,
  b2b_paisa: n,
  customer_orders: n,
  b2b_orders: n,
  customers: n,
  ordering_shops: n,
  new_users: n,
  new_shops: n,
  new_orgs: n,
});
export type AdminKpis = z.infer<typeof kpisSchema>;

export const adminOverviewSchema = z.object({
  range: z.enum(adminRanges),
  kpis: kpisSchema,
  previous: kpisSchema,
  totals: z.object({ shops: n, shops_live: n, orgs: n, users: n }),
  attention: z.object({
    pending_shops: n,
    pending_orgs: n,
    stuck_customer_orders: n,
    stuck_b2b_orders: n,
    open_support: n,
    deletion_requests: n,
  }),
  series: z.array(z.object({ day: z.string(), customer_paisa: n, b2b_paisa: n })),
  feed: z.array(
    z.object({
      kind: z.enum(["customer", "b2b"]),
      id: z.uuid(),
      number: z.string(),
      status: z.string(),
      total_paisa: n,
      created_at: z.string(),
      seller: z.string(),
      buyer: text,
    }),
  ),
  top_shops: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      slug: z.string(),
      area: text,
      orders: n,
      sales_paisa: n,
    }),
  ),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

const placeSchema = {
  id: z.uuid(),
  name: z.string(),
  phone: text,
  address_line: text,
  area: text,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  submitted_at: text,
  created_at: z.string(),
  owner_name: text,
  owner_phone: text,
};

export const approvalsSchema = z.object({
  shops: z.array(z.object({ ...placeSchema, kind: z.string(), photo_path: text })),
  orgs: z.array(z.object({ ...placeSchema, logo_path: text })),
  auto_approve: z.boolean(),
});
export type Approvals = z.infer<typeof approvalsSchema>;

export const adminStatuses = ["pending", "approved", "suspended", "rejected"] as const;
export type AdminStatus = (typeof adminStatuses)[number];
export const adminStatusFilterSchema = z.enum(adminStatuses).nullable().catch(null);

export const adminShopSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  tier: text,
  phone: text,
  address_line: text,
  area: text,
  created_at: z.string(),
  rejection_reason: text,
  owner_name: text,
  owner_phone: text,
  is_live: z.boolean(),
  products: n,
  orders_30d: n,
  sales_30d: n,
  rating: z.number().nullable(),
  rating_count: n,
});
export type AdminShop = z.infer<typeof adminShopSchema>;

export const adminOrgSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.string(),
  phone: text,
  address_line: text,
  area: text,
  created_at: z.string(),
  rejection_reason: text,
  owner_name: text,
  owner_phone: text,
  products: n,
  orders_30d: n,
  sales_30d: n,
  dukans_30d: n,
});
export type AdminOrg = z.infer<typeof adminOrgSchema>;

export const adminUserSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  phone: text,
  created_at: z.string(),
  last_seen_at: text,
  active_role: text,
  platform_roles: z.array(z.string()),
  shops: z.array(z.string()),
  orgs: z.array(z.string()),
  orders: n,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminOrderKinds = ["all", "customer", "b2b"] as const;
export type AdminOrderKind = (typeof adminOrderKinds)[number];
export const adminOrderKindSchema = z.enum(adminOrderKinds).catch("all");

export const adminOrderSchema = z.object({
  kind: z.enum(["customer", "b2b"]),
  id: z.uuid(),
  number: z.string(),
  status: z.string(),
  total_paisa: n,
  items_count: n,
  created_at: z.string(),
  seller: z.string(),
  buyer: text,
  phone: text,
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;

export const flagSchema = z.object({
  key: z.string(),
  description: text,
  enabled: z.boolean(),
  updated_at: z.string(),
});
export type Flag = z.infer<typeof flagSchema>;

export const auditEntrySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.uuid().nullable(),
  created_at: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  actor_name: text,
  actor_phone: text,
  shop_name: text,
  org_name: text,
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;
