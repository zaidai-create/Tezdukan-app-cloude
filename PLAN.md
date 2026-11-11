# TezDukan — Build Plan

> "Apni Dukan. Ab Aapke Ghar Tak."
> B2B quick-commerce + retail operating system for Pakistani kirana stores. Launch city: Hyderabad, Sindh.

This is the working plan for building TezDukan from scratch. It covers the architecture,
folder structure, routes, data model, and the seven build phases with their exit criteria.
Conventions and day-to-day rules live in [`CLAUDE.md`](./CLAUDE.md). Every non-obvious
choice is recorded in [`DECISIONS.md`](./DECISIONS.md). Progress is logged in
[`CHANGELOG.md`](./CHANGELOG.md).

---

## 1. Architecture at a glance

```
 Phone / desktop browser (installable PWA)
 ┌────────────────────────────────────────────────────────────────────┐
 │ Next.js 16 App Router (React 19.3, Cache Components, Partial        │
 │ Prefetching) · TanStack Query (server state, persisted) · Zustand   │
 │ (cart/UI) · Serwist service worker · IndexedDB sync queue (POS,     │
 │ khata, booker orders) · next-intl (en / ur / ur-Latn, sd-ready)      │
 └───────────────┬────────────────────────────────┬───────────────────┘
                 │ RSC / Server Actions /          │ supabase-js (user JWT)
                 │ Route Handlers (/api/*)         │ Realtime websockets
 ┌───────────────▼────────────────┐   ┌───────────▼───────────────────┐
 │ Server (Vercel, Node runtime)  │   │ Supabase                       │
 │ · proxy.ts: session refresh,   │   │ · Postgres 17 + RLS everywhere │
 │   locale rewrite, role routing │──▶│ · RPC functions for atomic ops │
 │ · lib/ai gateway (Munshi)      │   │ · Auth (phone + password)      │
 │ · lib/integrations adapters    │   │ · Realtime · Storage           │
 │   (sandbox until keys exist)   │   │ · Edge Functions (push, SMS,   │
 └────────────────────────────────┘   │   WhatsApp, cron targets)      │
                                      │ · pg_cron, pg_trgm, pgvector,  │
                                      │   unaccent, PostGIS            │
                                      └────────────────────────────────┘
```

Core principles:

1. **Postgres is the source of truth and the security boundary.** Every table has RLS.
   Anything that must be atomic (orders, stock, ledger, payments, POS bills) is a Postgres
   function called via RPC. The app never trusts the client for prices or totals.
2. **Speed is the product.** Static shells prerender, user data streams behind `<Suspense>`
   with skeletons that match the final layout. Optimistic updates with rollback. Prefetch on
   viewport/hover. No full-screen spinners.
3. **Offline is a feature, not an error.** POS, khata and booker orders work fully offline with
   an IndexedDB queue and idempotent server RPCs (client-generated ids).
4. **Every integration is an adapter** with a clearly labelled Sandbox mode until keys are added.
   Nothing fakes success silently.
5. **Munshi is a layer, not a dependency.** Every screen works without AI; Munshi calls the same
   typed server functions the UI uses, under the user's own session (so RLS applies).

---

## 2. Tech stack (pinned at project start, Oct 2026)

| Concern | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router, Turbopack, Cache Components, Partial Prefetching | 16.4.x |
| UI runtime | React / React DOM | 19.3.x |
| Language | TypeScript, `strict` + extra strictness flags | 6.0.x (see DECISIONS) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) via `@tailwindcss/turbopack` | 4.3.x |
| Components | shadcn/ui (Radix) fully re-themed to TezDukan tokens | shadcn CLI 4.x, radix-ui 1.8 |
| Motion | Motion (`motion/react`) | 14.x |
| Icons | Lucide (`lucide-react`), one stroke width | 1.x |
| Server state | TanStack Query (+ IndexedDB persister) | 5.x |
| Client state | Zustand | 5.x |
| Forms | React Hook Form + Zod (schemas shared client/server) | RHF 7.x, Zod 4.x |
| Backend | Supabase (Postgres 17, Auth, Realtime, Storage, Edge Functions) | supabase-js 2.x, @supabase/ssr 0.12 |
| Tables | TanStack Table + TanStack Virtual | 9.x / 3.x |
| Charts | Recharts | 3.x |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles (Google Maps optional via env) | 1.9 / 5.x |
| Documents | `@react-pdf/renderer`; print CSS for 58/80 mm thermal + A4 | 4.x |
| Scanning | `BarcodeDetector` API, fallback `@zxing/browser`; USB/BT scanners as keyboard | — |
| i18n | next-intl (cookie locale, `[locale]` segment, `localePrefix: 'never'`) | 4.x |
| PWA | Serwist (`@serwist/turbopack`), Web Push (VAPID) from Edge Functions | 9.x |
| AI | Provider-agnostic gateway in `src/lib/ai`: Anthropic (default) + Google Gemini | @anthropic-ai/sdk 1.x, @google/genai 2.x |
| Unit tests | Vitest | 5.x |
| E2E | Playwright at 390×844 and 1440×900 | 1.64.x |
| DB tests | pgTAP via `supabase test db` | — |
| Hosting | Vercel + Supabase | — |

---

## 3. Folder structure

```
.
├── AGENTS.md                  # Next.js agent rules block (managed by `next dev`)
├── CLAUDE.md                  # conventions, commands, design rules
├── PLAN.md · DECISIONS.md · CHANGELOG.md · README.md
├── .env.example               # every variable, with a comment
├── messages/                  # i18n: en.json, ur.json, ur-Latn.json, sd.json
├── public/                    # icons/, brand/, sounds/, splash/
├── scripts/                   # seed.ts, seed-reset.ts, gen-icons.ts, eval-munshi.ts
├── e2e/                       # Playwright specs + screenshot helpers
├── supabase/
│   ├── config.toml
│   ├── migrations/            # ordered SQL migrations (schema, RLS, functions, cron)
│   ├── tests/                 # pgTAP tests (RLS isolation, RPC behaviour)
│   ├── seed.sql               # deterministic seed rows (tracked in seed_registry)
│   └── functions/             # Edge Functions: push-send, sms-send, whatsapp-send, cron-*
└── src/
    ├── proxy.ts               # session refresh → locale rewrite → role routing
    ├── app/
    │   ├── [locale]/          # every page lives under the locale root param
    │   │   ├── layout.tsx     # <html lang dir>, fonts, providers
    │   │   ├── (customer)/    # default experience: /, /s/[slug], /cart, /orders, /account
    │   │   ├── (auth)/        # /login, /signup, /verify, /forgot-password, /register/*
    │   │   ├── (dukan)/dukan/ # dukandar: ordering + /dukan/manage/* (shop OS)
    │   │   ├── (distributor)/distributor/
    │   │   ├── (booker)/booker/
    │   │   ├── (rider)/rider/
    │   │   ├── (admin)/admin/
    │   │   ├── (legal)/       # /privacy, /terms, /refund-policy, /delivery-policy, /data-deletion
    │   │   ├── dev/design-system/
    │   │   └── ~offline/      # offline fallback document
    │   ├── api/               # munshi, v1 (public REST), webhooks/*, integrations/*
    │   ├── serwist/[path]/    # service worker route (Serwist + Turbopack)
    │   ├── manifest.ts · sw.ts · globals.css
    ├── components/
    │   ├── ui/                # design-system primitives (button, input, sheet, dialog, chip…)
    │   ├── brand/             # logo, wordmark, awning, speed lines
    │   ├── commerce/          # product card, add-stepper, cart bar, price, margin badge…
    │   ├── layout/            # bottom nav, sidebar, top bar, role switcher, command palette
    │   ├── states/            # empty, error (Retry), offline, skeleton presets
    │   └── munshi/            # mic button, listening sheet, action cards
    ├── features/<domain>/     # auth, catalog, cart, orders, pos, khata, inventory, …
    │   └── {components, hooks, actions.ts, queries.ts, schemas.ts}
    ├── lib/
    │   ├── supabase/          # client.ts, server.ts, proxy.ts, admin.ts, database.types.ts
    │   ├── ai/                # gateway, providers/, tools/, prompts/, stt/, tts/
    │   ├── integrations/      # sms/, whatsapp/, payments/, push/, maps/, printing/, fbr/, analytics/
    │   ├── offline/           # IndexedDB stores, sync queue, conflict handling
    │   ├── auth/              # session (DAL), roles, active context
    │   ├── money.ts · phone.ts · format.ts · units.ts · utils.ts
    ├── i18n/                  # routing.ts, navigation.ts, request.ts, locales.ts
    ├── stores/                # zustand stores (cart, ui, pos)
    ├── hooks/                 # shared hooks (useHaptics, useOnline, useSpeak…)
    └── schemas/               # shared Zod schemas
```

---

## 4. Routes (URLs carry no locale; the locale comes from the `NEXT_LOCALE` cookie)

The proxy rewrites `/x` → `/{locale}/x` internally. `/` sends signed-in users to their active
role's home. Role layouts verify membership server-side; RLS enforces it again in Postgres.

| Area | Routes |
| --- | --- |
| Auth | `/login`, `/signup`, `/verify`, `/forgot-password`, `/register/dukan`, `/register/distributor`, `/register/status` |
| Customer (default) | `/` (nearby dukans), `/location`, `/s/[slug]` (public storefront), `/s/[slug]/search`, `/cart`, `/checkout`, `/orders`, `/orders/[id]` (live tracking), `/account`, `/addresses`, `/addresses/new`, `/addresses/[id]` (map picker, outside the shell), `/account/settings` |
| Dukandar — ordering | `/dukan`, `/dukan/categories`, `/dukan/categories/[slug]`, `/dukan/search`, `/dukan/p/[id]` (sheet on mobile via intercepting route, page on desktop), `/dukan/brands/[slug]`, `/dukan/distributors`, `/dukan/distributors/[id]`, `/dukan/cart`, `/dukan/checkout`, `/dukan/orders`, `/dukan/orders/[id]`, `/dukan/orders/[id]/receive`, `/dukan/ledger`, `/dukan/ledger/[orgId]` |
| Dukandar — shop OS ("Dukan" tab) | `/dukan/manage` (dashboard), `/dukan/manage/pos`, `/inventory`, `/inventory/[id]`, `/khata`, `/khata/[customerId]`, `/customer-orders`, `/storefront`, `/cash-book`, `/expenses`, `/reports`, `/staff`, `/rewards`, `/settings` |
| Distributor | `/distributor` (dashboard), `/orders` (board + table), `/orders/[id]`, `/pick-lists`, `/catalog`, `/catalog/[id]`, `/catalog/import`, `/schemes`, `/price-tiers`, `/warehouse`, `/warehouse/stock-in`, `/warehouse/transfers`, `/retailers`, `/retailers/[id]`, `/collections`, `/settlements`, `/field-force`, `/delivery`, `/promotions`, `/analytics`, `/team`, `/billing`, `/integrations`, `/settings` |
| Order booker | `/booker` (today's beat), `/booker/shops/[id]`, `/booker/shops/[id]/order`, `/booker/shops/[id]/collect`, `/booker/onboard`, `/booker/visits`, `/booker/targets` |
| Rider | `/rider` (today's trips), `/rider/trips/[id]`, `/rider/stops/[id]`, `/rider/settlement` |
| Admin | `/admin`, `/verifications`, `/shops`, `/distributors`, `/users`, `/subscriptions`, `/plans`, `/catalog`, `/banners`, `/campaigns`, `/areas`, `/disputes`, `/audit`, `/flags`, `/ai`, `/content`, `/integrations`, `/outbox` |
| Public | `/privacy`, `/terms`, `/refund-policy`, `/delivery-policy`, `/data-deletion`, `/~offline`, `/dev/design-system` |
| API | `POST /api/munshi` (streaming), `/api/munshi/transcribe`, `/api/v1/*` (public REST, per-org API keys), `/api/webhooks/payments/[provider]`, `/api/webhooks/whatsapp`, `/api/integrations/[kind]/test` |

Navigation shells:

- **Mobile roles** (customer, dukandar, booker, rider): bottom nav, ≤5 tabs, raised centre
  Munshi mic button. Dukandar tabs: Home · Categories · Munshi · Orders · Dukan.
- **Desktop roles** (distributor, admin; dukandar on desktop): collapsible left sidebar, top bar
  with global search and a Ctrl+K command palette that also accepts Munshi commands.
- **Role switcher** in the header/avatar menu on every shell. Switching never signs out.

---

## 5. Auth, roles and the active context

- **Sign-in:** phone (+92) + password via Supabase Auth. Phones are normalised to E.164
  (`+923001234567`) from any common input (`0300-1234567`, `3001234567`, `923001234567`).
- **Sign-up:** phone + password + name → SMS OTP confirmation (Supabase phone confirmations).
  Supabase's **Send SMS Hook** calls a Postgres function that writes to `message_outbox`;
  the SMS adapter delivers it. Until an SMS provider is configured, the adapter runs in
  **Sandbox**: the OTP screen shows a labelled "Sandbox SMS" panel with the code.
- **Forgot password:** phone OTP → session → set new password. Admins can reset a password
  from the admin panel while SMS is in Sandbox mode.
- **Sessions persist** (refresh tokens in cookies via `@supabase/ssr`); the login screen is only
  for new or signed-out users.
- **Roles:** every user is a customer. Platform roles (`admin`, `support`) live in
  `user_roles`. App contexts come from memberships:
  `shop_staff` → **Dukandar** context for that shop; `org_members` → **Distributor**,
  **Booker** or **Rider** context for that distributor (by member role).
  `my_role_contexts()` returns the switcher list.
- **Active context** = (role, shop_id | org_id), stored on `profiles` and mirrored in a
  `td_ctx` cookie so the proxy can route without a DB call. `switch_active_context()`
  validates membership, updates the profile and returns the role's home path.
- **Becoming a dukandar/distributor** = registration flow (business details, photos, map pin,
  phone verification) → `pending` → admin approval → context unlocked. The pending state has
  its own status screen, never a dead end.

---

## 6. Data model (Supabase / Postgres)

### 6.1 Conventions (apply to every table)

- `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`,
  `updated_at timestamptz default now()` (trigger), `created_by uuid default auth.uid()
  references profiles(id) on delete set null`.
- **Financial records** also carry `deleted_at timestamptz` (soft delete). They are never hard
  deleted; corrections are reversals. Normal users' policies hide soft-deleted rows.
- **Money is `bigint` paisa** (`*_paisa`). Rs 1 = 100 paisa. Never floats.
  B2B quantities are integer base units (pieces); shop-inventory quantities are
  `numeric(12,3)` to support loose items (kg, litre).
- **Tenancy:** `org_id` (distributor) and/or `shop_id` (dukan) on every tenant-owned row.
- Index every foreign key and every search column (trigram GIN for names/aliases).
- Enum types for statuses so generated TypeScript types are exact.
- Timestamps are `timestamptz` (UTC); business days are computed in `Asia/Karachi`.
- Schemas: `public` (exposed tables + RPCs), `private` (helpers, not exposed via the API),
  extensions in `extensions`.

### 6.2 RLS model

Helper functions in `private` (`security definer`, `stable`, `set search_path = ''`), always
called as `(select private.fn())` so Postgres caches them per statement:

| Helper | Meaning |
| --- | --- |
| `is_admin()` / `is_platform_staff()` | `user_roles` has `admin` (/`support`) for `auth.uid()` |
| `my_shop_ids()` / `my_org_ids()` | active memberships of the caller |
| `has_shop_permission(shop_id, perm)` | owner, or `perm = any(permissions)` |
| `has_org_permission(org_id, perm)` | owner, or role default, or explicit permission |

Patterns: shop-owned rows → `shop_id in (select private.my_shop_ids())` (+ permission on
write). Org-owned rows → `org_id in (select private.my_org_ids())` (+ permission). Shared rows
(orders, ledger accounts between org and shop) → either side may read. Inserts/updates of
financial and stock data go **only through RPCs** (no direct insert/update policies).
Public storefront and "nearby dukans" reads go through `security definer` RPCs that return only
safe columns (never cost prices or phone numbers). Catalog reference data (brands, categories,
master products) is readable by everyone; writes are admin-only.

**Shop permissions:** `billing`, `inventory`, `khata`, `orders`, `customer_orders`, `reports`,
`expenses`, `storefront`, `staff`, `settings`.
**Org permissions:** `orders.view`, `orders.manage`, `catalog.manage`, `pricing.manage`,
`warehouse.manage`, `retailers.manage`, `credit.manage`, `collections.manage`,
`delivery.manage`, `field.manage`, `promotions.manage`, `analytics.view`, `team.manage`,
`billing.manage`, `integrations.manage`, `settings.manage`. Role defaults: owner = all;
manager = all except `billing.manage`, `team.manage`; accountant = `orders.view`,
`credit.manage`, `collections.manage`, `analytics.view`; warehouse = `orders.view`,
`orders.manage`, `warehouse.manage`; booker and rider act through their own RPCs.

### 6.3 Tables by area

**Identity**

| Table | Key columns / notes |
| --- | --- |
| `profiles` | `id` = `auth.users.id`; `full_name`, `phone`, `avatar_path`, `locale`, `theme`, `data_saver`, `tts_enabled`, `active_role`, `active_shop_id`, `active_org_id`, `last_seen_at`. Created by trigger on `auth.users` insert. |
| `user_roles` | platform roles: `user_id`, `role` (`admin`, `support`), `granted_by`. |
| `organizations` | distributors: `name`, `slug`, `legal_name`, `phone`, `email`, `ntn`, `strn`, `address_line`, `area_id`, `location` (lat/lng + PostGIS point), `logo_path`, `status` (`draft/pending/approved/rejected/suspended`), `rejection_reason`, `approved_at/by`, `settings jsonb` (order cut-off, delivery days, default credit limit/terms, overdue-hold days). |
| `org_members` | `org_id`, `user_id`, `role` (`owner/manager/accountant/warehouse/booker/rider`), `permissions text[]`, `status` (`invited/active/suspended`), `display_name`, `phone`. Unique (`org_id`,`user_id`). |
| `shops` | dukans: `owner_id` (nullable until claimed), `name`, `slug`, `phone`, `whatsapp`, `kind`, `address_line`, `area_id`, `location`, `photo_path`, `status`, `tier` (`silver/gold/platinum`), `ntn`, `strn`, `onboarded_by_org_id`, `approved_at/by`, `rejection_reason`. |
| `shop_staff` | `shop_id`, `user_id`, `role` (`owner/manager/cashier/staff`), `permissions text[]`, `status`. |
| `addresses` | customer addresses: `user_id`, `label`, `line1`, `line2`, `area_id`, `city`, `location`, `phone`, `is_default`. |
| `service_areas` | `name`, `name_ur`, `slug`, `city`, `kind` (`city/zone`), `parent_id`, `center`, `radius_m`, `boundary` (GeoJSON / PostGIS polygon), `is_active`. Hyderabad + zones (Latifabad, Qasimabad, Saddar, Hirabad, …). |

**Catalog**

| Table | Key columns / notes |
| --- | --- |
| `brands` | `name`, `name_ur`, `slug`, `logo_path`, `is_active`. |
| `categories` | `parent_id`, `name`, `name_ur`, `slug`, `image_path`, `tint` (token name), `sort_order`, `is_active`. |
| `master_products` | TezDukan master catalog: `name`, `name_ur`, `brand_id`, `category_id`, `barcode` (unique), `sku`, `pack_size_label` ("950 g"), `net_quantity`, `net_unit`, `description`, `image_path`, `search_text` (generated, unaccented), `is_active`. |
| `product_aliases` | lexicon: `target_type` (`product/brand/category`), `target_id`, `alias`, `language` (`en/ur/ur-Latn/sd`), `kind` (`name/spelling/mishearing/generic`), `weight`. e.g. Tapal / taapal / tapaal / ٹپال; cheeni → sugar. |
| `product_images` | `master_product_id` or `distributor_product_id`, `path`, `sort_order`, `alt`. |
| `distributor_products` | `org_id`, `master_product_id` (mapping by barcode), `name`, `sku`, `barcode`, `brand_id`, `category_id`, `description`, `mrp_paisa` (per piece), `trade_price_paisa` (per piece), `moq_base_qty`, `visible_area_ids uuid[]` (null = all), `is_active`. |
| `pack_units` | `distributor_product_id`, `unit` (`piece/dozen/inner/carton`), `label`, `base_qty` (e.g. 24), `barcode`, `is_default`. |
| `price_tiers` | `org_id`, `name`, `kind` (`segment/area`), `segment` (shop tier), `area_id`, `priority`. |
| `price_tier_items` | `price_tier_id`, `distributor_product_id`, `price_paisa` (per piece). |
| `schemes` | `org_id`, `name`, `kind` (`buy_x_get_y/slab_discount/bundle/flat_discount`), `rules jsonb` (validated), `area_ids`, `segments`, `starts_at`, `ends_at`, `is_active`. |
| `scheme_products` | `scheme_id`, `distributor_product_id`, `role` (`trigger/reward/bundle_item`). |
| `retailer_accounts` | the distributor↔shop relationship: `org_id`, `shop_id`, `price_tier_id`, `segment`, `credit_limit_paisa`, `payment_terms_days`, `status` (`active/on_hold/blocked`), `hold_override_until`, `assigned_booker_id`, `notes`. |

**Ordering (B2B)**

| Table | Key columns / notes |
| --- | --- |
| `carts` / `cart_items` | server cart per (shop, user) so Munshi tools and other devices see it. Items: `distributor_product_id`, `org_id`, `pack_unit_id`, `quantity`, `added_via` (`manual/munshi/parchi/reorder/booker`). |
| `orders` | `order_number`, `shop_id`, `org_id`, `placed_by`, `placed_by_name`, `booker_id`, `source`, `status` (`new → confirmed → picking → packed → dispatched → delivered`, + `partially_delivered`, `returned`, `cancelled`), `payment_method` (`cod/credit/jazzcash/easypaisa/raast/bank_transfer`), `payment_status`, `subtotal_paisa`, `discount_paisa`, `scheme_discount_paisa`, `delivery_fee_paisa`, `total_paisa`, `paid_paisa`, `delivery_slot_start/end`, `delivery_address jsonb`, `notes`, `cancel_reason`, timestamps per status, `trip_id`, `invoice_number`, `invoice_path`, `rating`, `client_request_id` (idempotency), `deleted_at`. |
| `order_items` | snapshots: `name`, `pack_unit`, `base_qty_per_unit`, `quantity`, `unit_price_paisa`, `mrp_paisa`, `scheme_id`, `free_base_qty`, `line_discount_paisa`, `line_total_paisa`, `delivered_base_qty`, `damaged_base_qty`, `short_base_qty`, `substitution_of_item_id`, `substitution_status`. |
| `order_status_history` | `order_id`, `from_status`, `to_status`, `changed_by`, `changed_by_name`, `note`. |
| `delivery_otps` | `order_id`, `code` — readable only by the shop's members; checked inside `confirm_delivery`. |
| `returns` / `return_items` | claims for damaged/short/returned goods with photos; `status` (`requested/approved/rejected/received/credited`). |
| `credit_notes` | `org_id`, `shop_id`, `order_id`, `return_id`, `number`, `amount_paisa`, `reason`, `status`, `journal_id`. |

**Delivery and field**

| Table | Key columns / notes |
| --- | --- |
| `riders` | `org_id`, `member_id`, `vehicle_id`, `cnic_last4`, `is_active`. |
| `vehicles` | `org_id`, `kind` (`bike/rickshaw/loader/van`), `registration_no`, `capacity_kg`. |
| `trips` / `trip_stops` | trip per rider per day; stops in route order with `order_id`, `sequence`, `status`, `eta`, `arrived_at`, `completed_at`, `cash_collected_paisa`, `failure_reason`. |
| `proof_of_delivery` | `trip_stop_id`, `order_id`, `photo_path`, `otp_verified`, `received_by_name`, `location`. |
| `rider_locations` | latest position per rider (`rider_id`, `trip_id`, `lat`, `lng`, `heading`, `recorded_at`); live updates over Realtime broadcast. |
| `beats` / `beat_shops` | beat plans per weekday per booker; shop list with sequence. |
| `visits` | check-in/out with GPS + distance from shop pin, `outcome`, `order_id`, `notes`. |
| `field_targets` | `org_id`, `member_id`, `period`, `metric`, `target_value`. |

**Warehouse**

| Table | Key columns / notes |
| --- | --- |
| `warehouses` | `org_id`, `name`, `code`, `address_line`, `location`, `is_default`. |
| `suppliers` | principal companies per org. |
| `stock_receipts` | stock-in header from a supplier (`reference_no`, `received_at`, `total_cost_paisa`). |
| `stock_batches` | `org_id`, `warehouse_id`, `distributor_product_id`, `batch_no`, `expiry_date`, `qty_on_hand`, `qty_reserved`, `unit_cost_paisa`, `bin_location`. FEFO by `expiry_date`. |
| `stock_movements` | append-only, signed base quantities: `movement_type` (`stock_in/transfer_in/transfer_out/reserve/release/dispatch/return_in/adjust_damage/adjust_expiry/adjust_count`), `reference_type/id`, `reason`. |
| `stock_transfers` | header for warehouse-to-warehouse transfers. |

**Money** (double-entry)

| Table | Key columns / notes |
| --- | --- |
| `ledger_accounts` | per book (`book_type` `org/shop`, `book_id`): `code` (`cash/bank/wallet/sales/sales_returns/discounts/scheme_expense/receivable/write_off/opening_equity/cash_in_transit`), optional `counterparty_type/id` (a shop for a distributor's receivable; a `shop_customers` row for a dukan's khata). |
| `ledger_entries` | `journal_id`, `account_id`, `book_type/id`, `debit_paisa`, `credit_paisa` (exactly one > 0), `entry_date`, `due_date`, `memo`, `reference_type/id`, `reversal_of`, `deleted_at`. Each journal balances (enforced in `post_ledger_entry`). The dukandar's "distributor ledger" reads the distributor's receivable account for that shop — one source of truth. |
| `payments` | `book_type/id`, `payer_type/id`, `amount_paisa`, `method`, `reference_no`, `receipt_path`, `status` (`pending_verification/confirmed/rejected`), `collected_by`, `trip_id`, `received_at`, `journal_id`, `client_id`. |
| `payment_allocations` | `payment_id`, `order_id` / `pos_bill_id`, `amount_paisa` (FIFO by default). |
| `cash_settlements` | rider/booker day-end: `expected_paisa`, `received_paisa`, `variance_paisa`, `status`, `approved_by`. |
| `plans` / `subscriptions` / `subscription_invoices` | distributor plans (Basic/Pro/Enterprise) with `limits jsonb`; periods; invoices with status and PDF. |

**Shop OS**

| Table | Key columns / notes |
| --- | --- |
| `shop_inventory` | `shop_id`, `master_product_id`, `distributor_product_id`, `name`, `barcode`, `category_id`, `unit`, `is_loose`, `cost_price_paisa`, `selling_price_paisa`, `mrp_paisa`, `qty_on_hand numeric(12,3)`, `low_stock_threshold`, `is_favourite`, `is_visible_online`, `image_path`. |
| `shop_stock_batches` | `inventory_id`, `batch_no`, `expiry_date`, `qty`. |
| `shop_stock_movements` | `type` (`receive/sale/sale_return/adjust_damage/adjust_expiry/self_use/count/opening`), signed `qty`, `unit_cost_paisa`, reference. |
| `pos_bills` / `pos_bill_items` | `client_id` (idempotency, generated on device), `bill_number`, `customer_id`, `status` (`completed/held/void/returned`), totals, `paid_cash_paisa`, `paid_digital_paisa`, `digital_method`, `udhaar_paisa`, `change_paisa`, `created_offline`, `device_id`, `synced_at`; items snapshot `cost_price_paisa` for profit. |
| `shop_customers` | khata customers: `name`, `phone`, `credit_limit_paisa`, `terms_days`, `profile_id` (if a TezDukan user), `notes`, `deleted_at`. |
| `expenses` | `category` (`rent/bijli/salaries/gas/transport/other`), `amount_paisa`, `paid_from`, `expense_date`, `receipt_path`, `deleted_at`. |
| `cash_book` | manual entries + daily `opening`/`closing`; POS cash and expenses join in the daily view. |

**Storefront**: `storefront_settings` (per shop: live flag, timings, delivery radius, minimum
order, fees, payment options), `customer_orders` / `customer_order_items`, `reviews`
(dukans by customers, distributors by dukandars).

**Engagement**: `banners`, `campaigns`, `notifications` (in-app centre via Realtime),
`push_subscriptions`, `reward_points` (TezPoints ledger; shop tier derived).

**AI and audit**: `ai_conversations`, `ai_messages`, `ai_actions` (transcript, tool, args,
result, status, user, time), `product_embeddings` (pgvector), `audit_logs`, `feature_flags`.

**Platform and integrations**: `message_outbox` (SMS/WhatsApp/push, with Sandbox status),
`api_keys` (hashed), `webhook_endpoints`, `webhook_deliveries`, `integration_settings`,
`support_tickets` / `support_messages` (disputes, refunds, support), `content_pages`
(policy pages per locale), `data_deletion_requests`, `events` (product analytics),
`counters` (human-readable numbers), `rate_limits`, `seed_registry`.

### 6.4 RPC functions (atomic, validated, audited)

| Function | Does |
| --- | --- |
| `place_order(shop_id, items, payment_method, slot, notes, client_request_id)` | Splits by distributor, applies tier prices + schemes server-side, checks MOQ, stock, credit limit and holds, creates orders + items + history, clears cart lines. Idempotent. |
| `update_order_status(order_id, to_status, note)` | Validates the transition and permission, writes history, reserves/releases stock. |
| `cancel_order(order_id, reason)` | Shop before dispatch; distributor any time before delivery. |
| `confirm_delivery(order_id, otp, delivered_items, cash_collected_paisa, photo_path, location)` | OTP check, POD, delivered quantities, FEFO stock out, invoice journal, cash collection. |
| `receive_order_into_inventory(order_id, lines)` | Adds received stock to `shop_inventory` at cost, records short/damaged as a return claim. |
| `post_ledger_entry(book_type, book_id, lines, memo, reference)` | Balanced journal posting with permission checks. |
| `record_payment(...)` | Payment + journal + FIFO allocation; receipts for manual transfers. |
| `create_pos_bill(shop_id, bill)` | Idempotent on `client_id`; items, stock out, cash/udhaar journals. |
| `switch_active_context(role, shop_id, org_id)` / `my_role_contexts()` | Role switcher. |
| `register_shop(...)` / `register_organization(...)` / `approve_*` / `reject_*` | Onboarding and admin approval. |
| `next_counter(scope)` / `check_rate_limit(key, max, window_s)` | Utilities. |
| `search_catalog(query, shop_id, limit)` | Trigram + aliases + unaccent; later + embeddings, ranked by shop history. |
| `storefront_*`, `nearby_shops(lat, lng, radius_m)` | Safe public reads. |

**Realtime:** `orders`, `order_status_history`, `customer_orders`, `notifications`, `trip_stops`,
`shop_inventory` (+ broadcast channels for rider locations).
**Storage buckets:** `product-images` (public read), `shop-media` (public read), `pod-photos`,
`invoices`, `parchi-uploads`, `payment-receipts`, `kyc-documents` (private, path-scoped policies).
**pg_cron:** payment reminders (10:00 PKT), daily briefs (07:30 PKT), subscription renewals
(00:30 PKT), overdue auto-hold (01:00 PKT), housekeeping (stale carts, rate-limit rows).

### 6.5 Seed data (real, not lorem ipsum)

One live dukan named **TezDukan** serving all of Hyderabad, one sample distributor, Hyderabad
service areas, categories with real photos, and at least three real Pakistani FMCG products per
category (Tapal Danedar, Lipton Yellow Label, Nestlé Milkpak, Olper's, Dalda, Habib Oil, Shan,
National, Knorr, Peek Freans Sooper, Lay's, Coca-Cola, Pepsi, Nestlé Pure Life, Surf Excel,
Ariel, Lux, Lifebuoy, Colgate…) with SKUs, pack sizes, carton quantities and realistic, editable
prices. Every seeded row is recorded in `seed_registry`; `pnpm seed:reset` removes them all.

---

## 7. Offline and PWA

- Serwist service worker: precached app shell + `/~offline`, runtime caching for static
  assets, images (stale-while-revalidate, size-capped), and navigations (network-first).
- Next.js `experimental.useOffline`: soft navigations, prefetches and Server Actions wait for
  the connection instead of throwing; `useOffline()` drives the offline banner.
- IndexedDB (via `idb`): catalog cache, TanStack Query persistence, and a **sync queue** for
  POS bills, khata entries and booker orders. Each queued item carries a client UUID; server
  RPCs are idempotent on it. Conflicts (e.g. price changed, stock negative) are surfaced to the
  user, never silently dropped.
- Web Push with VAPID keys, sent from a Supabase Edge Function. No Firebase.
- Installable: manifest, maskable icons, splash screens, a quiet "Install TezDukan" prompt.
- Trusted Web Activity (Bubblewrap) config for a Play Store APK in Phase 7.

---

## 8. Munshi AI (built in Phase 5; foundations earlier)

- `POST /api/munshi` streams a tool-calling loop through `src/lib/ai` (Anthropic default,
  Gemini alternative; `AI_PROVIDER`, `AI_MODEL_AGENT` default `claude-sonnet-5-5`,
  `AI_MODEL_FAST` default `claude-haiku-5-5`).
- Tools are Zod-typed and execute server-side with the user's own Supabase session (RLS
  applies). Role-gated tool sets as listed in the spec.
- Every write shows an **action card** (Confirm / Edit / Cancel); voice confirmation only for
  cart and stock changes; money, orders and irreversible actions need a tap. 10-second Undo.
- Speech: provider adapter (Gemini audio or Whisper-class STT) with Web Speech (`ur-PK`,
  `en-PK`) fallback; lexicon hints; LLM normalisation; hybrid search; 2–4 choices when unsure.
- Local units and numbers: peti, carton, dabba, packet, darjan, kilo, pao, litre; "dhai sau" =
  250, "sawa do" = 2.25, "dedh" = 1.5.
- Logged in `ai_actions`; per-account rate limits and monthly cost caps; prompt-injection safe.
- Evaluation suite of 60+ real commands (Urdu, Roman Urdu, English, mixed); target ≥ 90%.

---

## 9. Integrations (adapters in `src/lib/integrations`)

WhatsApp Business Cloud API · SMS (Pakistani provider via adapter) · JazzCash · Easypaisa ·
Raast / bank transfer (receipt upload) · Web Push (VAPID) · Leaflet/OSM (Google optional) ·
printing (58/80 mm print CSS, optional Web Bluetooth ESC/POS, A4) · barcode · public REST
API + webhooks (`order.created`, `order.status_changed`, `payment.received`,
`stock.updated`) · CSV/Excel import/export · FBR POS (feature flag) · AI providers ·
product analytics (`events` table, PostHog optional). Each role's settings page lists every
integration with status **Connected / Sandbox / Error** and a **Test** button.

---

## 10. Milestones

Each phase ends with: typecheck, lint, unit tests, pgTAP tests, Playwright e2e at 390×844 and
1440×900, screenshots of every new screen reviewed against the brand and UX rules, fixes, a
CHANGELOG entry, and a pushed commit.

### Phase 1 — Foundation
- Project setup and tooling; local Supabase stack; `.env.example`.
- Design tokens, fonts, component library, `/dev/design-system` (every token, component and
  state incl. hover, loading, disabled, error, RTL, dark).
- i18n: en, ur (RTL), ur-Latn; sd structure ready; instant switching without reload.
- Phone + password auth with persistent sessions, sign-up OTP (Sandbox SMS), forgot password.
- Roles, active context, role switcher, proxy routing, role shells (bottom nav / sidebar).
- Full schema with RLS, RPCs, pgTAP tests; generated types; seed data; `pnpm seed:reset`.
- PWA shell: manifest, icons, service worker, offline page, install prompt.

**Exit:** a new user can sign up, verify, sign in, stay signed in, switch language (RTL
correct), and switch between seeded roles without signing out; RLS tests prove tenant
isolation; the design-system page renders every state in light, dark and RTL.

### Phase 2 — Dukandar ordering (Blinkit-grade)
Home (header with shop + delivery promise, rotating search, category tiles, offers carousel,
order again, restock from POS, deals, brand stores, trending in area), search (instant,
typo-tolerant, multilingual, barcode, voice, parchi photo), categories (rail + grid + filter
chips), product card + bottom-sheet detail (gallery, packs, tiers, schemes, profit calculator,
frequently bought together), filters/sort sheet, WhatsApp share, cart split by distributor with
MOQ progress, checkout (slots, payment adapters, credit remaining), order success, live order
tracking, reorder, cancel, claims, rating, distributor ledger + statements.

### Phase 3 — Distributor portal + rider app
Dashboard (KPIs, charts, Hyderabad area heatmap, Munshi brief), realtime orders (sound +
browser notification, kanban + table, bulk actions, substitutions, pick lists, invoices and
challans, route grouping), catalog with AI-assisted bulk import, schemes, price tiers, warehouse
(multi-warehouse, batches, FEFO, transfers, valuation), retailers and credit (auto-hold),
collections and aging, settlements, delivery (trips, live map, POD with photo + OTP), rider app.

### Phase 4 — Dukan shop OS + customer app
Shop dashboard, offline POS (search, scan, voice, favourites, loose items, discounts, split
payment, hold/resume, returns, thermal/PDF/WhatsApp receipts), receive order into inventory,
inventory (batches, expiry, adjustments, stock count), khata (limits, reminders, aging,
statements), customer orders with sound alert, storefront settings + QR poster, cash book,
expenses, reports (PDF/Excel), staff permissions, rewards, settings. Customer app: location,
nearby dukans, dukan page with awning header, cart, checkout, tracking, ratings, addresses,
become-a-dukandar/distributor flows.

### Phase 5 — Munshi AI
Gateway, tool set, streaming sheet with waveform and speed-line thinking state, action cards
with Undo, voice pipeline, product lexicon + hybrid search (pg_trgm + transliteration +
pgvector), parchi / supplier bill / product photo vision, daily briefs with optional audio,
command palette integration, evaluation suite (≥ 90%).

### Phase 6 — Field force, admin and integrations
Order booker app (offline beat, booking, collections, onboarding, visits), admin panel (KPIs,
verification queues, subscriptions, master catalog, banners and campaigns, areas and zones,
disputes, audit and AI logs, feature flags, policy content), WhatsApp, SMS, Web Push, maps,
printing, public API + webhooks, subscriptions and billing, policy pages.

### Phase 7 — Hardening and launch
Performance budgets (LCP < 2.0 s, INP < 200 ms, CLS < 0.05, < 170 KB JS per route), Lighthouse
≥ 90 on every main page, WCAG 2.2 AA, security review (OWASP Top 10, dependency audit,
Supabase advisors), load test, CSP and security headers, TWA/APK packaging, production deploy
on Vercel + Supabase, README from zero.

---

## 11. Testing strategy

- **Unit (Vitest):** money/phone/units/format helpers, Zod schemas, unit parsing ("dhai sau"),
  pricing and scheme maths, sync-queue logic, AI tool argument validation.
- **Database (pgTAP):** RLS isolation per table family (a dukandar cannot see another shop; a
  distributor cannot see another distributor; customers see only their orders), RPC behaviour
  (idempotency, balances, stock, transitions).
- **E2E (Playwright):** core journeys per phase at 390×844 and 1440×900, plus screenshot capture
  of every new screen (light, dark, Urdu RTL).
- **Munshi eval:** scripted command set with expected tool calls and arguments; pass rate report.
- **Acceptance tests** from the spec are tracked in `e2e/acceptance/` and must pass before launch.

---

## 12. Open questions for the owner (not blocking)

1. **Hosting project.** The existing Supabase project (`zaidai-create's Project`, Mumbai) holds
   the previous TezDukan app's schema and data. This build develops against a local Supabase
   stack and does not touch it. Before Phase 7 we need a decision: create a new Supabase project
   for production (free plan allows one more), or retire the old schema in the existing project.
2. **Domain** for the PWA/TWA (e.g. `tezdukan.pk`) and Play Store package name.
3. **Provider accounts** when ready: SMS provider, WhatsApp Business, JazzCash/Easypaisa merchant,
   Anthropic and/or Gemini API keys, VAPID keys (we can generate these).
