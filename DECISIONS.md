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

## Design

- **The owner's logo is the brand source; it was traced to vectors** — the official artwork
  (`docs/brand/tezdukan-logo.png`) was traced into SVG paths per colour layer and kept in one
  module, `src/lib/brand/logo-art.ts`, which feeds the in-app logo and `scripts/gen-icons.ts`
  (favicon, PWA and Apple icons). Vector exports of the full lockup and the mark sit next to the
  original. The mark keeps the logo's own colours, flat mint plus its two shaded gradients (the
  flag's fold and the awning). It appears on its black rounded tile (`LogoMark`, like the app
  icon) or bare on black surfaces only. The lettering is traced too, so the wordmark matches
  the logo without loading another font weight. On light surfaces "Dukan" uses a deeper shade
  of the logo's mint (`--wordmark-dukan`, 3.5:1 on white); the logo's own mint is 1.7:1 there.
  Brand artwork is not mirrored in RTL. (2026-10-26)
- **The awning motif uses the logo's amber and orange stripes**, with the orange stripes hanging
  shorter as they do in the logo. Earlier builds used amber and white. (2026-10-26)
- **Spec brand colours stay; AA-safe shades are derived for text and fills** — white on the spec
  green `#0A8F5A` is 4.13:1, below AA for body text. Filled buttons in light mode use `--action`
  (`#07704A`, 6.1:1), and `--danger-ink`, `--awning-ink` and `--border-strong` (3:1 non-text)
  cover the other gaps. In dark mode, text on mint and amber fills is dark. The brand tokens
  themselves are unchanged. (2026-10-25)
- **Theme from a `td_theme` cookie applied by a tiny inline script, without next-themes** — the
  root layout stays static under Cache Components (no request read on the server), the first
  paint already has the right theme, and the preference syncs to the profile. Light is the
  default; "Match device" is an option. (2026-10-25)
- **Bottom sheet built on Radix Dialog with Motion** — Radix gives focus trapping, Escape and
  ARIA, matching every other dialog; Motion, already used for the cart spring, gives the sheet
  spring and drag-to-dismiss. Dragging starts only from the handle, so long lists inside a sheet
  scroll normally. (2026-10-25)

- **The auth screens are a shopfront** — on phones, a black signboard carries the logo, the
  awning hangs below it and the form sits underneath like the counter; on desktop the signboard
  is a side panel with what TezDukan does. The logo assembles itself once per page load: the
  cart rolls in trailing its speed lines, the flag curls, the awning drops into place, then the
  wordmark and tagline rise. The lockup is never mirrored; in RTL it sits at the start.
  (2026-10-26)
- **Brand moments in CSS, interactions in Motion** — the logo reveal and entrance rises are CSS
  keyframes, so they play on first paint without waiting for JavaScript and cost almost nothing
  on low-end phones. Interactive motion (the sliding language pill, sheets, the cart) uses
  Motion under `MotionConfig reducedMotion="user"`. With reduced motion, the CSS block zeroes
  durations and delays, so everything appears finished. (2026-10-26)
- **The theme boot script is rendered only in the server HTML** (`ServerOnlyScript`).
  `next/script` with `beforeInteractive` defers inline code until after Next's bootstrap, which
  would flash white in dark mode. A plain `<script>` is re-created inert, with a React warning,
  when switching language re-renders the root layout. (2026-10-26)
- **Phone numbers format as they are typed** ("0300 1234567"), a pasted +92/0092 is
  understood, and a check appears once the number is complete. The cursor stays after the
  digit just typed. (2026-10-26)

- **The owner's Stitch design system is the visual reference** (`docs/design/stitch/`): deep
  emerald `#0B5D3B` for actions (white text 8:1, so no separate AA shade is needed), saffron
  for offers and speed, coral red `#E11D48` for urgency, a warm canvas and a deep pine dark
  mode. The logo keeps its own mint and awning colours. Depth follows Apple's layered style:
  brand-tinted ambient shadows, top-lit filled controls and larger, softer corners (12/18/22/28
  px). It replaces the spec's first palette (`#0A8F5A`). (2026-10-28)
- **Frosted material only on bars** — the nav dock and sticky headers blur what scrolls under
  them; cards stay solid. Without backdrop-filter support, or with "reduce transparency", the
  bars fall back to a solid surface. (2026-10-28)
## App shell

- **Each role has its own account page** (`/dukan/account`, `/rider/account`, …) so the page
  keeps that role's navigation; `accountPath(role)` builds the link. (2026-10-25)
- **The mobile tab bar is a floating dock, as in the owner's reference picture** — a frosted
  capsule above the screen edge; the current tab is a filled pill with icon and label that
  slides between tabs on a spring, and the other tabs show icons only (labels stay for screen
  readers and as tooltips). Munshi moved from a raised centre mic to a "Munshi" button in the
  mobile header (tap to open, hold to talk), so the dock keeps five plain tabs. (2026-10-28)
- **Navigation lists only routes that exist** — each phase adds its items as its screens ship,
  so there is never a link to an unbuilt page. (2026-10-25)
- **Munshi before Phase 5** — the mic button, sheet, voice capture and the Ctrl+K hand-off all
  work. `/api/munshi` answers 503 `ai_not_configured` when no AI key is set (the sheet shows a
  labelled Sandbox notice) and `agent_unavailable` until the agent ships in Phase 5. It never
  pretends to answer. (2026-10-25)

- **Signing out ends this device's session only** (`signOut({ scope: "local" })`). Signing out
  on the shop's shared phone must not end the owner's session on their own phone. (2026-10-26)
- **Sign-in language: the device's choice wins, otherwise the profile's** — a language picked on
  the sign-in screen is saved to the profile; a device that never chose adopts the profile's
  language, so a returning user on a new phone gets their own language. (2026-10-26)
- **Demo users start in their own role** — the seed sets each demo profile's active context
  (admin, dukandar, distributor, booker, rider), so a demo opens on that role's home. The two
  multi-role users start as customers; parallel end-to-end runs use one each. (2026-10-26)

- **Forms that carry a password or phone number use `method="post"`** — a tap before hydration
  falls back to a native submit, and a GET would put the password in the URL, browser history and
  server logs. A POST to the page just renders it again. (2026-10-26)
- **In the command palette, pages outrank "Ask Munshi"** — Munshi is always offered, last, so
  Enter opens a matching page and only a question (nothing matches) goes to Munshi.
  (2026-10-26)

- **Product detail is a bottom sheet over the page being browsed**, opened from any card and
  filled by the `product_detail` RPC, rather than an intercepting route: the dukandar never
  loses their place in a long list, and one sheet serves home, search and categories. A
  shareable product page can follow when WhatsApp sharing lands. (2026-10-28)
- **Cart changes go straight from the browser to `set_cart_item`**, one at a time per cart
  (TanStack Query mutation scope), with the step shown at once and the newest server answer
  winning. A removed line gets an Undo toast. Pages hand their server-read cart to the client
  cache, so steppers and the cart bar are right on first paint. (2026-10-28)
- **Urdu screens show Urdu product names** (from `name_ur`), with dates, times and codes kept
  left to right inside Urdu sentences by Unicode isolates. (2026-10-28)
- **Ordering journeys in tests use a fresh dukan per run** (`createDukandar` in
  `e2e/support/admin.ts`), so parallel viewports never share a cart; orders they place are
  cancelled and stay, like any financial record. (2026-10-28)

## Offline and PWA

- **The service worker is bundled at build time** — `/serwist/sw.js` is a prerendered route
  (`generateStaticParams` plus a `'use cache'` function, since Cache Components drops
  `dynamic = 'force-static'`). Otherwise the first request after each serverless cold start
  would run esbuild and scan a build folder that is not deployed with the function. Unknown
  file names return 404. (2026-10-26)
- **Our own runtime caching rules instead of Serwist's `defaultCache`** — `defaultCache` is
  built against a second copy of `serwist` (pnpm resolves its `browserslist` peer
  differently), so its strategies failed the `instanceof` check that attaches the offline
  fallback, and offline navigations errored. Our rules: API routes are network-only; pages and
  RSC payloads are network-first with a 10 s timeout and a week of copies; build assets and
  fonts are cache-first; images are stale-while-revalidate. (2026-10-26)
- **Signing out clears the cached screens** (`pages`, `pages-rsc`) so the next person on a
  shared shop phone cannot open the previous account's pages offline. (2026-10-26)
- **Offline copy only promises what works today** — "recent pages can still be viewed". The
  "saved and will sync" wording arrives with the offline queues (cart, POS bills, khata).
  (2026-10-26)

## Backend

- **Customer first; becoming a business is an Account option** (owner's call) — every
  sign-in lands on the shopping app; "Become a shopkeeper / distributor" in Account registers
  through `register_shop` / `register_organization`. The `auto_approve_registrations` flag (on
  for the test site, off by default and in every pgTAP test) approves them in a before-insert
  trigger, so admin approval is one switch away. (2026-11-02)
- **Customer orders go to the dukan on WhatsApp for now** — the cart is kept on the phone and
  each dukan's bill (fee, free-delivery threshold, minimum order) comes from its storefront
  settings; the message lists items, totals, name and address. In-app customer orders, with a
  dukandar inbox, come with the customer-orders phase. Storefront reads go through definer
  functions because RLS keeps inventory private to the dukan. (2026-11-02)
- **Hosting: Vercel project `tezdukan` (team tezduakan), functions in Mumbai (`bom1`)** —
  next to the Supabase project (ap-south-1). From Washington (the default) every page paid
  several cross-world database round trips; in Mumbai the dukan home loads in about half a
  second warm. Deployed with the Vercel CLI while GitHub pushes are blocked. (2026-11-02)
- **The hosted project is reused, wiped and set up over the Management API** — the owner
  chose to keep `vgdwsisihixwsuuikhvp` and drop the old app's data (done: no tables, users or
  files remain). `pnpm hosted:setup` applies the migrations over HTTPS
  (`/database/query`, one transaction per file, recorded under the file's version so the
  CLI agrees later), sets Auth like `config.toml`, and with `--seed` loads the demo. HTTPS
  because cloud sandboxes and some networks block direct Postgres connections. (2026-10-29)
- **Big orders and first orders are confirmed by phone before they ship** — set at insert by
  a trigger (`confirm_above_paisa`, default Rs 20,000). The distributor ticks "confirmed on
  the phone" or asks the dukan to confirm in the app; dispatch refuses until one happens.
  Delivery needs the dukan's code, and posts the invoice, ledger and cash in one RPC.
  (2026-10-29)
- **Chat lives in Postgres, not WhatsApp** — conversations and messages with RLS and
  Realtime, so support and order context stay in the app. WhatsApp and phone stay one tap
  away (`wa.me`, `tel:`) for shopkeepers who prefer them. (2026-10-29)
- **Push goes through the outbox** — a notification row queues a `push` message only when the
  user has a subscription; actions flush it with `after()` and `/api/push/flush` (cron,
  `CRON_SECRET`) catches the rest. With no live subscription left the message is cancelled,
  not marked sent. Without VAPID keys the Sandbox sender records it. (2026-10-29)
- **Munshi drafts products with structured output, and has a parser fallback** — the agent
  model returns a JSON-schema draft from a line or a photo; without a key, a rule-based parser
  reads the common shorthand ("rate 1750, MRP 1950, carton 12", "12 wala dabba") and the UI
  says Sandbox. The distributor always reviews before saving. (2026-10-29)
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
- **One pricing path for the cart and the order** — `private.price_cart` prices the cart
  (tier, then area, then trade price; schemes; delivery fee; minimums; credit) and returns the
  cart summary; `place_order` orders exactly that summary and snapshots it. What the dukandar
  sees is what is ordered, and scheme maths lives in one SQL function. (2026-10-28)
- **Stock is enforced per distributor** (`settings.enforce_stock`, default true): a distributor
  that keeps stock records blocks orders beyond stock; one that allows backorders (Indus
  Traders in the seed) still shows "out of stock" but accepts the order. A distributor with no
  stock records at all counts everything as in stock. (2026-10-28)
- **Next-day delivery slots** — two-hour windows 10:00-18:00 on the distributor's delivery
  days, from tomorrow (or the day after past its cutoff). Same-day quick delivery belongs to the
  customer app in Phase 4. (2026-10-28)
- **A first order opens a retailer account with zero credit** — the distributor sees the shop
  in its retailer list straight away; credit stays its own decision (credit.manage). Bookers
  only see and order from their own distributor. (2026-10-28)
- **Order numbers `TD-000123` from one platform-wide counter** — short enough to read out on
  the phone, unique across distributors. The seed's history uses TD-000101..108 and moves the
  counter past them. (2026-10-28)
- **Product photos for the demo come from the owner's Stitch designs** — cropped WebP files in
  `scripts/seed-images/`, uploaded to the `product-images` bucket under `seed/` by `pnpm seed`.
  Real distributor photos replace them later. (2026-10-28)
- **More photos from Open Food Facts, only when clean and correct** — 27 front-of-pack photos
  were found on Open Food / Beauty Facts (CC BY-SA 3.0); only the 10 that show the right product
  clearly were kept (others were the wrong pack, a back label, a hand or a dark shelf). They are
  credited in `scripts/seed-images/products/CREDITS.md` and on the Terms page. A product with no
  photo shows its category icon and brand name, never initials. (2026-11-04)
- **Name snapshots on cross-tenant records** (`placed_by_name`, `changed_by_name`) — a
  distributor needs to see who placed an order without read access to other tenants' profiles.
  (2026-10-25)
- **`seed_registry` tracks seeded rows** — `pnpm seed:reset` deletes exactly those, in reverse
  dependency order, leaving real data untouched. (2026-10-25)
- **uuid v4 (`gen_random_uuid()`) primary keys** — Postgres 17 has no built-in uuidv7.
  Client-generated UUIDs make offline writes idempotent. (2026-10-25)

## AI

- **Munshi runs on Google's official Gemini API with a free AI Studio key** — one
  `GEMINI_API_KEY` powers Munshi, voice-to-text and (later) the support assistant. We do not use
  "web to API" tools that drive the consumer Gemini website with a person's login cookies: they
  break Google's terms, can get the owner's Google account blocked, and stop working without
  notice. (2026-11-03)
- **A list of models, tried in order** — the free tier's newest models are often overloaded
  (HTTP 503) or slow, so `GEMINI_MODEL_AGENT` is a comma-separated list (default
  `gemini-3.5-flash`, then the lite models, then the newest flash); a busy, rate-limited,
  retired or slow model falls through to the next, within about 40 seconds. When all are busy
  Munshi says so plainly. Paid billing on the AI Studio project removes most of this. (2026-11-03)
- **Munshi acts with the person's own session** — every tool calls the same RLS-protected
  queries and RPCs as the screens, so the model can never read or change more than the person
  could by hand. Writes (price, stock, adding products) are done when asked and reported back
  exactly. (2026-11-03)
- **Replies are plain text** — the app shows short sentences, not markdown; a read-aloud
  button helps people who read slowly. (2026-11-03)
- **The assistant is called Tez** — the owner renamed Munshi to Tez (2026-11-04). Every name
  people see (messages, the system prompt, the store listing) says Tez; code keeps the
  `munshi` identifiers and the `/api/munshi` route so nothing else has to move.
- **Minimal thinking** — measured on the free tier: `gemini-3.5-flash` answers a short
  question in about 1.2 s with `thinkingLevel: minimal` and 3.2 s with `low`, and a question
  that needs a tool takes two or three answers. `GEMINI_THINKING` (default `minimal`) can raise
  it later. Tool calls in one step run in parallel. (2026-11-04)
- **No FreeLLMAPI** — the owner suggested github.com/tashfeenahmed/freellmapi for keys. It holds
  no keys: it is a self-hosted router where you add your own key for each provider's free tier,
  and its own disclaimer says it is for personal experiments, not production. A Play Store app
  stays on one official API it is allowed to use (Gemini). A faster provider such as Groq can be
  added later with the owner's own key. (2026-11-04)
- **Tez can fill a shopper's cart** — `add_to_cart` only accepts products that a search in the
  same turn returned, and the phone adds them to its own cart (the cart lives on the device).
  The shopper still reviews the cart and places the order. (2026-11-04)

## Online dukan

- **A dukan goes online by its own choice, with products to sell** — `update_shop_storefront`
  refuses to go online with no product in stock, so customers never meet an empty dukan. Until
  2026-11-04 nothing in the app could switch a dukan online, which left every new dukan telling
  customers "doesn't take online orders"; Home and Products now show a one-tap Go online card
  while a dukan is offline.
- **The hosted Auth site URL is the live app** — `scripts/hosted-setup.ts` defaulted `SITE_URL`
  to localhost, which sent Google sign-in on phones to "localhost refused to connect". The
  default is now https://tezdukan.vercel.app, with localhost only in the redirect allow-list.
  (2026-11-04)

## Delivery areas and location

- **A dukan is shown only where it delivers** — `private.delivers_to` checks the shopper's
  point against the dukan's pin and `delivery_radius_m` (or `serves_all_city`). Dukandars choose
  1 to 5 km (the spec's mohalla range); admins can set up to 15 km or the whole city. Orders are
  checked again before they are placed. (2026-11-05)
- **The shopper's point lives in a cookie** (`td_loc`), set by the phone from GPS, a saved
  address or an area centre, so server-rendered screens can filter without asking every time.
  Without it, the default saved address with a map point is used; otherwise the app asks before
  showing any dukan. (2026-11-05)
- **Location through Chrome, not delegation** — 0.1.5 added androidbrowserhelper's location
  delegation; on the owner's phone it never returned a position ("Could not find your
  location") while 0.1.4 had worked, so 0.1.6 removes it and Chrome answers the site's location
  requests again. The site also falls back from GPS to the network position. (2026-11-05)
- **Dukandar photos in their own folders** — product photos go to product-images under
  shop/<shop_id>/ (inventory staff), logo and banner to shop-media under shop/<shop_id>/;
  update_shop_profile only accepts paths in the dukan's own folder. Photos are resized to WebP
  on the phone before upload. (2026-11-05)

## Notifications

- **Alerts always reach the phone screen** — the service worker no longer skips the system
  notification when TezDukan is open (owner's call: a dukandar must not miss an order). A
  pg_cron + pg_net job calls `/api/push/flush` every minute (secret in Supabase Vault, set up by
  `hosted:setup` when CRON_SECRET is given); it also keeps the server warm. (2026-11-05)

