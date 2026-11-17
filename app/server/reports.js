import { all, one } from './db.js';
import { r2, today } from './posting.js';
export const BOSS = ['admin', 'owner'];

const between = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const addM = (s, k) => { let y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${String(m + 1).padStart(2, '0')}-01`; };

export async function flows(from, to) {
  const [rows, rec] = await Promise.all([all(`select a.code, a.type, a.grp, coalesce(sum(jl.debit),0) d, coalesce(sum(jl.credit),0) c
    from journal_lines jl join journals j on j.id = jl.journal_id join accounts a on a.code = jl.account
    where j.date between $1 and $2 group by a.code, a.type, a.grp`, [from, to]),
  one(`select coalesce(sum(jl.credit),0) v from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') and j.date between $1 and $2`, [from, to])]);
  const f = { sales: 0, cos: 0, exp: 0, oth: 0 };
  for (const r of rows) {
    const cos = r.grp === 'Cost of Sales' || r.code === '5000';
    if (r.code === '4000') f.sales += r.c - r.d;
    else if (r.type === 'C') f.oth += r.c - r.d;
    if (cos) f.cos += r.d - r.c; else if (r.type === 'D') f.exp += r.d - r.c;
  }
  for (const k in f) f[k] = r2(f[k]);
  return { ...f, gp: r2(f.sales - f.cos), np: r2(f.sales - f.cos + f.oth - f.exp), recovery: r2(rec.v) };
}

export async function balances(to) {
  const rows = await all(`select jl.account, sum(jl.debit - jl.credit) b from journal_lines jl join journals j on j.id=jl.journal_id where j.date <= $1 group by jl.account`, [to]);
  return Object.fromEntries(rows.map(r => [r.account, r2(r.b)]));
}

export async function partyBalances(kind) {
  const acc = kind === 'V' ? '2000' : '1200';
  const rows = await all(`select jl.party_id id, sum(jl.debit - jl.credit) b from journal_lines jl where jl.account=$1 and jl.party_id is not null group by jl.party_id`, [acc]);
  return Object.fromEntries(rows.map(r => [r.id, kind === 'V' ? r2(-r.b) : r2(r.b)]));
}

// FIFO ageing of open bills. kind 'C' = customers (receivable 1200), 'V' = suppliers (payable 2000).
export async function aging(to, kind = 'C') {
  const acc = kind === 'V' ? '2000' : '1200';
  const [rows, plist, lastRows] = await Promise.all([
    all(`select jl.party_id, j.date, jl.debit, jl.credit from journal_lines jl join journals j on j.id=jl.journal_id
      where jl.account=$2 and jl.party_id is not null and j.date <= $1 order by j.date, j.id`, [to, acc]),
    all('select id, name, phone, city, credit_limit from parties'),
    all(`select jl.party_id, max(j.date) d from journal_lines jl join journals j on j.id=jl.journal_id
      where jl.account=$1 and ${kind === 'V' ? 'jl.debit' : 'jl.credit'} > 0 and jl.party_id is not null group by jl.party_id`, [acc])]);
  const by = new Map();
  for (const r of rows) {
    const up = kind === 'V' ? +r.credit : +r.debit, down = kind === 'V' ? +r.debit : +r.credit;
    const p = by.get(r.party_id) || { deb: [], cred: 0 }; if (up > 0) p.deb.push([r.date, up]); p.cred += down; by.set(r.party_id, p);
  }
  const buckets = [0, 0, 0, 0], out = [];
  for (const [id, p] of by) {
    let c = p.cred, open = 0, oldest = null;
    const bk = [0, 0, 0, 0];
    for (const [d, a] of p.deb) { const u = Math.min(a, c); c -= u; const o = a - u; if (o > 0.5) { open += o; if (!oldest) oldest = d; const age = between(d, to); const k = age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3; buckets[k] += o; bk[k] += o; } }
    const bal = r2(open - c);
    if (Math.abs(bal) > 0.5) out.push({ party_id: id, balance: bal, oldest, days: oldest ? between(oldest, to) : 0, b0: r2(bk[0]), b30: r2(bk[1]), b60: r2(bk[2]), b90: r2(bk[3]), advance: r2(c) });
  }
  const names = Object.fromEntries(plist.map(p => [p.id, p]));
  const last = Object.fromEntries(lastRows.map(r => [r.party_id, r.d]));
  out.forEach(o => Object.assign(o, { name: names[o.party_id]?.name, phone: names[o.party_id]?.phone, city: names[o.party_id]?.city, limit: +names[o.party_id]?.credit_limit || 0, last_paid: last[o.party_id] || null }));
  out.sort((a, b) => b.balance - a.balance);
  return { buckets: buckets.map(r2), rows: out, total: r2(out.reduce((a, o) => a + Math.max(o.balance, 0), 0)) };
}

// Where cash and bank money came from and went to.
export async function cashFlow(from, to) {
  const cash = (await all(`select code, name from accounts where grp='Cash & Bank' order by code`)).map(a => a.code);
  const open = await one(`select coalesce(sum(jl.debit-jl.credit),0) v from journal_lines jl join journals j on j.id=jl.journal_id where jl.account = any($1) and j.date < $2`, [cash, from]);
  const rows = await all(`select j.id, j.date, jl.account, a.name, a.type, jl.debit, jl.credit from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account
    where j.date between $1 and $2 and j.id in (select journal_id from journal_lines where account = any($3)) order by j.date, j.id`, [from, to, cash]);
  const byJ = new Map();
  for (const r of rows) { const x = byJ.get(r.id) || { date: r.date, lines: [] }; x.lines.push(r); byJ.set(r.id, x); }
  const cat = new Map(), months = new Map();
  const add = (k, dir, v, m) => { const c = cat.get(k) || { name: k, dir, v: 0 }; c.v += v; cat.set(k, c); const mm = months.get(m) || { m, in: 0, out: 0 }; mm[dir] += v; months.set(m, mm); };
  for (const [, j] of byJ) {
    const cl = j.lines.filter(l => cash.includes(l.account)), other = j.lines.filter(l => !cash.includes(l.account));
    const net = cl.reduce((a, l) => a + (+l.debit) - (+l.credit), 0);
    if (Math.abs(net) < 0.005) continue; // transfer between cash and bank
    const m = String(j.date).slice(0, 7), dir = net > 0 ? 'in' : 'out', v = Math.abs(net);
    const codes = other.map(l => l.account);
    let k = 'Other';
    if (codes.includes('1200')) k = net > 0 ? 'Recovery from customers' : 'Refund to customers';
    else if (codes.includes('2000')) k = net > 0 ? 'Refund from suppliers' : 'Paid to suppliers';
    else if (codes.includes('4000')) k = 'Cash sales';
    else if (other.some(l => l.type === 'D')) k = other.find(l => l.type === 'D').name;
    else if (other.some(l => l.type === 'E')) k = net > 0 ? 'Capital added' : 'Owner drawings';
    else if (other.some(l => l.type === 'B')) k = net > 0 ? 'Loans received' : 'Loans / tax paid';
    add(k, dir, v, m);
  }
  const list = [...cat.values()].map(c => ({ ...c, v: r2(c.v) })).sort((a, b) => b.v - a.v);
  const tin = r2(list.filter(c => c.dir === 'in').reduce((a, c) => a + c.v, 0)), tout = r2(list.filter(c => c.dir === 'out').reduce((a, c) => a + c.v, 0));
  return { opening: r2(open.v), in: tin, out: tout, closing: r2(+open.v + tin - tout), inflows: list.filter(c => c.dir === 'in'), outflows: list.filter(c => c.dir === 'out'),
    months: [...months.values()].sort((a, b) => a.m.localeCompare(b.m)).map(x => ({ m: x.m, in: r2(x.in), out: r2(x.out) })) };
}

// Sales tax by month: output tax on sales less input tax on purchases (FBR return due on the 18th of next month).
export async function taxSummary(from, to) {
  const rows = await all(`select to_char(date,'YYYY-MM') m, kind, coalesce(sum(tax),0) tax, coalesce(sum(total-tax),0) val, count(*)::int n from invoices
    where date between $1 and $2 group by 1, 2 order by 1`, [from, to]);
  const by = new Map();
  for (const r of rows) {
    const x = by.get(r.m) || { m: r.m, sales: 0, output: 0, purchases: 0, input: 0, bills: 0 };
    const sg = r.kind.endsWith('return') ? -1 : 1;
    if (r.kind.startsWith('sale')) { x.sales += sg * r.val; x.output += sg * r.tax; x.bills += r.kind === 'sale' ? r.n : 0; } else { x.purchases += sg * r.val; x.input += sg * r.tax; }
    by.set(r.m, x);
  }
  const months = [...by.values()].map(x => { const due = new Date(Date.UTC(+x.m.slice(0, 4), +x.m.slice(5, 7), 18)).toISOString().slice(0, 10); return { ...x, sales: r2(x.sales), output: r2(x.output), purchases: r2(x.purchases), input: r2(x.input), payable: r2(x.output - x.input), due }; });
  const t = today(), nm = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 18));
  if (+t.slice(8, 10) > 18) nm.setUTCMonth(nm.getUTCMonth() + 1);
  const next = nm.toISOString().slice(0, 10);
  const bal = await one(`select coalesce(sum(jl.credit-jl.debit),0) v from journal_lines jl where jl.account='2200'`);
  return { months, next_due: next, days_left: between(t, next), payable_now: r2(bal.v),
    total: { sales: r2(months.reduce((a, x) => a + x.sales, 0)), output: r2(months.reduce((a, x) => a + x.output, 0)), input: r2(months.reduce((a, x) => a + x.input, 0)), payable: r2(months.reduce((a, x) => a + x.payable, 0)) } };
}

// "What moved": this month to date against the same days of last month.
export async function insights(to) {
  const t = to || today(), from = t.slice(0, 8) + '01';
  const pf = addM(from, -1), day = +t.slice(8, 10);
  const pEnd = (() => { const d = new Date(Date.UTC(+pf.slice(0, 4), +pf.slice(5, 7) - 1, 1)); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); return pf.slice(0, 8) + String(Math.min(day, last)).padStart(2, '0'); })();
  const [a, b] = await Promise.all([flows(from, t), flows(pf, pEnd)]);
  const cust = async (f, e) => Object.fromEntries((await all(`select party_id, sum(case when kind='sale' then total else -total end) v from invoices where kind in ('sale','sale_return') and date between $1 and $2 group by 1`, [f, e])).map(r => [r.party_id, +r.v]));
  const prod = async (f, e) => Object.fromEntries((await all(`select l.product_id, sum(l.amount) v from invoice_lines l join invoices i on i.id=l.invoice_id where i.kind='sale' and i.date between $1 and $2 group by 1`, [f, e])).map(r => [r.product_id, +r.v]));
  const exps = async (f, e) => Object.fromEntries((await all(`select a.name, sum(jl.debit-jl.credit) v from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account where a.type='D' and a.grp<>'Cost of Sales' and a.code<>'5000' and j.date between $1 and $2 group by 1`, [f, e])).map(r => [r.name, +r.v]));
  const [c1, c0, p1, p0, e1, e0] = await Promise.all([cust(from, t), cust(pf, pEnd), prod(from, t), prod(pf, pEnd), exps(from, t), exps(pf, pEnd)]);
  const names = Object.fromEntries((await all('select id, name from parties')).map(p => [p.id, p.name]));
  const pnames = Object.fromEntries((await all('select id, name from products')).map(p => [p.id, p.name]));
  const movers = (now, before, nm) => [...new Set([...Object.keys(now), ...Object.keys(before)])].map(k => ({ id: k, name: nm ? nm[k] : k, now: r2(now[k] || 0), before: r2(before[k] || 0), diff: r2((now[k] || 0) - (before[k] || 0)) })).filter(x => Math.abs(x.diff) > 1).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 6);
  const metric = (k, label) => ({ k, label, now: a[k], before: b[k], diff: r2(a[k] - b[k]), pct: b[k] ? Math.round((a[k] - b[k]) / Math.abs(b[k]) * 100) : null });
  const lost = Object.keys(c0).filter(k => c0[k] > 0 && !c1[k]).map(k => ({ id: k, name: names[k], before: r2(c0[k]) })).sort((x, y) => y.before - x.before).slice(0, 6);
  return { period: { from, to: t, pfrom: pf, pto: pEnd },
    metrics: [metric('sales', 'Sales'), metric('recovery', 'Recovery'), metric('gp', 'Gross profit'), metric('exp', 'Expenses'), metric('np', 'Net profit')],
    customers: movers(c1, c0, names), products: movers(p1, p0, pnames), expenses: movers(e1, e0, null), lost };
}

export async function dashboard(user, from, to) {
  const t = today();
  if (user.role === 'salesman') {
    const [mine, rec, ag, recent] = await Promise.all([
      one(`select count(*)::int n, coalesce(sum(total),0) v from invoices where kind='sale' and created_by=$1 and date=$2`, [user.id, t]),
      one(`select coalesce(sum(jl.credit),0) v from journal_lines jl join journals j on j.id=jl.journal_id
        where jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') and j.created_by=$1 and j.date=$2`, [user.id, t]),
      aging(t),
      all(`select i.id, i.no, i.date, i.total, i.paid, p.name party from invoices i left join parties p on p.id=i.party_id
        where i.kind='sale' and i.created_by=$1 order by i.id desc limit 10`, [user.id])]);
    return { role: 'salesman', today: t, bills: mine.n, billed: r2(mine.v), recovery: r2(rec.v), collect: ag.rows.slice(0, 10), recent };
  }
  const months = []; for (let k = 11; k >= 0; k--) months.push(addM(to.slice(0, 8) + '01', -k).slice(0, 7));
  // 12-month series for the sparklines: flows per month, and month-end balances
  const start = months[0] + '-01';
  // same-length period just before, for the "vs last period" figure
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const pTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10), pFrom = new Date(Date.parse(pTo) - (days - 1) * 864e5).toISOString().slice(0, 10);
  // everything at once: the database is far away, so waiting for each query in turn is what made the dashboard slow
  const [f, b, cashAcc, stock, mrows, open, prev, topC, topP, recent, ag, last, prods] = await Promise.all([
    flows(from, to), balances(to),
    all(`select code, name from accounts where grp='Cash & Bank' order by code`),
    one(`select coalesce(sum(greatest(stock,0)*cost),0) v from products where active`),
    all(`select to_char(j.date,'YYYY-MM') m,
      sum(case when jl.account='4000' then jl.credit - jl.debit else 0 end) sales,
      sum(case when jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') then jl.credit else 0 end) rec,
      sum(case when jl.account='1300' and j.type='Purchase Entry' then jl.debit when jl.account='1300' and j.type='Purchase Return Entry' then -jl.credit else 0 end) pur,
      sum(case when a.grp='Cost of Sales' or jl.account='5000' then jl.debit - jl.credit else 0 end) cos,
      sum(case when a.type='D' and a.grp<>'Cost of Sales' and jl.account<>'5000' then jl.debit - jl.credit else 0 end) exp,
      sum(case when jl.account='1200' then jl.debit - jl.credit else 0 end) ar,
      sum(case when jl.account='2000' then jl.credit - jl.debit else 0 end) ap,
      sum(case when a.grp='Cash & Bank' then jl.debit - jl.credit else 0 end) cash
    from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account
    where j.date >= $1 and j.date <= $2 group by 1`, [start, to]),
    one(`select coalesce(sum(case when jl.account='1200' then jl.debit - jl.credit end),0) ar,
      coalesce(sum(case when jl.account='2000' then jl.credit - jl.debit end),0) ap,
      coalesce(sum(case when a.grp='Cash & Bank' then jl.debit - jl.credit end),0) cash
    from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account where j.date < $1`, [start]),
    days < 4000 ? flows(pFrom, pTo) : null,
    all(`select p.id, p.name, sum(case when i.kind='sale' then i.total else -i.total end) v from invoices i join parties p on p.id=i.party_id
      where i.kind in ('sale','sale_return') and i.date between $1 and $2 group by p.id, p.name having sum(i.total) > 0 order by v desc limit 6`, [from, to]),
    all(`select pr.id, pr.name, pr.unit, sum(il.qty) q, sum(il.amount) v from invoice_lines il join invoices i on i.id=il.invoice_id join products pr on pr.id=il.product_id
      where i.kind='sale' and i.date between $1 and $2 group by pr.id, pr.name, pr.unit order by v desc limit 6`, [from, to]),
    all(`select i.id, i.no, i.date, i.total, i.paid, i.kind, p.name party from invoices i left join parties p on p.id=i.party_id
      where i.kind='sale' order by i.date desc, i.id desc limit 8`),
    aging(to),
    one(`select max(date) d from journals`),
    all(`select id, name, stock, price, cost, reorder from products where active`),
  ]);
  const cash = cashAcc.map(a => ({ ...a, balance: b[a.code] || 0 }));
  const mm = Object.fromEntries(mrows.map(r => [r.m, r]));
  let ar = open.ar, ap = open.ap, cs = open.cash;
  const monthly = months.map(m => { const r = mm[m] || {}; ar += r.ar || 0; ap += r.ap || 0; cs += r.cash || 0;
    return { m, sales: r2(r.sales || 0), recovery: r2(r.rec || 0), purchases: r2(r.pur || 0), gp: r2((r.sales || 0) - (r.cos || 0)), expenses: r2(r.exp || 0), receivable: r2(ar), payable: r2(ap), cash: r2(cs) }; });
  const alerts = [];
  prods.filter(p => p.stock < 0).forEach(p => alerts.push({ level: 'red', text: `${p.name}: stock is ${p.stock}`, hint: 'More sold than bought. Do a stock count.' }));
  const zero = prods.filter(p => !(p.price > 0)); if (zero.length) alerts.push({ level: 'orange', text: `${zero.length} product${zero.length > 1 ? 's have' : ' has'} no sale price`, hint: zero.slice(0, 3).map(p => p.name).join(', ') });
  if (BOSS.includes(user.role)) prods.filter(p => p.price > 0 && p.price < p.cost).forEach(p => alerts.push({ level: 'orange', text: `${p.name} sells below cost`, hint: `Price ${p.price}, cost ${p.cost}` }));
  prods.filter(p => p.reorder > 0 && p.stock >= 0 && p.stock <= p.reorder).forEach(p => alerts.push({ level: 'orange', text: `${p.name} is low (${p.stock} left)`, hint: 'Time to reorder.' }));
  const old = ag.rows.filter(r => r.days > 60 && r.balance > 0);
  if (old.length) alerts.push({ level: 'yellow', text: `${old.length} customers unpaid for 60+ days`, hint: `Rs ${Math.round(old.reduce((a, r) => a + r.balance, 0)).toLocaleString('en-US')} in total` });
  const out = {
    role: user.role, from, to, today: t, lastEntry: last.d,
    sales: f.sales, recovery: f.recovery, expenses: f.exp, otherIncome: f.oth, prev: prev && { sales: prev.sales, recovery: prev.recovery, gp: prev.gp, from: pFrom, to: pTo },
    receivable: b['1200'] || 0, payable: r2(-(b['2000'] || 0)), cash, cashTotal: r2(cash.reduce((a, x) => a + x.balance, 0)),
    stockValue: r2(stock.v), monthly, topCustomers: topC, topProducts: topP, recent, aging: ag.buckets, owe: ag.rows.slice(0, 6), alerts,
  };
  if (BOSS.includes(user.role)) Object.assign(out, { gp: f.gp, cogs: f.cos, np: f.np });
  return out;
}

export async function ledger(account, partyId, from, to) {
  const [open, rows] = await Promise.all([one(`select coalesce(sum(jl.debit - jl.credit),0) b from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account=$1 and j.date < $2${partyId ? ' and jl.party_id = $3' : ''}`, partyId ? [account, from, partyId] : [account, from]),
  all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice, jl.debit, jl.credit from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account=$1 and j.date between $2 and $3${partyId ? ' and jl.party_id = $4' : ''} order by j.date, j.id`, partyId ? [account, from, to, partyId] : [account, from, to])]);
  let run = r2(open.b);
  const lines = rows.map(r => { run = r2(run + r.debit - r.credit); return { ...r, balance: run }; });
  return { opening: r2(open.b), lines, closing: run };
}

export async function trialBalance(to) {
  const [b, acc] = await Promise.all([balances(to), all('select code, name, type, grp from accounts order by code')]);
  const rows = acc.map(a => ({ ...a, debit: Math.max(b[a.code] || 0, 0), credit: Math.max(-(b[a.code] || 0), 0) })).filter(r => r.debit || r.credit);
  return { rows, debit: r2(rows.reduce((a, r) => a + r.debit, 0)), credit: r2(rows.reduce((a, r) => a + r.credit, 0)) };
}

export async function profitLoss(from, to) {
  const rows = await all(`select a.code, a.name, a.type, a.grp, sum(jl.credit - jl.debit) v from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account
    where a.type in ('C','D') and j.date between $1 and $2 group by a.code, a.name, a.type, a.grp order by a.code`, [from, to]);
  const income = rows.filter(r => r.type === 'C').map(r => ({ ...r, v: r2(r.v) }));
  const cos = rows.filter(r => r.type === 'D' && (r.grp === 'Cost of Sales' || r.code === '5000')).map(r => ({ ...r, v: r2(-r.v) }));
  const exp = rows.filter(r => r.type === 'D' && !(r.grp === 'Cost of Sales' || r.code === '5000')).map(r => ({ ...r, v: r2(-r.v) }));
  const ti = r2(income.reduce((a, r) => a + r.v, 0)), tc = r2(cos.reduce((a, r) => a + r.v, 0)), te = r2(exp.reduce((a, r) => a + r.v, 0));
  return { income, cos, exp, totalIncome: ti, totalCos: tc, grossProfit: r2(ti - tc), totalExp: te, netProfit: r2(ti - tc - te) };
}

export async function balanceSheet(to) {
  const [b, acc] = await Promise.all([balances(to), all('select code, name, type, grp from accounts order by code')]);
  const pick = t => acc.filter(a => a.type === t).map(a => ({ ...a, v: t === 'A' ? (b[a.code] || 0) : r2(-(b[a.code] || 0)) })).filter(a => a.v);
  const assets = pick('A'), liab = pick('B'), equity = pick('E');
  const profit = r2(acc.filter(a => a.type === 'C' || a.type === 'D').reduce((s, a) => s - (b[a.code] || 0), 0));
  const ta = r2(assets.reduce((s, a) => s + a.v, 0)), tl = r2(liab.reduce((s, a) => s + a.v, 0)), te = r2(equity.reduce((s, a) => s + a.v, 0) + profit);
  return { assets, liabilities: liab, equity, profit, totalAssets: ta, totalLiabilities: tl, totalEquity: te, check: r2(ta - tl - te) };
}

export async function dayBook(from, to) {
  return all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice,
      json_agg(json_build_object('account', jl.account, 'name', a.name, 'party', p.name, 'debit', jl.debit, 'credit', jl.credit) order by jl.id) lines
    from journals j join journal_lines jl on jl.journal_id=j.id join accounts a on a.code=jl.account left join parties p on p.id=jl.party_id
    where j.date between $1 and $2 group by j.id order by j.date desc, j.id desc limit 500`, [from, to]);
}

// ---------------- stock movement: opening, in, out, returns, adjustments, closing for a period ----------------
export async function stockMovement(from, to) {
  const [prods, mv, adj] = await Promise.all([
    all(`select id, name, unit, category, stock, cost, price, reorder from products where active order by name`),
    all(`select il.product_id pid, i.kind, (i.date < $1) before, (i.date > $2) after, sum(il.qty) q, sum(il.amount) amt
      from invoice_lines il join invoices i on i.id = il.invoice_id group by 1, 2, 3, 4`, [from, to]),
    all(`select entity_id::int pid, (at::date < $1) before, (at::date > $2) after, sum((data->>'dq')::numeric) q
      from audit_log where entity = 'product' and action = 'adjust' group by 1, 2, 3`, [from, to]),
  ]);
  const SIGN = { purchase: 1, sale_return: 1, sale: -1, purchase_return: -1 };
  const P = new Map(prods.map(p => [p.id, { ...p, purchased: 0, sold: 0, sale_ret: 0, pur_ret: 0, adjusted: 0, after: 0, sales_amt: 0 }]));
  for (const r of mv) {
    const p = P.get(r.pid); if (!p) continue;
    const q = +r.q * SIGN[r.kind];
    if (r.after) { p.after += q; continue; }
    if (r.before) continue;
    if (r.kind === 'purchase') p.purchased += +r.q; else if (r.kind === 'sale') { p.sold += +r.q; p.sales_amt += +r.amt; } else if (r.kind === 'sale_return') p.sale_ret += +r.q; else p.pur_ret += +r.q;
  }
  for (const r of adj) { const p = P.get(r.pid); if (!p) continue; if (r.after) p.after += +r.q; else if (!r.before) p.adjusted += +r.q; }
  const rows = [...P.values()].map(p => {
    const closing = r2(+p.stock - p.after);
    const opening = r2(closing - (p.purchased + p.sale_ret - p.sold - p.pur_ret + p.adjusted));
    const status = closing < 0 ? 'oversold' : p.reorder > 0 && closing <= p.reorder ? 'low' : closing === 0 ? 'out' : 'ok';
    return { id: p.id, name: p.name, unit: p.unit, category: p.category, opening, purchased: r2(p.purchased), sale_ret: r2(p.sale_ret), sold: r2(p.sold), pur_ret: r2(p.pur_ret), adjusted: r2(p.adjusted), closing,
      tp: +p.price, cost: +p.cost, value: r2(Math.max(closing, 0) * p.cost), tp_value: r2(Math.max(closing, 0) * p.price), sales_amt: r2(p.sales_amt), reorder: +p.reorder, status };
  });
  const sum = k => r2(rows.reduce((a, r) => a + r[k], 0));
  return { from, to, rows, totals: { value: sum('value'), tp_value: sum('tp_value'), sales_amt: sum('sales_amt'), oversold: rows.filter(r => r.status === 'oversold').length, low: rows.filter(r => r.status === 'low').length } };
}

// ---------------- cash book: every cash/bank movement with running balance ----------------
export async function cashBook(from, to, account = null) {
  const accs = await all(`select code, name from accounts where grp = 'Cash & Bank' ${account ? 'and code = $1' : ''} order by code`, account ? [account] : []);
  const codes = accs.map(a => a.code);
  const [open, rows] = await Promise.all([
    one(`select coalesce(sum(jl.debit - jl.credit), 0) v from journal_lines jl join journals j on j.id = jl.journal_id where jl.account = any($1) and j.date < $2`, [codes, from]),
    all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice, u.name by_name,
        sum(case when jl.account = any($1) then jl.debit else 0 end) cin, sum(case when jl.account = any($1) then jl.credit else 0 end) cout,
        string_agg(distinct case when jl.account = any($1) then a.name end, ', ') acc,
        string_agg(distinct case when jl.account <> all($1) then coalesce(p.name, a.name) end, ', ') against
      from journals j join journal_lines jl on jl.journal_id = j.id join accounts a on a.code = jl.account left join parties p on p.id = jl.party_id left join users u on u.id = j.created_by
      where j.date between $2 and $3 and j.id in (select journal_id from journal_lines where account = any($1))
      group by j.id, u.name order by j.date, j.id`, [codes, from, to]),
  ]);
  let run = r2(open.v);
  const lines = rows.map(r => { const i = r2(r.cin), o = r2(r.cout); const net = r2(i - o); run = r2(run + net); return { id: r.id, no: r.no, date: r.date, type: r.type, memo: r.memo, bill: r.ref_invoice, by: r.by_name, account: r.acc, against: r.against, in: net > 0 ? net : 0, out: net < 0 ? -net : 0, balance: run }; }).filter(l => l.in || l.out);
  return { from, to, accounts: accs, opening: r2(open.v), lines, in: r2(lines.reduce((a, l) => a + l.in, 0)), out: r2(lines.reduce((a, l) => a + l.out, 0)), closing: run };
}

// ---------------- ledger hub: every account grouped the way the business thinks about it ----------------
export function ledgerGroup(a) {
  const g = String(a.grp || '').toLowerCase(), n = String(a.name || '').toLowerCase();
  if (a.grp === 'Cash & Bank') return 'cash';
  if (/comm/.test(n) && (a.type === 'B' || a.type === 'D')) return 'commission';
  if (g === 'payroll' || /salary|staff|wages/.test(g + ' ' + n)) return 'staff';
  if (a.type === 'E') return 'partners';
  if (a.type === 'D' && a.grp !== 'Cost of Sales' && a.code !== '5000') return 'expense';
  if (a.code === '1200' || a.code === '2000') return 'control';
  return 'other';
}
export async function ledgerHub(from, to) {
  const [accs, per, bal] = await Promise.all([
    all('select code, name, type, grp from accounts order by name'),
    all(`select jl.account, sum(jl.debit) d, sum(jl.credit) c, count(distinct j.id)::int n from journal_lines jl join journals j on j.id = jl.journal_id where j.date between $1 and $2 group by 1`, [from, to]),
    all(`select jl.account, sum(jl.debit - jl.credit) b from journal_lines jl join journals j on j.id = jl.journal_id where j.date <= $1 group by 1`, [to]),
  ]);
  const P = new Map(per.map(r => [r.account, r])), Bm = new Map(bal.map(r => [r.account, +r.b]));
  return accs.map(a => { const p = P.get(a.code) || {}; const b = Bm.get(a.code) || 0; const nat = a.type === 'A' || a.type === 'D' ? b : -b;
    return { ...a, group: ledgerGroup(a), debit: r2(p.d || 0), credit: r2(p.c || 0), entries: p.n || 0, balance: r2(nat), raw: r2(b) }; });
}
