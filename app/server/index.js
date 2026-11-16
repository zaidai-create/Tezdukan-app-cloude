import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pool, q, one, all, tx, migrate, seedAccounts } from './db.js';
import { requireAuth, hashPassword, checkPassword, makeToken, loginAllowed, loginFailed, loginOk, audit, seedAdmin } from './auth.js';
import { createInvoice, deleteInvoice, receipt, payment, expense, voucher, stockAdjust, UserError, r2, today } from './posting.js';
import { dashboard, ledger, trialBalance, profitLoss, balanceSheet, aging, dayBook, partyBalances } from './reports.js';
import { importLegacy, importCheck } from './importer.js';
import { parseVoice } from './voice.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' }); next(); });

const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const range = req => {
  const to = isDate(req.query.to) ? req.query.to : today();
  const from = isDate(req.query.from) ? req.query.from : to.slice(0, 8) + '01';
  return { from, to };
};
const STAFF = ['admin', 'accountant'];
const company = async () => (await one(`select value from settings where key='company'`))?.value || { name: 'Qayam Traders', address: '', phone: '', ntn: '', strn: '', footer: 'Thank you for your business.', tax_pct: 0 };

/* ---------- auth ---------- */
app.post('/api/auth/login', ah(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase(), pw = String(req.body.password || '');
  const key = `${req.ip}|${username}`;
  if (!loginAllowed(key)) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
  const u = await one('select * from users where username=$1', [username]);
  if (!u || !u.active || !checkPassword(pw, u.pass_hash)) { loginFailed(key); return res.status(401).json({ error: 'Wrong username or password.' }); }
  loginOk(key);
  await audit(u.id, 'login', 'user', u.id);
  res.json({ token: makeToken(u), user: { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change } });
}));

app.post('/api/me/password', requireAuth(), ah(async (req, res) => {
  const u = await one('select * from users where id=$1', [req.user.id]);
  if (!checkPassword(String(req.body.old || ''), u.pass_hash)) throw new UserError('Current password is wrong.');
  const pw = String(req.body.new || '');
  if (pw.length < 8) throw new UserError('Use at least 8 characters.');
  const r = await one('update users set pass_hash=$1, must_change=false, token_version=token_version+1 where id=$2 returning *', [hashPassword(pw), u.id]);
  await audit(u.id, 'password', 'user', u.id);
  res.json({ token: makeToken(r) });
}));

/* ---------- boot: everything the app needs to start ---------- */
app.get('/api/boot', requireAuth(), ah(async (req, res) => {
  const staff = STAFF.includes(req.user.role);
  const products = await all(`select p.id, p.name, p.category, p.unit, p.price, p.stock, p.reorder, p.aliases${staff ? ', p.cost' : ''},
      coalesce((select sum(il.qty) from invoice_lines il join invoices i on i.id=il.invoice_id where il.product_id=p.id and i.kind='sale'),0) sold
    from products p where p.active order by sold desc, p.name`);
  const cb = await partyBalances('C'), vb = staff ? await partyBalances('V') : {};
  const parties = await all(`select id, kind, name, city, phone, address, ntn, credit_limit from parties where active ${staff ? '' : "and kind='C'"} order by name`);
  parties.forEach(p => { p.balance = (p.kind === 'C' ? cb[p.id] : vb[p.id]) || 0; });
  const accounts = staff ? await all('select code, name, type, grp, system from accounts order by code') : await all(`select code, name, type, grp from accounts where code='1000'`);
  res.json({ user: req.user, company: await company(), products, parties, accounts, today: today() });
}));

/* ---------- dashboard & reports ---------- */
app.get('/api/dashboard', requireAuth(), ah(async (req, res) => { const { from, to } = range(req); res.json(await dashboard(req.user, from, to)); }));
app.get('/api/reports/trial-balance', requireAuth(...STAFF), ah(async (req, res) => res.json(await trialBalance(range(req).to))));
app.get('/api/reports/profit-loss', requireAuth(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await profitLoss(from, to)); }));
app.get('/api/reports/balance-sheet', requireAuth(...STAFF), ah(async (req, res) => res.json(await balanceSheet(range(req).to))));
app.get('/api/reports/aging', requireAuth(), ah(async (req, res) => res.json(await aging(range(req).to))));
app.get('/api/reports/day-book', requireAuth(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await dayBook(from, to)); }));
app.get('/api/reports/account-ledger', requireAuth(...STAFF), ah(async (req, res) => { const { from, to } = range(req); res.json(await ledger(String(req.query.account), null, from, to)); }));
app.get('/api/reports/stock', requireAuth(), ah(async (req, res) => {
  const staff = STAFF.includes(req.user.role);
  res.json(await all(`select id, name, category, unit, stock, price, reorder${staff ? ', cost, round(greatest(stock,0)*cost, 2) value' : ''} from products where active order by name`));
}));

/* ---------- parties ---------- */
app.get('/api/parties/:id/ledger', requireAuth(), ah(async (req, res) => {
  const p = await one('select * from parties where id=$1', [+req.params.id]);
  if (!p || (req.user.role === 'salesman' && p.kind !== 'C')) throw new UserError('Not found.', 404);
  const from = isDate(req.query.from) ? req.query.from : '2000-01-01', to = isDate(req.query.to) ? req.query.to : today();
  const l = await ledger(p.kind === 'C' ? '1200' : '2000', p.id, from, to);
  if (p.kind === 'V') { l.opening = -l.opening; l.closing = -l.closing; l.lines.forEach(x => { x.balance = -x.balance; }); }
  res.json({ party: p, from, to, ...l, company: await company() });
}));
app.get('/api/parties/:id/rates', requireAuth(), ah(async (req, res) => {
  // last rate this party paid/charged for each product, for auto-filling bills
  const rows = await all(`select distinct on (il.product_id) il.product_id, il.rate from invoice_lines il join invoices i on i.id=il.invoice_id
    where i.party_id=$1 and i.kind in ('sale','purchase') order by il.product_id, i.date desc, i.id desc`, [+req.params.id]);
  res.json(Object.fromEntries(rows.map(r => [r.product_id, r.rate])));
}));
const partyFields = b => [String(b.name || '').trim(), String(b.city || '').trim(), String(b.phone || '').trim(), String(b.address || '').trim(), String(b.ntn || '').trim(), r2(b.credit_limit)];
app.post('/api/parties', requireAuth(), ah(async (req, res) => {
  const kind = req.user.role === 'salesman' ? 'C' : (req.body.kind === 'V' ? 'V' : 'C');
  const f = partyFields(req.body); if (!f[0]) throw new UserError('Enter a name.');
  const dup = await one('select id from parties where kind=$1 and lower(name)=lower($2)', [kind, f[0]]);
  if (dup) throw new UserError('This name already exists.');
  const r = await one('insert into parties(kind, name, city, phone, address, ntn, credit_limit) values($1,$2,$3,$4,$5,$6,$7) returning *', [kind, ...f]);
  await audit(req.user.id, 'create', 'party', r.id, { name: r.name });
  res.json({ ...r, balance: 0 });
}));
app.put('/api/parties/:id', requireAuth(), ah(async (req, res) => {
  const p = await one('select * from parties where id=$1', [+req.params.id]);
  if (!p || (req.user.role === 'salesman' && p.kind !== 'C')) throw new UserError('Not found.', 404);
  const f = partyFields({ ...p, ...req.body }); if (!f[0]) throw new UserError('Enter a name.');
  if (req.user.role === 'salesman') f[5] = p.credit_limit;
  const r = await one('update parties set name=$1, city=$2, phone=$3, address=$4, ntn=$5, credit_limit=$6, active=$7 where id=$8 returning *', [...f, req.body.active === false && req.user.role === 'admin' ? false : true, p.id]);
  await audit(req.user.id, 'update', 'party', p.id, { before: p, after: r });
  res.json(r);
}));

/* ---------- products ---------- */
const prodFields = b => [String(b.name || '').trim(), String(b.category || '').trim(), String(b.unit || 'pc').trim() || 'pc', r2(b.cost), r2(b.price), +b.reorder || 0, String(b.aliases || '').trim()];
app.post('/api/products', requireAuth(...STAFF), ah(async (req, res) => {
  const f = prodFields(req.body); if (!f[0]) throw new UserError('Enter a product name.');
  const r = await one('insert into products(name, category, unit, cost, price, reorder, aliases) values($1,$2,$3,$4,$5,$6,$7) returning *', f);
  await audit(req.user.id, 'create', 'product', r.id, { name: r.name });
  res.json({ ...r, sold: 0 });
}));
app.put('/api/products/:id', requireAuth(...STAFF), ah(async (req, res) => {
  const p = await one('select * from products where id=$1', [+req.params.id]); if (!p) throw new UserError('Not found.', 404);
  const f = prodFields({ ...p, ...req.body }); if (!f[0]) throw new UserError('Enter a product name.');
  const r = await one('update products set name=$1, category=$2, unit=$3, cost=$4, price=$5, reorder=$6, aliases=$7, active=$8 where id=$9 returning *', [...f, req.body.active !== false, p.id]);
  await audit(req.user.id, 'update', 'product', p.id, { before: p, after: r });
  res.json(r);
}));
app.post('/api/products/:id/adjust', requireAuth(...STAFF), ah(async (req, res) => { await tx(c => stockAdjust(c, req.user, { ...req.body, product_id: +req.params.id })); res.json({ ok: true }); }));

/* ---------- accounts ---------- */
app.get('/api/accounts', requireAuth(...STAFF), ah(async (req, res) => {
  const b = Object.fromEntries((await all('select account, sum(debit-credit) b from journal_lines group by account')).map(r => [r.account, r2(r.b)]));
  res.json((await all('select * from accounts order by code')).map(a => ({ ...a, balance: b[a.code] || 0 })));
}));
app.post('/api/accounts', requireAuth(...STAFF), ah(async (req, res) => {
  const { code, name, type, grp } = req.body;
  if (!/^\d{3,8}$/.test(String(code || ''))) throw new UserError('Account code must be 3 to 8 digits.');
  if (!String(name || '').trim() || !'ABCDE'.includes(type) || !type) throw new UserError('Enter a name and choose a type.');
  const r = await one('insert into accounts(code, name, type, grp) values($1,$2,$3,$4) on conflict do nothing returning *', [String(code), String(name).trim(), type, String(grp || '').trim()]);
  if (!r) throw new UserError('This account code already exists.');
  await audit(req.user.id, 'create', 'account', r.code, r);
  res.json(r);
}));

/* ---------- bills ---------- */
app.get('/api/invoices', requireAuth(), ah(async (req, res) => {
  const kind = ['sale', 'purchase', 'sale_return', 'purchase_return'].includes(req.query.kind) ? req.query.kind : 'sale';
  if (req.user.role === 'salesman' && kind !== 'sale') throw new UserError('Not allowed.', 403);
  const p = [kind], w = ['i.kind = $1'];
  if (req.user.role === 'salesman') { p.push(req.user.id); w.push(`i.created_by = $${p.length}`); }
  if (req.query.party) { p.push(+req.query.party); w.push(`i.party_id = $${p.length}`); }
  if (isDate(req.query.from)) { p.push(req.query.from); w.push(`i.date >= $${p.length}`); }
  if (isDate(req.query.to)) { p.push(req.query.to); w.push(`i.date <= $${p.length}`); }
  if (req.query.q) { p.push('%' + String(req.query.q).toLowerCase() + '%'); w.push(`(lower(pt.name) like $${p.length} or lower(i.no) like $${p.length})`); }
  const lim = Math.min(+req.query.limit || 60, 300), off = Math.max(+req.query.offset || 0, 0);
  res.json(await all(`select i.id, i.no, i.date, i.total, i.paid, i.kind, i.legacy, i.source, pt.name party, pt.id party_id from invoices i left join parties pt on pt.id=i.party_id
    where ${w.join(' and ')} order by i.date desc, i.id desc limit ${lim} offset ${off}`, p));
}));
app.get('/api/invoices/:id', requireAuth(), ah(async (req, res) => {
  const inv = await one('select i.*, u.name created_by_name from invoices i left join users u on u.id=i.created_by where i.id=$1', [+req.params.id]);
  if (!inv || (req.user.role === 'salesman' && (inv.created_by !== req.user.id || inv.kind !== 'sale'))) throw new UserError('Not found.', 404);
  const lines = await all(`select il.qty, il.rate, il.amount, p.name, p.unit${STAFF.includes(req.user.role) ? ', il.cost' : ''} from invoice_lines il left join products p on p.id=il.product_id where il.invoice_id=$1 order by il.id`, [inv.id]);
  const party = await one('select id, kind, name, city, phone, address, ntn from parties where id=$1', [inv.party_id]);
  let before = 0;
  if (party) {
    const acc = party.kind === 'C' ? '1200' : '2000';
    const minj = (await one('select min(id) m from journals where ref_invoice=$1', [inv.id])).m || 0;
    const b = await one(`select coalesce(sum(jl.debit - jl.credit),0) b from journal_lines jl join journals j on j.id=jl.journal_id
      where jl.account=$1 and jl.party_id=$2 and (j.date < $3 or (j.date = $3 and j.id < $4))`, [acc, party.id, inv.date, minj]);
    before = party.kind === 'C' ? r2(b.b) : r2(-b.b);
  }
  if (!STAFF.includes(req.user.role)) delete inv.pay_account;
  res.json({ invoice: inv, lines, party, company: await company(), previous: before, after: r2(before + (inv.kind.endsWith('return') ? -inv.total : inv.total) - inv.paid) });
}));
app.post('/api/invoices', requireAuth(), ah(async (req, res) => {
  if (req.user.role === 'salesman' && req.body.kind !== 'sale') throw new UserError('Salesmen can make sale bills only.', 403);
  res.json(await tx(c => createInvoice(c, req.user, req.body)));
}));
app.delete('/api/invoices/:id', requireAuth('admin'), ah(async (req, res) => { await tx(c => deleteInvoice(c, req.user, +req.params.id)); res.json({ ok: true }); }));

/* ---------- money ---------- */
app.post('/api/receipts', requireAuth(), ah(async (req, res) => res.json(await tx(c => receipt(c, req.user, req.body)))));
app.post('/api/payments', requireAuth(...STAFF), ah(async (req, res) => res.json(await tx(c => payment(c, req.user, req.body)))));
app.post('/api/expenses', requireAuth(...STAFF), ah(async (req, res) => res.json(await tx(c => expense(c, req.user, req.body)))));
app.post('/api/vouchers', requireAuth(...STAFF), ah(async (req, res) => res.json(await tx(c => voucher(c, req.user, req.body)))));
app.get('/api/journals/:id', requireAuth(...STAFF), ah(async (req, res) => {
  const j = await one('select * from journals where id=$1', [+req.params.id]); if (!j) throw new UserError('Not found.', 404);
  j.lines = await all('select jl.*, a.name account_name, p.name party from journal_lines jl join accounts a on a.code=jl.account left join parties p on p.id=jl.party_id where journal_id=$1 order by jl.id', [j.id]);
  res.json(j);
}));
app.delete('/api/journals/:id', requireAuth('admin'), ah(async (req, res) => {
  const j = await one('select * from journals where id=$1', [+req.params.id]); if (!j) throw new UserError('Not found.', 404);
  if (j.ref_invoice) throw new UserError('This entry belongs to a bill. Cancel the bill instead.');
  if (j.legacy) throw new UserError('Entries from the old software cannot be deleted. Make a correcting voucher.');
  await q('delete from journals where id=$1', [j.id]); await audit(req.user.id, 'delete', 'journal', j.id, { no: j.no, memo: j.memo });
  res.json({ ok: true });
}));

/* ---------- voice entry: understand, then the user approves ---------- */
async function voiceContext() {
  const products = await all(`select p.id, p.name, p.unit, p.price, p.cost, p.aliases, coalesce((select sum(il.qty) from invoice_lines il join invoices i on i.id=il.invoice_id where il.product_id=p.id and i.kind='sale'),0) sold from products p where p.active`);
  const parties = await all('select id, kind, name from parties where active');
  const expenseAccounts = await all(`select code, name from accounts where type='D' and grp <> 'Cost of Sales' and code <> '5000' order by code`);
  const last = await all(`select distinct on (i.party_id, il.product_id) i.party_id, il.product_id, il.rate from invoice_lines il join invoices i on i.id=il.invoice_id
    where i.kind in ('sale','purchase') order by i.party_id, il.product_id, i.date desc, i.id desc`);
  const lr = new Map(last.map(r => [r.party_id + ':' + r.product_id, r.rate]));
  const sold = new Map(products.map(p => [p.id, p.sold]));
  return { products, customers: parties.filter(p => p.kind === 'C'), vendors: parties.filter(p => p.kind === 'V'), expenseAccounts, lastRate: (p, party) => lr.get(party + ':' + p) || 0, rank: id => sold.get(id) || 0 };
}
app.post('/api/voice/parse', requireAuth(), ah(async (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) throw new UserError('Kuch bolein ya likhein.');
  const draft = parseVoice(text, await voiceContext());
  if (req.user.role === 'salesman' && !['sale', 'receipt', 'unknown'].includes(draft.intent)) { draft.notes.push('Aap sirf sale aur recovery entry kar sakte hain.'); draft.intent = 'unknown'; }
  const r = await one('insert into voice_drafts(text, draft, created_by) values($1,$2,$3) returning id', [text, JSON.stringify(draft), req.user.id]);
  res.json({ id: r.id, draft });
}));
app.post('/api/voice/:id/approve', requireAuth(), ah(async (req, res) => {
  const vd = await one('select * from voice_drafts where id=$1 and created_by=$2', [+req.params.id, req.user.id]);
  if (!vd) throw new UserError('Draft not found.', 404);
  if (vd.status !== 'pending') throw new UserError('This entry was already handled.');
  const d = req.body.draft || vd.draft;
  const result = await tx(async c => {
    const staff = STAFF.includes(req.user.role);
    let partyId = d.party?.id || null;
    if (!partyId && d.party?.name && d.intent !== 'expense') {
      const kind = d.intent === 'purchase' || d.intent === 'payment' ? 'V' : 'C';
      if (kind === 'V' && !staff) throw new UserError('Only admin or accountant can add a supplier.');
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
      return { kind: d.intent, ...(await createInvoice(c, req.user, { kind: d.intent, party_id: partyId, lines, paid, pay_account: payAcc, tax_pct: d.tax_pct ?? company0.tax_pct ?? 0, discount: d.discount || 0, note: `Voice: ${vd.text}`.slice(0, 500), source: 'voice', date: d.date })) };
    }
    if (d.intent === 'receipt') {
      const acc = d.payment?.account || (d.payment?.mode === 'bank' ? (await c.query(`select code from accounts where grp='Cash & Bank' and code<>'1000' order by code limit 1`)).rows[0]?.code : '1000');
      return { kind: 'receipt', ...(await receipt(c, req.user, { party_id: partyId, amount: d.amount, account: acc, note: 'Voice entry', date: d.date })) };
    }
    if (!staff) throw new UserError('Aap sirf sale aur recovery entry kar sakte hain.');
    if (d.intent === 'payment') {
      const acc = d.payment?.account || (d.payment?.mode === 'bank' ? (await c.query(`select code from accounts where grp='Cash & Bank' and code<>'1000' order by code limit 1`)).rows[0]?.code : '1000');
      return { kind: 'payment', ...(await payment(c, req.user, { party_id: partyId, amount: d.amount, account: acc, note: 'Voice entry', date: d.date })) };
    }
    if (d.intent === 'expense') return { kind: 'expense', ...(await expense(c, req.user, { account: d.account?.code, amount: d.amount, pay_account: d.payment?.account || '1000', note: d.note || 'Voice entry', date: d.date })) };
    throw new UserError('Choose what this entry is: sale, purchase, receipt, payment or expense.');
  });
  await q(`update voice_drafts set status='approved', decided_at=now(), draft=$2, result=$3 where id=$1`, [vd.id, JSON.stringify(d), JSON.stringify(result)]);
  res.json(result);
}));
app.post('/api/voice/:id/reject', requireAuth(), ah(async (req, res) => {
  await q(`update voice_drafts set status='rejected', decided_at=now() where id=$1 and created_by=$2 and status='pending'`, [+req.params.id, req.user.id]);
  res.json({ ok: true });
}));

/* ---------- users & settings (admin) ---------- */
app.get('/api/users', requireAuth('admin'), ah(async (req, res) => res.json(await all('select id, username, name, role, active, phone, must_change, created_at from users order by name'))));
app.post('/api/users', requireAuth('admin'), ah(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase(), name = String(req.body.name || '').trim(), role = req.body.role, pw = String(req.body.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new UserError('Username: 3 to 30 letters or numbers, no spaces.');
  if (!name || !['admin', 'accountant', 'salesman'].includes(role)) throw new UserError('Enter a name and choose a role.');
  if (pw.length < 8) throw new UserError('Password needs at least 8 characters.');
  if (await one('select 1 from users where username=$1', [username])) throw new UserError('This username is taken.');
  const r = await one('insert into users(username, name, role, pass_hash, phone, must_change) values($1,$2,$3,$4,$5,true) returning id, username, name, role, active, phone', [username, name, role, hashPassword(pw), String(req.body.phone || '')]);
  await audit(req.user.id, 'create', 'user', r.id, { username, role });
  res.json(r);
}));
app.put('/api/users/:id', requireAuth('admin'), ah(async (req, res) => {
  const u = await one('select * from users where id=$1', [+req.params.id]); if (!u) throw new UserError('Not found.', 404);
  if (u.id === req.user.id && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) throw new UserError('You cannot remove your own admin access.');
  const role = ['admin', 'accountant', 'salesman'].includes(req.body.role) ? req.body.role : u.role;
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
app.get('/api/settings', requireAuth(), ah(async (req, res) => res.json(await company())));
app.put('/api/settings', requireAuth('admin'), ah(async (req, res) => {
  const c0 = await company(), b = req.body;
  const v = { ...c0, ...Object.fromEntries(['name', 'address', 'phone', 'ntn', 'strn', 'footer', 'email'].filter(k => b[k] !== undefined).map(k => [k, String(b[k]).slice(0, 300)])), tax_pct: b.tax_pct !== undefined ? Math.max(+b.tax_pct || 0, 0) : c0.tax_pct };
  await q(`insert into settings(key, value) values('company',$1) on conflict (key) do update set value=excluded.value`, [JSON.stringify(v)]);
  await audit(req.user.id, 'update', 'settings', 'company', v);
  res.json(v);
}));
app.get('/api/audit', requireAuth('admin'), ah(async (req, res) => res.json(await all('select a.*, u.name user_name from audit_log a left join users u on u.id=a.user_id order by a.id desc limit 200'))));

/* ---------- import & backup (admin) ---------- */
app.post('/api/admin/import', requireAuth('admin'), ah(async (req, res) => {
  if (req.body.confirm !== 'REPLACE') throw new UserError('Type REPLACE to confirm. This replaces all bills, parties, products and ledger entries.');
  const summary = await tx(c => importLegacy(c, req.user, req.body.data));
  res.json({ ...summary, ...(await importCheck()) });
}));
app.get('/api/admin/backup', requireAuth('admin'), ah(async (req, res) => {
  const out = { exported_at: new Date().toISOString(), version: 1 };
  for (const t of ['settings', 'accounts', 'parties', 'products', 'invoices', 'invoice_lines', 'journals', 'journal_lines', 'counters']) out[t] = await all(`select * from ${t}`);
  out.users = await all('select id, username, name, role, active, phone from users');
  await audit(req.user.id, 'backup', 'all', null);
  res.set('Content-Disposition', `attachment; filename="qayam-backup-${today()}.json"`).json(out);
}));

app.get('/api/health', ah(async (req, res) => { await q('select 1'); res.json({ ok: true, time: new Date().toISOString() }); }));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

/* ---------- static app ---------- */
app.get('/vendor/html2canvas.min.js', (req, res) => res.sendFile(require.resolve('html2canvas/dist/html2canvas.min.js')));
app.get('/vendor/jspdf.umd.min.js', (req, res) => res.sendFile(require.resolve('jspdf/dist/jspdf.umd.min.js')));
app.use(express.static(join(here, '..', 'public'), { index: 'index.html', maxAge: '1h', setHeaders: (res, p) => { if (/\b(sw\.js|index\.html)$/.test(p)) res.set('Cache-Control', 'no-cache'); } }));
app.get(/^\/(?!api\/).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(join(here, '..', 'public', 'index.html')));

app.use((err, req, res, next) => {
  const status = err.status || (err.code && /^(23|22|P0)/.test(err.code) ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Try again.' : err.message });
});

const port = +process.env.PORT || 3000;
(async () => {
  await migrate();
  await seedAccounts();
  await seedAdmin();
  app.listen(port, () => console.log(`Qayam ERP listening on ${port}`));
})().catch(e => { console.error('Startup failed:', e); process.exit(1); });

process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)));
