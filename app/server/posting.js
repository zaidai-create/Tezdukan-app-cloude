// All money movements go through here. Every function runs inside a DB transaction (client `c`)
// and writes a balanced double-entry journal; the database re-checks the balance at commit.
import { audit } from './auth.js';

export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const r3 = n => Math.round((Number(n) || 0) * 1000) / 1000;
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
export const fyOf = d => { const y = +d.slice(0, 4), m = +d.slice(5, 7), s = m >= 7 ? y : y - 1; return `${String(s % 100).padStart(2, '0')}${String((s + 1) % 100).padStart(2, '0')}`; };

export class UserError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
const need = (cond, msg) => { if (!cond) throw new UserError(msg); };
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

async function nextNo(c, prefix, date, width) {
  const key = `${prefix}-${fyOf(date)}`;
  const r = await c.query(`insert into counters(key, n) values($1, 1) on conflict (key) do update set n = counters.n + 1 returning n`, [key]);
  return `${key}-${String(r.rows[0].n).padStart(width, '0')}`;
}

const JPREFIX = { 'Sale Entry': 'SV', 'Purchase Entry': 'PV', 'Cash Receipt': 'CRV', 'Bank Receipt': 'BRV', 'Cash Payment': 'CPV', 'Bank Payment': 'BPV', 'Journal': 'JV', 'Sales Return Entry': 'SRV', 'Purchase Return Entry': 'PRV', 'Stock Adjustment': 'SAV' };

export async function postJournal(c, { date, type, memo = '', lines, ref_invoice = null, user_id = null }) {
  const ls = lines.map(l => ({ ...l, debit: r2(l.debit), credit: r2(l.credit) })).filter(l => l.debit > 0 || l.credit > 0);
  const d = r2(ls.reduce((a, l) => a + l.debit, 0)), k = r2(ls.reduce((a, l) => a + l.credit, 0));
  need(ls.length >= 2, 'An entry needs at least one debit and one credit line.');
  need(d === k, `Debit (${d}) and credit (${k}) must be equal.`);
  const no = await nextNo(c, JPREFIX[type] || 'JV', date, 4);
  const j = await c.query(`insert into journals(no, date, type, memo, ref_invoice, created_by) values($1,$2,$3,$4,$5,$6) returning id`, [no, date, type, memo, ref_invoice, user_id]);
  for (const l of ls) {
    await c.query(`insert into journal_lines(journal_id, account, party_id, debit, credit) values($1,$2,$3,$4,$5)`, [j.rows[0].id, l.account, l.party_id || null, l.debit, l.credit]);
  }
  return { id: j.rows[0].id, no };
}

async function account(c, code) {
  const a = (await c.query('select code, name, type, grp from accounts where code=$1', [code])).rows[0];
  need(a, `Account ${code} does not exist.`);
  return a;
}
async function cashAccount(c, code) {
  const a = await account(c, code);
  need(a.grp === 'Cash & Bank', `${a.name} is not a cash or bank account.`);
  return a;
}
const isCash = a => a.code === '1000' || /cash/i.test(a.name);
async function party(c, id, kind) {
  const p = (await c.query('select id, kind, name, credit_limit from parties where id=$1 and active', [id])).rows[0];
  need(p, kind === 'C' ? 'Choose a customer.' : 'Choose a supplier.');
  need(p.kind === kind, kind === 'C' ? 'This party is a supplier, not a customer.' : 'This party is a customer, not a supplier.');
  return p;
}

const KINDS = {
  sale:            { party: 'C', prefix: 'QT', width: 6, stock: -1, label: 'Sale' },
  purchase:        { party: 'V', prefix: 'PI', width: 4, stock: +1, label: 'Purchase' },
  sale_return:     { party: 'C', prefix: 'SR', width: 4, stock: +1, label: 'Sales return' },
  purchase_return: { party: 'V', prefix: 'PR', width: 4, stock: -1, label: 'Purchase return' },
};

export async function createInvoice(c, user, b) {
  const K = KINDS[b.kind];
  need(K, 'Unknown bill type.');
  if (user.role === 'salesman') { need(b.kind === 'sale', 'Salesmen can make sale bills only.'); b.pay_account = '1000'; }
  const date = isDate(b.date) ? b.date : today();
  const p = await party(c, +b.party_id, K.party);
  need(Array.isArray(b.lines) && b.lines.length, 'Add at least one item.');
  const lines = [];
  for (const l of b.lines) {
    const qty = r3(l.qty), rate = r2(l.rate);
    need(qty > 0, 'Every item needs a quantity above zero.');
    need(rate > 0, 'Every item needs a rate above zero.');
    const pr = (await c.query('select id, name, cost, stock from products where id=$1 and active for update', [+l.product_id])).rows[0];
    need(pr, 'One of the products no longer exists.');
    lines.push({ pr, qty, rate, amount: r2(qty * rate) });
  }
  const subtotal = r2(lines.reduce((a, l) => a + l.amount, 0));
  const discount = Math.min(Math.max(r2(b.discount), 0), subtotal);
  const net = r2(subtotal - discount);
  const tax_pct = Math.max(r2(b.tax_pct), 0);
  const tax = r2(net * tax_pct / 100);
  const total = r2(net + tax);
  need(total > 0, 'The bill total must be above zero.');
  const paid = Math.min(Math.max(r2(b.paid), 0), total);
  let payAcc = null;
  if (paid > 0 && (b.kind === 'sale' || b.kind === 'purchase')) payAcc = await cashAccount(c, b.pay_account || '1000');

  const no = await nextNo(c, K.prefix, date, K.width);
  const inv = (await c.query(
    `insert into invoices(kind, no, date, party_id, subtotal, discount, tax_pct, tax, total, paid, pay_account, note, source, created_by)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
    [b.kind, no, date, p.id, subtotal, discount, tax_pct, tax, total, (b.kind === 'sale' || b.kind === 'purchase') ? paid : 0, payAcc ? payAcc.code : null, String(b.note || '').slice(0, 500), b.source === 'voice' ? 'voice' : 'app', user.id])).rows[0];

  let cogs = 0;
  for (const l of lines) {
    const cost = r2(l.pr.cost);
    if (K.stock < 0) cogs += r2(l.qty * cost);
    await c.query('insert into invoice_lines(invoice_id, product_id, qty, rate, cost, amount) values($1,$2,$3,$4,$5,$6)', [inv.id, l.pr.id, l.qty, l.rate, cost, l.amount]);
    if (b.kind === 'purchase') {
      // weighted-average cost
      const have = Math.max(+l.pr.stock, 0), unitNet = net > 0 ? l.amount * (net / subtotal) / l.qty : l.rate;
      const newCost = have + l.qty > 0 ? r2((have * +l.pr.cost + l.qty * unitNet) / (have + l.qty)) : r2(unitNet);
      await c.query('update products set stock = stock + $1, cost = $2 where id=$3', [l.qty, newCost, l.pr.id]);
    } else {
      await c.query('update products set stock = stock + $1 where id=$2', [K.stock * l.qty, l.pr.id]);
    }
  }
  cogs = r2(cogs);
  const memo = `${K.label} ${no} · ${p.name}`;
  const J = (type, lines2) => postJournal(c, { date, type, memo, lines: lines2, ref_invoice: inv.id, user_id: user.id });

  if (b.kind === 'sale') {
    await J('Sale Entry', [
      { account: '1200', party_id: p.id, debit: total },
      { account: '4000', credit: net },
      { account: '2200', credit: tax },
      { account: '5000', debit: cogs },
      { account: '1300', credit: cogs },
    ]);
    if (paid > 0) await J(isCash(payAcc) ? 'Cash Receipt' : 'Bank Receipt', [{ account: payAcc.code, debit: paid }, { account: '1200', party_id: p.id, credit: paid }]);
  } else if (b.kind === 'purchase') {
    await J('Purchase Entry', [{ account: '1300', debit: net }, { account: '2200', debit: tax }, { account: '2000', party_id: p.id, credit: total }]);
    if (paid > 0) await J(isCash(payAcc) ? 'Cash Payment' : 'Bank Payment', [{ account: '2000', party_id: p.id, debit: paid }, { account: payAcc.code, credit: paid }]);
  } else if (b.kind === 'sale_return') {
    const back = r2(lines.reduce((a, l) => a + l.qty * l.pr.cost, 0));
    await J('Sales Return Entry', [
      { account: '4000', debit: net }, { account: '2200', debit: tax }, { account: '1200', party_id: p.id, credit: total },
      { account: '1300', debit: back }, { account: '5000', credit: back },
    ]);
  } else {
    await J('Purchase Return Entry', [{ account: '2000', party_id: p.id, debit: total }, { account: '1300', credit: net }, { account: '2200', credit: tax }]);
  }
  await audit(user.id, 'create', 'invoice', inv.id, { kind: b.kind, no, total, party: p.name, source: b.source || 'app' });
  return { id: inv.id, no, total };
}

export async function deleteInvoice(c, user, id) {
  const inv = (await c.query('select * from invoices where id=$1 for update', [id])).rows[0];
  need(inv, 'Bill not found.');
  need(!inv.legacy, 'Bills from the old software cannot be cancelled here. Make a return instead.');
  const sign = KINDS[inv.kind].stock;
  const ls = (await c.query('select product_id, qty from invoice_lines where invoice_id=$1', [id])).rows;
  for (const l of ls) await c.query('update products set stock = stock - $1 where id=$2', [sign * l.qty, l.product_id]);
  await c.query('delete from journals where ref_invoice=$1', [id]);
  await c.query('delete from invoices where id=$1', [id]);
  await audit(user.id, 'cancel', 'invoice', id, { no: inv.no, total: inv.total });
}

export async function receipt(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const p = await party(c, +b.party_id, 'C');
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const acc = await cashAccount(c, user.role === 'salesman' ? '1000' : (b.account || '1000'));
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Receipt' : 'Bank Receipt', memo: `Received from ${p.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: acc.code, debit: amt }, { account: '1200', party_id: p.id, credit: amt }] });
  await audit(user.id, 'create', 'receipt', j.id, { party: p.name, amt });
  return j;
}

export async function payment(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const p = await party(c, +b.party_id, 'V');
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const acc = await cashAccount(c, b.account || '1000');
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Payment' : 'Bank Payment', memo: `Paid to ${p.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: '2000', party_id: p.id, debit: amt }, { account: acc.code, credit: amt }] });
  await audit(user.id, 'create', 'payment', j.id, { party: p.name, amt });
  return j;
}

export async function expense(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const ex = await account(c, b.account); need(ex.type === 'D', 'Choose an expense account.');
  const acc = await cashAccount(c, b.pay_account || '1000');
  const j = await postJournal(c, { date, type: isCash(acc) ? 'Cash Payment' : 'Bank Payment', memo: `${ex.name}${b.note ? ' · ' + b.note : ''}`, user_id: user.id,
    lines: [{ account: ex.code, debit: amt }, { account: acc.code, credit: amt }] });
  await audit(user.id, 'create', 'expense', j.id, { account: ex.code, amt });
  return j;
}

export async function voucher(c, user, b) {
  const date = isDate(b.date) ? b.date : today();
  need(Array.isArray(b.lines) && b.lines.length >= 2, 'A voucher needs at least two lines.');
  const lines = [];
  for (const l of b.lines) {
    const a = await account(c, String(l.account));
    let pid = l.party_id ? +l.party_id : null;
    if (pid) { const p = (await c.query('select kind from parties where id=$1', [pid])).rows[0]; need(p, 'Party not found.'); }
    if ((a.code === '1200' || a.code === '2000') && !pid) throw new UserError(`${a.name} needs a party on the line.`);
    lines.push({ account: a.code, party_id: pid, debit: l.debit, credit: l.credit });
  }
  const j = await postJournal(c, { date, type: b.type && JPREFIX[b.type] ? b.type : 'Journal', memo: String(b.memo || '').slice(0, 500), lines, user_id: user.id });
  await audit(user.id, 'create', 'voucher', j.id, { lines: lines.length });
  return j;
}

export async function stockAdjust(c, user, b) {
  const pr = (await c.query('select id, name, cost, stock from products where id=$1 for update', [+b.product_id])).rows[0];
  need(pr, 'Product not found.');
  const dq = r3(b.qty); need(dq !== 0, 'Enter how much to add or remove.');
  const val = r2(Math.abs(dq) * pr.cost);
  await c.query('update products set stock = stock + $1 where id=$2', [dq, pr.id]);
  if (val > 0) await postJournal(c, { date: today(), type: 'Stock Adjustment', memo: `${pr.name}: ${dq > 0 ? '+' : ''}${dq} (${b.reason || 'count correction'})`, user_id: user.id,
    lines: dq < 0 ? [{ account: '5500', debit: val }, { account: '1300', credit: val }] : [{ account: '1300', debit: val }, { account: '5500', credit: val }] });
  await audit(user.id, 'adjust', 'product', pr.id, { dq, reason: b.reason });
}
