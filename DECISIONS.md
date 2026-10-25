# Decisions

Choices made while building, so nobody has to rediscover why. Newest at the bottom of each
section. Format: **decision** — reason (date).

## Platform and tooling

- **Next.js 16.4 with Cache Components and Partial Prefetching enabled** — 16.4 recommends it
  for every new app (create-next-app enables it by default). Static shells + streamed user
  data give instant navigations and skeleton-first loading, which is what the spec asks for.
  Session reads sit behind `<Suspense>`. (2026-10-25)
- **`experimental.useOffline` enabled** — soft navigations and Server Actions wait for the
  network instead of throwing, which suits shops on unreliable 4G. Serwist still handles full
  offline loads. (2026-10-25)
- **TypeScript 6.0, not 7.0** — TypeScript 7 (native) is the latest release, but
  `typescript-eslint` (used by `eslint-config-next`) supports only `<6.1`. 6.0.3 typechecks and
  builds cleanly with Next 16.4. Revisit when typescript-eslint supports 7. (2026-10-25)
- **ESLint 9 (flat config), not 10** — matches the Next 16.4 template; several React lint
  plugins have not declared ESLint 10 support yet. `next lint` no longer exists; we run
  `eslint` directly. (2026-10-25)
- **Tailwind CSS v4 via `@tailwindcss/turbopack`** — the loader the Next 16.4 template uses; no
  PostCSS config needed. (2026-10-25)
- **pnpm** as the package manager (spec uses `pnpm seed:reset`). (2026-10-25)
- **`src/` directory** with `@/*` imports — keeps config files and app code apart. The spec's
  `components/ui`, `lib/ai`, `lib/integrations` live under `src/`. (2026-10-25)
- **`@playwright/test` pinned to 1.63.0** — matches the Chromium build preinstalled in the cloud
  build container (1.64 would need a different browser revision). CI installs matching browsers
  with `pnpm exec playwright install chromium`. (2026-10-25)
- **shadcn/ui CLI v4, `radix-nova` style, RTL enabled** — Radix primitives per the spec; the
  generated components are rewritten to TezDukan tokens (sizes, radius, colours) rather than
  used as-is. shadcn's `cn` package replaces `clsx` + `tailwind-merge`. (2026-10-25)
- **Brand rules enforced by ESLint** — custom rules reject emoji, hex colours and Tailwind palette
  classes in components, and `react/jsx-no-literals` rejects hard-coded UI text. (2026-10-25)

## Internationalisation

- **next-intl with a `[locale]` segment and `localePrefix: 'never'`** — the locale lives in the
  `NEXT_LOCALE` cookie (1 year) and the proxy rewrites internally, so URLs stay clean
  (`/dukan/manage/pos`) while pages can still be statically rendered per locale via
  `next/root-params`. Links shared on WhatsApp open in the recipient's own language. Switching
  language updates the cookie and refreshes in place (no full reload). (2026-10-25)
- **Locale codes: `en`, `ur`, `ur-Latn` (Roman Urdu), `sd`** — valid BCP 47 tags so `Intl`
  APIs work. `sd` is configured (RTL, falls back to Urdu strings) but hidden from the language
  picker until translations are reviewed (feature flag `sindhi_ui`). English is the default; the
  first-run screen asks for a language. (2026-10-25)
- **Prices stay `Rs 1,250` with Latin digits in every locale** — the spec fixes the format, and
  Pakistani shopkeepers read prices in Latin digits even in Urdu UI. (2026-10-25)

## Backend

- **Develop against a local Supabase stack (Docker) — the existing hosted project is not
  touched.** The connected project (`zaidai-create's Project`, ap-south-1) contains the
  previous TezDukan app's schema and data (profiles, shops, products, orders…) whose table
  names clash with this schema. Choosing between a new free project and retiring the old schema
  is left to the owner before deployment (PLAN §12). Supabase images are pulled from Docker Hub
  because the default registry rate-limits this environment. (2026-10-25)
- **Platform roles in `user_roles`; app contexts derived from memberships** — Dukandar comes from
  `shop_staff`, Distributor/Booker/Rider from `org_members`, admin/support from `user_roles`.
  One source of truth per relationship, so approvals and removals can never leave a stale role
  behind. `my_role_contexts()` builds the switcher list. (2026-10-25)
- **Active context on `profiles` + `td_ctx` cookie** — the profile follows the user across
  devices; the cookie lets the proxy route without a DB round trip. (2026-10-25)
- **Phone + password via Supabase Auth with phone confirmations; SMS through the Send SMS Hook
  into `message_outbox`** — Supabase handles OTP generation, expiry and rate limits; our adapter
  only delivers. In Sandbox (no provider keys) the OTP screen shows a labelled Sandbox panel with
  the code, so the flow is identical to production. (2026-10-25)
- **Customers must sign in before the home feed; dukan storefront pages (`/s/[slug]`) are
  public** — the spec's customer flow is sign in → location → home, but QR posters at the
  counter must open the shop page directly; sign-in is asked at add-to-cart. (2026-10-25)
- **Double-entry ledger with `ledger_accounts` + balanced journals** — gives correct balances,
  statements, aging and a simple P&L from one structure. The dukandar's distributor ledger reads
  the distributor's receivable account for that shop (single source of truth). Entries are never
  edited; corrections are reversals. (2026-10-25)
- **PostGIS for locations** — nearby dukans, delivery radius, zones as polygons, route grouping
  and the area heatmap are all spatial queries; Supabase ships PostGIS. (2026-10-25)
- **Public reads through `security definer` RPCs** — storefront and nearby-dukan queries must
  never expose cost prices, phone numbers or owner details; RPCs return explicit safe columns
  while base tables stay member-only. (2026-10-25)
- **Name snapshots on cross-tenant records** (`placed_by_name`, `changed_by_name`) — a
  distributor needs to see who placed an order without read access to other tenants' profiles.
  (2026-10-25)
- **`seed_registry` tracks seeded rows** — `pnpm seed:reset` deletes exactly those, in reverse
  dependency order, leaving real data untouched. (2026-10-25)
- **uuid v4 (`gen_random_uuid()`) primary keys** — Postgres 17 has no built-in uuidv7.
  Client-generated UUIDs make offline writes idempotent. (2026-10-25)
