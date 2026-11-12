# Changelog

All notable changes, newest first. Dates are Asia/Karachi.

## Unreleased

### Support chat: the AI assistant answers first, the team is one tap away (2026-11-12)

- In the support chat (customers, dukandars and distributors), the TezDukan Assistant answers
  first, in a few seconds, in the language the person wrote in (English, Urdu or Roman Urdu).
  It knows 40 common questions (ordering, payment, delivery, cancelling, missing items, refunds,
  addresses, notifications, registering a dukan with CNIC, going online, products) and the
  person's own latest orders ("your order C-000011 from TezDukan is on the way").
- When it cannot fully help, or the person is upset or asks for a person, it shows "Should I
  connect you with my team?" with Yes and No. Yes hands the chat to the team and notifies every
  admin ("Ayesha wants to talk to the team"); "Talk to the team" is also always at hand.
- While the assistant is answering, the team is not pinged for every message. Once the team has
  the chat (or a team member replies), the assistant stays quiet and the team is told of each
  message. If the AI is busy it says so and asks to try again; twice in a row, the team takes
  over, so nobody waits for an answer that will not come.
- The admin Support inbox marks each chat "Needs team" or "AI answering". AI answers are
  labelled "TezDukan Assistant · AI" in the chat.
- The newest chat message no longer hides behind the message box.
- Privacy policy: Google Gemini also gives the first answer in support chats. Refund policy:
  the customer cancellation rule.

### CNIC documents on every dukan and distributor in the admin dashboard (2026-11-12)

- Dukans and Distributors show a small "CNIC" tag on everyone who sent documents when
  registering, and their detail sheet has "Registration documents": the CNIC number, both sides
  and the shop (or warehouse) photo, whatever the status (waiting, active, paused or rejected).
  Photos open full size; the links expire after 10 minutes. Approvals shows the same view.

### Checkout redesign and cancel from the order's menu (2026-11-12)

- Checkout reads in the order a shopper thinks: where it goes, what is in it, "Did you
  forget?" (a row of the same dukan's everyday items, its own picks first), what to do if
  something is missing, delivery instructions, payment, then the bill and the cancellation
  policy. The bar at the bottom always shows the total ("View bill" jumps to it) and one clear
  next step: Place order, "Add Rs X more", or "Choose address" when there is none.
- Bill details: item total with the printed price struck through, delivery (free struck through
  when waived), To pay, and one savings line that counts the waived delivery too. No hidden fees.
- Cash on delivery asks "Need change?": exact cash, or a note larger than the bill (Rs 500,
  1,000, 5,000). The dukan sees "Bring change for Rs 1,000" with the order.
- Delivery instructions and the shopper's note now show on the order for the dukandar (and the
  shopper); before, they were saved but never shown.
- Cancelling moved into a ⋮ menu on the order (with Help, Report a problem and Call the dukan),
  following the policy shown at checkout: free until the dukan accepts; within 2 minutes after
  it accepts, before packing, with a reason the dukan sees; never once packed or on the way
  (the sheet offers Call the dukan and Ask TezDukan for help instead). The database enforces
  the same rule.
- The dukandar's order page shows the customer's history at the dukan: "8 orders delivered",
  "2 cancelled by them", or "First order from this customer".

### Opening ad, app 0.1.7, and "if something is not available" (2026-11-12)

- Opening ad: when the app opens, TezDukan's own poster fills the screen while the first screen
  loads behind it (shoppers see the shopping poster, dukandars and distributors the wholesale
  one), with Skip, once per session. It is part of the page shell, so it paints at once.
- App 0.1.7: the Android splash is the same poster (English, and Urdu on phones set to Urdu),
  fitted to the screen. Signed with the same key as 0.1.6, so it installs as an update.
- Checkout asks "If something is not available": call me, send something similar, or remove
  it. The dukandar sees the choice on the order and can mark a line "Not available": remove it,
  or send one of the dukan's own products of the same kind at the same price or less. The
  total updates, the delivery fee stays, and the customer is notified and sees "Changed by the
  dukan" on the order. Stock taken on delivery follows what was actually sent.
- Report a problem: on any order that is not cancelled, the customer picks what went wrong
  (missing, damaged or expired, wrong item, late, something else) and sends it. It opens a
  support ticket for the order, appears in the customer's support chat where the TezDukan team
  answers, and alerts the dukan. The order then shows "Problem reported" with a link to the chat.

### Admin dashboard as a website (2026-11-12)

- The admin panel has its own address, tezdukan-admin.vercel.app: it opens straight to an
  admin sign-in (no welcome posters, no shopping) and then to the dashboard.
- It is a web dashboard everywhere: sidebar and top bar on a computer, a menu on a phone
  (the bottom dock is gone).
- Dukans, Distributors and Orders are tables on a wide screen: name, area, status, products,
  orders and sales in 30 days, joined date; orders show number, from → to, items, status,
  total and time. Phones keep the compact rows.

### Dukan and distributor registration with documents (2026-11-12)

- Registering a dukan or distributor is two steps: the business, then the owner's CNIC number,
  photos of both sides of the CNIC and a photo of the shop (or warehouse). Photos are taken
  with the camera, shrunk on the phone and uploaded to a private folder; NTN and STRN are
  optional. Only the TezDukan team can see the documents.
- Every new registration waits for the TezDukan team (auto-approval is off). Approvals in the
  admin panel shows the CNIC number and the three photos (links that expire in 10 minutes).
- "Registration status" page: sent → being checked → ready, the reason when it needs changes
  with "Register again", and "Open my dukan" once approved. Account shows a card while a
  registration is waiting or needs changes.
- Sign-in for businesses: opening "Register your dukan" while signed out explains that an
  existing shopkeeper only needs to sign in (number or Google) to get their dukan back, and
  "Create account" carries on to the registration after the SMS code.
- Alerts for new registrations open the Approvals page (the old link led nowhere).

### The storefront as a showroom (2026-11-12)

- Customer home, redone: the delivery address and time sit in the header, search opens its own
  screen, category tabs stay under it, then aisles to explore, deals, a shelf per category
  with "See all", brands and the dukans nearby.
- Product tiles are three across with the photo first and ADD on its corner; the price is the
  biggest thing on the tile. The same product at several dukans is one tile showing the
  cheapest offer.
- Tapping a product opens it up close: photos, sizes the dukan has, brand, the dukan's terms,
  the other dukans selling it (price and time, each with its own ADD) and similar products.
- Search understands Roman Urdu and spelling mistakes ("doodh", "cheeni", "taapal"), shows
  results while typing and remembers recent searches on the phone.
- Categories are grouped (Grocery & Kitchen, Snacks & Drinks, Home & Personal Care); a
  category page has sort chips (popular, price, discount, top rated) and brand pages.
- Stars on products are real: after a delivered order the customer taps stars for each item;
  the average shows on the product at every dukan that sells it. No stars are shown until
  someone has rated.
- Categories, brands and "Buy again" count only what can be delivered to the customer.

### Tez, redesigned (2026-11-12)

- Tez opens on a greeting by name and three things to ask, each with an icon; the message
  field is a single rounded bar with the mic in it.
- Speaking turns the whole sheet into a listening screen: a breathing orb, a timer, the words
  heard so far, and two big round buttons (Cancel, Done).

### Fixes (2026-11-12)

- Dark mode on iPhone: the white strip under the navigation dock is gone. The page carried two
  browser theme-colour tags and only one followed dark mode; now every one does, also after
  moving between screens.
- Account > Preferences: "Appearance" is no longer cut to a few letters. Light, Dark and Auto
  sit under the label, full width.
- Shoppers who also run a dukan switch role from the avatar menu (the shopping header now
  shows the delivery address where the role chip was).

### Addresses with a map (2026-11-11)

- Customers save up to five delivery addresses (Home, Work, Other) on a map: slide the map
  until the pin is on the door, or tap "Use my current location". The address is read from
  the pin and can be corrected; house or flat and a landmark are optional. Search finds an
  area, road or place. The screen says how many dukans deliver to the pin before saving.
- "My addresses" in Account and the "Deliver to" sheet: pick, edit, delete. The chosen address
  decides which dukans and products are shown.
- An order now goes to a saved address and keeps its pin and landmark; the dukandar gets an
  "Open in Maps" button. The database refuses an order outside the dukan's delivery radius,
  and the cart says so before the customer tries. A dukan page opened from a shared link warns
  when it does not deliver to the customer.
- Dukandars can set their delivery distance up to 6 km (it was 5).
- Maps are OpenStreetMap tiles drawn with Leaflet, addresses come from Nominatim; both sit
  behind settings so another provider can replace them.

### Code graph for Claude (2026-11-06)

- graphify maps the code into a knowledge graph (`graphify-out/`, not committed) that Claude
  queries before searching files: `pnpm graph:install`, then `pnpm graph` to build or refresh.
  The graphify skill (`/graphify`) and a CLAUDE.md section are added; `.graphifyignore` keeps
  generated files, translations and images out. Its Claude Code hooks are not committed yet.

### Photos, dukan profile, app 0.1.6 (2026-11-05)

- Dukandars add product photos from the gallery or camera (tap the photo on a product). Photos
  are shrunk on the phone before upload.
- Dukan profile on Online dukan, like a Daraz store page: banner, logo and "about"; customers
  see them on the dukan page.
- Dukan profile layout: the dukan name sits below the banner (it was hidden behind it) and the
  banner hint no longer runs under the Add banner button.
- Location: GPS first, then the network position when GPS cannot get a fix indoors.
- App 0.1.6: location works again (0.1.5's location delegation is removed; Chrome handles it as
  in 0.1.4), and the light line above the phone's navigation bar is gone.

### Delivery areas, phone alerts, faster open, admin panel (2026-11-05)

- Delivery areas: every dukan has a pin and delivers 1 to 5 km (the TezDukan team can set up to
  15 km or the whole city). Customers choose where to deliver (phone location, a saved address
  or an area) and see only the dukans and products that deliver there; an order outside the
  area is refused. Dukandars set their pin and distance on Online dukan.
- Location: "Use my current location" asks for high accuracy, explains what to do when location
  is off, and offers Hyderabad's areas as a fallback. App 0.1.5 answers location requests with
  the app's own permission, so it works even when Chrome has no location access.
- Order alerts now show as phone notifications even while TezDukan is open. A scheduled job
  sends any waiting alert every minute and keeps the server warm so the app opens faster.
- App 0.1.5: a full-screen TezDukan splash while the app opens.
- Admin panel (website and phone): overview, approvals with the auto-approve switch, dukans
  (pause, start again, delivery area), distributors, users, orders, app switches, audit log.

### Bug fixes, Online dukan, and Tez (2026-11-04)

- Fixed: Google sign-in on phones ended on "localhost refused to connect". The hosted Auth site
  URL had been set to localhost by the setup script; it is now the live app.
- Fixed: a new dukan could never go online, so customers saw "This dukan doesn't take online
  orders yet" even after the dukandar added products. New Online dukan screen (Home -> Online /
  Offline, or Account): the online switch, the dukan's link to share on WhatsApp, delivery time,
  fee, minimum order, free delivery above an amount and a one-line tagline. Home and Products
  show a one-tap Go online card while the dukan is offline.
- Fixed: the header cut the dukan's name to two letters on phones.
- The assistant is now called Tez. It answers about three times faster (minimal thinking, tools
  in parallel) and can do more: the dukandar's hisab for any period, switching the dukan online
  or offline, and for shoppers, putting what they ask for straight into the cart.
- Urdu: the brand is spelled تیز دکان everywhere.
- Product photos: ten more common products have a real photo (Open Food Facts contributors,
  CC BY-SA, credited in Terms). Products without a photo show their category icon and brand
  name instead of two initials.

### Dukan ratings and the dukandar's Hisab (2026-11-04)

- Customers see each dukan's stars from delivered orders ("4.8 (23)", or "New") on dukan cards
  and the dukan page, and the latest comments under "What customers say".
- Hisab for dukandars (Home -> See full hisab): sales, orders, average bill, profit from buying
  prices, customers, each compared with the period before; sales by time of day (3-hour slots)
  or by day, with the busiest time marked; best sellers. Today, yesterday, 7 days or 30 days.
  Staff without report access see a clear message instead.

### Premium customer side (2026-11-04)

- Home: "Deliver to" pill with the chosen address and the fastest delivery time, a live card
  for an order on its way (tap to track), Buy again (what you ordered before, still on the
  shelf) and Deals for you (biggest savings against MRP first).
- Tap any product for a detail sheet: big photo, price against MRP and the saving, the dukan
  that sells it, and ADD or the stepper.
- Checkout: saved addresses (Home, Work, Other, optional current location) with a Change
  sheet; the first typed address is saved with the first order. Delivery instruction chips and
  a note go to the dukan; a Cash on delivery card; a sticky "Place order · Rs ..." bar that no
  longer hides behind the navigation dock.
- After ordering: an "Order placed!" moment, then tracking with the status in one big line,
  the usual delivery time, a five-step bar, Call and WhatsApp the dukan, Cancel while new,
  five-star rating after delivery, and Order again at today's prices.
- Fixed: the Deals row made the whole page scroll sideways on phones.

### Play Store readiness, account deletion, Google sign-in (2026-11-03)

- Delete my account (Account page) and the public page /data-deletion, as Google Play requires.
- Play Store kit in docs/play-store: signed app bundle steps, listing texts in English and Urdu,
  feature graphic, screenshots, Data safety answers and the publishing checklist. The privacy
  policy now covers voice, AI processing, crash reports and Google sign-in.
- Google sign-in is switched on (Supabase provider and the app's button). It starts working
  once the Supabase callback address is added to the Google Cloud OAuth client.
- Fixed: shop staff without khata access (cashier, stock helper) saw an error on Home.

### Munshi answers with AI (2026-11-03)

- Munshi now answers questions and does simple jobs with Google's Gemini (official API, a free
  Google AI Studio key is enough). Dukandars can ask for today's sales and new orders, find a
  product, change its price or stock, add products and open a screen ("Products wala page
  kholo" gives a button). Customers can ask about nearby dukans, products and their orders;
  distributors about today's numbers and pending orders.
- Replies are short plain text in the person's language, with a speaker button that reads them
  aloud. Every change runs with the person's own permissions.
- Google's free tier is often busy, so Munshi tries several Gemini models in turn and says
  "busy, try again in a minute" when all of them are.
- The same key also turns on better voice recognition (Gemini hears Roman Urdu well).

### New posters (2026-11-03)

- New poster designs made from the app's real screens in tilted 3D phones, with floating
  "moment" cards (New order, On the way, Cash on delivery) and one clear action each.
- Posters on the customer home (shop nearby, follow your order, become a shopkeeper), the
  dukandar home (16 common products, stock at trade price) and the distributor dashboard
  (list common products, one order inbox). They swipe on phones, show two at a time on wide
  screens, and move on by themselves unless reduced motion is on.
- The welcome screens use the new posters instead of the old pictures.

### Products for dukandars, common-product packs, better voice, Android 0.1.4 (2026-11-03)

- New Products tab for dukandars (Home, Orders, Products, Khata, Account): search the shelf,
  filter low stock or hidden items, and tap a product to change its price, count its stock or
  hide it from customers.
- Add products three ways: type the name (TezDukan fills in photo and details from its
  catalogue), say it, or add the common-products pack: 16 items most dukans keep, priced at
  MRP with the same opening stock, in one tap. Products not in the catalogue are added by name.
- Distributors get the same one-tap pack on Catalog, with trade prices to check first.
- Munshi and voice search can use a server speech-to-text model (Groq Whisper or Gemini,
  set by env) that hears Urdu far better than the phone; without a key the phone's own
  recognition is used as before.
- Android 0.1.4 never shows an error screen: problems are reported to the server quietly. The
  download link always gives the newest app, and older apps are asked to update.

### Shop dashboard, distributor insights and order alerts (2026-11-03)

- The dukandar's Home is now a live shop dashboard: today's online sales and orders, a 7-day
  trend, the live order queue with one-tap next steps (Accept, Mark packed, Send out,
  Delivered), low stock with a restock button, and khata and stock totals.
- Dukandar tabs are now Home, Orders, Wholesale, Khata and Account. Buying stock from
  distributors moved to Wholesale (`/dukan/wholesale`); the sidebar adds Stock orders.
- Distributor dashboard, full width: this month against last month, average order, the order
  pipeline (Placed to On the way), retailers active this week, new and gone quiet, fill rate,
  best sellers, sales by category, stock running out at the current selling speed, and quiet
  dukans with Call and WhatsApp buttons.
- "Turn on order alerts" card on the dukandar and distributor dashboards and the order pages,
  with clear steps when the phone has blocked notifications.
- Android app 0.1.3 asks for the Android 13+ notification permission, so order alerts arrive
  as phone notifications.
- Admin panel plan in `docs/admin/ADMIN_PLAN.md` (no code yet).

### Customer app, onboarding and the new Account page (2026-11-02)

- Everyone lands on the customer app after sign-in, with five tabs: Home, Categories, Nearby,
  Cart and Account.
  - Home: search, shop by category, dukans near you and popular products.
  - Categories: category chips, search and a product grid with ADD and steppers.
  - Nearby: live dukans with delivery time, fee, minimum order, Call and WhatsApp; each opens
    its own storefront page.
  - Cart: one bill per dukan with a free-delivery progress bar, minimum-order check, savings
    and a delivery address; the order goes to the dukan on WhatsApp.
- Two more demo dukans (Madina Mart, Al-Rehman Kiryana), so the customer app has a choice.
- Account offers Become a shopkeeper and Become a distributor: register from the app with
  name, phone, area, address and location (distributors pick the areas they deliver to). A
  testing flag approves registrations at once; otherwise they wait for an admin.
- Account page redesigned in an Apple-like style: profile header, quick tiles, grouped
  settings (appearance, language, notifications), support and policies, opportunities, and
  sign out.
- Terms and conditions, Privacy policy and Refund policy pages.
- Android app 0.1.1 shows the error on screen after a crash, with Try again and Open in
  browser.

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
