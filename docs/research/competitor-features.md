# What the big apps do, and where TezDukan stands

A feature study from public material (store listings, company sites, press) and from how these
apps are commonly used. It is a checklist for our own design; no branding, artwork or copy from
any of them is used. Last updated 11 November 2026.

## Who was studied

| App | What it is | Notable points from public sources |
| --- | --- | --- |
| Bazaar (Pakistan) | Wholesale ordering for kiryana stores, plus the Easy Khata ledger | Order any time, free next-day delivery, discounts and bundles, credit for trusted customers, mobile load and bill payments; Easy Khata does bookkeeping, debt collection and lending. Registration asks for CNIC photos, a shop photo and optional NTN/STRN. |
| Dastgyr, Retailo, Jugnu, Tajir (Pakistan) | Wholesale ordering for retailers | 2,000 to 3,500 products, next-day or 24-hour delivery, phone helpline, buy now pay later after a few months of orders |
| Krave Mart (Pakistan) | Groceries in about 30 minutes | Cash on delivery and online payment, live order tracking, no service fee, flash deals, free delivery above a basket size, open all day |
| Careem groceries / Quik | Dark-store grocery delivery in minutes | Free delivery for subscribers (Careem Plus), 15-minute target |
| Zepto, Blinkit (India) | 10-minute grocery delivery, the reference for the look the owner wants | Dense product grid with ADD on the photo, sizes ("2 options"), ratings, product page with similar products, scheduled slots, a subscription |

"eTokri" as a Pakistani grocery app could not be found in public sources; the name belongs to
an Indian shopping portal. If the owner means another app, its name or a screenshot will do.

## Customer app

| Feature | TezDukan today | Plan |
| --- | --- | --- |
| Saved addresses with a map pin, GPS, search | Done (11 Nov) | Live with Part 1 |
| Only dukans that deliver to the address | Done; the database refuses orders outside the radius | Live with Part 1 |
| Dense product grid, ADD on the photo, price against MRP | Two large cards per row | Part 3: three per row, ADD on the photo |
| Product page: photos, sizes, brand, similar products, sticky Add to cart | A short sheet with one photo | Part 3 |
| Product ratings from real buyers | Dukan ratings only | Part 3: rate items after delivery, stars on cards |
| Search that forgives spelling and understands Roman Urdu ("cheeni", "doodh") | Exact text match only | Part 3: same alias search the dukandar side has, plus recent and popular searches |
| Sort and filter (price, discount, rating, brand) | None | Part 3 |
| Deals, Buy again, categories on home | Done | Part 3: tighter layout, category rails |
| Cart: free-delivery progress, savings, minimum order, instructions | Done | Keep |
| "If an item is not available": replace, call me, or remove | Missing | Planned (checkout) |
| Promo codes / first-order discount | Missing (tables exist) | Planned, needs the owner's offer rules |
| Order tracking with status timeline, call and WhatsApp the dukan | Done | Keep |
| Rider on a live map | Missing (rider app is basic) | Later, with the rider app |
| Report a problem with an order (missing or damaged item, with photo) | Support chat only | Planned |
| Order again | Done | Keep |
| Wishlist / favourites | Missing | Planned |
| Online payment (cards, JazzCash, Easypaisa), wallet, refunds to wallet | Cash on delivery only | Needs merchant accounts from the owner; adapters with a Sandbox first |
| Scheduled delivery slot | Missing | Later; dukans deliver on demand today |
| Referral ("invite a friend") and loyalty points | Missing (points table exists) | Later, needs the owner's budget rules |
| Notifications on the phone for every order step | Done; the every-minute flush still needs the owner's go-ahead | Waiting for "cron laga do" |
| Languages: English, Urdu, Roman Urdu | Done | Keep |
| Assistant (voice and text) that fills the cart | Done (Tez) | Keep improving |

## Dukandar app

| Feature | TezDukan today | Plan |
| --- | --- | --- |
| Register with CNIC front and back, shop photo, optional NTN; approved by the team | Name, phone, area, address only; auto-approved while testing | Part 2 |
| Log in again to the same dukan (phone and password, or Google) | Works for the same account; Google and phone accounts are separate | Part 2: connect Google to an existing account |
| Wholesale catalogue, search with aliases, schemes, pack sizes, margin per item | Done | Keep |
| Cart, minimum order, delivery slots, order tracking | Done | Keep |
| Credit (udhaar) with the distributor, ledger and statements | Done | Keep |
| Returns and claims for short or damaged goods | Tables exist; no screen | Planned |
| Invoice as PDF / share on WhatsApp | Missing | Planned |
| Own online dukan: products with photos, banner, logo, delivery area, go live | Done | Keep |
| Customer orders inbox with accept, pack, send, deliver; map link to the address | Done (map link 11 Nov) | Keep |
| Khata for the dukan's own customers (udhaar book with reminders), the Easy Khata idea | Tables exist; no screen | Planned: high value for dukandars |
| Counter sale (quick bill), stock book, expenses, cash book | Tables exist; reports only | Planned after khata |
| Sales and profit report | Done (Hisab) | Keep |
| Mobile load and bill payments | Missing | Needs a payments partner; not planned yet |

## Distributor and admin

| Feature | TezDukan today | Plan |
| --- | --- | --- |
| Distributor: catalogue, prices, orders, big-order confirmation, chat | Done | Keep |
| Distributor: bookers' beats, riders' trips, warehouse stock | Tables exist; screens are basic | Later |
| Admin: approvals with documents, dukans, distributors, users, orders, switches, audit log | Done except documents | Part 2 adds documents; a separate admin website was asked for |
| Admin: banners and campaigns, catalogue editing, areas | Missing | Planned with the admin website |

## Order of work agreed with the owner

1. Addresses and map (done).
2. Customer storefront redesign with ratings and search (Part 3, moved ahead of Part 2 because
   the owner's main complaint is the look and feel).
3. Registration with documents and approval (Part 2).
4. Opening ad, speed, full test pass and a new Android build (Part 4).
5. Then, in this order unless the owner says otherwise: item-not-available choice at checkout,
   report a problem, wishlist, khata for the dukan's customers, invoices, promo codes.

## Sources

- https://profit.pakistantoday.com.pk/2021/01/19/karachi-based-bazaar-technologies-secures-6-5m-in-seed-funding-to-digitise-mom-and-pop-stores/
- https://pakistan.endeavor.org/profiles/profile-one/
- https://bazaar-tech-com.en.uptodown.com/android
- https://dawn.com/news/1638159/focusing-on-the-average-dukanwala
- https://www.seedstars.com/community/entrepreneurs/programs/international-growth-program-7/dastgyr
- https://apps.apple.com/app/id1607963433 (Retailo)
- https://kr-asia.com/pakistans-jugnu-raises-usd-3-2-million-for-b2b-e-commerce-marketplace
- https://play.google.com/store/apps/details?id=com.krrave.customer (Krave Mart)
- https://www.intelligentcio.com/apac/2026/01/14/indrive-launches-grocery-delivery-with-krave-mart-in-pakistan/
- https://menastartupdigest.com/?p=21414 (Careem Quik and Careem Plus)
- https://www.business-standard.com/companies/news/zepto-pilots-slotted-delivery-feature-in-select-cities-125120400504_1.html
