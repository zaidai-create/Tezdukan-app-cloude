import type { Locale } from "@/i18n/locales";
import type { AppRole } from "./roles";

/** One entry in the role switcher (from `my_role_contexts()`). */
export type RoleContext = {
  role: AppRole;
  contextId: string | null;
  /** Shop or distributor name; null for customer/admin. */
  name: string | null;
  memberRole: string | null;
  /** Approval status of the shop/distributor ("approved", "pending", "rejected"…). */
  status: string | null;
  imageUrl: string | null;
};

/** What the app shell needs to know about the signed-in person. Never secrets. */
export type ShellSession = {
  userId: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  locale: Locale;
  activeRole: AppRole;
  activeContextId: string | null;
  contexts: RoleContext[];
};

export function activeContextOf(session: ShellSession): RoleContext | undefined {
  return session.contexts.find(
    (c) => c.role === session.activeRole && c.contextId === session.activeContextId,
  );
}

export function isUsable(context: RoleContext): boolean {
  return context.role === "customer" || context.role === "admin" || context.status === "approved";
}
