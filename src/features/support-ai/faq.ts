/**
 * The questions people ask TezDukan support most, with the answers the team would give. The
 * support assistant answers from these (and the person's own recent orders) and nothing else,
 * so it never promises a refund, a fee or a feature we do not have. Keep them true to the app:
 * when a screen or a rule changes, change the answer here too.
 */
export type Faq = { q: string; a: string };

export const SUPPORT_FAQ: readonly Faq[] = [
  // Ordering
  {
    q: "How do I place an order?",
    a: "Pick a dukan on Home or Nearby, add items, open Cart, check the delivery address and tap Place order. You pay cash when it arrives.",
  },
  {
    q: "How do I pay? Can I pay online?",
    a: "For now it is cash on delivery only. At checkout, under Need change?, pick the note you will pay with (Rs 500, 1,000 or 5,000) and the rider brings change.",
  },
  {
    q: "Where is my order? How do I track it?",
    a: "Open Account > Orders (or the live order card on Home). It shows each step: Placed, Accepted, Packed, On the way, Delivered. You get a notification at each step if notifications are on.",
  },
  {
    q: "My order is late.",
    a: "Each dukan shows its usual delivery time. You can call or WhatsApp the dukan from the order page. If it is very late, use Report a problem > Late delivery on the order and the team follows up.",
  },
  {
    q: "How long does delivery take?",
    a: "Each dukan sets its own delivery time, shown on its card and in the cart (for example, about 30 minutes).",
  },
  {
    q: "What is the delivery fee?",
    a: "Each dukan sets its own delivery fee and the amount above which delivery is free. The cart shows the exact fee and how much more to add for free delivery. There are no other hidden charges.",
  },
  {
    q: "Why can't I place my order? It says add more.",
    a: "Each dukan has a minimum order. The cart shows how much more to add; then Place order works.",
  },
  {
    q: "How do I cancel my order?",
    a: "Open the order and tap the three dots at the top, then Cancel order. It is free until the dukan accepts it. After it is accepted you have 2 minutes, before packing, and you choose a reason. Once packed it cannot be cancelled; call the dukan instead.",
  },
  {
    q: "Why can't I cancel my order?",
    a: "Once the dukan has packed it or sent it, or 2 minutes after the dukan accepted it, the order can no longer be cancelled from the app, because the dukan has already done the work. Call the dukan from the order page.",
  },
  {
    q: "The dukan rejected my order. Why?",
    a: "A dukan can turn down an order (for example, items ran out or it is closing). The reason is shown on the order and you pay nothing. You can order from another dukan nearby.",
  },
  {
    q: "What happens if an item is out of stock?",
    a: "At checkout you choose: Call me, Send similar (same kind, same price or less) or Remove it. The dukan follows your choice; any change shows on the order as Changed by the dukan and the total updates.",
  },
  {
    q: "An item was missing, damaged, expired or wrong.",
    a: "Open the order and tap Report a problem, pick what went wrong and send. It reaches the TezDukan team and the dukan. Please report within 48 hours of delivery; a photo helps.",
  },
  {
    q: "I want a refund.",
    a: "Report it on the order with Report a problem. The team checks each claim with the dukan. Since payment is cash on delivery, there is usually nothing to refund for an order that was cancelled or rejected.",
  },
  {
    q: "The bill is different from what I expected.",
    a: "The order page shows every item, the delivery fee and the total. If the dukan removed or replaced an item, it shows as Changed by the dukan. If something still looks wrong, use Report a problem on the order.",
  },
  {
    q: "How do I add or change my delivery address?",
    a: "In the Cart tap Change next to the address, or go to Account > My addresses. Place the pin on the map at your door so the rider finds you.",
  },
  {
    q: "No dukan delivers to my area. / I can't see any dukans.",
    a: "Each dukan delivers only within its own area. Check that the map pin is at your exact location (tap the address at the top of Home). If none are near you yet, we are adding more dukans across Hyderabad.",
  },
  {
    q: "How do I contact the dukan?",
    a: "Open the order: the Call dukan and WhatsApp buttons reach the dukan directly.",
  },
  {
    q: "How do I give delivery instructions?",
    a: "At checkout, tap Call when you arrive, Ring the bell, Leave at the door or Don't ring the bell, and add a short note. The dukan sees it with the order.",
  },
  {
    q: "How do I order the same things again?",
    a: "Open a past order and tap Order again. Items the dukan still has go into your cart at today's prices.",
  },
  {
    q: "How do I rate an order?",
    a: "After delivery, open the order and give stars to the order and to each item. Ratings help other shoppers pick good dukans.",
  },
  {
    q: "Are prices the same as in the shop?",
    a: "Each dukan sets its own prices, often below the printed price (MRP). The cart shows the MRP struck through and how much you save.",
  },
  // App and account
  {
    q: "I am not getting notifications.",
    a: "Tap Turn on order alerts when the app asks, and allow notifications for TezDukan in your phone's settings. On Android, also turn off battery saver for TezDukan.",
  },
  {
    q: "Is there an app? How do I download it?",
    a: "The Android app downloads from tezdukan.vercel.app. On iPhone, open tezdukan.vercel.app in Safari and choose Add to Home Screen.",
  },
  {
    q: "How do I change the language?",
    a: "Account > Language: English, Urdu or Roman Urdu.",
  },
  {
    q: "I forgot my password.",
    a: "On the sign-in screen tap Forgot password? If the code does not arrive, the TezDukan team can reset it for you.",
  },
  {
    q: "How do I delete my account?",
    a: "Account > Delete my account, or the page tezdukan.vercel.app/data-deletion.",
  },
  {
    q: "What is Tez?",
    a: "Tez is the in-app helper: tap the mic and speak, or type. It can find products, answer questions about your orders and, for dukandars, change prices and stock.",
  },
  {
    q: "When is support available?",
    a: "The TezDukan team answers from 9 am to 9 pm, usually within 15 minutes. The WhatsApp button at the top of this chat reaches the team too.",
  },
  // Dukandars and distributors
  {
    q: "How do I open my dukan on TezDukan?",
    a: "Account > Become a shopkeeper. Step 1: your dukan's details and location. Step 2: your CNIC number, photos of both sides of your CNIC and a photo of your shop (NTN and STRN are optional). The TezDukan team checks it, and you get a notification when it is approved.",
  },
  {
    q: "How long does approval take? What is my registration status?",
    a: "The team checks every registration by hand. Your status shows in Account (Registration being checked) and you get a notification as soon as it is decided.",
  },
  {
    q: "Why do you need my CNIC? Is it safe?",
    a: "The CNIC and shop photo confirm that a real person runs the dukan, which keeps customers safe. The photos are stored privately; only the TezDukan team can see them.",
  },
  {
    q: "How do I become a distributor?",
    a: "Account > Become a distributor: your business details, your CNIC (both sides) and a photo of your warehouse or office. The team checks it before you go live.",
  },
  {
    q: "How do I start taking online orders?",
    a: "On Home tap the Online/Offline button, or Account > Online dukan. You need at least one product in stock. There you also set delivery time, delivery fee, minimum order and free delivery above an amount.",
  },
  {
    q: "How do I add products or change prices and stock?",
    a: "Products tab: add the common products in one tap, or add one by typing or saying its name. Tap any product to change its price, count its stock or hide it.",
  },
  {
    q: "How do I accept and deliver customer orders?",
    a: "Orders tab (or Home): Accept, Mark packed, Send for delivery, Mark delivered. Reject with a reason if you cannot take it. Turn on order alerts to hear a sound for each new order.",
  },
  {
    q: "An item in a customer's order is not on my shelf.",
    a: "Open the order and tap Not available next to the item: remove it, or send one of your own products of the same kind at the same price or less, as the customer allowed. The total updates and the customer is told.",
  },
  {
    q: "A customer cancelled after I accepted.",
    a: "Customers can cancel only within 2 minutes of your accepting, before packing, and must give a reason, which you see in the notification. Your order page also shows each customer's delivered and cancelled orders with you.",
  },
  {
    q: "How do I change my delivery area?",
    a: "Account > Online dukan: place your dukan's pin on the map and choose how far you deliver.",
  },
  {
    q: "How do I buy stock from distributors?",
    a: "Wholesale tab: order from distributors at trade price, see your margin and pick a delivery slot. Khata shows what you owe each distributor.",
  },
  {
    q: "Where do I see my sales and profit?",
    a: "Home > See full hisab: sales, orders, average bill, profit, busiest time and best sellers for today, yesterday, 7 or 30 days.",
  },
];

export function faqText(): string {
  return SUPPORT_FAQ.map((item, index) => `${index + 1}. Q: ${item.q}\n   A: ${item.a}`).join("\n");
}
