import pg from 'pg';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// Keep connections open: opening a new one to a far-away database costs over a second.
export const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: +process.env.DB_POOL_MAX || 8, idleTimeoutMillis: 15 * 60e3, keepAlive: true, keepAliveInitialDelayMillis: 10e3 });
pool.on('error', e => console.error('db pool:', e.message));
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
    // skip the whole schema script when it has not changed since the last start (saves time when the server wakes up)
    const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
    const hash = createHash('sha1').update(sql).digest('hex');
    const have = await c.query(`select value #>> '{}' h from settings where key='schema_hash'`).then(r => r.rows[0]?.h, () => null);
    if (have === hash) return false;
    await c.query(sql);
    await c.query(`insert into settings(key, value) values('schema_hash', to_jsonb($1::text)) on conflict (key) do update set value = excluded.value`, [hash]);
    return true;
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
  const C = DEFAULT_COA;
  await q(`insert into accounts(code,name,type,grp,system) select * from unnest($1::text[], $2::text[], $3::char[], $4::text[], $5::bool[]) on conflict (code) do nothing`,
    [C.map(a => a[0]), C.map(a => a[1]), C.map(a => a[2]), C.map(a => a[3]), C.map(a => SYSTEM_ACCOUNTS.includes(a[0]))]);
}
// Open a few connections up front and keep one busy now and then so they stay warm.
export async function warmPool(n = +process.env.DB_POOL_MAX || 8) {
  await Promise.all(Array.from({ length: n }, () => pool.query('select 1').catch(() => {})));
  setInterval(() => pool.query('select 1').catch(() => {}), 4 * 60e3).unref();
}
