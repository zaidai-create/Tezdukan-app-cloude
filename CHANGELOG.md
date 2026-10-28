# Changelog

All notable changes, newest first. Dates are Asia/Karachi.

## Unreleased

### Phase 2 — Dukandar ordering (in progress)

- Ordering backend (2026-10-28):
  - Search by name, typo, Urdu or Roman Urdu, or barcode; browse by category, brand or
    distributor with sorting and filters; product detail with other distributors' offers and
    what is bought together; one home feed call.
  - A server cart priced for the shop (tier, area or trade price, schemes, delivery fee, minimum
    order, credit) and split by distributor, and a checkout that orders every distributor at
    once or none, safely retried.
  - Cancel, reorder, rate and return claims, and the distributor ledger with aging.
  - 68 new database tests (313 in total).
- Demo data: Mehran Distributors as a second distributor, stock at both warehouses, key-account
  prices, three home banners, product and category photos from the Stitch designs, and eight
  TezDukan orders over three weeks with invoices, a payment and a credit note.

### Design refresh (2026-10-28)

- New look from the owner's Stitch designs, made more Apple-like: deep emerald actions, saffron
  offers, coral urgency, a warm canvas, layered soft shadows, top-lit 3D buttons and rounder
  corners, in light and dark.
- The bottom navigation is now a floating, frosted dock like the owner's picture: the open tab
  is a green pill with its name that slides on a spring; the others show icons. The cart tab
  shows how many items are in the cart.
- Munshi moved into the mobile header (tap to open, hold to talk).

### Phase 1 — Foundation (in progress)

- Fixes found by the new screenshot and journey tests:
  - The Ctrl+K command palette crashed on open; it now works. Typing a page name and pressing
    Enter goes to that page, and a question goes to Munshi.
  - Tapping Sign in before the page has loaded can no longer put the password in the URL.
  - The role switcher opens as a side panel on desktop.
  - Booker and rider cards no longer repeat their role.

  Password reset is covered end to end, and the screenshots now include every signed-in shell.
  (2026-10-26)
- The Phase 1 database is merged:
  - 90 tables, all with row-level security, plus identity RPCs and storage buckets with their
    policies.
  - Realtime for orders and notifications.
  - 245 pgTAP tests, including tenant isolation.
- Demo seed: the live TezDukan dukan, the Indus Traders distributor, 16 Hyderabad areas and 53
  real products. Eight demo logins cover every role, and each user opens on their own home.
  (2026-10-26)
- End-to-end journeys against the real database:
  - sign up, verify with the Sandbox code, and land home
  - sign in to each role, and stay signed in
  - switch roles without signing out
  - sign out
  (2026-10-26)
- A new sign-in experience. Phones get a shopfront layout: a black signboard with the logo,
  the awning hanging below, the form underneath. The logo assembles itself (cart rolls in, speed
  lines trail, awning drops). Other touches:
  - a language highlight that slides
  - phone numbers that space themselves, with a check when complete
  - a Caps Lock warning
  - errors that shake
  - code digits that pop in and turn green when accepted
  - a short rise between screens

  All of it respects the phone's reduce-motion setting. (2026-10-26)
- End-to-end tests for the public screens at 390×844 and 1440×900, with WCAG 2.1 AA checks
  (axe) in English and Urdu, and `pnpm screenshots` for design review. (2026-10-26)
- Offline: pages not yet visited now show the offline page instead of a browser error, the
  service worker is built once at build time, and signing out clears cached screens.
  (2026-10-26)
- The owner's official logo, traced to vectors. It drives the in-app mark and wordmark, the
  favicon and the PWA icons; vector exports of the lockup and mark are in `docs/brand/`. The
  awning motif now uses the logo's amber and orange stripes. (2026-10-26)
- PWA: web manifest, icons, Serwist service worker with an offline fallback page, and an install
  prompt from the second visit.
- Munshi entry points: the raised mic in the bottom nav (tap to open, hold to talk), a desktop
  button, the Munshi sheet with suggestions per role, and "Ask Munshi" from Ctrl+K. Answers say
  plainly that Munshi is not available yet (Phase 5).
- Role shells for customer, dukandar, distributor, order booker, rider and admin: bottom nav,
  collapsible desktop sidebar, top bar with a Ctrl+K command palette, a role switcher that
  needs no logout, and an account page (profile, roles, language, theme, sign out).
- Auth screens: sign in with phone and password, sign up with SMS code verification (a
  labelled Sandbox panel shows the code when no SMS provider is set), and forgot/reset
  password. The proxy refreshes the session and routes each role to its home.
- Languages: English, Urdu (right to left), Roman Urdu, and Sindhi (hidden for now, falls back
  to Urdu). The choice is kept in a cookie and the profile; messages are typed.
- Design system: light and dark tokens checked for WCAG AA, the component library, commerce
  components (price, product image, ADD-to-stepper, product card, cart bar, category tile),
  designed loading, empty, error and offline states, and a live catalogue at
  `/dev/design-system` with dark and RTL toggles.
- Money, phone and date helpers (integer paisa and `Rs 1,250`, E.164 phones shown as
  `0300 1234567`, DD/MM/YYYY in Asia/Karachi) with unit tests.
- Tooling: Next.js 16.4 (Cache Components), strict TypeScript, ESLint rules that reject emoji,
  raw colours and hard-coded UI text, Prettier, Vitest, Playwright at 390×844 and 1440×900, and
  a local Supabase stack.
- Plan, working rules and decision log (`PLAN.md`, `CLAUDE.md`, `DECISIONS.md`).
