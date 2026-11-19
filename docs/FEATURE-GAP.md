# Qayam Traders ERP — feature comparison and roadmap

Compared with Odoo (POS + Accounting), ERPNext, Zoho POS / Inventory and Square POS, November 2026.
"Have" = built and connected to double-entry accounting in this app. "Phase 1" = added in this release.

## Accounting & finance

| Feature | Odoo / ERPNext | Qayam before | Now |
|---|---|---|---|
| Chart of accounts, journals, double entry (DB-enforced balance) | ✓ | Have | Have |
| Trial balance, P&L, balance sheet, cash flow, day book | ✓ | Have | Have |
| General ledger report (all accounts, date range, CSV/PDF) | ✓ | Per-account only | **Phase 1** |
| Party ledgers, ageing, recovery reminders | ✓ | Have | Have |
| Payment / receipt / journal vouchers | ✓ | Have | Have |
| Contra (cash ↔ bank fund transfer) | ✓ | Via journal only | **Phase 1** |
| Credit / debit notes (party adjustments) | ✓ | Returns only | **Phase 1** |
| Money in / out by customizable category (capital, drawings, advances, misc) | ✓ (Odoo cash in/out) | — | **Phase 1** |
| Reversal instead of delete (audit-safe) | ✓ | Delete | **Phase 1** |
| Approval workflow (draft → approve → post) | ✓ | Have (> Rs 10,000) | Extended to all new entries |
| Period lock (close books) | ✓ | Have | Have |
| Loans: given / taken, installments, interest, repayments, write-off | ERPNext Lending app | Plain ledgers | **Phase 1** |
| Personal records kept separate from business books | — | — | **Phase 1** (personal loans) |
| Bank reconciliation (clearance dates vs statement) | ✓ | — | **Phase 1** |
| Fixed assets + straight-line depreciation + disposal | ✓ | Asset ledgers only | **Phase 1** |
| Payroll: employees, monthly salary posting, advances, payments | ✓ | Staff ledgers only | **Phase 1** |
| Multi-currency | ✓ | PKR only | Not needed (PKR) |

## POS & inventory

| Feature | Odoo / Zoho / Square | Qayam before | Now |
|---|---|---|---|
| Sales, purchases, returns, discounts (TP / %), free samples | ✓ | Have | Have |
| Customer credit, supplier balances, cash / bank payments | ✓ | Have | Have |
| Receipt printing (A4 + 80 mm), PDF / image, WhatsApp | ✓ | Have | Have |
| Stock adjustments, oversold alerts, stock movement report, valuation | ✓ | Have | Have |
| SKU + barcode, camera / scanner lookup | ✓ | — | **Phase 1** |
| Global search (products, barcodes, parties, bills, vouchers, loans, staff, accounts) | ✓ | Bills only | **Phase 1** |
| Dashboard: quick actions, recent records, low-stock alerts | ✓ | Partly | **Phase 1** |
| Multiple warehouses + stock transfers | Zoho / Odoo | — | Phase 2 |
| Batch / expiry tracking, damaged stock bin | Odoo / ERPNext | Damage via adjust | Phase 2 |
| Product variants and bundles (e.g. carton = 12 pcs) | ✓ | — | Phase 2 |
| Held / pending bills (open tickets) | Square / Odoo | — | Phase 2 |
| Cashier shifts, opening / closing cash count | Odoo / Square | — | Phase 2 |
| Loyalty points and rewards | Odoo | — | Phase 3 |
| Offline billing with sync | Odoo | Shell only | Phase 3 |

## Sources
- ERPNext accounting, bank reconciliation, assets: https://docs.frappe.io/erpnext/accounting/introduction , https://docs.frappe.io/erpnext/bank-reconciliation-tool
- Odoo POS features (sessions, cash control, loyalty, offline, barcodes): https://www.odoo.com/app/point-of-sale-features
- Zoho POS / Inventory warehouses and transfers: https://www.zoho.com/en-in/pos/resources/help/warehouse.html , https://www.zoho.com/inventory/help/warehouses/transfer-orders.html
- Square open tickets, cash drawer, shift reports: https://squareup.com/help/us/en/article/5337-use-open-tickets-with-square
