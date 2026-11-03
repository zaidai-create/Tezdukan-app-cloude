# Publishing TezDukan on Google Play

Everything the code can provide is ready. The steps in **Play Console** need the owner's Google
account, so they are listed in order below.

## What is ready

| Item | Where |
| --- | --- |
| App bundle (`.aab`, signed with the upload key) | Built with `./gradlew bundleRelease` in `android/` (0.1.4, versionCode 5). The upload keystore lives outside the repo; keep it safe, every update must be signed with it. |
| App icon 512×512 | `assets/app-icon-512.png` |
| Feature graphic 1024×500 | `assets/feature-graphic-1024x500.png` |
| Phone screenshots 1080×1920 | `assets/phone-screenshot-1.png` … `-6.png` |
| Privacy policy | https://tezdukan.vercel.app/privacy |
| Account deletion (in app and on the web) | Account → Delete my account, and https://tezdukan.vercel.app/data-deletion |
| Promo video | The 32-second vertical promo (upload it to YouTube, then paste the link in the listing) |

## Steps in Play Console

1. **Developer account**: sign up at https://play.google.com/console (one-time USD 25). Use an
   organisation account if TezDukan is a registered business; a personal account must run a
   closed test with at least 12 testers for 14 days before it can publish to everyone.
2. **Create app**: name *TezDukan*, default language English (United States) or Urdu, App,
   Free.
3. **Set up your app** (the checklist on the dashboard):
   - *Privacy policy*: https://tezdukan.vercel.app/privacy
   - *App access*: "All or some functionality is restricted". Give reviewers a demo login:
     phone `0300 0000006` (customer) and `0300 0000002` (dukandar), password
     `TezDukan-Demo-1`. Sign in with "Use phone number and password".
   - *Ads*: No ads.
   - *Content rating*: fill the questionnaire (category *Utility, productivity, communication
     or other*). Answer Yes to "users can interact or exchange content" (order chat and support
     chat) and No to violence, sexuality, gambling and the rest. Expect *Everyone / 3+*.
   - *Target audience*: 18 and over.
   - *News app*: No. *Government app*: No. *Financial features*: None (khata is a record of
     credit between a shop and its supplier, the app does not lend money).
   - *Data safety*: use the answers below.
   - *Data deletion*: https://tezdukan.vercel.app/data-deletion
4. **Store listing**: paste the texts below, upload the icon, feature graphic and screenshots.
   Category *Shopping*. Contact email and the support WhatsApp number.
5. **Release**: Testing → Internal testing (or Closed testing) → Create release → upload the
   `.aab` → add release notes → roll out. Then Production when testing is done.
6. **After the first upload (important)**: Play re-signs the app with its own key. Open
   *Test and release → App integrity → App signing*, copy the **SHA-256 certificate
   fingerprint** of the *App signing key*, and add it to `public/.well-known/assetlinks.json`
   next to the upload key's fingerprint, then deploy. Without it the Play version opens with a
   browser address bar instead of full screen.

## Store listing (English)

**App name** (30 max): TezDukan: Mohalla Grocery

**Short description** (80 max):
Order from dukans near you. Dukandars: online orders, products, khata in one app.

**Full description**:

TezDukan brings your mohalla's kiryana dukans to your phone, and gives every dukandar a
simple shop app.

For customers
• See dukans near you with delivery time, delivery fee and minimum order
• Browse by category, search in English, Roman Urdu or Urdu
• One bill per dukan, pay cash at the door
• Follow your order: accepted, packed, on the way, delivered

For dukandars
• Your dukan online in minutes: add 16 common products in one tap, or add by typing or speaking
• Orders arrive with a sound and a notification; accept, pack and send out in one tap
• Change prices and count stock from your phone
• Buy stock from distributors at trade price and keep your khata in one place
• Munshi, the voice helper: "Aaj ki sale kitni hui?", "Tapal ka rate 1250 kar do"

For distributors
• Orders from every dukan in one inbox, with confirmation calls for big orders
• Dashboard with this month's sales, best sellers, stock running out and quiet dukans
• List common products in one tap and set trade prices

Made for Hyderabad, in English, Urdu and Roman Urdu.

## Store listing (Urdu)

**Short description**: قریبی دکانوں سے آرڈر کریں۔ دکانداروں کے لیے آن لائن آرڈر، پروڈکٹس اور کھاتہ ایک ایپ میں۔

**Full description**:

ٹیز دکان آپ کے محلے کی کریانہ دکانیں آپ کے فون پر لاتا ہے، اور ہر دکاندار کو ایک آسان دکان ایپ دیتا ہے۔

گاہکوں کے لیے
• قریبی دکانیں، ڈیلیوری کا وقت، ڈیلیوری فیس اور کم از کم آرڈر کے ساتھ
• کیٹیگری سے دیکھیں، انگریزی، رومن اردو یا اردو میں تلاش کریں
• ہر دکان کا ایک بل، ادائیگی دروازے پر نقد
• آرڈر کی ہر خبر: قبول، پیک، راستے میں، ڈیلیور

دکانداروں کے لیے
• چند منٹ میں دکان آن لائن: 16 عام پروڈکٹس ایک ٹیپ میں، یا لکھ کر یا بول کر شامل کریں
• نیا آرڈر آواز اور نوٹیفکیشن کے ساتھ، ایک ٹیپ میں قبول، پیک اور روانہ
• فون سے قیمت بدلیں اور اسٹاک گنیں
• ڈسٹری بیوٹرز سے ٹریڈ قیمت پر مال خریدیں اور کھاتہ ایک جگہ رکھیں
• منشی، بول کر کام کرنے والا مددگار

ڈسٹری بیوٹرز کے لیے
• ہر دکان کا آرڈر ایک ان باکس میں
• اس مہینے کی سیل، سب سے زیادہ بکنے والی چیزیں اور ختم ہوتا اسٹاک
• عام پروڈکٹس ایک ٹیپ میں لسٹ کریں

## Data safety answers

Data is encrypted in transit (HTTPS). Users can request deletion (link above). No data is sold
or shared with third parties for their own use; Supabase (database), Vercel (hosting) and
Google Gemini (Munshi and voice) are service providers.

| Data type | Collected | Shared | Why | Optional |
| --- | --- | --- | --- | --- |
| Name | Yes | No | Account management, app functionality | No |
| Phone number | Yes | No | Account management, app functionality | No |
| Email address | Only with Google sign-in | No | Account management | Yes |
| Approximate and precise location | Yes (shop and delivery address) | No | App functionality (nearby dukans, delivery) | Yes |
| Purchase history | Yes (orders) | No | App functionality | No |
| In-app messages | Yes (order and support chat) | No | App functionality, customer support | Yes |
| Voice recordings | Yes, only when the mic is used; processed to text and not stored | No | App functionality (Munshi) | Yes |
| Photos | Only product and shop photos the user uploads | No | App functionality | Yes |
| App interactions | Yes | No | Analytics, app functionality | No |
| Crash logs and diagnostics | Yes (Android crash reports) | No | App functionality, analytics | No |
| Device or other IDs | Yes (push notification token) | No | App functionality (order alerts) | Yes |

## Release notes for 0.1.4

- Products tab for dukandars: add common products in one tap, change prices and stock
- Munshi answers by voice or text
- Order alerts as phone notifications
- New design and posters
