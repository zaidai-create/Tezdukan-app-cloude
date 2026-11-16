import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// numeric -> JS number (amounts are 2 decimals, quantities 3), date -> 'YYYY-MM-DD' string
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(1082, v => v);
pg.types.setTypeParser(20, v => parseInt(v, 10));

const url = process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/qayam';
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || process.env.PGSSL === 'disable';
// All app tables live in their own schema (default "qayam") so they never mix with other apps in the same database.
export const SCHEMA = (process.env.DB_SCHEMA || 'qayam').replace(/[^a-z0-9_]/g, '');
export const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: +process.env.DB_POOL_MAX || 5, idleTimeoutMillis: 30000 });
pool.on('connect', c => { c.query(`set search_path to ${SCHEMA}`).catch(() => {}); });

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const all = async (text, params) => (await pool.query(text, params)).rows;

export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const here = dirname(fileURLToPath(import.meta.url));
export async function migrate() {
  const c = await pool.connect();
  try {
    const ex = await c.query('select 1 from pg_namespace where nspname = $1', [SCHEMA]);
    if (!ex.rowCount) await c.query(`create schema ${SCHEMA}`);
    await c.query(`set search_path to ${SCHEMA}`);
    const sp = (await c.query('show search_path')).rows[0].search_path;
    if (sp.replace(/"/g, '').trim() !== SCHEMA) throw new Error(`search_path is ${sp}, expected ${SCHEMA}`);
    await c.query(readFileSync(join(here, 'schema.sql'), 'utf8'));
  } finally { c.release(); }
}

// Default chart of accounts for a fresh install (real data import replaces names/adds the rest).
export const DEFAULT_COA = [
  ['1000', 'Cash in Hand', 'A', 'Cash & Bank'],
  ['1010', 'Bank Account', 'A', 'Cash & Bank'],
  ['1200', 'Accounts Receivable (Customers)', 'A', 'Receivables'],
  ['1300', 'Inventory - Stock in Trade', 'A', 'Inventory'],
  ['2000', 'Accounts Payable (Suppliers)', 'B', 'Payables'],
  ['2200', 'Sales Tax Payable', 'B', 'Taxes Payable'],
  ['3000', 'Owner Capital', 'E', 'Capital'],
  ['4000', 'Sales', 'C', 'Revenue'],
  ['4100', 'Other Income', 'C', 'Revenue'],
  ['5000', 'Cost of Goods Sold', 'D', 'Cost of Sales'],
  ['5300', 'Miscellaneous Expense', 'D', 'Operating Expenses'],
  ['5500', 'Spoilage & Stock Adjustments', 'D', 'Operating Expenses'],
];
export const SYSTEM_ACCOUNTS = ['1000', '1200', '1300', '2000', '2200', '3000', '4000', '5000', '5500'];

export async function seedAccounts() {
  for (const [code, name, type, grp] of DEFAULT_COA) {
    await q(`insert into accounts(code,name,type,grp,system) values($1,$2,$3,$4,$5) on conflict (code) do nothing`,
      [code, name, type, grp, SYSTEM_ACCOUNTS.includes(code)]);
  }
}
