export const appRoles = [
  "customer",
  "dukandar",
  "distributor",
  "booker",
  "rider",
  "admin",
] as const;
export type AppRole = (typeof appRoles)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (appRoles as readonly string[]).includes(value);
}

/** Where each role lands after sign-in or a role switch. */
export const roleHome: Record<AppRole, string> = {
  customer: "/",
  dukandar: "/dukan",
  distributor: "/distributor",
  booker: "/booker",
  rider: "/rider",
  admin: "/admin",
};

/** Each role's account & settings page lives under its own prefix so its navigation stays. */
export function accountPath(role: AppRole): string {
  return role === "customer" ? "/account" : `${roleHome[role]}/account`;
}

/** URL prefixes owned by each role (customer owns everything else that needs a session). */
const rolePrefixes: ReadonlyArray<readonly [string, AppRole]> = [
  ["/dukan", "dukandar"],
  ["/distributor", "distributor"],
  ["/booker", "booker"],
  ["/rider", "rider"],
  ["/admin", "admin"],
];

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function roleForPath(pathname: string): AppRole | null {
  for (const [prefix, role] of rolePrefixes) if (hasPrefix(pathname, prefix)) return role;
  return null;
}

/** Set once the welcome posters have been seen, so later launches open on sign-in. */
export const WELCOMED_COOKIE = "td_welcomed";

/** Pages that never need a session. */
const publicPrefixes = [
  "/welcome",
  "/login",
  "/signup",
  "/verify",
  "/forgot-password",
  "/s/",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/delivery-policy",
  "/data-deletion",
  "/dev",
  "/~offline",
];

export function isPublicPath(pathname: string): boolean {
  return publicPrefixes.some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : hasPrefix(pathname, prefix),
  );
}

/** Auth screens that a signed-in person should be sent away from. */
export function isAuthPath(pathname: string): boolean {
  return ["/welcome", "/login", "/signup", "/verify"].some((prefix) => hasPrefix(pathname, prefix));
}

/** The active context: which role, and for which shop or distributor. */
export type ActiveContext = { role: AppRole; contextId: string | null };

export const CONTEXT_COOKIE = "td_ctx";

export function serializeContext(ctx: ActiveContext): string {
  return ctx.contextId ? `${ctx.role}:${ctx.contextId}` : ctx.role;
}

export function parseContext(value: string | undefined | null): ActiveContext | null {
  if (!value) return null;
  const [role, contextId] = value.split(":");
  if (!isAppRole(role)) return null;
  return { role, contextId: contextId && /^[0-9a-f-]{36}$/i.test(contextId) ? contextId : null };
}

/** Membership roles inside a shop or a distributor (shown next to the context name). */
export const memberRoles = [
  "owner",
  "manager",
  "cashier",
  "staff",
  "accountant",
  "warehouse",
  "booker",
  "rider",
] as const;
export type MemberRole = (typeof memberRoles)[number];

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (memberRoles as readonly string[]).includes(value);
}
