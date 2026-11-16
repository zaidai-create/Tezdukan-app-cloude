// Registers: bills, payments, item-wise sales, customer/supplier summary and stock history as filterable tables
// with totals, Excel (CSV) export and PDF/print.
import { $, $$, esc, ic, chev, api, S, can, picker, hud, fail, route, go, page, rs, n2, qty as fq, fd, nice, today, fyStart, UI, swr } from './core.js';
import { shareDoc, shareFile } from './invoice.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const KL = { sale: 'Sale', purchase: 'Purchase', sale_return: 'Sales return', purchase_return: 'Purchase return' };
const ML = { receipt: 'Received', payment: 'Paid to supplier', expense: 'Expense', opening: 'Opening balance', journal: 'Journal', other_in: 'Other in', other_out: 'Other out' };

/* ---------- date presets ---------- */
const mStart = d => d.slice(0, 8) + '01';
const prevMonth = () => { const t = today(), d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 0)); const e = d.toISOString().slice(0, 10); return [mStart(e), e]; };
const PRESETS = [['month', 'Is mahina', () => [mStart(today()), today()]], ['last', 'Pichla mahina', prevMonth], ['year', 'Is saal (FY)', () => [fyStart(today()), today()]], ['all', 'Sab', () => ['2000-01-01', today()]], ['custom', 'Tareekh chunein', null]];

const qs = s => Object.fromEntries(new URLSearchParams(s || ''));
const toQ = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

/* ---------- filter bar ---------- */
function filterBar(F, { kinds, partyKind, status, search = true }) {
  const pName = F.party ? nice(S.boot.parties.find(p => p.id === +F.party)?.name || 'Party') : null;
  return `<div class="fbar">
    ${kinds ? `<div class="seg" data-fk>${kinds.map(([k, l]) => `<button data-v="${k}" class="${F.kind === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="frow">
      ${partyKind ? `<button class="fchip ${F.party ? 'on' : ''}" data-fp>${ic('people')}<span>${esc(pName || (partyKind === 'V' ? 'Sab suppliers' : partyKind === 'C' ? 'Sab customers' : 'Sab parties'))}</span>${F.party ? `<i data-fpx>${ic('x')}</i>` : ''}</button>` : ''}
      <select class="fchip" data-fd>${PRESETS.map(([k, l]) => `<option value="${k}" ${F.preset === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${status ? `<select class="fchip" data-fs>${status.map(([k, l]) => `<option value="${k}" ${F.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
    </div>
    ${F.preset === 'custom' ? `<div class="frow"><label class="fdate">From<input type="date" data-ff value="${F.from}"></label><label class="fdate">To<input type="date" data-ft value="${F.to}"></label></div>` : ''}
    ${search ? `<div class="search">${ic('search')}<input data-fq placeholder="Naam ya number se dhoondein" value="${esc(F.q || '')}" autocomplete="off"></div>` : ''}
  </div>`;
}
function wireFilters(host, F, partyKind, reload) {
  host.addEventListener('click', async e => {
    const k = e.target.closest('[data-fk] [data-v]'); if (k) { F.kind = k.dataset.v; reload(true); return; }
    if (e.target.closest('[data-fpx]')) { e.stopPropagation(); F.party = ''; reload(true); return; }
    if (e.target.closest('[data-fp]')) {
      const items = S.boot.parties.filter(p => !partyKind || partyKind === 'all' || p.kind === partyKind).map(p => ({ ...p, search: p.name + ' ' + p.city }));
      const r = await picker({ title: 'Party chunein', items, render: p => `<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${p.kind === 'C' ? 'Customer' : 'Supplier'}${p.city ? ' · ' + esc(nice(p.city)) : ''}</span></span>` });
      if (r) { F.party = r.id; reload(true); }
    }
  });
  host.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.fd !== undefined) { F.preset = t.value; const p = PRESETS.find(x => x[0] === t.value); if (p[2]) [F.from, F.to] = p[2](); reload(true); }
    if (t.dataset.fs !== undefined) { F.status = t.value; reload(true); }
    if (t.dataset.ff !== undefined) { F.from = t.value; reload(); }
    if (t.dataset.ft !== undefined) { F.to = t.value; reload(); }
  });
  let tm; host.addEventListener('input', e => { if (e.target.dataset.fq !== undefined) { F.q = e.target.value; clearTimeout(tm); tm = setTimeout(() => reload(), 300); } });
}
const initF = (o, preset = 'year') => { const F = { kind: '', party: '', status: 'all', q: '', preset, ...o }; const p = PRESETS.find(x => x[0] === F.preset); if (p?.[2] && !(o.from && o.to)) [F.from, F.to] = p[2](); if (o.from || o.to) F.preset = 'custom'; return F; };

/* ---------- table, CSV, print ---------- */
// cols: [key, label, {n: numeric, fmt: fn, cls, total}]
function table(cols, rows, totals, rowAttr = () => '') {
  return `<div class="tscroll"><table class="rtable"><thead><tr>${cols.map(([, l, o = {}]) => `<th class="${o.n ? 'n' : ''}">${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr ${rowAttr(r)}>${cols.map(([k, , o = {}]) => `<td class="${o.n ? 'n' : ''} ${typeof o.cls === 'function' ? o.cls(r) : o.cls || ''}">${o.fmt ? o.fmt(r[k], r) : esc(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    ${totals ? `<tfoot><tr>${cols.map(([k, , o = {}], i) => `<td class="${o.n ? 'n' : ''}">${i === 0 ? 'Total' : totals[k] != null && totals[k] !== '' ? (o.tfmt || o.fmt || (x => x))(totals[k], totals) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
}
const plain = (o, v, r) => { const h = o.fmt ? String(o.fmt(v, r)) : String(v ?? ''); return h.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(); };
async function exportCSV(name, cols, rows, totals) {
  const cell = s => { s = String(s ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const raw = (o, k, r) => (o.n && typeof r[k] === 'number' ? r[k] : plain(o, r[k], r));
  const lines = [cols.map(c => cell(c[1])).join(','), ...rows.map(r => cols.map(([k, , o = {}]) => cell(raw(o, k, r))).join(','))];
  if (totals) lines.push(cols.map(([k, , o = {}], i) => cell(i === 0 ? 'Total' : totals[k] ?? '')).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
  try { await shareFile(blob, `${name}.csv`, name); } catch (e) { fail(e); }
}
function printTable(title, sub, cols, rows, totals) {
  const c = S.boot.company;
  const html = `<div class="paper rep"><div class="rhead"><img src="/brand/logo-full.png" alt=""><div><b>${esc(c.name)}</b><span>${esc(title)}</span><small>${esc(sub)}</small></div></div>
    <table class="rtable print"><thead><tr>${cols.map(([, l, o = {}]) => `<th class="${o.n ? 'n' : ''}">${esc(l)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${cols.map(([k, , o = {}]) => `<td class="${o.n ? 'n' : ''}">${esc(plain(o, r[k], r))}</td>`).join('')}</tr>`).join('')}</tbody>
    ${totals ? `<tfoot><tr>${cols.map(([k, , o = {}], i) => `<td class="${o.n ? 'n' : ''}">${i === 0 ? 'Total' : totals[k] != null && totals[k] !== '' ? esc(plain({ fmt: o.tfmt || o.fmt }, totals[k], totals)) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table>
    <div class="gen">Printed ${esc(fd(today()))} · ${esc(c.name)}</div></div>`;
  shareDoc(html, { name: title.replace(/\W+/g, '-'), text: `${title} · ${sub}` });
}
const actions = () => `<div class="racts2"><button class="chip" data-csv>${ic('tray')} Excel (CSV)</button><button class="chip" data-print>${ic('printer')} PDF / Print</button></div>`;
const rng = F => `${fd(F.from)} – ${fd(F.to)}`;
const money = v => (v ? n2(v) : '—');

/* =============== BILLS REGISTER =============== */
const statusOf = r => r.kind.endsWith('return') ? '<span class="badge gray">Return</span>' : r.due < 0.5 ? '<span class="badge green">Paid</span>' : r.paid > 0 ? '<span class="badge orange">Part paid</span>' : '<span class="badge red">Credit</span>';
let billF = null;
route(/^register(?:\?(.*))?$/, async (v, query) => {
  const o = qs(query);
  if (!billF || query) billF = initF({ kind: o.kind || (can.staff() ? 'sale' : 'sale'), party: o.party || '', from: o.from, to: o.to }, o.party ? 'all' : 'year');
  const F = billF;
  const body = page(v, { title: 'Bills register', back: UI === 'web' ? 'home' : 'bills', backLabel: UI === 'web' ? 'Dashboard' : 'Bills', sub: 'Har bill ek table mein: kab, kis ko, kitna' });
  const kinds = can.staff() ? [['sale', 'Sales'], ['purchase', 'Purchases'], ['returns', 'Returns'], ['all', 'Sab']] : null;
  const cols = [
    ['date', 'Date', { fmt: x => fd(x) }], ['no', 'Bill no', { fmt: (x, r) => `<b>${esc(x)}</b>${r.edited_at ? ' <span class="badge gray">edited</span>' : ''}` }],
    ...(F.kind === 'all' || F.kind === 'returns' ? [['kind', 'Type', { fmt: x => KL[x] }]] : []),
    ['party', 'Party', { fmt: x => esc(nice(x || '—')) }], ['items', 'Items', { n: 1 }], ['qty', 'Qty', { n: 1, fmt: x => fq(x) }],
    ['discount', 'Discount', { n: 1, fmt: money, cls: 'grn' }], ['total', 'Total', { n: 1, fmt: x => n2(x), cls: 'b' }], ['paid', 'Received / paid', { n: 1, fmt: money }], ['due', 'Due', { n: 1, fmt: money, cls: r => (r.due > 0.5 ? 'red' : '') }],
    ['status', 'Status', { fmt: (x, r) => statusOf(r) }], ['by_name', 'Made by', { fmt: x => esc(x || '') }],
  ];
  let data = null;
  const draw = () => {
    const t = data.totals;
    $('[data-out]', body).innerHTML = `<div class="rsum">
        <div><small>Bills</small><b>${t.bills}</b></div><div><small>Total</small><b>${rs(t.total)}</b></div>
        <div><small>${F.kind === 'purchase' ? 'Paid' : 'Received'}</small><b>${rs(t.paid)}</b></div><div><small>Due</small><b class="red">${rs(t.due)}</b></div>
        ${t.discount ? `<div><small>Discount</small><b class="grn">${rs(t.discount)}</b></div>` : ''}</div>
      ${actions()}
      ${data.rows.length ? table(cols, data.rows, { ...t, items: '', status: '', by_name: '', party: '', no: `${t.bills} bills` }, r => `data-go="bill/${r.id}"`) : `<div class="empty">${ic('doc')}<div>Is filter mein koi bill nahi</div></div>`}`;
  };
  const load = async (redraw) => {
    if (redraw) { $('[data-f]', body).innerHTML = filterBar(F, { kinds, partyKind: F.kind === 'purchase' ? 'V' : F.kind === 'sale' ? 'C' : 'all', status: [['all', 'Sab bills'], ['due', 'Sirf baqaya'], ['paid', 'Sirf paid']] }); }
    const out = $('[data-out]', body); out.style.opacity = .5;
    try { await swr(`/api/registers/bills?${toQ({ kind: F.kind, party: F.party, from: F.from, to: F.to, status: F.status, q: F.q })}`, d => { data = d; draw(); }); }
    catch (e) { fail(e); } finally { out.style.opacity = 1; }
  };
  body.innerHTML = `<div data-f></div><div data-out>${loading}</div>`;
  wireFilters(body, F, null, load);
  body.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    const title = `Bills register${F.party ? ' · ' + nice(S.boot.parties.find(p => p.id === +F.party)?.name || '') : ''}`;
    if (e.target.closest('[data-csv]')) exportCSV(title.replace(/\W+/g, '-'), cols, data.rows, data.totals);
    if (e.target.closest('[data-print]')) printTable(title, rng(F), cols.filter(c => !['status', 'by_name'].includes(c[0])), data.rows, data.totals);
  });
  await load(true);
});

/* =============== PAYMENTS REGISTER =============== */
let monF = null;
route(/^moneyreg(?:\?(.*))?$/, async (v, query) => {
  const o = qs(query);
  if (!monF || query) monF = initF({ kind: o.kind || (can.staff() ? 'all' : 'receipt'), party: o.party || '' }, 'month');
  const F = monF;
  const body = page(v, { title: 'Payments register', back: 'more', backLabel: 'More', sub: 'Wasooli, supplier payments aur kharche' });
  const kinds = can.staff() ? [['all', 'Sab'], ['receipt', 'Wasooli'], ['payment', 'Supplier'], ['expense', 'Kharche']] : null;
  const cols = [['date', 'Date', { fmt: x => fd(x) }], ['no', 'Voucher', { fmt: x => `<b>${esc(x)}</b>` }], ['kind', 'Type', { fmt: x => ML[x] || x }],
    ['party', 'Party / head', { fmt: (x, r) => esc(nice(x || r.head || '—')) }], ['account', 'Cash / bank', { fmt: x => esc(nice(x || '')) }],
    ['amount', 'Amount', { n: 1, fmt: (x, r) => `<span class="${r.kind === 'receipt' || r.kind === 'other_in' ? 'grn' : ''}">${n2(x)}</span>` }], ['memo', 'Note', { fmt: x => esc(String(x || '').slice(0, 60)) }], ['by', 'By', { fmt: x => esc(x || '') }]];
  let data = null;
  const draw = () => {
    const t = data.totals;
    $('[data-out]', body).innerHTML = `<div class="rsum">${['receipt', 'payment', 'expense'].filter(k => t[k] != null || F.kind === k || F.kind === 'all').map(k => `<div><small>${ML[k]}</small><b class="${k === 'receipt' ? 'grn' : ''}">${rs(t[k] || 0)}</b></div>`).join('')}<div><small>Entries</small><b>${data.count}</b></div></div>
      ${actions()}${can.boss() ? '<p class="sec-f" style="margin:0 4px 8px">Galat entry cancel karne ke liye us line par tap karein.</p>' : ''}
      ${data.rows.length ? table(cols, data.rows, null, r => `data-j="${r.id}"`) : `<div class="empty">Is filter mein koi entry nahi</div>`}`;
  };
  const load = async (redraw) => {
    if (redraw) $('[data-f]', body).innerHTML = filterBar(F, { kinds, partyKind: F.kind === 'payment' ? 'V' : F.kind === 'receipt' ? 'C' : 'all' });
    try { await swr(`/api/registers/money?${toQ({ kind: F.kind, party: F.party, from: F.from, to: F.to, q: F.q })}`, d => { data = d; draw(); }); } catch (e) { fail(e); }
  };
  body.innerHTML = `<div data-f></div><div data-out>${loading}</div>`;
  wireFilters(body, F, null, load);
  body.addEventListener('click', async e => {
    if (e.target.closest('[data-csv]')) return exportCSV('Payments-register', cols, data.rows);
    if (e.target.closest('[data-print]')) return printTable('Payments register', rng(F), cols.filter(c => c[0] !== 'by'), data.rows);
    const tr = e.target.closest('[data-j]'); if (!tr) return;
    const r = data.rows.find(x => x.id === +tr.dataset.j);
    const { actionSheet, confirmBox } = await import('./core.js');
    const opts = [...(r.party_id ? [{ label: 'Party ka khata kholein', value: 'party' }] : []), ...(can.boss() && !r.legacy && !r.bill ? [{ label: 'Yeh entry cancel karein', value: 'cancel', danger: true }] : [])];
    if (!opts.length) return;
    const a = await actionSheet(`${ML[r.kind] || 'Entry'} · ${rs(r.amount)} · ${r.no}`, opts);
    if (a === 'party') go(`party/${r.party_id}`);
    if (a === 'cancel' && await confirmBox(`${r.no} cancel karein? Ledger se hat jayegi.`, 'Cancel entry', true)) {
      try { await api(`/api/journals/${r.id}`, { method: 'DELETE' }); hud('Cancelled'); load(); } catch (x) { fail(x); }
    }
  });
  await load(true);
});

/* =============== ITEM-WISE SALES =============== */
let itemF = null;
route(/^itemsales(?:\?(.*))?$/, async (v, query) => {
  const o = qs(query);
  if (!itemF || query) itemF = initF({ party: o.party || '' }, 'month');
  const F = itemF;
  const body = page(v, { title: 'Item-wise sales', back: 'reports', backLabel: 'Reports', sub: 'Kaun sa item kitna bika' });
  const boss = can.boss();
  const cols = [['name', 'Item', { fmt: x => `<b>${esc(nice(x))}</b>` }], ['unit', 'Unit'], ['qty', 'Qty sold', { n: 1, fmt: x => fq(x) }], ['avg', 'Avg rate', { n: 1, fmt: x => n2(x) }],
    ['amount', 'Sales', { n: 1, fmt: x => n2(x), cls: 'b' }], ['disc', 'Discount', { n: 1, fmt: money, cls: 'grn' }], ...(boss ? [['profit', 'Gross profit', { n: 1, fmt: x => n2(x) }]] : []), ['bills', 'Bills', { n: 1 }], ['customers', 'Customers', { n: 1 }]];
  let data;
  const load = async (redraw) => {
    if (redraw) $('[data-f]', body).innerHTML = filterBar(F, { partyKind: 'C', search: false });
    try {
      await swr(`/api/registers/items?${toQ({ party: F.party, from: F.from, to: F.to })}`, d => {
        data = d;
        $('[data-out]', body).innerHTML = `<div class="rsum"><div><small>Sales</small><b>${rs(d.totals.amount)}</b></div><div><small>Discount</small><b class="grn">${rs(d.totals.disc)}</b></div>${boss ? `<div><small>Gross profit</small><b>${rs(d.totals.profit)}</b></div>` : ''}<div><small>Items</small><b>${d.rows.length}</b></div></div>
          ${actions()}${d.rows.length ? table(cols, d.rows, { qty: d.totals.qty, amount: d.totals.amount, disc: d.totals.disc, profit: d.totals.profit }, r => `data-go="product/${r.id}"`) : '<div class="empty">Is dauran koi sale nahi</div>'}`;
      });
    } catch (e) { fail(e); }
  };
  body.innerHTML = `<div data-f></div><div data-out>${loading}</div>`;
  wireFilters(body, F, 'C', load);
  body.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-csv]')) exportCSV('Item-wise-sales', cols, data.rows, data.totals);
    if (e.target.closest('[data-print]')) printTable('Item-wise sales', rng(F), cols, data.rows, data.totals);
  });
  await load(true);
});

/* =============== CUSTOMER / SUPPLIER SUMMARY =============== */
let psF = null;
route(/^partysum(?:\/(C|V))?$/, async (v, k) => {
  if (!psF) psF = initF({ kind: 'C' }, 'year');
  const F = psF; if (k) F.kind = k; if (!can.staff()) F.kind = 'C';
  const body = page(v, { title: F.kind === 'V' ? 'Supplier summary' : 'Customer summary', back: 'reports', backLabel: 'Reports', sub: 'Har party ek line mein: bills, wasooli, baqaya' });
  const cust = () => F.kind === 'C';
  const cols = () => [['name', cust() ? 'Customer' : 'Supplier', { fmt: x => `<b>${esc(nice(x))}</b>` }], ['city', 'City', { fmt: x => esc(nice(x || '')) }], ['bills', 'Bills', { n: 1 }], ['last_bill', 'Last bill', { fmt: x => (x ? fd(x) : '—') }],
    ['billed', cust() ? 'Sales' : 'Purchases', { n: 1, fmt: x => n2(x) }], ['returned', 'Returns', { n: 1, fmt: money }], ['paid', cust() ? 'Received' : 'Paid', { n: 1, fmt: money, cls: 'grn' }], ['balance', cust() ? 'Balance due' : 'Balance payable', { n: 1, fmt: x => n2(x), cls: r => (r.balance > 0.5 ? 'red b' : 'b') }]];
  let data;
  const load = async (redraw) => {
    if (redraw) $('[data-f]', body).innerHTML = filterBar(F, { kinds: can.staff() ? [['C', 'Customers'], ['V', 'Suppliers']] : null, search: false });
    try {
      await swr(`/api/registers/parties?${toQ({ kind: F.kind, from: F.from, to: F.to })}`, d => {
        data = d; const t = d.totals;
        $('[data-out]', body).innerHTML = `<div class="rsum"><div><small>${cust() ? 'Sales' : 'Purchases'}</small><b>${rs(t.billed)}</b></div><div><small>${cust() ? 'Received' : 'Paid'}</small><b class="grn">${rs(t.paid)}</b></div><div><small>Balance</small><b class="red">${rs(t.balance)}</b></div><div><small>Parties</small><b>${d.rows.length}</b></div></div>
          ${actions()}${table(cols(), d.rows, t, r => `data-go="party/${r.id}"`)}`;
      });
    } catch (e) { fail(e); }
  };
  body.innerHTML = `<div data-f></div><div data-out>${loading}</div>`;
  wireFilters(body, F, null, async redraw => { $('.large', v).textContent = F.kind === 'V' ? 'Supplier summary' : 'Customer summary'; await load(redraw); });
  body.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-csv]')) exportCSV(cust() ? 'Customer-summary' : 'Supplier-summary', cols(), data.rows, data.totals);
    if (e.target.closest('[data-print]')) printTable(cust() ? 'Customer summary' : 'Supplier summary', rng(F), cols(), data.rows, data.totals);
  });
  await load(true);
});

/* =============== PRODUCT: stock history =============== */
route(/^product\/(\d+)$/, async (v, id) => {
  const p0 = S.boot.products.find(p => p.id === +id);
  const body = page(v, { title: p0 ? nice(p0.name) : 'Product', back: 'products', backLabel: 'Stock', right: can.staff() ? `<button class="nbtn" data-edit>Edit</button>` : '' });
  body.innerHTML = loading;
  const d = await api(`/api/products/${id}/history`);
  const p = d.product;
  const IN = { purchase: 'Purchase', sale: 'Sale', sale_return: 'Sales return', purchase_return: 'Purchase return', adjust: 'Stock adjust' };
  const cols = [['date', 'Date', { fmt: x => fd(x) }], ['kind', 'Type', { fmt: x => IN[x] }], ['no', 'Bill', { fmt: x => esc(x || '') }], ['party', 'Party / reason', { fmt: x => esc(nice(x || '')) }],
    ['in', 'In', { n: 1, fmt: (x, r) => (r.qty > 0 ? `<span class="grn">+${fq(r.qty)}</span>` : '') }], ['out', 'Out', { n: 1, fmt: (x, r) => (r.qty < 0 ? `<span class="red">${fq(-r.qty)}</span>` : '') }],
    ['rate', 'Rate', { n: 1, fmt: x => (x ? n2(x) : '') }], ['after', 'Stock after', { n: 1, fmt: x => `<b>${fq(x)}</b>` }]];
  body.innerHTML = `<div class="rsum"><div><small>In stock</small><b class="${p.stock < 0 ? 'red' : ''}">${fq(p.stock)} ${esc(p.unit)}</b></div><div><small>TP / sale price</small><b>${rs(p.price)}</b></div>${p.cost != null && can.staff() ? `<div><small>Cost (avg)</small><b>${rs(p.cost)}</b></div>` : ''}<div><small>Total in</small><b class="grn">${fq(d.totals.in)}</b></div><div><small>Total out</small><b class="red">${fq(d.totals.out)}</b></div></div>
    ${can.staff() ? `<div class="racts2"><button class="chip" data-adj>${ic('cube')} Stock adjust</button><button class="chip" data-csv>${ic('tray')} Excel (CSV)</button><button class="chip" data-sales>${ic('chart')} Sales of this item</button></div>` : ''}
    ${d.moves.length ? table(cols, d.moves, null, r => (r.bill ? `data-go="bill/${r.bill}"` : '')) : '<div class="empty">Abhi koi movement nahi</div>'}`;
  body.addEventListener('click', async e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-csv]')) exportCSV(`Stock-${nice(p.name).replace(/\W+/g, '-')}`, cols, d.moves);
    if (e.target.closest('[data-sales]')) go('itemsales');
    if (e.target.closest('[data-adj]')) { const m = await import('./screens.js'); if (await m.productForm(S.boot.products.find(x => x.id === p.id))) go(`product/${p.id}`); }
  });
  const ed = $('[data-edit]', v); if (ed) ed.onclick = async () => { const m = await import('./screens.js'); if (await m.productForm(S.boot.products.find(x => x.id === p.id))) go(`product/${p.id}`); };
});
