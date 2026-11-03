# Admin panel plan

Status: planned and designed (2026-11-03), not built. The visual design (four boards: the plan,
overview dashboard, dukans and sales, delivery and app control) lives in the owner's
"TezDukan Admin Panel" design canvas on claude.ai.

## Goal

One control room for the marketplace: the app, the website, dukans, distributors, customers,
delivery fees and money. Every setting changes live within seconds and every change is audited.

## Modules (left sidebar)

| Group | Module | Sees and changes |
| --- | --- | --- |
| Home | Overview | Sales today, orders (dukan and customer), active dukans, sign-ups, live order feed, approvals and alerts |
| People | Approvals | New dukans and distributors, documents, map pin, approve or reject with a reason, auto-approve switch |
| People | Dukans | Sales, online orders, ratings, khata; suspend; tier and commission; delivery fee and radius overrides |
| People | Distributors | Areas served, catalog health, confirm and dispatch times, credit given, top products |
| People | Customers | Accounts, orders, complaints, blocks; find by phone |
| Operations | Orders | All dukan and customer orders; filter by status, area, late; cancel, refund, reassign |
| Operations | Delivery and fees | City defaults and per-area / per-dukan fee, free-delivery threshold, minimum order, ETA, slots, pause an area |
| Operations | Catalog | Master products, brands, categories, photos, Urdu names, search aliases |
| Growth | Promotions | Home banners, coupons, featured dukans, schemes with dates |
| Growth | Notifications | Push, SMS and in-app broadcasts to segments, templates |
| Control | App and website | Feature flags, maintenance mode, minimum Android version, home sections, announcements, legal pages, languages |
| Control | Support | Live chat queue (exists at /admin/support), tickets, reply times |
| Control | Finance | COD collected, commissions, payouts, invoices, exports |
| Control | Reports | Sales by dukan, area, category, day; top products; cohorts; Excel and PDF |
| Control | Team and audit | Admin users, roles and permissions, audit log, integrations, system health |

## Roles

Owner (everything), Operations, Support, Finance (read-only outside money), Content. Permissions
are checked in the database (`private.is_admin()` grows into per-permission helpers).

## Real-time settings

1. Settings live in tables, not code: `platform_settings` (key, value jsonb, schema-checked),
   `area_delivery_settings`, `shop_overrides`, and the existing `feature_flags`.
2. Writes go through admin RPCs that validate, save and write `audit_log` (who, before, after).
3. Readers use `'use cache'` with a settings tag; the admin action calls `updateTag`, and Supabase
   Realtime on the settings tables tells open screens to `router.refresh()`.
4. Risky changes (ordering off, maintenance mode, fee changes over 20%) confirm first, can be
   scheduled, and can be undone from the audit log.

## UI/UX

Same tokens as the app. Frosted sidebar and top bar, white cards on the green-grey canvas, three
shadow levels, 18 px cards, big tabular numbers first, 150–250 ms springs, Ctrl+K command
palette, light and dark, works on tablet and phone.

## Build order

- Phase A (2 weeks): Overview, Approvals, Dukans, Delivery and fees, feature flags, audit log.
- Phase B (2 weeks): Orders, Customers, Support queue, Notifications.
- Phase C (2 weeks): Finance and payouts, Reports, Promotions and banners, website pages.
- Phase D (1 week): Roles and permissions, integrations, system health, scheduled changes.
