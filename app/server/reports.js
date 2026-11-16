import { all, one } from './db.js';
import { r2, today } from './posting.js';

const between = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const addM = (s, k) => { let y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return `${y}-${String(m + 1).padStart(2, '0')}-01`; };

export async function flows(from, to) {
  const rows = await all(`select a.code, a.type, a.grp, coalesce(sum(jl.debit),0) d, coalesce(sum(jl.credit),0) c
    from journal_lines jl join journals j on j.id = jl.journal_id join accounts a on a.code = jl.account
    where j.date between $1 and $2 group by a.code, a.type, a.grp`, [from, to]);
  const f = { sales: 0, cos: 0, exp: 0, oth: 0 };
  for (const r of rows) {
    const cos = r.grp === 'Cost of Sales' || r.code === '5000';
    if (r.code === '4000') f.sales += r.c - r.d;
    else if (r.type === 'C') f.oth += r.c - r.d;
    if (cos) f.cos += r.d - r.c; else if (r.type === 'D') f.exp += r.d - r.c;
  }
  const rec = await one(`select coalesce(sum(jl.credit),0) v from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') and j.date between $1 and $2`, [from, to]);
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

export async function aging(to) {
  const rows = await all(`select jl.party_id, j.date, jl.debit, jl.credit from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account='1200' and jl.party_id is not null and j.date <= $1 order by j.date, j.id`, [to]);
  const by = new Map();
  for (const r of rows) { const p = by.get(r.party_id) || { deb: [], cred: 0 }; if (r.debit > 0) p.deb.push([r.date, r.debit]); p.cred += r.credit; by.set(r.party_id, p); }
  const buckets = [0, 0, 0, 0], out = [];
  for (const [id, p] of by) {
    let c = p.cred, open = 0, oldest = null;
    for (const [d, a] of p.deb) { const u = Math.min(a, c); c -= u; const o = a - u; if (o > 0.5) { open += o; if (!oldest) oldest = d; const age = between(d, to); buckets[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += o; } }
    const bal = r2(open - c);
    if (Math.abs(bal) > 0.5) out.push({ party_id: id, balance: bal, oldest, days: oldest ? between(oldest, to) : 0 });
  }
  const names = Object.fromEntries((await all('select id, name, phone, city from parties')).map(p => [p.id, p]));
  out.forEach(o => Object.assign(o, { name: names[o.party_id]?.name, phone: names[o.party_id]?.phone, city: names[o.party_id]?.city }));
  out.sort((a, b) => b.balance - a.balance);
  return { buckets: buckets.map(r2), rows: out };
}

export async function dashboard(user, from, to) {
  const t = today();
  if (user.role === 'salesman') {
    const mine = await one(`select count(*)::int n, coalesce(sum(total),0) v from invoices where kind='sale' and created_by=$1 and date=$2`, [user.id, t]);
    const rec = await one(`select coalesce(sum(jl.credit),0) v from journal_lines jl join journals j on j.id=jl.journal_id
      where jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') and j.created_by=$1 and j.date=$2`, [user.id, t]);
    const ag = await aging(t);
    const recent = await all(`select i.id, i.no, i.date, i.total, i.paid, p.name party from invoices i left join parties p on p.id=i.party_id
      where i.kind='sale' and i.created_by=$1 order by i.id desc limit 10`, [user.id]);
    return { role: 'salesman', today: t, bills: mine.n, billed: r2(mine.v), recovery: r2(rec.v), collect: ag.rows.slice(0, 10), recent };
  }
  const f = await flows(from, to);
  const b = await balances(to);
  const cashAcc = await all(`select code, name from accounts where grp='Cash & Bank' order by code`);
  const cash = cashAcc.map(a => ({ ...a, balance: b[a.code] || 0 }));
  const stock = await one(`select coalesce(sum(greatest(stock,0)*cost),0) v from products where active`);
  const months = []; for (let k = 11; k >= 0; k--) months.push(addM(to.slice(0, 8) + '01', -k).slice(0, 7));
  // 12-month series for the sparklines: flows per month, and month-end balances
  const start = months[0] + '-01';
  const mrows = await all(`select to_char(j.date,'YYYY-MM') m,
      sum(case when jl.account='4000' then jl.credit - jl.debit else 0 end) sales,
      sum(case when jl.account='1200' and j.type in ('Cash Receipt','Bank Receipt') then jl.credit else 0 end) rec,
      sum(case when jl.account='1300' and j.type='Purchase Entry' then jl.debit when jl.account='1300' and j.type='Purchase Return Entry' then -jl.credit else 0 end) pur,
      sum(case when a.grp='Cost of Sales' or jl.account='5000' then jl.debit - jl.credit else 0 end) cos,
      sum(case when a.type='D' and a.grp<>'Cost of Sales' and jl.account<>'5000' then jl.debit - jl.credit else 0 end) exp,
      sum(case when jl.account='1200' then jl.debit - jl.credit else 0 end) ar,
      sum(case when jl.account='2000' then jl.credit - jl.debit else 0 end) ap,
      sum(case when a.grp='Cash & Bank' then jl.debit - jl.credit else 0 end) cash
    from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account
    where j.date >= $1 and j.date <= $2 group by 1`, [start, to]);
  const open = await one(`select coalesce(sum(case when jl.account='1200' then jl.debit - jl.credit end),0) ar,
      coalesce(sum(case when jl.account='2000' then jl.credit - jl.debit end),0) ap,
      coalesce(sum(case when a.grp='Cash & Bank' then jl.debit - jl.credit end),0) cash
    from journal_lines jl join journals j on j.id=jl.journal_id join accounts a on a.code=jl.account where j.date < $1`, [start]);
  const mm = Object.fromEntries(mrows.map(r => [r.m, r]));
  let ar = open.ar, ap = open.ap, cs = open.cash;
  const monthly = months.map(m => { const r = mm[m] || {}; ar += r.ar || 0; ap += r.ap || 0; cs += r.cash || 0;
    return { m, sales: r2(r.sales || 0), recovery: r2(r.rec || 0), purchases: r2(r.pur || 0), gp: r2((r.sales || 0) - (r.cos || 0)), expenses: r2(r.exp || 0), receivable: r2(ar), payable: r2(ap), cash: r2(cs) }; });
  // same-length period just before, for the "vs last period" figure
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const pTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10), pFrom = new Date(Date.parse(pTo) - (days - 1) * 864e5).toISOString().slice(0, 10);
  const prev = days < 4000 ? await flows(pFrom, pTo) : null;
  const topC = await all(`select p.id, p.name, sum(case when i.kind='sale' then i.total else -i.total end) v from invoices i join parties p on p.id=i.party_id
    where i.kind in ('sale','sale_return') and i.date between $1 and $2 group by p.id, p.name having sum(i.total) > 0 order by v desc limit 6`, [from, to]);
  const topP = await all(`select pr.id, pr.name, pr.unit, sum(il.qty) q, sum(il.amount) v from invoice_lines il join invoices i on i.id=il.invoice_id join products pr on pr.id=il.product_id
    where i.kind='sale' and i.date between $1 and $2 group by pr.id, pr.name, pr.unit order by v desc limit 6`, [from, to]);
  const recent = await all(`select i.id, i.no, i.date, i.total, i.paid, i.kind, p.name party from invoices i left join parties p on p.id=i.party_id
    where i.kind='sale' order by i.date desc, i.id desc limit 8`);
  const ag = await aging(to);
  const last = await one(`select max(date) d from journals`);
  const prods = await all(`select id, name, stock, price, cost, reorder from products where active`);
  const alerts = [];
  prods.filter(p => p.stock < 0).forEach(p => alerts.push({ level: 'red', text: `${p.name}: stock is ${p.stock}`, hint: 'More sold than bought. Do a stock count.' }));
  const zero = prods.filter(p => !(p.price > 0)); if (zero.length) alerts.push({ level: 'orange', text: `${zero.length} product${zero.length > 1 ? 's have' : ' has'} no sale price`, hint: zero.slice(0, 3).map(p => p.name).join(', ') });
  if (user.role === 'admin') prods.filter(p => p.price > 0 && p.price < p.cost).forEach(p => alerts.push({ level: 'orange', text: `${p.name} sells below cost`, hint: `Price ${p.price}, cost ${p.cost}` }));
  prods.filter(p => p.reorder > 0 && p.stock >= 0 && p.stock <= p.reorder).forEach(p => alerts.push({ level: 'orange', text: `${p.name} is low (${p.stock} left)`, hint: 'Time to reorder.' }));
  const old = ag.rows.filter(r => r.days > 60 && r.balance > 0);
  if (old.length) alerts.push({ level: 'yellow', text: `${old.length} customers unpaid for 60+ days`, hint: `Rs ${Math.round(old.reduce((a, r) => a + r.balance, 0)).toLocaleString('en-US')} in total` });
  const out = {
    role: user.role, from, to, today: t, lastEntry: last.d,
    sales: f.sales, recovery: f.recovery, expenses: f.exp, otherIncome: f.oth, prev: prev && { sales: prev.sales, recovery: prev.recovery, gp: prev.gp, from: pFrom, to: pTo },
    receivable: b['1200'] || 0, payable: r2(-(b['2000'] || 0)), cash, cashTotal: r2(cash.reduce((a, x) => a + x.balance, 0)),
    stockValue: r2(stock.v), monthly, topCustomers: topC, topProducts: topP, recent, aging: ag.buckets, owe: ag.rows.slice(0, 6), alerts,
  };
  if (user.role === 'admin') Object.assign(out, { gp: f.gp, cogs: f.cos, np: f.np });
  return out;
}

export async function ledger(account, partyId, from, to) {
  const open = await one(`select coalesce(sum(jl.debit - jl.credit),0) b from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account=$1 and j.date < $2${partyId ? ' and jl.party_id = $3' : ''}`, partyId ? [account, from, partyId] : [account, from]);
  const rows = await all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice, jl.debit, jl.credit from journal_lines jl join journals j on j.id=jl.journal_id
    where jl.account=$1 and j.date between $2 and $3${partyId ? ' and jl.party_id = $4' : ''} order by j.date, j.id`, partyId ? [account, from, to, partyId] : [account, from, to]);
  let run = r2(open.b);
  const lines = rows.map(r => { run = r2(run + r.debit - r.credit); return { ...r, balance: run }; });
  return { opening: r2(open.b), lines, closing: run };
}

export async function trialBalance(to) {
  const b = await balances(to);
  const acc = await all('select code, name, type, grp from accounts order by code');
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
  const b = await balances(to);
  const acc = await all('select code, name, type, grp from accounts order by code');
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
