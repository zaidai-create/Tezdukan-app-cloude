# Qayam Traders ERP: Master Plan (Phase 0)

> Status: **Phase 0 complete. Waiting for your approval** before Phase 1 code starts.
> Is phase mein yeh hua: purane project ki har file padhi, aapke real data ka health-check kiya, backend ka faisla kiya, AI aur WhatsApp automation ka design kiya, aur **Dashboard + New Bill ka working design** banaya (`design/dashboard.html`).

---

## 0. Ek nazar mein (summary)

| Sawal | Jawab |
|---|---|
| Best backend? | **PostgreSQL (Supabase)**. Hisaab-kitaab ki saari "pakki" logic database ke andar Postgres functions mein chalegi. Saath mein ek chhota **Node.js gateway** hoga, static-IP server par, FBR aur WhatsApp ke liye. |
| Web-based? | Haan. **React + TypeScript** web app (Vercel par), jo PC, tablet aur phone teeno par chale. Salesmen ke liye phone par "install" bhi ho sakti hai (PWA). |
| AI ko "train" karna? | Model ko train/fine-tune **nahi** karna. AI aapke live database se **safe tools** ke zariye seedha parhega. Is tarah har jawab aaj ke sahi numbers par hoga, purani training par nahi. Section 7 dekhein. |
| WhatsApp par bill/voice bhejo, software khud entry kare? | **Haan, ho sakta hai**, official WhatsApp Business Cloud API se. Voice note, bill ki photo ya text se AI **draft entry** banata hai, aap "Confirm" dabate hain, phir woh books mein jaati hai. Section 8 dekhein. |
| Design? | Dashboard aur New Bill ka interactive design tayyar hai: animations, dark mode, mobile layout, aur teen roles (Admin / Accountant / Salesman). |
| Pehle kya chahiye? | Section 12 ke sawalon ke jawab, aur **GitHub repo private karni hai** (abhi public hai). |

---

## 1. Purane project ka inventory (jo maine padha)

Files: `index.html` (81 KB, poori app ek file mein), `boot.js` (Supabase login + team + CSV import), `billing.js` (New Bill screen), `shim.js` (key-value DB adapter), `config.js`, `api/users.js` (Vercel function: add/reset/remove user), `supabase/schema.sql` (profiles + kv table + RLS), `supabase/security-test.sql`, `qayam-data.json` (aapka asli data).

### 1.1 Screens aur menus (Admin / Accountant)

| Menu | Screens / features |
|---|---|
| Dashboard | Hero banner + quick actions (New invoice, New bill, Receive payment, Issue cheque); 4 count cards; 8 KPI tiles (sales this month, gross profit, net profit, receivable, payable, cash+bank, stock value, margin); 3D bar chart (sales vs cost, 6 months); category donut; statistics table; pending tasks; top 5 products; latest invoices; bank & cash balances; cheque register |
| Products | Products & Stock (list, new product, stock adjustment with reason), Reorder List (+ "create bill from list"), Product Profit |
| Sales | **New Bill** (customer search, product search, last rate per customer, live totals, discount, tax %, received now: Full/Half/None, Save / Save & print / Draft), Sales Invoices (list, confirm draft, print), Customers, Party Statement, Sales Returns (credit note, back-in-stock or write-off) |
| Purchases | Purchase Bills (new bill with batch + expiry, weighted-average cost), Vendors |
| Accounts | Bank Payment / Bank Receipt / Cash Payment / Cash Receipt / Journal vouchers, Expenses, Bank Accounts, Bank Cheques (issue, clear, cancel), Cancelled Cheques, Chart of Accounts (tree: category > group > account, new account with auto code), Company & Tax Settings (name, address, phone, NTN, STRN, default tax %, invoice footer) |
| Reports | Trial Balance, Profit & Loss, Balance Sheet, Cash Flow (6 months), General Ledger, Receivables Ageing (0-30/31-60/61+), Stock Valuation, Expiry Report, Day Book, Customer Sales, Sales Tax Summary |
| Worker Orders | Admin/accountant approve or reject salesman orders (approve becomes an invoice) |
| Backup & Security | Storage status, last/next backup (every 10 days), Back up now, Download JSON, restore list, Start fresh, Load demo, Team access (add person, reset password, remove), Change my password, Restore from file |
| Import Data | CSV import for customers / vendors / products with downloadable templates; opening balances and opening stock auto-posted |
| Global | Ctrl+K page search, Quick create menu, Light/Dark toggle, alert pills (low stock, expiring 30 days, drafts, overdue), search + Export CSV on every list, print, 3D tilt cards, login screen (ID + password, show/hide, caps-lock warning, shake on wrong password) |

**Worker (salesman):** Home, New Order, My Orders, Products (no cost), Customers (name + city only).

### 1.2 Data fields (old format)

- Product: `id, name, cat, unit, cost, price, stock, batch, exp, min`
- Customer / Vendor: `id, name, city, phone, ntn, limit, ac` (old account code)
- Sale invoice: `no, date, c, l[{p,q,pr}], dc (discount), tx (tax %), st, paid, cogs, pm, h (historical), note`
- Purchase bill: `no, date, v, l[{p,q,c}], paid, h`
- Voucher / journal: `no, date, type, dr, cr, amt, note, pa (party C# / V#), rs`
- Cheque: `no, date, bk, v, amt, st`
- Settings: `name, addr, phone, ntn, strn, tax, foot`
- Chart of accounts: `[code, title, A/B/C/D/E, group]`

### 1.3 Purane system ki kamzoriyan (jo naye mein theek hongi)

1. **Poora database browser mein download hota hai** (`kv` table mein JSON ke tukde). Isi wajah se login ke baad 5-7 second lagte hain, aur data barhne ke saath yeh aur slow hoga.
2. **Posting browser mein hoti hai.** Stock minus karna, ledger entry, invoice number, sab JavaScript mein. Do log ek saath bill banayein to number takra sakte hain (`SI-(1001+count)`), aur internet beech mein toot jaye to aadhi entry reh sakti hai.
3. Voucher sirf **ek debit / ek credit** line ka hai. Multi-line JV nahi ban sakta.
4. Stock har product ka **ek number** hai: na batch-wise, na location-wise (cold store / van), na FEFO.
5. Debit = Credit ka rule database enforce nahi karta. Audit log bhi nahi hai.
6. Tax sirf ek "%" hai. FBR ki sale types, further tax, 3rd Schedule kuch nahi hai.

---

## 2. Aapke real data ka health-check (`qayam-data.json`)

| Cheez | Nateeja |
|---|---|
| Size | 17 products, 38 customers, 5 vendors, 48 accounts, 285 sale invoices, 127 purchase bills, **1,386 ledger entries** (11 May 2025 se 15 Oct 2026 tak) |
| Trial balance | **Balance hai: Debit = Credit, farq 0.00.** Migration ke liye achhi buniyad. |
| Customer balances | Har receivable entry par party tag hai. Customers ka total = ledger 1200 = **Rs 25,66,892**. Bilkul match. |
| Customer dependency | **Hyderabad Bakers** = all-time sales ka 81% (Rs 2.63 crore / 3.23 crore) aur receivables ka 76% (Rs 19.6 lakh). Yeh business ka sabse bara risk hai. |
| Stock vs ledger | Product list ke hisaab se stock Rs 7.79 lakh ka hai, ledger (1300) Rs 5.21 lakh kehta hai. **Rs 2.58 lakh ka farq.** Physical count se settle hoga. |
| Negative stock | BUTTER BLEND: stock **-1** |
| Bina price ke products | DD MAYONNAISE, BIG PENNE PASTA, BIG ELBOW MACARONI: sale price 0 |
| Cost se kam price | REAL MAYONNAISE: price 3,000, cost 3,114.25 |
| Units | Sab products "pc" hain, jabke naam mein "1 CRTN = 4 POUCH (4 KG)", "1 CRTN = 30 PES" likha hai. **Carton ↔ piece ↔ kg conversion** banana zaroori hai. NURPUR BUTTER 200GM ki cost 15,000 shayad carton ki hai. |
| FBR readiness | NTN: 0/38 customers. HS code: 0/17 products. Mobile number: sirf 7 customers ke (kuch "1234" jaise fake). Area/city: 26/38. |
| Batch / expiry | Track nahi ho raha (sab "-" / 2028-12-31 placeholder). Reorder level sab 0. |
| Freshness | Aakhri entry **15 Oct 2026**, yaani 17 din purani. |

Yeh saari cheezein dashboard design mein **khud-ba-khud alerts aur insights** ki shakal mein nazar aati hain.

> **Privacy:** chart of accounts mein bank account numbers aur partners ke naam hain. Is liye maine `qayam-data.json` **repo mein commit nahi kiya** (repo public hai).

---

## 3. Backend: POS software mein kya use hota hai, aur aapke liye best kya hai

### 3.1 Aam taur par POS/ERP kis par bante hain

| Qisam | Typical backend | Kahan milta hai | Achha | Masla |
|---|---|---|---|---|
| Desktop POS (purana style) | C# / .NET + **SQL Server**, ya VB / Delphi + MS Access | Pakistan ki zyada-tar dukaan/distribution software | Offline chalta hai, tez | Ek hi PC par data, remote access mushkil, backup ka masla, mobile salesmen ke liye nahi |
| Web POS (PHP) | **Laravel + MySQL** | Bahut se local web ERPs | Sasta hosting, developers aam | Accounting rules (constraints, row security) app code par chhor dete hain |
| Web POS (JavaScript) | Node.js + **PostgreSQL** ya MongoDB | Modern SaaS POS | Fast, real-time | MongoDB accounting ke liye kamzor hai (joins/transactions/constraints) |
| Open-source ERP | **Odoo** (Python + PostgreSQL) | Bari companies | Bahut features | Bhaari, customize karna mehnga, FBR module alag |
| Backend-as-a-Service | **Supabase** (PostgreSQL), Firebase (NoSQL) | Naye startups | Login, database, storage, backups ready | Firebase NoSQL hai, double-entry accounting ke liye theek nahi |

### 3.2 Faisla: **Supabase (PostgreSQL) + Postgres functions + chhota Node gateway**

Kyun:

1. **Accounting ko relational database chahiye.** PostgreSQL mein paisa `numeric(14,2)` mein store hoga (float ki paisa-galti nahi), aur **"Debit = Credit" database khud check karega** (constraint trigger). Ghalat entry save hi nahi hogi.
2. **Ek bill = ek transaction.** `post_sales_invoice(id)` function stock minus, ledger entry, invoice number aur status sab ek saath karega. Ya to sab hoga, ya kuch nahi. Internet toot jaye to aadhi entry nahi bachegi.
3. **Row Level Security (RLS):** salesman ko cost/profit/bank **database level par** nahi milega. Sirf screen par chhupana kaafi nahi hota.
4. Aap pehle se Supabase + Vercel use kar rahe hain, to login, users aur deploy ka tareeqa wahi rahega.
5. Login, file storage (bill photos, logo, backups), realtime updates aur scheduled jobs (pg_cron: 10-day backup, reminders) sab ek jagah milte hain.
6. **Static IP** wali zaroorat (FBR IP whitelist + WhatsApp webhooks) ek sasti VPS par Node service se poori hogi.

Region: Pakistan ke qareeb **Mumbai (ap-south-1)** ya Singapore. Speed ke liye Mumbai behtar rahega.

**Offline:** salesman ka internet kamzor ho to app order **phone par save** karegi aur network aate hi sync karegi. Final bill/FBR ke liye internet zaroori hai, kyunki FBR online system hai.

---

## 4. Architecture

```
                    ┌──────────────────────────────────────────────┐
  PC / Phone ──────►│  Web app: React + TypeScript (Vercel)        │
  (Admin,           │  Dashboard · New Bill · Masters · Reports    │
   Accountant,      └───────────────┬──────────────────────────────┘
   Salesman)                        │ Supabase Auth (JWT)
                                    ▼
                    ┌──────────────────────────────────────────────┐
                    │  Supabase: PostgreSQL + RLS + Storage        │
                    │  · posting functions (stock+ledger+number)   │
                    │  · debit = credit constraint                 │
                    │  · audit_log, backups, pg_cron jobs          │
                    └───────▲───────────────────────▲──────────────┘
                            │ service key           │ (same RLS as the user)
                    ┌───────┴───────────────────────┴──────────────┐
                    │  Gateway VPS (static IP, Docker + Caddy)      │
                    │  1) fbr-gateway  → PRAL / FBR DI API          │
                    │  2) assistant    → WhatsApp Cloud API webhook │
                    │                    + speech-to-text + Claude  │
                    └───────┬───────────────────────┬──────────────┘
                            ▼                       ▼
                 gw.fbr.gov.pk (PRAL)     WhatsApp (Meta) · AI APIs
```

### 4.1 Frontend stack
- React 18 + TypeScript + Vite + Tailwind CSS
- TanStack Query: data caching, so the dashboard opens fast (target ≤ 1.5 s)
- Framer Motion (animations), Lucide icons (no emojis)
- Charts: the custom SVG charts from the design (light, accessible, animated)
- PWA: installable on phones, with an offline order queue

### 4.2 Database (core tables)
`company_settings, profiles, permissions, accounts, journal_entries, journal_lines, vouchers, parties, routes, salesmen, warehouses, products, product_units, batches, stock_movements, price_lists, schemes, sales_orders, sales_invoices, sales_invoice_items, sales_returns, receipts, receipt_allocations, purchase_orders, goods_received, purchase_invoices, purchase_returns, claims, payments, bank_accounts, cheques, expenses, tax_rates, fbr_settings, fbr_submissions, fbr_ref_*, audit_log, backup_log`. AI/WhatsApp ke liye bhi: `wa_contacts, wa_messages, ai_actions` (har AI action ka record, original audio/text ke saath).

---

## 5. UI/UX design (tayyar hai)

**File:** `design/dashboard.html`. Browser mein kholein. Repo wali copy mein **demo data (fictional)** hai. Sidebar mein **"Load my qayam-data.json"** dabayein aur apni file chunein: aapke asli numbers dikh jayenge, aur file aapke computer se bahar nahi jaati.

### 5.1 Design ke usool
- **Pehchaan wahi rakhi:** blue-teal gradient, navy sidebar, Source Sans 3 font, hero banner, 3D tilt cards. Look ko modern kiya hai.
- **Kam clicks:** New Bill har jagah se ek button ya **F2** se khulta hai. Ctrl+K se kuch bhi dhoondein (customer, product, page).
- **Role ke hisaab se screen:** Admin profit dekhta hai. Accountant ko profit nahi dikhta, expenses dikhte hain. Salesman ko sirf apna route, stock (qty) aur apne bills.
- **Numbers lakh/crore mein** (Rs 25.7 lakh, Rs 1.11 crore). Hover karein to poora amount.
- **Har chart ka table view** bhi hai, aur keyboard se bhi chalta hai.
- **Mobile-first salesman flow:** neeche tab bar, beech mein bara "+" New Bill button, bill screen par neeche sticky Total + Save.

### 5.2 Dashboard mein kya hai
1. Hero: salaam, period ka khulasa, "books purani hain" ki warning, quick actions
2. Date filter: Today, Yesterday, 7/30 days, This month, Last month, 3 months, This FY (Jul-Jun), Last FY, 12 months, All time, ya custom range
3. KPI tiles (count-up animation + sparkline + pichle period se % farq): Sales, Gross profit (admin), Recovery, Customers owe you, You owe vendors / Advance, Cash & bank
4. Sales vs Purchases chart (hover crosshair; adhoora mahina dashed line mein)
5. "What needs attention": aapke data se nikle insights
6. Receivables ageing (0-30 / 31-60 / 61-90 / 90+) + top 5 baqi-daar
7. Top customers, Top products
8. To-do & alerts: negative stock, bina price, cost se kam price, 60+ din purane baqi, reorder level
9. Cash & bank balances
10. FBR Digital Invoicing: setup checklist + readiness meters
11. Latest bills table (payment status + FBR column)

### 5.3 New Bill flow (sabse zyada use hone wali screen)
Customer type karein (balance aur aakhri bill nazar aata hai) → **Enter**. Product type karein → **Enter** (us customer ka **pichla rate** khud aa jata hai). Qty type → **Enter** wapas product search par. "Usually buys" chips se ek click mein add karein. Stock se zyada qty ya cost se kam rate par warning milti hai. Sales tax / further tax ka breakdown, payment (Cash / Credit / Partial / Bank / Cheque), customer balance "pehle → baad mein". **Ctrl+Enter** se save + print. Save hone par animated tick, 80 mm receipt preview, FBR status, WhatsApp share.

> Note: brief mein likha tha "look 100% wahi rakhein, 3D charts bhi". Aapke naye message ("modern trending animations") ki wajah se maine brand wahi rakha lekin charts saaf aur parhne mein aasan banaye. Agar purane 3D bar/donut wapas chahiye to bata dein, wohi rakh dunga.

---

## 6. API integrations (list)

| Integration | Kis liye | Kahan chalegi |
|---|---|---|
| **FBR / PRAL Digital Invoicing** | Har sale real-time FBR ko, invoice number + QR | fbr-gateway (static IP) |
| FBR reference data | HS codes, UOM, sale types → rates, SRO, provinces (daily cache) | fbr-gateway |
| FBR STATL / Get_Reg_Type | Customer registered hai ya nahi | fbr-gateway |
| **WhatsApp Business Cloud API** | Bill PDF bhejna, reminders, AI bot | assistant service |
| **Claude API (Anthropic)** | AI samajh: entries, sawal-jawab, bill photo parhna | assistant service |
| Speech-to-text (Urdu) | Voice note → text | assistant service |
| Bank statement CSV | Bank reconciliation | web app import |
| Supabase Storage | Logo, bill photos, backups | database |

---

## 7. AI: "data ke saath train karna" asal mein kaise hoga

**Fine-tuning (model ko dobara train karna) ki zaroorat nahi, aur yeh ghalat tareeqa bhi hai.** Train kiya hua model aaj ka balance nahi jaanta, kal ki entry ke baad purana ho jata hai, aur numbers "andaaze" se bata sakta hai.

**Sahi tareeqa: AI ko tools dena.** AI ke paas chand mehfooz functions hote hain, maslan `customer_balance(name)`, `sales_summary(from, to)`, `stock_of(product)`, `draft_sale(...)`, `draft_receipt(...)`. AI har jawab ke liye **live database** se parhta hai, aur usi user ki permissions (RLS) ke saath. Salesman ka AI bhi profit nahi dekh sakta.

**Kaunsa AI:** Claude (Anthropic). Default **Claude Opus 5.5** (`claude-opus-5-5`), jo Urdu/English mix samajhne aur theek tool chunne mein sabse mazboot hai. Kharcha kam rakhna ho to aap **Sonnet 5.5** ya bahut sasta **Haiku 5.5** chun sakte hain; yeh aapka faisla hoga. API prices (per 1M tokens, input / output): Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50. Andaaza: ek WhatsApp sawal ~3,000 input + ~300 output tokens. Opus par ~$0.018 (taqreeban Rs 5) per message, Haiku par is ka ek chhota hissa. Prompt caching se aur kam hoga.

**In-app AI features (Phase 8):**
1. **Poochho, jawab lo** (Urdu/English): "Is mahine Grill Town se kitni recovery hui?", "Kaunsa product sab se zyada munafa de raha hai?"
2. **Rozana khulasa** raat 9 baje: sales, recovery, cash, kis se paisa lena hai, kya khatam ho raha hai
3. **Ajeeb entries pakarna:** cost se kam rate, achanak bara discount, double entry, negative stock, ek din mein ek customer ke do bill
4. **Purchase bill ki photo → draft purchase invoice** (vendor, products, qty, rate, batch, expiry khud bhar jayein, aap check karke confirm karein)
5. **Reorder suggestion:** pichli bikri ki raftaar se kitna mangwana hai
6. **FBR error ko aasan Urdu mein samjhana** + fix ka button
7. **Recovery plan:** kis customer ke paas pehle jana hai (purana baqi + amount)

---

## 8. WhatsApp automation: kya mumkin hai, kaise hoga

### 8.1 Seedha jawab
**Haan.** Ek **naya number** (nayi SIM) AI ke liye allot karein. Aap aur aapke staff us number par:
- **Voice note** bhejein: *"Hyderabad Bakers ko 50 kilo butter premium 1330 ke rate se diya, 30 hazar cash mila"*
- **Bill ki photo** bhejein (supplier ka purchase bill, cash memo, bank slip)
- **Text** likhein: *"Saim Ali ka balance?"*, *"aaj ki sale?"*

AI samjhega, **draft entry** banayega, aur WhatsApp par hi **summary + buttons** bhejega:

```
AI:  Sale draft QT-2627-000286
     Hyderabad Bakers · Butter Premium 50 × 1,330 = Rs 66,500
     Cash received: Rs 30,000 · New balance: Rs 19,96,500
     [ Confirm ]  [ Edit ]  [ Cancel ]
You: (Confirm dabaya)
AI:  Saved. Stock: Butter Premium 87 → 37. Bill PDF customer ko bhejun?  [ Haan ] [ Nahi ]
```

### 8.2 Kaise kaam karega (andar se)
1. WhatsApp Business **Cloud API** (Meta ka official) message ko hamare **assistant** server par bhejta hai (webhook).
2. Voice note ho to pehle **speech-to-text** (Urdu) se text banta hai. Photo ho to Claude usay **parh** leta hai (vision).
3. Claude samajhta hai kya karna hai, aur **tools** se database mein **draft** banata hai. Final entry khud nahi karta.
4. Aap **Confirm** dabate hain, tab hi posting function chalta hai (stock + ledger + FBR).

### 8.3 Hifazat ke usool (bahut zaroori)
- Sirf **register kiye hue numbers** bot use kar sakte hain. Har number ek user aur role se juda hoga, aur wahi permissions milengi jo app mein hain.
- AI **kabhi khud final/FBR entry, delete ya bara payment nahi karega**. Har cheez par Confirm chahiye. Ek had (maslan Rs 5 lakh) se upar ki entry par admin approval.
- Har AI action ka record: original voice/photo/text, AI ne kya samjha, kis ne confirm kiya (`ai_actions` + `audit_log`).
- Confirm ke baad thori der tak **Undo** ka option.
- Same message do dafa aaye to entry do dafa nahi banegi (idempotency).

### 8.4 "Software maintenance kar dega?" Saaf baat
AI **books ko maintain karega**: entries, recovery, reminders, khulasa, ghalatiyon ki nishandahi. Lekin **software ka code khud nahi badlega**. Woh system ki sehat par nazar rakh kar WhatsApp par alert dega: backup hua ya nahi, FBR queue mein bills atke hain, token expire hone wala hai, data purana ho raha hai.

### 8.5 Aur automations jo WhatsApp par lag sakti hain
| Automation | Kis ko | Kab |
|---|---|---|
| Bill PDF + FBR QR | Customer | Bill save hote hi |
| Payment reminder (purana baqi) | Customer | Har hafte / due date par |
| Raseed (payment receipt) | Customer | Recovery entry par |
| Rozana khulasa | Owner | Raat 9 baje |
| Salesman ka route + recovery list | Salesman | Subah 8 baje |
| Low stock / expiry alert | Owner, store | Jab had se neeche jaye |
| Customer ledger statement | Customer | Maangne par ("statement bhejo") |
| Supplier se order | Supplier | Reorder suggestion approve karne par |

### 8.6 Kharcha aur shartein (WhatsApp)
- **Official Cloud API hi use karenge.** Unofficial tools (whatsapp-web.js, Baileys) par number **ban** ho sakta hai, business ke liye risk.
- Meta ab **per-message** charge karta hai (1 July 2025 se). Customer ki taraf se aaye message ka jawab 24 ghante ke andar ("service") free hai. Business ki taraf se pehle bheje gaye **template** messages (reminders, bills) category aur mulk ke hisaab se charge hote hain. Kuch vendors keh rahe hain 1 Oct 2026 se rates barhe hain. Budget banane se pehle Meta ka official rate card check karna hai.
- Shart: Meta Business account, business verification, aur ek number jo normal WhatsApp app par active na ho.
- **Speech-to-text (Urdu):** Urdu ka koi independent accuracy test nahi mila, sab vendor claims hain. Is liye aapke **20-30 asli voice notes** par 2-3 services (maslan OpenAI Whisper, Google Speech-to-Text, Speechmatics) test karke best chunenge. Whisper ka rate taqreeban $0.006 per minute hai. (Claude abhi audio direct nahi sunta, is liye yeh qadam zaroori hai.)

---

## 9. Phases (build order)

Har phase ke baad main dikhaunga kya chal raha hai, phir agla shuru hoga.

| Phase | Kya banega | Kab "done" |
|---|---|---|
| **0** ✅ | Inventory, data health-check, plan, Dashboard + New Bill design | Aapki approval |
| **1** | Supabase schema, login (username → internal email), roles + per-module permissions, **RLS**, debit = credit constraint, audit log | RLS tests: salesman cost/profit/bank nahi parh sakta |
| **2** | React app shell (design wala look), masters: products (units, conversions, FBR fields), customers, suppliers, routes, salesmen, warehouses/vans, price lists, schemes | Saare masters add/edit/search/export |
| **3** | Sales (order booking, New Bill, Draft → Finalized → FBR Valid, returns, load sheet, recovery FIFO), Purchases (PO, GRN with batch/expiry, invoices, returns, claims), Inventory (multi-location, FEFO, transfers, count, adjustments). **Sab automatic posting ke saath.** | Har document ka journal balance |
| **4** | Accounts: CoA tree, multi-line vouchers, bank reconciliation, cheques (PDC, bounce), expenses, petty cash, ledgers, ageing, credit-limit blocking, fiscal year Jul-Jun, period lock. Reports (print / PDF / Excel) | Trial balance, P&L, balance sheet sahi |
| **5** | FBR gateway (Node + Docker, static IP), validate → post, retry queue, sandbox scenario runner, A4 + 80 mm invoice with FBR number + QR | Saare sandbox scenarios pass |
| **6** | Purana data migrate + reconciliation report + "FBR Readiness" bulk-edit screen | Balances paisa-paisa match |
| **7** | Deploy, 10-day backups + restore test, README, acceptance checklist | Brief ka checklist poora |
| **8** | In-app AI assistant (sawal-jawab, khulasa, anomaly alerts, bill photo → draft) | Aapke 20 test sawal sahi |
| **9** | WhatsApp bot (voice / photo / text → draft → confirm), reminders, bill sharing, rozana khulasa | 20-30 asli voice notes sahi samjhe |

AI aur WhatsApp core ke baad is liye hain kyunki AI tabhi sahi kaam karega jab neeche ka database aur posting pakki ho.

---

## 10. Mahana kharcha (andaaza, USD)

| Cheez | Andaaza |
|---|---|
| Supabase Pro (daily backups, pause nahi hota) | ~$25 |
| Vercel Pro (business use ke liye zaroori) | ~$20 |
| Gateway VPS (static IP, FBR + WhatsApp) | ~$5-12 |
| WhatsApp messages | Istemal par (8.6 dekhein) |
| AI (Claude) + speech-to-text | Istemal par (section 7). 100 sawal/din Opus par ~$50-60/month, sasta model chunne par kaafi kam |

---

## 11. Security aur backup

- Login: username + password (Supabase Auth). Admin users add/reset/deactivate kar sakta hai. Har module par view/create/edit/delete/approve permissions.
- Permissions RLS mein enforce hongi, sirf screen par nahi.
- Tokens (FBR, WhatsApp, AI keys) sirf gateway server ke environment mein. Browser, Git ya logs mein kabhi nahi.
- Audit log: har create/edit/delete/login ka before/after.
- Backups: har 10 din automatic + "Download full backup" + restore ka tested tareeqa.
- **Abhi ka kaam:** GitHub repo **private** karein (Settings → General → Danger Zone → Change visibility).

---

## 12. Aap se sawal (yeh jawab chahiye, andaza nahi lagaunga)

1. Qayam Traders ka **NTN / STRN**, registered address + province, aur IRIS sales-tax profile mein **business activity + sector**
2. Har product ka **HS code, sale type, rate** (tax consultant se)
3. Abhi ke **further tax / withholding** rates
4. Gateway ke liye **kaunsa VPS** (ya main suggest karun?)
5. **Invoice number format** (maslan `QT-2627-000123`) aur **printer**: A4, 80 mm thermal, ya dono
6. FBR Digital Invoicing ka **official logo** file
7. Units: har product ka **carton = kitne piece / kitne kg**
8. WhatsApp bot ke liye **naya number** kaunsa hoga, aur kin logon ke number allow hon (owner, accountant, salesmen)
9. Voice notes zyada-tar **Urdu, Sindhi ya mix** mein hongi? 20-30 sample voice notes bhej sakte hain?
10. Design: naya modern chart style theek hai, ya purane **3D bars/donut** wapas chahiye?
11. GitHub repo private kar di? Uske baad main purana code aur data migration scripts repo mein rakh sakta hoon.

---

*Next step: aap "OK" karein (aur upar ke jawab dein), phir Phase 1 shuru hoga.*
