/**
 * What TezDukan's assistants know about the app. Kept to what the app really does, so Munshi
 * and the support assistant never promise a feature, a fee or a time we do not have.
 */
export const TEZDUKAN_KNOWLEDGE = `
TezDukan is a grocery app for Hyderabad, Sindh (Pakistan). It has three sides:

CUSTOMERS (people at home)
- See dukans (kiryana shops) near them, each with its delivery time, delivery fee, minimum
  order and the amount above which delivery is free. Tabs: Home, Categories, Nearby, Cart, Account.
- Add products to the cart (one bill per dukan) and tap Place order. Payment is cash on delivery.
- Order steps: Placed -> Accepted -> Packed -> On the way -> Delivered. A dukan can also reject
  an order (the customer is told why). Orders are in Account -> Orders, with a notification at
  every step if notifications are on.
- Anyone can open their own dukan or become a distributor from Account -> Become a shopkeeper /
  Become a distributor (name, phone, area, address and location). Registrations are checked by
  the TezDukan team before going live.

DUKANDARS (shopkeepers)
- Tabs: Home, Orders, Products, Khata, Account.
- Home: today's sales, live customer orders with one-tap next steps (Accept, Mark packed,
  Send out, Delivered), low stock, and khata totals.
- Products: add the 16 common products in one tap (priced at MRP, change later), add a product
  by typing or saying its name (TezDukan fills in the photo and details), or add their own
  product by name. Tap any product to change its price, count its stock, or hide it from customers.
- The online dukan must be switched on (Account) to receive customer orders.
- Buy stock (Wholesale): order from distributors at trade price, see the margin, choose a
  delivery slot. Khata shows what the dukan owes each distributor.
- Order alerts: turn on notifications to hear a sound when an order comes in.

DISTRIBUTORS
- Dashboard: today's orders, this month against last month, the order pipeline, best sellers,
  stock running out, dukans that went quiet (with Call and WhatsApp buttons).
- Orders inbox: confirm big or first orders with the dukandar by phone, then pick, pack and
  dispatch. At delivery the rider enters the dukan's delivery code and records cash.
- Catalog: list common products in one tap, set trade price and MRP, hide or show products.

GENERAL
- Sign in with phone number and password (SMS code to verify), or with Google.
- Languages: English, Urdu and Roman Urdu (Account -> Language).
- Munshi is the in-app helper: tap the mic to speak or type a question.
- Android app: download from tezdukan.vercel.app. The TezDukan team answers support chats from
  9 am to 9 pm; the WhatsApp button in support reaches the team too.
- Delete account: Account -> Delete my account, or the page tezdukan.vercel.app/data-deletion.
- Policies: tezdukan.vercel.app/terms, /privacy and /refund-policy.
`.trim();
