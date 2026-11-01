# Qayam Traders ERP

Accounting, sales, stock and FBR Digital Invoicing for Qayam Traders, a butter and dairy distributor in Pakistan.
Web-based (PC, tablet and phone), with an AI assistant and a WhatsApp bot planned.

## Where things are

| Path | What it is |
|---|---|
| `docs/PLAN.md` | The master plan: backend choice, architecture, data health-check, AI + WhatsApp automation design, phases, open questions |
| `design/dashboard.html` | Interactive design prototype: role-aware dashboard and the New Bill flow. Open it in any browser. |

## View the design

1. Open `design/dashboard.html` in Chrome or Edge.
2. It starts with **demo data** (fictional names and numbers).
3. To see your own numbers, click **Load my qayam-data.json** in the sidebar and choose your file. The file is read in your browser only; nothing is uploaded.
4. Try: **F2** (New Bill), **Ctrl+K** (search), the date filter, the light/dark button, and "Preview as" Admin / Accountant / Salesman.

## Status

Phase 0 (plan + design) is done and waiting for approval. Phase 1 (Supabase schema, roles, row-level security) starts after that.

## Data privacy

Real business data (`qayam-data.json`, database dumps, backups) must never be committed. `.gitignore` blocks the usual file names. This repository is currently **public**; make it private before any real data or migration scripts are added.
