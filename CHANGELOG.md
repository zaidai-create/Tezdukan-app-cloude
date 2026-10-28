# Changelog

All notable changes, newest first. Dates are Asia/Karachi.

## Unreleased

### Distributor portal, chat and notifications (2026-10-29)

- Distributor catalog:
  - Products with search, filters (selling, out of stock, hidden), stock and margin.
  - A show/hide switch with Undo.
  - An add and edit form:
    - Munshi fills it from one line ("Tapal Danedar 950g, carton 12, rate 1750, MRP 1950")
      or from a photo of the pack.
    - Products can be copied from the TezDukan master catalog, with a photo upload.
    - Saving keeps the piece and carton packs in step and can receive opening stock into a
      batch.
  - Without an AI key, Munshi reads the line with a built-in parser and says "Sandbox".
- Distributor orders:
  - A dashboard with today's numbers, 7-day sales and top shops.
  - An order inbox.
  - Order pages with the shop's phone, WhatsApp, chat and map.
  - Confirm, pack, dispatch and deliver, with the delivery code, cash collected and short
    lines.
  - Big orders (Rs 20,000 and up by default) and first orders need a phone confirmation
    before they can ship. The distributor can also ask the dukan to confirm in the app.
  - Delivery posts the invoice, khata entries and cash payment in one step.
- Chat:
  - Dukan and distributor chat live.
  - Shops and customers can open support chat with an instant reply.
  - The admin support queue.
  - Unread badges and quick replies.
- Notifications:
  - A bell with the latest updates.
  - Live toasts, plus a chime for new orders.
  - Phone notifications through Web Push, with a Sandbox mode when no keys are set.
- Dukandar:
  - A profit calculator on the product sheet.
  - Expected profit at MRP in the cart.
  - Call, WhatsApp and chat buttons on order pages.
- First launch:
  - A splash and three welcome slides.
  - Continue with Google on sign-in and sign-up, shown as Sandbox until enabled.
- 87 new database tests (400 in total).

### Phase 2 — Dukandar ordering (in progress)

- Dukandar ordering screens (2026-10-28):
  - Home: tomorrow's delivery window, a search bar with rotating examples and Munshi's mic,
    offer banners, 3D category tiles, order again, deals, selling fast nearby, top brands, the
    distributor khata total and your distributors.
  - Categories, distributor pages and instant search (typos, Urdu, Roman Urdu, barcodes) with
    sort and filter chips; a product sheet with pack sizes, profit, schemes, other
    distributors' prices and what is bought together.
  - A cart split by distributor with minimum-order and free-delivery progress, scheme savings
    and free goods; checkout with delivery slots, cash or khata, and a note; an order placed
    screen.
  - My orders (active and past), order pages with the delivery code, a live progress timeline,
    reorder, cancel, rating and damage or shortage claims.
  - Distributor khata: what you owe each distributor, credit left, age of dues and the full
    statement.
  - The nav dock now has Home, Categories, Cart (with its count), Orders and Account.
  - Every screen in English, Urdu (right to left) and Roman Urdu, with loading, empty and error
    states; new end-to-end journeys and screenshots (158 browser tests pass).

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
