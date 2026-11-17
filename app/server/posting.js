// All money movements go through here. Every function runs inside a DB transaction (client `c`)
// and writes a balanced double-entry journal; the database re-checks the balance at commit.
// The app server is far from the database, so each function is written to need as few round trips as possible.
import { audit } from './auth.js';

export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
export const fyOf = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7), s = m >= 7 ? y : y - 1; return `${String(s % 100).padStart(2, '0')}${String((s + 1) % 100).padStart(2, '0')}`; };

export class UserError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
export const need = (cond, msg) => { if (!cond) throw new UserError(msg); };
export const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Period lock: nothing on or before the locked date can be added or cancelled (books closed).
export async function checkLock(c, date) {
  const r = (await c.query(`select value->>'lock_date' d from settings where key='company'`)).rows[0];
  const lock = r?.d && /^\d{4}-\d{2}-\d{2}$/.test(r.d) ? r.d : null;
  const d = String(date).slice(0, 10);
  need(!lock || d > lock, `Books are closed up to ${lock}. Use a later date, or ask the owner to open the period.`);
}

export const JPREFIX = { 'Sale Entry': 'SV', 'Purchase Entry': 'PV', 'Cash Receipt': 'CRV', 'Bank Receipt': 'BRV', 'Cash Payment': 'CPV', 'Bank Payment': 'BPV', 'Journal': 'JV', 'Sales Return Entry': 'SRV', 'Purchase Return Entry': 'PRV', 'Stock Adjustment': 'SAV' };

// Post several journals in ONE round trip (database function post_journals checks lock date and balance).
export async function postJournals(c, list) {
  const js = list.map(j => {
    const lines = j.lines.map(l => ({ account: l.account, party_id: l.party_id || null, debit: r2(l.debit), credit: r2(l.credit) })).filter(l => l.debit > 0 || l.credit > 0);
    const d = r2(lines.reduce((a, l) => a + l.debit, 0)), k = r2(lines.reduce((a, l) => a + l.credit, 0));
    need(lines.length >= 2, 'An entry needs at least one debit and one credit line.');
    need(d === k, `Debit (${d}) and credit (${k}) must be equal.`);
    return { date: j.date, type: j.type, prefix: JPREFIX[j.type] || 'JV', memo: String(j.memo || '').slice(0, 500), ref_invoice: j.ref_invoice || null, user_id: j.user_id || null, lines };
  });
  if (!js.length) return [];
  return (await c.query('select post_journals($1::jsonb) r', [JSON.stringify(js)])).rows[0].r;
}
export async function postJournal(c, j) { return (await postJournals(c, [j]))[0]; }

const isCash = a => a.code === '1000' || /cash/i.test(a.name);
// Party + account lookups in one query
async function lookup(c, { partyId = null, accounts = [] }) {
  const r = (await c.query(`select (select row_to_json(x) from (select id, kind, name, credit_limit from parties where id=$1 and active) x) party,
      (select coalesce(json_object_agg(code, json_build_object('code', code, 'name', name, 'type', type, 'grp', grp)), '{}') from accounts where code = any($2::text[])) accs`,
  [partyId, accounts.filter(Boolean).map(String)])).rows[0];
  return { party: r.party, accs: r.accs };
}
function checkParty(p, kind) {
  need(p, kind === 'C' ? 'Choose a customer.' : 'Choose a supplier.');
  need(p.kind === kind, kind === 'C' ? 'This party is a supplier, not a customer.' : 'This party is a customer, not a supplier.');
  return p;
}
function checkCash(a, code) {
  need(a, `Account ${code} does not exist.`);
  need(a.grp === 'Cash & Bank', `${a.name} is not a cash or bank account.`);
  return a;
}

export const KINDS = {
  sale:            { party: 'C', prefix: 'QT', width: 6, stock: -1, label: 'Sale' },
  purchase:        { party: 'V', prefix: 'PI', width: 4, stock: +1, label: 'Purchase' },
  sale_return:     { party: 'C', prefix: 'SR', width: 4, stock: +1, label: 'Sales return' },
  purchase_return: { party: 'V', prefix: 'PR', width: 4, stock: -1, label: 'Purchase return' },
};

// Same arithmetic as createInvoice, used to decide whether a bill needs an owner's approval.
export function invoiceTotals(b) {
  const lines = (Array.isArray(b.lines) ? b.lines : []).map(l => ({ qty: r3(l.qty), rate: r2(l.rate) }));
  const subtotal = r2(lines.reduce((a, l) => a + r2(l.qty * l.rate), 0));
  const discount = Math.min(Math.max(r2(b.discount), 0), subtotal);
  const net = r2(subtotal - discount);
  const tax_pct = Math.max(r2(b.tax_pct), 0);
  const tax = r2(net * tax_pct / 100);
  const total = r2(net + tax);
  return { subtotal, discount, net, tax_pct, tax, total, paid: Math.min(Math.max(r2(b.paid), 0), total) };
}

export async function createInvoice(c, user, b, old = null) {
  const K = KINDS[b.kind];
  need(K, 'Unknown bill type.');
  if (user.role === 'salesman') { need(b.kind === 'sale', 'Salesmen can make sale bills only.'); b.pay_account = '1000'; }
  const date = isDate(b.date) ? b.date : today();
  need(Array.isArray(b.lines) && b.lines.length, 'Add at least one item.');
  for (const l of b.lines) { need(r3(l.qty) > 0, 'Every item needs a quantity above zero.'); need(r2(l.rate) > 0, 'Every item needs a rate above zero.'); }
  const T = invoiceTotals(b);
  need(T.total > 0, 'The bill total must be above zero.');
  const payCode = String(b.pay_account || '1000');
  const ids = [...new Set(b.lines.map(l => +l.product_id))];

  // 1 trip: party, products (locked), pay account
  const r = (await c.query(`select (select row_to_json(x) from (select id, kind, name, credit_limit from parties where id=$1 and active) x) party,
      (select coalesce(json_agg(x), '[]') from (select id, name, cost, stock, price from products where id = any($2::int[]) and active order by id for update) x) prods,
      (select row_to_json(x) from (select code, name, grp from accounts where code=$3) x) acc`, [+b.party_id, ids, payCode])).rows[0];
  const p = checkParty(r.party, K.party);
  const prods = new Map(r.prods.map(x => [x.id, x]));
  const withTp = b.kind === 'sale' || b.kind === 'sale_return';
  const lines = b.lines.map(l => {
    const pr = prods.get(+l.product_id); need(pr, 'One of the products no longer exists.');
    const qty = r3(l.qty), rate = r2(l.rate);
    // TP shown on the bill: the price list rate (or what the user saw), never below the rate charged
    const tp = withTp ? Math.max(r2(l.tp) > 0 ? r2(l.tp) : r2(pr.price), rate) : null;
    return { pr, qty, rate, tp, amount: r2(qty * rate) };
  });
  const paid = (b.kind === 'sale' || b.kind === 'purchase') ? T.paid : 0;
  const payAcc = paid > 0 ? checkCash(r.acc, payCode) : null;

  // 1 trip: bill number + bill row (an edited bill keeps its id and number)
  const key = `${K.prefix}-${fyOf(date)}`;
  const inv = old ? (await c.query(`update invoices set date=$2, party_id=$3, subtotal=$4, discount=$5, tax_pct=$6, tax=$7, total=$8, paid=$9, pay_account=$10, note=$11, edited_at=now(), edited_by=$12
      where id=$1 returning id, no`, [old.id, date, p.id, T.subtotal, T.discount, T.tax_pct, T.tax, T.total, paid, payAcc ? payAcc.code : null, String(b.note || '').slice(0, 500), user.id])).rows[0] : (await c.query(`with n as (insert into counters(key, n) values($1, 1) on conflict (key) do update set n = counters.n + 1 returning n)
    insert into invoices(kind, no, date, party_id, subtotal, discount, tax_pct, tax, total, paid, pay_account, note, source, created_by, ref_no)
    select $2, $1 || '-' || lpad(n.n::text, $3, '0'), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16 from n returning id, no`,
  [key, b.kind, K.width, date, p.id, T.subtotal, T.discount, T.tax_pct, T.tax, T.total, paid, payAcc ? payAcc.code : null, String(b.note || '').slice(0, 500), b.source === 'voice' ? 'voice' : 'app', user.id, String(b.ref_no || '').slice(0, 40)])).rows[0];

  // stock and weighted-average cost per product
  const per = new Map();
  for (const l of lines) { const x = per.get(l.pr.id) || { pr: l.pr, qty: 0, val: 0 }; x.qty += l.qty; x.val += l.amount; per.set(l.pr.id, x); }
  const upd = [...per.values()].map(x => {
    if (b.kind !== 'purchase') return [x.pr.id, K.stock * x.qty, null];
    const have = Math.max(+x.pr.stock, 0), unitNet = T.net > 0 && T.subtotal > 0 ? (x.val * (T.net / T.subtotal)) / x.qty : x.val / x.qty;
    return [x.pr.id, x.qty, have + x.qty > 0 ? r2((have * +x.pr.cost + x.qty * unitNet) / (have + x.qty)) : r2(unitNet)];
  });
  // 1 trip: lines + stock
  await c.query(`with li as (insert into invoice_lines(invoice_id, product_id, qty, rate, cost, amount, tp)
      select $1, * from unnest($2::int[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $10::numeric[]) returning 1),
    up as (update products p set stock = p.stock + x.d, cost = coalesce(x.c, p.cost) from unnest($7::int[], $8::numeric[], $9::numeric[]) x(id, d, c) where p.id = x.id returning 1)
    select (select count(*) from li) a, (select count(*) from up) b`,
  [inv.id, lines.map(l => l.pr.id), lines.map(l => l.qty), lines.map(l => l.rate), lines.map(l => r2(l.pr.cost)), lines.map(l => l.amount), upd.map(u => u[0]), upd.map(u => u[1]), upd.map(u => u[2]), lines.map(l => l.tp)]);

  const cogs = r2(lines.reduce((a, l) => a + r2(l.qty * r2(l.pr.cost)), 0));
  const memo = `${K.label} ${inv.no} · ${p.name}`;
  const J = (type, ls) => ({ date, type, memo, lines: ls, ref_invoice: inv.id, user_id: user.id });
  const { total, net, tax } = T;
  const js = [];
  if (b.kind === 'sale') {
    js.push(J('Sale Entry', [{ account: '1200', party_id: p.id, debit: total }, { account: '4000', credit: net }, { account: '2200', credit: tax }, { account: '5000', debit: cogs }, { account: '1300', credit: cogs }]));
    if (paid > 0) js.push(J(isCash(payAcc) ? 'Cash Receipt' : 'Bank Receipt', [{ account: payAcc.code, debit: paid }, { account: '1200', party_id: p.id, credit: paid }]));
  } else if (b.kind === 'purchase') {
    js.push(J('Purchase Entry', [{ account: '1300', debit: net }, { account: '2200', debit: tax }, { account: '2000', party_id: p.id, credit: total }]));
    if (paid > 0) js.push(J(isCash(payAcc) ? 'Cash Payment' : 'Bank Payment', [{ account: '2000', party_id: p.id, debit: paid }, { account: payAcc.code, credit: paid }]));
  } else if (b.kind === 'sale_return') {
    js.push(J('Sales Return Entry', [{ account: '4000', debit: net }, { account: '2200', debit: tax }, { account: '1200', party_id: p.id, credit: total }, { account: '1300', debit: cogs }, { account: '5000', credit: cogs }]));
  } else {
    js.push(J('Purchase Return Entry', [{ account: '2000', party_id: p.id, debit: total }, { account: '1300', credit: net }, { account: '2200', credit: tax }]));
  }
  // 1 trip: all journals
  await postJournals(c, js);
  if (old) audit(user.id, 'edit', 'invoice', inv.id, { kind: b.kind, no: inv.no, total, before: old.total, party: p.name, approval: b.approval_id || undefined });
  else audit(user.id, 'create', 'invoice', inv.id, { kind: b.kind, no: inv.no, total, party: p.name, source: b.source || 'app', approval: b.approval_id || undefined });
  return { id: inv.id, no: inv.no, total, edited: !!old };
}

// Edit a bill: undo its stock and ledger entries, then write it again with the same number.
export async function loadEditable(c, id) {
  const old = (await c.query('select * from invoices where id=$1 for update', [+id])).rows[0];
  need(old, 'Bill not found.');
  need(!old.legacy, 'Bills from the old software cannot be edited. Make a return or a new bill instead.');
  return old;
}
export async function editInvoice(c, user, b) {
  const old = await loadEditable(c, b.invoice_id);
  if (user.role === 'salesman') need(old.kind === 'sale' && old.created_by === user.id, 'You can only edit your own sale bills.');
  await checkLock(c, old.date);
  await c.query(`with s as (select product_id, sum(qty) q from invoice_lines where invoice_id=$1 group by product_id),
      u as (update products p set stock = p.stock - $2 * s.q from s where p.id = s.product_id returning 1),
      dj as (delete from journals where ref_invoice=$1 returning 1),
      dl as (delete from invoice_lines where invoice_id=$1 returning 1)
    select (select count(*) from u) + (select count(*) from dj) + (select count(*) from dl) n`, [old.id, KINDS[old.kind].stock]);
  return createInvoice(c, user, { ...b, kind: old.kind, source: old.source }, old);
}

export async function deleteInvoice(c, user, id) {
  const inv = (await c.query('select * from invoices where id=$1 for update', [id])).rows[0];
  need(inv, 'Bill not found.');
  need(!inv.legacy, 'Bills from the old software cannot be cancelled here. Make a return instead.');
  await checkLock(c, inv.date);
  const sign = KINDS[inv.kind].stock;
  await c.query(`with s as (select product_id, sum(qty) q from invoice_lines where invoice_id=$1 group by product_id)
    update products p set stock = p.stock - $2 * s.q from s where p.id = s.product_id`, [id, sign]);
  await c.query('delete from journals where ref_invoice=$1', [id]);
  await c.query('delete from invoices where id=$1', [id]);
  audit(user.id, 'cancel', 'invoice', id, { no: inv.no, total: inv.total });
}

export async function receipt(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const code = user.role === 'salesman' ? '1000' : String(b.account || '1000');
  const { party: p0, accs } = await lookup(c, { partyId: +b.party_id, accounts: [code] });
  const p = checkParty(p0, 'C'), acc = checkCash(accs[code], code);
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Receipt' : 'Bank Receipt', memo: `Received from ${p.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: acc.code, debit: amt }, { account: '1200', party_id: p.id, credit: amt }] });
  audit(user.id, 'create', 'receipt', j.id, { party: p.name, amt, no: j.no, approval: b.approval_id || undefined });
  return { ...j, party_id: p.id, amount: amt };
}

export async function payment(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const code = String(b.account || '1000');
  const { party: p0, accs } = await lookup(c, { partyId: +b.party_id, accounts: [code] });
  const p = checkParty(p0, 'V'), acc = checkCash(accs[code], code);
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Payment' : 'Bank Payment', memo: `Paid to ${p.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: '2000', party_id: p.id, debit: amt }, { account: acc.code, credit: amt }] });
  audit(user.id, 'create', 'payment', j.id, { party: p.name, amt, no: j.no, approval: b.approval_id || undefined });
  return { ...j, party_id: p.id, amount: amt };
}

export async function expense(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const code = String(b.pay_account || '1000');
  const { accs } = await lookup(c, { accounts: [b.account, code] });
  const ex = accs[b.account]; need(ex, `Account ${b.account} does not exist.`); need(ex.type === 'D', 'Choose an expense account.');
  const acc = checkCash(accs[code], code);
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Payment' : 'Bank Payment', memo: `${ex.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: ex.code, debit: amt }, { account: acc.code, credit: amt }] });
  audit(user.id, 'create', 'expense', j.id, { account: ex.code, name: ex.name, amt, no: j.no, approval: b.approval_id || undefined });
  return { ...j, amount: amt };
}

export async function voucher(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  need(Array.isArray(b.lines) && b.lines.length >= 2, 'A voucher needs at least two lines.');
  const codes = b.lines.map(l => String(l.account)), pids = b.lines.map(l => +l.party_id || 0).filter(Boolean);
  const r = (await c.query(`select (select coalesce(json_object_agg(code, name), '{}') from accounts where code = any($1::text[])) accs,
    (select coalesce(array_agg(id), '{}') from parties where id = any($2::int[])) parties`, [codes, pids])).rows[0];
  const lines = b.lines.map(l => {
    const code = String(l.account); need(r.accs[code], `Account ${code} does not exist.`);
    const pid = +l.party_id || null; if (pid) need(r.parties.includes(pid), 'Party not found.');
    if ((code === '1200' || code === '2000') && !pid) throw new UserError(`${r.accs[code]} needs a party on the line.`);
    return { account: code, party_id: pid, debit: l.debit, credit: l.credit };
  });
  const j = await postJournal(c, { date, type: b.type && JPREFIX[b.type] ? b.type : 'Journal', memo: String(b.memo || '').slice(0, 500), lines, user_id: user.id });
  audit(user.id, 'create', 'voucher', j.id, { lines: lines.length, amt: r2(lines.reduce((a, l) => a + r2(l.debit), 0)), no: j.no, memo: String(b.memo || '').slice(0, 80), approval: b.approval_id || undefined });
  return { ...j };
}

export async function stockAdjust(c, user, b) {
  const pr = (await c.query('select id, name, cost, stock from products where id=$1 for update', [+b.product_id])).rows[0];
  need(pr, 'Product not found.');
  const dq = r3(b.qty); need(dq !== 0, 'Enter how much to add or remove.');
  const val = r2(Math.abs(dq) * pr.cost);
  await c.query('update products set stock = stock + $1 where id=$2', [dq, pr.id]);
  if (val > 0) await postJournal(c, { date: today(), type: 'Stock Adjustment', memo: `${pr.name}: ${dq > 0 ? '+' : ''}${dq} (${b.reason || 'count correction'})`, user_id: user.id,
    lines: dq < 0 ? [{ account: '5500', debit: val }, { account: '1300', credit: val }] : [{ account: '1300', debit: val }, { account: '5500', credit: val }] });
  audit(user.id, 'adjust', 'product', pr.id, { dq, reason: b.reason, name: pr.name });
}

export const RUN = { sale: createInvoice, purchase: createInvoice, sale_return: createInvoice, purchase_return: createInvoice, receipt, payment, expense, voucher, edit: editInvoice, opening: openingBalance };
export const runKind = (c, user, kind, b) => { need(RUN[kind], 'Unknown entry type.'); return RUN[kind](c, user, KINDS[kind] ? { ...b, kind } : b); };
export function amountOf(kind, b) {
  if (KINDS[kind] || kind === 'edit') return invoiceTotals(b).total;
  if (kind === 'voucher') return r2((b.lines || []).reduce((a, l) => a + r2(l.debit), 0));
  return r2(b.amount);
}

// Opening balance for a new customer (they already owe us) or supplier (we already owe them).
export async function openingBalance(c, user, b) {
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const { party: p } = await lookup(c, { partyId: +b.party_id });
  need(p, 'Party not found.');
  const date = isDate(b.date) ? b.date : today();
  const lines = p.kind === 'C' ? [{ account: '1200', party_id: p.id, debit: amt }, { account: '3000', credit: amt }] : [{ account: '3000', debit: amt }, { account: '2000', party_id: p.id, credit: amt }];
  const j = await postJournal(c, { date, type: 'Journal', memo: `Opening balance · ${p.name}`, lines, user_id: user.id });
  audit(user.id, 'create', 'opening', j.id, { party: p.name, amt, no: j.no, approval: b.approval_id || undefined });
  return { ...j, party_id: p.id, amount: amt };
}
