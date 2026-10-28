import { z } from "zod";
import type { AppRole } from "@/lib/auth/roles";
import type { ShellSession } from "@/lib/auth/session-types";

export const notificationKindSchema = z.enum([
  "order",
  "payment",
  "stock",
  "khata",
  "brief",
  "approval",
  "promotion",
  "delivery",
  "support",
  "system",
  "chat",
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationSchema = z.object({
  id: z.uuid(),
  kind: notificationKindSchema,
  title: z.string(),
  body: z.string().nullable(),
  data: z.record(z.string(), z.unknown()),
  link: z.string().nullable(),
  read_at: z.string().nullable(),
  created_at: z.string(),
  shop_id: z.uuid().nullable(),
  org_id: z.uuid().nullable(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const NOTIFICATION_COLUMNS =
  "id, kind, title, body, data, link, read_at, created_at, shop_id, org_id" as const;

/**
 * Whose notifications a screen shows: a dukan's (shop_id), a distributor's (org_id), or the
 * person's own (neither: customer, admin). A multi-role person never sees their distributor
 * alerts inside the dukan app.
 */
export type NotificationScope = { userId: string; role: AppRole; contextId: string | null };

export function scopeOf(
  session: Pick<ShellSession, "userId" | "activeRole" | "activeContextId">,
): NotificationScope {
  return { userId: session.userId, role: session.activeRole, contextId: session.activeContextId };
}

export function scopeColumn(scope: NotificationScope): "shop_id" | "org_id" | null {
  if (scope.role === "dukandar") return "shop_id";
  if (scope.role === "distributor" || scope.role === "booker" || scope.role === "rider")
    return "org_id";
  return null;
}

export function inScope(
  scope: NotificationScope,
  row: Pick<AppNotification, "shop_id" | "org_id">,
): boolean {
  const column = scopeColumn(scope);
  if (!column) return row.shop_id === null && row.org_id === null;
  return row[column] === scope.contextId;
}
