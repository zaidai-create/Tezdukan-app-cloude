// Registers: every bill / payment in one table with filters and totals, item-wise sales, customer summary, stock history.
import { all, one } from './db.js';
import { r2 } from './posting.js';

const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const KINDS = ['sale', 'purchase', 'sale_return', 'purchase_return'];

export async function billRegister(user, q) {
  const p = [], w = [];
  const add = (sql, v) => { p.push(v); w.push(sql.replace('?', '$' + p.length)); };
  const kinds = q.kind === 'all' ? KINDS : q.kind === 'returns' ? ['sale_return', 'purchase_return'] : KINDS.includes(q.kind) ? [q.kind] : ['sale'];
  add('i.kind = any(?::text[])', user.role === 'salesman' ? ['sale'] : kinds);
  if (user.role === 'salesman') add('i.created_by = ?', user.id);
  if (+q.party) add('i.party_id = ?', +q.party);
  if (isDate(q.from)) add('i.date >= ?', q.from);
  if (isDate(q.to)) add('i.date <= ?', q.to);
  if (q.q) { p.push('%' + String(q.q).toLowerCase() + '%'); w.push(`(lower(pt.name) like $${p.length} or lower(i.no) like $${p.length})`); }
  if (q.status === 'due') w.push(`i.kind in ('sale','purchase') and i.total - i.paid > 0.5`);
  if (q.status === 'paid') w.push(`i.kind in ('sale','purchase') and i.total - i.paid <= 0.5`);
  if (+q.by) add('i.created_by = ?', +q.by);
  const rows = await all(`select i.id, i.no, i.date, i.kind, i.total, i.paid, i.subtotal, i.discount bill_disc, i.tax, i.legacy, i.source, i.edited_at,
      pt.id party_id, pt.name party, u.name by_name, coalesce(l.n, 0) items, coalesce(l.q, 0) qty, coalesce(l.disc, 0) item_disc
    from invoices i left join parties pt on pt.id = i.party_id left join users u on u.id = i.created_by
    left join (select invoice_id, count(*)::int n, sum(qty) q, sum(greatest(coalesce(tp, rate) - rate, 0) * qty) disc from invoice_lines group by invoice_id) l on l.invoice_id = i.id
    where ${w.join(' and ')} order by i.date desc, i.id desc limit 3000`, p);
  const sign = r => (r.kind.endsWith('return') ? -1 : 1);
  rows.forEach(r => { r.discount = r2(+r.item_disc + +r.bill_disc); r.due = r.kind === 'sale' || r.kind === 'purchase' ? r2(Math.max(r.total - r.paid, 0)) : 0; });
  const tot = { bills: rows.length, total: 0, paid: 0, due: 0, discount: 0, qty: 0 };
  for (const r of rows) { tot.total += sign(r) * r.total; tot.paid += r.paid; tot.due += r.due; tot.discount += sign(r) * r.discount; tot.qty += sign(r) * r.qty; }
  for (const k in tot) tot[k] = r2(tot[k]);
  return { rows, totals: tot };
}

// Money received / paid / expenses (not counting cash paid on the bill itself, which shows on the bill)
export async function moneyRegister(user, q) {
  const p = [], w = [`j.type in ('Cash Receipt','Bank Receipt','Cash Payment','Bank Payment','Journal')`];
  const add = (sql, v) => { p.push(v); w.push(sql.replace('?', '$' + p.length)); };
  if (isDate(q.from)) add('j.date >= ?', q.from);
  if (isDate(q.to)) add('j.date <= ?', q.to);
  if (user.role === 'salesman') add('j.created_by = ?', user.id);
  if (q.bills !== '1') w.push('j.ref_invoice is null');
  const rows = await all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice, j.legacy, u.name by_name,
      json_agg(json_build_object('account', jl.account, 'name', a.name, 'type', a.type, 'grp', a.grp, 'party_id', jl.party_id, 'party', pt.name, 'debit', jl.debit, 'credit', jl.credit)) lines
    from journals j join journal_lines jl on jl.journal_id = j.id join accounts a on a.code = jl.account left join parties pt on pt.id = jl.party_id left join users u on u.id = j.created_by
    where ${w.join(' and ')} group by j.id, u.name order by j.date desc, j.id desc limit 3000`, p);
  const out = [];
  for (const j of rows) {
    const cash = j.lines.filter(l => l.grp === 'Cash & Bank'), other = j.lines.filter(l => l.grp !== 'Cash & Bank');
    const net = r2(cash.reduce((a, l) => a + +l.debit - +l.credit, 0));
    const pl = j.lines.find(l => l.party_id);
    let kind;
    if (other.some(l => l.account === '1200') && net > 0) kind = 'receipt';
    else if (other.some(l => l.account === '2000') && net < 0) kind = 'payment';
    else if (other.some(l => l.type === 'D') && net < 0) kind = 'expense';
    else if (j.type === 'Journal' && /^Opening balance/.test(j.memo)) kind = 'opening';
    else if (j.type === 'Journal') kind = 'journal';
    else kind = net > 0 ? 'other_in' : 'other_out';
    if (user.role === 'salesman' && kind !== 'receipt') continue;
    const amount = cash.length ? Math.abs(net) : r2(j.lines.reduce((a, l) => a + +l.debit, 0));
    out.push({ id: j.id, no: j.no, date: j.date, kind, amount, party: pl?.party || null, party_id: pl?.party_id || null,
      head: kind === 'expense' ? other.find(l => l.type === 'D')?.name : null, account: cash.map(l => l.name).join(', '), memo: j.memo, by: j.by_name, legacy: j.legacy, bill: j.ref_invoice });
  }
  const kinds = q.kind && q.kind !== 'all' ? q.kind.split(',') : null;
  let list = kinds ? out.filter(r => kinds.includes(r.kind)) : out;
  if (+q.party) list = list.filter(r => r.party_id === +q.party);
  if (q.q) { const s = String(q.q).toLowerCase(); list = list.filter(r => [r.party, r.head, r.memo, r.no].some(x => String(x || '').toLowerCase().includes(s))); }
  const totals = {};
  for (const r of list) totals[r.kind] = r2((totals[r.kind] || 0) + r.amount);
  return { rows: list, totals, count: list.length };
}

// Item-wise sales for a period (optionally one customer)
export async function itemSales(user, q) {
  const p = [isDate(q.from) ? q.from : '2000-01-01', isDate(q.to) ? q.to : '2999-12-31'];
  let extra = '';
  if (+q.party) { p.push(+q.party); extra += ` and i.party_id = $${p.length}`; }
  if (user.role === 'salesman') { p.push(user.id); extra += ` and i.created_by = $${p.length}`; }
  const staff = user.role !== 'salesman';
  const rows = await all(`select pr.id, pr.name, pr.unit,
      sum(case when i.kind='sale' then il.qty else -il.qty end) qty,
      sum(case when i.kind='sale' then il.amount else -il.amount end) amount,
      sum(case when i.kind='sale' then greatest(coalesce(il.tp, il.rate) - il.rate, 0) * il.qty else 0 end) disc,
      ${staff ? `sum((case when i.kind='sale' then 1 else -1 end) * il.qty * (case when il.cost > 0 then il.cost else pr.cost end)) cost,` : ''}
      count(distinct i.id) bills, count(distinct i.party_id) customers
    from invoice_lines il join invoices i on i.id = il.invoice_id join products pr on pr.id = il.product_id
    where i.kind in ('sale','sale_return') and i.date between $1 and $2 ${extra}
    group by pr.id, pr.name, pr.unit order by amount desc`, p);
  rows.forEach(r => { r.avg = r.qty ? r2(r.amount / r.qty) : 0; if (staff) r.profit = r2(r.amount - r.cost); });
  return { rows, totals: { qty: r2(rows.reduce((a, r) => a + +r.qty, 0)), amount: r2(rows.reduce((a, r) => a + +r.amount, 0)), disc: r2(rows.reduce((a, r) => a + +r.disc, 0)), profit: staff ? r2(rows.reduce((a, r) => a + r.profit, 0)) : null } };
}

// Per customer (or supplier): bills, returns, received, balance — one row each
export async function partySummary(user, q) {
  const kind = q.kind === 'V' && user.role !== 'salesman' ? 'V' : 'C';
  const acc = kind === 'V' ? '2000' : '1200';
  const from = isDate(q.from) ? q.from : '2000-01-01', to = isDate(q.to) ? q.to : '2999-12-31';
  const [inv, money, bal] = await Promise.all([
    all(`select party_id, count(*) filter (where kind in ('sale','purchase'))::int bills, max(date) filter (where kind in ('sale','purchase')) last_bill,
        coalesce(sum(total) filter (where kind in ('sale','purchase')), 0) billed, coalesce(sum(total) filter (where kind in ('sale_return','purchase_return')), 0) returned
      from invoices where date between $1 and $2 group by party_id`, [from, to]),
    all(`select jl.party_id, sum(${kind === 'V' ? 'jl.debit' : 'jl.credit'}) v from journal_lines jl join journals j on j.id = jl.journal_id
      where jl.account = $1 and j.type in ('Cash Receipt','Bank Receipt','Cash Payment','Bank Payment') and j.date between $2 and $3 group by jl.party_id`, [acc, from, to]),
    all(`select jl.party_id, sum(jl.debit - jl.credit) b from journal_lines jl join journals j on j.id = jl.journal_id where jl.account = $1 and j.date <= $2 group by jl.party_id`, [acc, to]),
  ]);
  const I = new Map(inv.map(r => [r.party_id, r])), M = new Map(money.map(r => [r.party_id, +r.v])), B = new Map(bal.map(r => [r.party_id, kind === 'V' ? -r.b : +r.b]));
  const parties = await all(`select id, name, city, phone from parties where kind = $1 and active order by name`, [kind]);
  const rows = parties.map(pt => { const i = I.get(pt.id) || {}; return { id: pt.id, name: pt.name, city: pt.city, phone: pt.phone, bills: i.bills || 0, last_bill: i.last_bill || null, billed: r2(i.billed || 0), returned: r2(i.returned || 0), paid: r2(M.get(pt.id) || 0), balance: r2(B.get(pt.id) || 0) }; })
    .filter(r => r.bills || r.paid || Math.abs(r.balance) > 0.5);
  rows.sort((a, b) => b.billed - a.billed);
  const t = k => r2(rows.reduce((a, r) => a + r[k], 0));
  return { kind, rows, totals: { bills: rows.reduce((a, r) => a + r.bills, 0), billed: t('billed'), returned: t('returned'), paid: t('paid'), balance: t('balance') } };
}

// Stock movements of one product, newest first, with running stock
export async function stockHistory(user, id) {
  const pr = await one('select id, name, unit, stock, cost, price, reorder, category from products where id=$1', [id]);
  if (!pr) return null;
  const [lines, adj] = await Promise.all([
    all(`select i.id bill, i.no, i.date, i.kind, pt.name party, il.qty, il.rate, i.created_at at from invoice_lines il join invoices i on i.id = il.invoice_id left join parties pt on pt.id = i.party_id where il.product_id = $1`, [id]),
    all(`select l.at, l.data, u.name by_name from audit_log l left join users u on u.id = l.user_id where l.entity='product' and l.action='adjust' and l.entity_id = $1`, [String(id)]),
  ]);
  const IN = { purchase: 1, sale_return: 1, sale: -1, purchase_return: -1 };
  const mv = lines.map(l => ({ date: l.date, at: l.at, kind: l.kind, no: l.no, bill: l.bill, party: l.party, qty: r2(IN[l.kind] * l.qty), rate: user.role === 'salesman' && l.kind.startsWith('purchase') ? null : l.rate }))
    .concat(adj.map(a => ({ date: new Date(a.at).toISOString().slice(0, 10), at: a.at, kind: 'adjust', no: '', party: a.data?.reason || 'Stock count', qty: r2(+a.data?.dq || 0), by: a.by_name })));
  mv.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : new Date(b.at) - new Date(a.at)));
  let run = +pr.stock;
  for (const m of mv) { m.after = r2(run); run = r2(run - m.qty); }
  const sum = k => r2(mv.filter(m => m.kind === k).reduce((a, m) => a + Math.abs(m.qty), 0));
  if (user.role === 'salesman') delete pr.cost;
  return { product: pr, moves: mv.slice(0, 1500), totals: { in: r2(sum('purchase') + sum('sale_return')), out: r2(sum('sale') + sum('purchase_return')), adjust: r2(mv.filter(m => m.kind === 'adjust').reduce((a, m) => a + m.qty, 0)) } };
}
