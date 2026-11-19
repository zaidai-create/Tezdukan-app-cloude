import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pool, q, one, all, tx, migrate, seedAccounts, warmPool } from './db.js';
import { requireAuth, hashPassword, checkPassword, makeToken, loginAllowed, loginFailed, loginOk, audit, seedAdmin, clearUserCache } from './auth.js';
import { deleteInvoice, stockAdjust, UserError, r2, today, checkLock } from './posting.js';
import { billRegister, moneyRegister, itemSales, partySummary, stockHistory } from './registers.js';
import { submit, approve, reject, cancelOwn, listApprovals, activity, notices, APPROVERS, resetLimit } from './approvals.js';
import { dashboard, ledger, trialBalance, profitLoss, balanceSheet, aging, dayBook, partyBalances, cashFlow, taxSummary, insights, stockMovement, cashBook, ledgerHub } from './reports.js';
import { importLegacy, importCheck } from './importer.js';
import { parseVoice, parseBest } from './voice.js';
import * as F2 from './finance2.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const app = express();
app.disable('x-powered-by');
app.use(compression({ threshold: 1024 }));
app.set('trust proxy', 1);   // behind the hosting proxy: req.ip is the real client address
app.use('/api/admin/import', express.json({ limit: '25mb' }));
app.use(express.json({ limit: '1mb' }));
// Security headers: only our own scripts may run, the app cannot be framed by other sites, HTTPS only.
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:", "connect-src 'self'", "worker-src 'self'", "manifest-src 'self'", "frame-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"].join('; ');
app.use((req, res, next) => {
  // The hosting proxy (Ample) already adds Strict-Transport-Security and X-Content-Type-Options to every response;
  // sending them again makes duplicate headers that browsers treat as invalid. Set BEHIND_PLAIN_PROXY=1 elsewhere.
  if (process.env.BEHIND_PLAIN_PROXY === '1') res.set({ 'X-Content-Type-Options': 'nosniff', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' });
  res.set({ 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': CSP,
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin' });
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const range = req => {
  const to = isDate(req.query.to) ? req.query.to : today();
  const from = isDate(req.query.from) ? req.query.from : to.slice(0, 8) + '01';
  return { from, to };
};
const ROLES = ['admin', 'owner', 'manager', 'accountant', 'salesman'];
const STAFF = ['admin', 'owner', 'manager', 'accountant'];   // all entries and reports
const BOSS = ['admin', 'owner'];                              // team, settings, cancelling bills, profit figures

/* ---------- response cache ----------
   The database is on another continent (~0.3 s per query), so every GET answer is kept in memory per user
   and thrown away the moment anything is written. After a write the most-used screens are rebuilt in the background. */
let ver = 0;
const cache = new Map(), inflight = new Map(), recent = new Map();
const NOCACHE = /^\/api\/(admin\/|health|auth\/)/;
function cacheMw(req, res, next) {
  if (req.method !== 'GET' || NOCACHE.test(req.originalUrl)) return next();
  const key = `${req.user.id}|${today()}|${req.originalUrl}`;
  if (!req.headers['x-warm']) recent.set(key, { url: req.originalUrl, auth: req.headers.authorization, hit: Date.now() });
  const hit = cache.get(key);
  if (hit && hit.ver === ver) { res.set('X-Cache', 'hit'); return res.type('json').send(hit.body); }
  const w = inflight.get(key);
  if (w && w.ver === ver) return w.p.then(body => (body ? res.set('X-Cache', 'shared').type('json').send(body) : next()));
  let done; const p = new Promise(r => { done = r; }), myVer = ver;
  inflight.set(key, { ver, p });
  const finish = body => { done(body); if (inflight.get(key)?.p === p) inflight.delete(key); };
  const json = res.json.bind(res);
  res.json = data => {
    if (res.statusCode >= 400) { finish(null); return json(data); }
    const body = JSON.stringify(data);
    if (myVer === ver) { if (cache.size > 800) cache.clear(); cache.set(key, { ver: myVer, body }); }
    finish(body);
    return res.type('json').send(body);
  };
  res.on('close', () => finish(null));
  next();
}
const guard = (...roles) => [requireAuth(...roles), cacheMw];
let warmTimer = null;
function invalidate() {
  ver++; cache.clear(); co = null; resetLimit();
  clearTimeout(warmTimer);
  warmTimer = setTimeout(warm, 300);
}
async function warm() {
  const now = Date.now();
  const keys = [...recent.entries()].filter(([, v]) => now - v.hit < 30 * 60e3).sort((a, b) => b[1].hit - a[1].hit);
  for (const [k, v] of recent) if (now - v.hit > 60 * 60e3) recent.delete(k);
  const want = keys.filter(([, v]) => /^\/api\/(boot|dashboard|notices|approvals|invoices\?|reports\/aging)/.test(v.url)).slice(0, 10);
  const startVer = ver;
  for (let i = 0; i < want.length && ver === startVer; i += 3) {
    await Promise.all(want.slice(i, i + 3).map(([, v]) => fetch(`http://127.0.0.1:${port}${v.url}`, { headers: { authorization: v.auth, 'x-warm': '1' } }).then(r => r.arrayBuffer()).catch(() => {})));
  }
}
app.use('/api', (req, res, next) => { ready.then(() => next(), next); });
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && !/^\/(auth\/login|voice\/parse)$/.test(req.path)) res.on('finish', () => { if (res.statusCode < 400) { if (/^\/(users|me)/.test(req.path)) clearUserCache(); invalidate(); } });
  next();
});
let co = null; // company settings, kept in memory until something is saved
const company = async () => co || (co = (await one(`select value from settings where key='company'`))?.value || { name: 'Qayam Traders', address: '', phone: '', ntn: '', strn: '', footer: 'Thank you for your business.', tax_pct: 0 });

/* ---------- auth ---------- */
app.post('/api/auth/login', ah(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase(), pw = String(req.body.password || '');
  const key = `${req.ip}|${username}`;
  if (!loginAllowed(key) || !loginAllowed('*|' + username, 30) || !loginAllowed(req.ip + '|*', 40)) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
  if (username.length > 60 || pw.length > 200) return res.status(400).json({ error: 'Wrong username or password.' });
  const u = await one('select * from users where username=$1', [username]);
  if (!u || !u.active || !checkPassword(pw, u.pass_hash)) {
    loginFailed(key); loginFailed('*|' + username); loginFailed(req.ip + '|*');
    if (u) audit(u.id, 'login_failed', 'user', u.id, { ip: req.ip });
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  loginOk(key);
  await audit(u.id, 'login', 'user', u.id);
  res.json({ token: makeToken(u), user: { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change } });
}));

app.post('/api/me/password', guard(), ah(async (req, res) => {
  const u = await one('select * from users where id=$1', [req.user.id]);
  if (!checkPassword(String(req.body.old || ''), u.pass_hash)) throw new UserError('Current password is wrong.');
  const pw = String(req.body.new || '');
  if (pw.length < 8) throw new UserError('Use at least 8 characters.');
  const r = await one('update users set pass_hash=$1, must_change=false, token_version=token_version+1 where id=$2 returning *', [hashPassword(pw), u.id]);
  await audit(u.id, 'password', 'user', u.id);
  res.json({ token: makeToken(r) });
}));

/* ---------- boot: everything the app needs to start ---------- */
app.get('/api/boot', guard(), ah(async (req, res) => {
  const staff = STAFF.includes(req.user.role);
  const [products, cb, vb, parties, accounts, co, team] = await Promise.all([
    all(`select p.id, p.name, p.category, p.unit, p.price, p.stock, p.reorder, p.aliases, p.sku, p.barcode${staff ? ', p.cost' : ''}, coalesce(s.q, 0) sold
      from products p left join (select il.product_id, sum(il.qty) q from invoice_lines il join invoices i on i.id=il.invoice_id where i.kind='sale' group by il.product_id) s on s.product_id=p.id
      where p.active order by sold desc, p.name`),
    partyBalances('C'), staff ? partyBalances('V') : {},
    all(`select id, kind, name, city, phone, address, ntn, credit_limit from parties where active ${staff ? '' : "and kind='C'"} order by name`),
    staff ? all('select code, name, type, grp, system from accounts order by code') : all(`select code, name, type, grp from accounts where code='1000'`),
    company(),
    all(`select id, name, role, phone from users where active and role = any($1::text[])`, [APPROVERS]),
  ]);
  parties.forEach(p => { p.balance = (p.kind === 'C' ? cb[p.id] : vb[p.id]) || 0; });
  const { token_version, ...user } = req.user;
  res.json({ user, company: co, products, parties, accounts, owners: team, today: today() });
}));

/* ---------- dashboard & reports ---------- */
app.get('/api/dashboard', guard(), ah(async (req, res) => { const { from, to } = range(req); res.json(await dashboard(req.user, from, to)); }));
app.get('/api/reports/trial-balance', guard(...STAFF), ah(async (req, res) => res.json(await trialBalance(range(req).to))));
app.get('/api/reports/profit-loss', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await profitLoss(from, to)); }));
app.get('/api/reports/balance-sheet', guard(...STAFF), ah(async (req, res) => res.json(await balanceSheet(range(req).to))));
app.get('/api/reports/aging', guard(), ah(async (req, res) => res.json(await aging(range(req).to))));
app.get('/api/reports/stock-movement', guard(), ah(async (req, res) => {
  const d = await stockMovement(isDate(req.query.from) ? req.query.from : today().slice(0, 8) + '01', range(req).to);
  if (!STAFF.includes(req.user.role)) d.rows.forEach(r => { delete r.cost; delete r.value; });
  res.json(d);
}));
app.get('/api/reports/cash-book', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await cashBook(from, to, req.query.account ? String(req.query.account) : null)); }));
app.get('/api/ledgers', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await ledgerHub(from, to)); }));
app.get('/api/reports/payables', guard(...STAFF), ah(async (req, res) => res.json(await aging(range(req).to, 'V'))));
app.get('/api/reports/cash-flow', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await cashFlow(from, to)); }));
app.get('/api/reports/sales-tax', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await taxSummary(from, to)); }));
app.get('/api/reports/insights', guard(...STAFF), ah(async (req, res) => res.json(await insights(range(req).to))));
app.get('/api/reports/day-book', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await dayBook(from, to)); }));
app.get('/api/reports/account-ledger', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await ledger(String(req.query.account), null, from, to)); }));
app.get('/api/reports/stock', guard(), ah(async (req, res) => {
  const staff = STAFF.includes(req.user.role);
  res.json(await all(`select id, name, category, unit, stock, price, reorder${staff ? ', cost, round(greatest(stock,0)*cost, 2) value' : ''} from products where active order by name`));
}));

/* ---------- parties ---------- */
app.get('/api/parties/:id/ledger', guard(), ah(async (req, res) => {
  const [p, co0] = await Promise.all([one('select * from parties where id=$1', [+req.params.id]), company()]);
  if (!p || (req.user.role === 'salesman' && p.kind !== 'C')) throw new UserError('Not found.', 404);
  const from = isDate(req.query.from) ? req.query.from : '2000-01-01', to = isDate(req.query.to) ? req.query.to : today();
  const l = await ledger(p.kind === 'C' ? '1200' : '2000', p.id, from, to);
  if (p.kind === 'V') { l.opening = -l.opening; l.closing = -l.closing; l.lines.forEach(x => { x.balance = -x.balance; }); }
  res.json({ party: p, from, to, ...l, company: co0 });
}));
app.get('/api/parties/:id/rates', guard(), ah(async (req, res) => {
  if (req.user.role === 'salesman' && !(await one(`select 1 from parties where id=$1 and kind='C'`, [+req.params.id]))) throw new UserError('Not found.', 404);
  // last rate this party paid/charged for each product, for auto-filling bills
  const rows = await all(`select distinct on (il.product_id) il.product_id, il.rate from invoice_lines il join invoices i on i.id=il.invoice_id
    where i.party_id=$1 and i.kind in ('sale','purchase') and il.rate > 0 order by il.product_id, i.date desc, i.id desc`, [+req.params.id]);
  res.json(Object.fromEntries(rows.map(r => [r.product_id, r.rate])));
}));
const partyFields = b => [String(b.name || '').trim(), String(b.city || '').trim(), String(b.phone || '').trim(), String(b.address || '').trim(), String(b.ntn || '').trim(), r2(b.credit_limit)];
app.post('/api/parties', guard(), ah(async (req, res) => {
  const kind = req.user.role === 'salesman' ? 'C' : (req.body.kind === 'V' ? 'V' : 'C');
  const f = partyFields(req.body); if (!f[0]) throw new UserError('Enter a name.');
  const dup = await one('select id from parties where kind=$1 and lower(name)=lower($2)', [kind, f[0]]);
  if (dup) throw new UserError('This name already exists.');
  const r = await one('insert into parties(kind, name, city, phone, address, ntn, credit_limit) values($1,$2,$3,$4,$5,$6,$7) returning *', [kind, ...f]);
  await audit(req.user.id, 'create', 'party', r.id, { name: r.name });
  // opening balance: what they already owed (customer) or we already owed them (supplier) before using the app
  let opening = null;
  if (r2(req.body.opening) > 0 && STAFF.includes(req.user.role)) opening = await tx(c => submit(c, req.user, 'opening', { party_id: r.id, amount: r2(req.body.opening), date: req.body.opening_date }));
  res.json({ ...r, balance: opening && !opening.pending ? r2(req.body.opening) : 0, opening });
}));
app.put('/api/parties/:id', guard(), ah(async (req, res) => {
  const p = await one('select * from parties where id=$1', [+req.params.id]);
  if (!p || (req.user.role === 'salesman' && p.kind !== 'C')) throw new UserError('Not found.', 404);
  const f = partyFields({ ...p, ...req.body }); if (!f[0]) throw new UserError('Enter a name.');
  if (req.user.role === 'salesman') f[5] = p.credit_limit;
  const r = await one('update parties set name=$1, city=$2, phone=$3, address=$4, ntn=$5, credit_limit=$6, active=$7 where id=$8 returning *', [...f, req.body.active === false && BOSS.includes(req.user.role) ? false : true, p.id]);
  await audit(req.user.id, 'update', 'party', p.id, { before: p, after: r });
  res.json(r);
}));

/* ---------- products ---------- */
const prodFields = b => [String(b.name || '').trim(), String(b.category || '').trim(), String(b.unit || 'pc').trim() || 'pc', r2(b.cost), r2(b.price), +b.reorder || 0, String(b.aliases || '').trim(), String(b.sku || '').trim().slice(0, 40), String(b.barcode || '').replace(/\s+/g, '').slice(0, 64)];
const dupBarcode = async (code, id = 0) => { if (code && await one('select 1 from products where barcode=$1 and id<>$2 and active', [code, id])) throw new UserError('Yeh barcode pehle se kisi aur product par laga hai.'); };
app.post('/api/products', guard(...STAFF), ah(async (req, res) => {
  const f = prodFields(req.body); if (!f[0]) throw new UserError('Enter a product name.');
  await dupBarcode(f[8]);
  const r = await one('insert into products(name, category, unit, cost, price, reorder, aliases, sku, barcode) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *', f);
  await audit(req.user.id, 'create', 'product', r.id, { name: r.name });
  res.json({ ...r, sold: 0 });
}));
app.put('/api/products/:id', guard(...STAFF), ah(async (req, res) => {
  const p = await one('select * from products where id=$1', [+req.params.id]); if (!p) throw new UserError('Not found.', 404);
  const f = prodFields({ ...p, ...req.body }); if (!f[0]) throw new UserError('Enter a product name.');
  await dupBarcode(f[8], p.id);
  const r = await one('update products set name=$1, category=$2, unit=$3, cost=$4, price=$5, reorder=$6, aliases=$7, sku=$8, barcode=$9, active=$10 where id=$11 returning *', [...f, req.body.active !== false, p.id]);
  await audit(req.user.id, 'update', 'product', p.id, { before: p, after: r });
  res.json(r);
}));
app.post('/api/products/:id/adjust', guard(...STAFF), ah(async (req, res) => { await tx(c => stockAdjust(c, req.user, { ...req.body, product_id: +req.params.id })); res.json({ ok: true }); }));

/* ---------- accounts ---------- */
app.get('/api/accounts', guard(...STAFF), ah(async (req, res) => {
  const b = Object.fromEntries((await all('select account, sum(debit-credit) b from journal_lines group by account')).map(r => [r.account, r2(r.b)]));
  res.json((await all('select * from accounts order by code')).map(a => ({ ...a, balance: b[a.code] || 0 })));
}));
// one-tap ledger heads: a staff member, a commission person, an expense head, a partner, a bank account
const QUICK = { staff: ['D', 'Payroll', 400000, 400499], commission: ['B', 'Commission Payable', 201100, 201499], expense: ['D', 'General & Administrative Expense', 400600, 400999], partner: ['E', 'Partners Capital', 500010, 500499], bank: ['A', 'Cash & Bank', 1040, 1099] };
app.post('/api/accounts/quick', guard(...STAFF), ah(async (req, res) => {
  const q = QUICK[req.body.kind]; if (!q) throw new UserError('Choose what kind of ledger this is.');
  const name = String(req.body.name || '').trim().toUpperCase(); if (!name) throw new UserError('Enter a name.');
  if (await one('select 1 from accounts where upper(name) = $1', [name])) throw new UserError('A ledger with this name already exists.');
  const r = await tx(async c => {
    const m = (await c.query(`select coalesce(max(code::bigint), $1 - 1) m from accounts where code ~ '^[0-9]+$' and code::bigint between $1 and $2`, [q[2], q[3]])).rows[0].m;
    if (+m + 1 > q[3]) throw new UserError('No free account code left in this range.');
    return (await c.query('insert into accounts(code, name, type, grp) values($1,$2,$3,$4) returning *', [String(+m + 1), name, q[0], q[1]])).rows[0];
  });
  audit(req.user.id, 'create', 'account', r.code, r);
  res.json(r);
}));
app.post('/api/accounts', guard(...STAFF), ah(async (req, res) => {
  const { code, name, type, grp } = req.body;
  if (!/^\d{3,8}$/.test(String(code || ''))) throw new UserError('Account code must be 3 to 8 digits.');
  if (!String(name || '').trim() || !'ABCDE'.includes(type) || !type) throw new UserError('Enter a name and choose a type.');
  const r = await one('insert into accounts(code, name, type, grp) values($1,$2,$3,$4) on conflict do nothing returning *', [String(code), String(name).trim(), type, String(grp || '').trim()]);
  if (!r) throw new UserError('This account code already exists.');
  await audit(req.user.id, 'create', 'account', r.code, r);
  res.json(r);
}));

/* ---------- registers (tables) ---------- */
app.get('/api/registers/bills', guard(), ah(async (req, res) => res.json(await billRegister(req.user, req.query))));
app.get('/api/registers/money', guard(), ah(async (req, res) => res.json(await moneyRegister(req.user, req.query))));
app.get('/api/registers/items', guard(), ah(async (req, res) => res.json(await itemSales(req.user, req.query))));
app.get('/api/registers/parties', guard(), ah(async (req, res) => res.json(await partySummary(req.user, req.query))));
app.get('/api/products/:id/history', guard(), ah(async (req, res) => { const d = await stockHistory(req.user, +req.params.id); if (!d) throw new UserError('Not found.', 404); res.json(d); }));

/* ---------- bills ---------- */
app.get('/api/invoices', guard(), ah(async (req, res) => {
  const kind = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(req.query.kind) ? req.query.kind : 'sale';
  if (req.user.role === 'salesman' && kind !== 'sale') throw new UserError('Not allowed.', 403);
  const p = [kind], w = ['i.kind = $1'];
  if (req.user.role === 'salesman') { p.push(req.user.id); w.push(`i.created_by = $${p.length}`); }
  if (req.query.party) { p.push(+req.query.party); w.push(`i.party_id = $${p.length}`); }
  if (isDate(req.query.from)) { p.push(req.query.from); w.push(`i.date >= $${p.length}`); }
  if (isDate(req.query.to)) { p.push(req.query.to); w.push(`i.date <= $${p.length}`); }
  if (req.query.q) { p.push('%' + String(req.query.q).toLowerCase() + '%'); w.push(`(lower(pt.name) like $${p.length} or lower(i.no) like $${p.length})`); }
  const lim = Math.max(1, Math.min(Math.floor(+req.query.limit) || 60, 300)), off = Math.max(Math.floor(+req.query.offset) || 0, 0);
  res.json(await all(`select i.id, i.no, i.date, i.total, i.paid, i.kind, i.legacy, i.source, pt.name party, pt.id party_id from invoices i left join parties pt on pt.id=i.party_id
    where ${w.join(' and ')} order by i.date desc, i.id desc limit ${lim} offset ${off}`, p));
}));
app.get('/api/invoices/:id', guard(), ah(async (req, res) => {
  const inv = await one('select i.*, u.name created_by_name from invoices i left join users u on u.id=i.created_by where i.id=$1', [+req.params.id]);
  if (!inv || (req.user.role === 'salesman' && (inv.created_by !== req.user.id || inv.kind !== 'sale'))) throw new UserError('Not found.', 404);
  const [lines, pb, co0] = await Promise.all([
    all(`select il.product_id, il.qty, il.rate, il.amount, il.tp, p.name, p.unit${STAFF.includes(req.user.role) ? ', il.cost' : ''} from invoice_lines il left join products p on p.id=il.product_id where il.invoice_id=$1 order by il.id`, [inv.id]),
    one(`select row_to_json(p) party, (select coalesce(sum(jl.debit - jl.credit),0) from journal_lines jl join journals j on j.id=jl.journal_id
        where jl.account = case when p.kind='C' then '1200' else '2000' end and jl.party_id=p.id
          and (j.date < $2 or (j.date = $2 and j.id < coalesce((select min(id) from journals where ref_invoice=$3), 0)))) b
      from (select id, kind, name, city, phone, address, ntn from parties where id=$1) p`, [inv.party_id, inv.date, inv.id]),
    company(),
  ]);
  const party = pb?.party || null;
  const before = party ? (party.kind === 'C' ? r2(pb.b) : r2(-pb.b)) : 0;
  if (!STAFF.includes(req.user.role)) delete inv.pay_account;
  res.json({ invoice: inv, lines, party, company: co0, previous: before, after: r2(before + (inv.kind.endsWith('return') ? -inv.total : inv.total) - inv.paid) });
}));
app.post('/api/invoices', guard(), ah(async (req, res) => {
  if (req.user.role === 'salesman' && req.body.kind !== 'sale') throw new UserError('Salesmen can make sale bills only.', 403);
  const kind = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(req.body.kind) ? req.body.kind : null;
  if (!kind) throw new UserError('Unknown bill type.');
  res.json(await tx(c => submit(c, req.user, kind, req.body)));
}));
app.put('/api/invoices/:id', guard(), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'edit', { ...req.body, invoice_id: +req.params.id })))));
app.delete('/api/invoices/:id', guard(...BOSS), ah(async (req, res) => { await tx(c => deleteInvoice(c, req.user, +req.params.id)); res.json({ ok: true }); }));

/* ---------- money ---------- */
app.post('/api/receipts', guard(), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'receipt', req.body)))));
app.post('/api/payments', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'payment', req.body)))));
app.post('/api/expenses', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'expense', req.body)))));
app.post('/api/vouchers', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'voucher', req.body)))));

/* ---------- approvals (owners) & notifications ---------- */
app.get('/api/approvals', guard(), ah(async (req, res) => res.json(await listApprovals(req.user, { mine: !BOSS.includes(req.user.role) || req.query.mine === '1' }))));
app.post('/api/approvals/:id/approve', guard(...APPROVERS), ah(async (req, res) => res.json(await approve(req.user, +req.params.id))));
app.post('/api/approvals/:id/reject', guard(...APPROVERS), ah(async (req, res) => res.json(await reject(req.user, +req.params.id, String(req.body.reason || '')))));
app.delete('/api/approvals/:id', guard(), ah(async (req, res) => res.json(await cancelOwn(req.user, +req.params.id))));
app.get('/api/activity', guard(...BOSS), ah(async (req, res) => res.json(await activity(Math.max(1, Math.min(Math.floor(+req.query.limit) || 150, 400))))));
app.get('/api/notices', guard(), ah(async (req, res) => res.json(await notices(req.user))));
app.post('/api/notices/read', guard(), ah(async (req, res) => { await q('update notices set read_at=now() where user_id=$1 and read_at is null', [req.user.id]); res.json({ ok: true }); }));
app.get('/api/journals/:id', guard(...STAFF), ah(async (req, res) => {
  const j = await one('select * from journals where id=$1', [+req.params.id]); if (!j) throw new UserError('Not found.', 404);
  j.lines = await all('select jl.*, a.name account_name, p.name party from journal_lines jl join accounts a on a.code=jl.account left join parties p on p.id=jl.party_id where journal_id=$1 order by jl.id', [j.id]);
  res.json(j);
}));
app.delete('/api/journals/:id', guard(...BOSS), ah(async (req, res) => {
  const j = await one('select * from journals where id=$1', [+req.params.id]); if (!j) throw new UserError('Not found.', 404);
  if (j.ref_invoice) throw new UserError('This entry belongs to a bill. Cancel the bill instead.');
  if (j.legacy) throw new UserError('Entries from the old software cannot be deleted. Make a correcting voucher.');
  const amt = (await one('select coalesce(sum(debit),0) v from journal_lines where journal_id=$1', [j.id])).v;
  await tx(async c => { await checkLock(c, j.date); await c.query('delete from journals where id=$1', [j.id]); });
  audit(req.user.id, 'cancel', 'journal', j.id, { no: j.no, memo: j.memo, amt, type: j.type });
  res.json({ ok: true });
}));

/* ---------- voice entry: understand, then the user approves ---------- */
async function voiceContext() {
  const products = await all(`select p.id, p.name, p.unit, p.price, p.cost, p.aliases, coalesce((select sum(il.qty) from invoice_lines il join invoices i on i.id=il.invoice_id where il.product_id=p.id and i.kind='sale'),0) sold from products p where p.active`);
  const parties = await all('select id, kind, name from parties where active');
  const expenseAccounts = await all(`select code, name from accounts where type='D' and grp <> 'Cost of Sales' and code <> '5000' order by code`);
  const last = await all(`select distinct on (i.party_id, il.product_id) i.party_id, il.product_id, il.rate from invoice_lines il join invoices i on i.id=il.invoice_id
    where i.kind in ('sale','purchase') and il.rate > 0 order by i.party_id, il.product_id, i.date desc, i.id desc`);
  const lr = new Map(last.map(r => [r.party_id + ':' + r.product_id, r.rate]));
  const sold = new Map(products.map(p => [p.id, p.sold]));
  return { products, customers: parties.filter(p => p.kind === 'C'), vendors: parties.filter(p => p.kind === 'V'), expenseAccounts, lastRate: (p, party) => lr.get(party + ':' + p) || 0, rank: id => sold.get(id) || 0 };
}
app.post('/api/voice/parse', guard(), ah(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) throw new UserError('Kuch bolein ya likhein.');
  const alts = Array.isArray(req.body.alternatives) ? req.body.alternatives.map(x => String(x || '').slice(0, 600)).slice(0, 8) : [];
  const draft = parseBest([text, ...alts], await voiceContext());
  if (req.user.role === 'salesman' && !['sale', 'receipt', 'unknown'].includes(draft.intent)) { draft.notes.push('Aap sirf sale aur recovery entry kar sakte hain.'); draft.intent = 'unknown'; }
  const r = await one('insert into voice_drafts(text, draft, created_by) values($1,$2,$3) returning id', [text, JSON.stringify(draft), req.user.id]);
  res.json({ id: r.id, draft });
}));
app.post('/api/voice/:id/approve', guard(), ah(async (req, res) => {
  const vd = await one('select * from voice_drafts where id=$1 and created_by=$2', [+req.params.id, req.user.id]);
  if (!vd) throw new UserError('Draft not found.', 404);
  if (vd.status !== 'pending') throw new UserError('This entry was already handled.');
  const d = req.body.draft || vd.draft;
  const result = await tx(async c => {
    const staff = STAFF.includes(req.user.role);
    let partyId = d.party?.id || null;
    if (!partyId && d.party?.name && d.intent !== 'expense') {
      const kind = d.intent === 'purchase' || d.intent === 'payment' ? 'V' : 'C';
      if (kind === 'V' && !staff) throw new UserError('Only the office team can add a supplier.');
      const ex = (await c.query('select id from parties where kind=$1 and lower(name)=lower($2)', [kind, d.party.name.trim()])).rows[0];
      partyId = ex ? ex.id : (await c.query('insert into parties(kind, name) values($1,$2) returning id', [kind, d.party.name.trim()])).rows[0].id;
    }
    if (d.intent === 'sale' || d.intent === 'purchase') {
      const lines = [];
      for (const it of d.items || []) {
        let pid = it.product_id;
        if (!pid) {
          if (!staff) throw new UserError(`"${it.name}" is a new product. Ask the admin to add it first.`);
          const ex = (await c.query('select id from products where lower(name)=lower($1)', [String(it.name).trim()])).rows[0];
          pid = ex ? ex.id : (await c.query('insert into products(name, unit, price, cost) values($1,$2,$3,$4) returning id', [String(it.name).trim(), it.unit || 'pc', d.intent === 'sale' ? r2(it.rate) : 0, d.intent === 'purchase' ? r2(it.rate) : 0])).rows[0].id;
        }
        lines.push({ product_id: pid, qty: it.qty, rate: it.rate });
      }
      const total = r2(lines.reduce((a, l) => a + l.qty * l.rate, 0));
      const paid = d.payment?.mode === 'credit' ? 0 : Math.min(r2(d.payment?.amount ?? total), total);
      const payAcc = d.payment?.account || (d.payment?.mode === 'bank' ? (await c.query(`select code from accounts where grp='Cash & Bank' and code<>'1000' order by code limit 1`)).rows[0]?.code : '1000');
      const company0 = (await c.query(`select value from settings where key='company'`)).rows[0]?.value || {};
      return { party_id: partyId, ...(await submit(c, req.user, d.intent, { kind: d.intent, party_id: partyId, lines, paid, pay_account: payAcc, tax_pct: d.tax_pct ?? company0.tax_pct ?? 0, discount: d.discount || 0, note: `Voice: ${vd.text}`.slice(0, 500), source: 'voice', date: d.date })) };
    }
    if (d.intent === 'receipt') {
      const acc = d.payment?.account || (d.payment?.mode === 'bank' ? (await c.query(`select code from accounts where grp='Cash & Bank' and code<>'1000' order by code limit 1`)).rows[0]?.code : '1000');
      return { party_id: partyId, ...(await submit(c, req.user, 'receipt', { party_id: partyId, amount: d.amount, account: acc, note: 'Voice entry', date: d.date })) };
    }
    if (!staff) throw new UserError('Aap sirf sale aur recovery entry kar sakte hain.');
    if (d.intent === 'payment') {
      const acc = d.payment?.account || (d.payment?.mode === 'bank' ? (await c.query(`select code from accounts where grp='Cash & Bank' and code<>'1000' order by code limit 1`)).rows[0]?.code : '1000');
      return { party_id: partyId, ...(await submit(c, req.user, 'payment', { party_id: partyId, amount: d.amount, account: acc, note: 'Voice entry', date: d.date })) };
    }
    if (d.intent === 'expense') return submit(c, req.user, 'expense', { account: d.account?.code, amount: d.amount, pay_account: d.payment?.account || '1000', note: d.note || 'Voice entry', date: d.date });
    throw new UserError('Choose what this entry is: sale, purchase, receipt, payment or expense.');
  });
  await q(`update voice_drafts set status='approved', decided_at=now(), draft=$2, result=$3 where id=$1`, [vd.id, JSON.stringify(d), JSON.stringify(result)]);
  res.json(result);
}));
app.post('/api/voice/:id/reject', guard(), ah(async (req, res) => {
  await q(`update voice_drafts set status='rejected', decided_at=now() where id=$1 and created_by=$2 and status='pending'`, [+req.params.id, req.user.id]);
  res.json({ ok: true });
}));

/* ---------- users & settings (admin) ---------- */
app.get('/api/users', guard(...BOSS), ah(async (req, res) => res.json(await all('select id, username, name, role, active, phone, must_change, created_at from users order by name'))));
app.post('/api/users', guard(...BOSS), ah(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase(), name = String(req.body.name || '').trim(), role = req.body.role, pw = String(req.body.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new UserError('Username: 3 to 30 letters or numbers, no spaces.');
  if (!name || !ROLES.includes(role)) throw new UserError('Enter a name and choose a role.');
  if (role === 'admin' && req.user.role !== 'admin') throw new UserError('Only the admin can make another admin.', 403);
  if (pw.length < 8) throw new UserError('Password needs at least 8 characters.');
  if (await one('select 1 from users where username=$1', [username])) throw new UserError('This username is taken.');
  const r = await one('insert into users(username, name, role, pass_hash, phone, must_change) values($1,$2,$3,$4,$5,true) returning id, username, name, role, active, phone', [username, name, role, hashPassword(pw), String(req.body.phone || '')]);
  await audit(req.user.id, 'create', 'user', r.id, { username, role });
  res.json(r);
}));
app.put('/api/users/:id', guard(...BOSS), ah(async (req, res) => {
  const u = await one('select * from users where id=$1', [+req.params.id]); if (!u) throw new UserError('Not found.', 404);
  if (u.id === req.user.id && (req.body.active === false || (req.body.role && req.body.role !== u.role))) throw new UserError('You cannot change your own role or switch yourself off.');
  if (req.user.role !== 'admin' && (u.role === 'admin' || req.body.role === 'admin')) throw new UserError('Only the admin can change an admin account.', 403);
  const role = ROLES.includes(req.body.role) ? req.body.role : u.role;
  const active = req.body.active === undefined ? u.active : !!req.body.active;
  let sets = 'role=$1, active=$2, name=$3, phone=$4', p = [role, active, String(req.body.name || u.name), String(req.body.phone ?? u.phone)];
  const bump = req.body.password || !active || role !== u.role;
  if (req.body.password) { if (String(req.body.password).length < 8) throw new UserError('Password needs at least 8 characters.'); p.push(hashPassword(String(req.body.password))); sets += `, pass_hash=$${p.length}, must_change=true`; }
  if (bump) sets += ', token_version=token_version+1';
  p.push(u.id);
  const r = await one(`update users set ${sets} where id=$${p.length} returning id, username, name, role, active, phone`, p);
  await audit(req.user.id, 'update', 'user', u.id, { role, active, reset: !!req.body.password });
  res.json(r);
}));
app.get('/api/settings', guard(), ah(async (req, res) => res.json(await company())));
app.put('/api/settings', guard(...BOSS), ah(async (req, res) => {
  const c0 = await company(), b = req.body;
  const v = { ...c0, ...Object.fromEntries(['name', 'address', 'phone', 'ntn', 'strn', 'footer', 'email', 'bank', 'terms', 'lock_date'].filter(k => b[k] !== undefined).map(k => [k, String(b[k]).slice(0, 600)])), tax_pct: b.tax_pct !== undefined ? Math.max(+b.tax_pct || 0, 0) : c0.tax_pct,
    approval_limit: b.approval_limit !== undefined && b.approval_limit !== '' ? Math.max(+b.approval_limit || 0, 0) : (c0.approval_limit ?? 10000) };
  await q(`insert into settings(key, value) values('company',$1) on conflict (key) do update set value=excluded.value`, [JSON.stringify(v)]);
  await audit(req.user.id, 'update', 'settings', 'company', v);
  res.json(v);
}));
app.get('/api/audit', guard(...BOSS), ah(async (req, res) => res.json(await all('select a.*, u.name user_name from audit_log a left join users u on u.id=a.user_id order by a.id desc limit 200'))));

/* ---------- import & backup (admin) ---------- */
app.post('/api/admin/import', guard('admin'), ah(async (req, res) => {
  if (req.body.confirm !== 'REPLACE') throw new UserError('Type REPLACE to confirm. This replaces all bills, parties, products and ledger entries.');
  const summary = await tx(c => importLegacy(c, req.user, req.body.data));
  res.json({ ...summary, ...(await importCheck()) });
}));
app.get('/api/admin/backup', guard('admin'), ah(async (req, res) => {
  const out = { exported_at: new Date().toISOString(), version: 1 };
  for (const t of ['settings', 'accounts', 'parties', 'products', 'invoices', 'invoice_lines', 'journals', 'journal_lines', 'counters']) out[t] = await all(`select * from ${t}`);
  out.users = await all('select id, username, name, role, active, phone from users');
  await audit(req.user.id, 'backup', 'all', null);
  res.set('Content-Disposition', `attachment; filename="qayam-backup-${today()}.json"`).json(out);
}));

/* ---------- Phase 1: search, money in/out, transfers, notes, reversal, loans, banking, assets, payroll ---------- */
app.get('/api/search', guard(), ah(async (req, res) => res.json(await F2.search(req.user, req.query.q, req.query.type))));
app.get('/api/recent', guard(), ah(async (req, res) => res.json(await F2.recent(req.user))));
app.get('/api/money/categories', guard(...STAFF), ah(async (req, res) => res.json(await F2.categories())));
app.put('/api/money/categories', guard(...BOSS), ah(async (req, res) => res.json(await F2.saveCategories(req.user, req.body.list))));
app.post('/api/money', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'money', req.body)))));
app.post('/api/transfer', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'transfer', req.body)))));
app.post('/api/notes', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'note', req.body)))));
app.post('/api/journals/:id/reverse', guard(...BOSS), ah(async (req, res) => res.json(await F2.reverseJournal(req.user, +req.params.id, String(req.body.reason || ''), req.body.date))));
app.get('/api/loans', guard(...STAFF), ah(async (req, res) => res.json(await F2.listLoans())));
app.get('/api/loans/:id', guard(...STAFF), ah(async (req, res) => res.json(await F2.loanDetail(+req.params.id))));
// personal loans never touch the business books, so they do not need an owner's approval
app.post('/api/loans', guard(...STAFF), ah(async (req, res) => { const b = { ...req.body, amount: r2(req.body.principal) };
  res.json(await tx(c => (b.book === 'personal' ? F2.createLoan(c, req.user, b) : submit(c, req.user, 'loan', b)))); }));
app.post('/api/loans/:id/txn', guard(...STAFF), ah(async (req, res) => { const L = await one('select book from loans where id=$1', [+req.params.id]); if (!L) throw new UserError('Loan not found.', 404);
  const b = { ...req.body, loan_id: +req.params.id }; res.json(await tx(c => (L.book === 'personal' ? F2.loanTxn(c, req.user, b) : submit(c, req.user, 'loan_txn', b)))); }));
app.get('/api/reports/loan-recovery', guard(...STAFF), ah(async (req, res) => res.json(await F2.loanRecovery())));
app.get('/api/bank-rec', guard(...STAFF), ah(async (req, res) => res.json(await F2.bankRec(String(req.query.account || ''), isDate(req.query.to) ? req.query.to : today()))));
app.post('/api/bank-rec/clear', guard(...STAFF), ah(async (req, res) => res.json(await F2.bankClear(req.user, req.body.ids, req.body.on, req.body.clear !== false))));
app.post('/api/bank-rec/statement', guard(...STAFF), ah(async (req, res) => res.json(await F2.bankStatement(req.user, String(req.body.account || ''), req.body.as_on, req.body.balance))));
app.get('/api/assets', guard(...STAFF), ah(async (req, res) => res.json(await F2.listAssets())));
app.post('/api/assets', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'asset', { ...req.body, amount: r2(req.body.cost) })))));
app.post('/api/assets/depreciate', guard(...STAFF), ah(async (req, res) => res.json(await F2.runDepreciation(req.user, String(req.body.upto || '')))));
app.post('/api/assets/:id/dispose', guard(...BOSS), ah(async (req, res) => res.json(await F2.disposeAsset(req.user, +req.params.id, req.body))));
app.get('/api/employees', guard(...STAFF), ah(async (req, res) => res.json(await F2.listEmployees())));
app.post('/api/employees', guard(...STAFF), ah(async (req, res) => res.json(await F2.saveEmployee(req.user, req.body))));
app.put('/api/employees/:id', guard(...STAFF), ah(async (req, res) => res.json(await F2.saveEmployee(req.user, req.body, +req.params.id))));
app.get('/api/payroll/runs', guard(...STAFF), ah(async (req, res) => res.json(await all('select r.*, j.no voucher from payroll_runs r left join journals j on j.id = r.journal_id order by month desc limit 36'))));
app.post('/api/payroll/run', guard(...STAFF), ah(async (req, res) => {
  const E = await all('select id, salary from employees where active'); const want = new Map((req.body.lines || []).map(l => [+l.employee_id, r2(l.amount)]));
  const amount = r2(E.reduce((s, e) => s + (want.has(e.id) ? want.get(e.id) : +e.salary), 0));
  res.json(await tx(c => submit(c, req.user, 'payroll', { ...req.body, amount })));
}));
app.post('/api/payroll/pay', guard(...STAFF), ah(async (req, res) => res.json(await tx(c => submit(c, req.user, 'salary', req.body)))));
app.get('/api/reports/general-ledger', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await F2.generalLedger(from, to, req.query.account ? String(req.query.account) : null)); }));
app.get('/api/reports/expenses', guard(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await F2.expenseReport(from, to)); }));

app.get('/api/health', ah(async (req, res) => { await q('select 1'); res.json({ ok: true, time: new Date().toISOString() }); }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- static app ---------- */
// service worker with a version stamp of the current files, so phones pick up each deploy
const swBody = (() => {
  const h = createHash('sha1');
  const walk = d => { for (const f of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|css|html|png|webmanifest)$/.test(f.name)) h.update(f.name).update(readFileSync(p)); } };
  walk(join(here, '..', 'public'));
  return readFileSync(join(here, '..', 'public', 'sw.js'), 'utf8').replace('__BUILD__', h.digest('hex').slice(0, 10));
})();
app.get('/sw.js', (req, res) => res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/javascript' }).send(swBody));
app.get('/vendor/html2canvas.min.js', (req, res) => res.sendFile(require.resolve('html2canvas/dist/html2canvas.min.js'), { maxAge: '7d' }));
app.get('/vendor/jspdf.umd.min.js', (req, res) => res.sendFile(require.resolve('jspdf/dist/jspdf.umd.min.js'), { maxAge: '7d' }));
app.use(express.static(join(here, '..', 'public'), { index: 'index.html', maxAge: '1h', setHeaders: (res, p) => { if (/\b(sw\.js|index\.html)$/.test(p)) res.set('Cache-Control', 'no-cache'); else if (/[\\/](brand|vendor)[\\/]|\.png$/.test(p)) res.set('Cache-Control', 'public, max-age=604800'); } }));
app.get(/^\/(?!api\/).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(join(here, '..', 'public', 'index.html')));

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Too much data in one request.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  const db = err.code && /^(23|22|P0)/.test(err.code);
  const status = err.status || (db ? 400 : 500);
  if (status >= 500 || db) console.error(err);
  // database errors are logged for us but never shown to the user (they reveal table and column names)
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Try again.' : db ? (err.code === '23505' ? 'This already exists.' : 'Some values are not valid. Please check and try again.') : err.message });
});

const port = +process.env.PORT || 3000;
// Start listening at once (the server sleeps when idle and must wake fast); API calls wait until the database is ready.
const ready = (async () => {
  const warming = warmPool();            // open connections while the schema check runs
  let fresh;
  // while a deploy switches over, the old release still holds connections: wait and retry instead of giving up
  for (let i = 0; ; i++) {
    try { fresh = await migrate(); break; } catch (e) { if (i >= 8 || e.code !== '53300') throw e; console.warn('DB busy, retrying…'); await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  await Promise.all([fresh ? seedAccounts() : null, seedAdmin(), warming]);
})();
ready.then(() => console.log('Database ready')).catch(e => { console.error('Startup failed:', e); process.exit(1); });
app.listen(port, () => console.log(`Qayam ERP listening on ${port}`));

process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)));
