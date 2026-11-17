import { $, $$, esc, ic, chev, api, S, can, auth, party, product, reloadBoot, hud, fail, sheet, picker, actionSheet, confirmBox, route, go, render, page,
  rs, rs2, n2, qty as fq, short, r2, fd, fdShort, monShort, today, fyStart, nice, initials, waPhone, swr, refreshBoot, ROLE_LABEL } from './core.js';
import { invoiceHTML, statementHTML, fitPaper, shareDoc, billText, viewDoc } from './invoice.js';
import { ledgerTable, ledgerCSV } from './ledgers.js';
import { openVoice } from './voice.js';
import { UI } from './core.js';
import { webHome } from './webdash.js';
import { closeBooks } from './finance.js';
import { afterSubmit, pendingCard, notice } from './approvals.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const avatar = name => `<span class="avatar">${esc(initials(name))}</span>`;
const fyFrom = () => fyStart(today());
const KLABEL = { sale: 'Sales invoice', purchase: 'Purchase invoice', sale_return: 'Sales return', purchase_return: 'Purchase return' };
const status = i => {
  if (i.kind === 'sale_return' || i.kind === 'purchase_return') return `<span class="badge gray">${KLABEL[i.kind]}</span>`;
  const due = i.total - i.paid;
  return due < 0.5 ? '<span class="badge green">Paid</span>' : i.paid > 0 ? `<span class="badge orange">Due ${rs(due)}</span>` : `<span class="badge red">Credit</span>`;
};
const cashAccounts = () => S.boot.accounts.filter(a => a.grp === 'Cash & Bank');
let period = 'month';
const periodRange = () => { const t = today(); return period === 'today' ? [t, t] : period === 'month' ? [t.slice(0, 8) + '01', t] : period === 'year' ? [fyFrom(), t] : ['2000-01-01', t]; };

/* =============================== HOME =============================== */
const MARK = '<img src="/brand/logo-mark.png" alt="">';
const PERIODS = [['today', 'Today'], ['month', 'Month'], ['year', 'This Year'], ['all', 'All']];
const spark = (vals, c) => {
  const v = vals.length ? vals : [0, 0], mx = Math.max(...v), mn = Math.min(...v, 0), sp = (mx - mn) || 1, w = 140, h = 26;
  const pts = v.map((x, i) => [i * w / (v.length - 1 || 1), h - 3 - (x - mn) / sp * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return `<svg class="sp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="a" d="${d}L${w},${h}L0,${h}Z"/><path class="l" d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
};
const pctChg = (now, before) => (before && Math.abs(before) > 1 ? (now - before) / Math.abs(before) : null);
const wave = () => `<span class="wave" aria-hidden="true">${[10, 18, 26, 14, 22, 12, 24, 16, 8].map(h => `<i style="height:${h}px"></i>`).join('')}</span>`;

route(/^home$/, async v => {
  if (UI === 'web') return webHome(v);
  const sales = S.user.role === 'salesman', first = String(S.user.name || '').split(' ')[0];
  const alertsCount = () => (S._alerts || 0);
  v.innerHTML = `<div class="page"><div class="brandbar"><span class="brandmark">${MARK}</span><span class="brandtext"><b>${esc(nice(S.boot.company.name))}</b><span>Sales, stock and accounts</span></span>
      <button class="roundbtn" data-go="notices" aria-label="Notifications">${ic('bell')}<span class="dot" data-dot hidden></span></button><button class="me" data-go="more" aria-label="Profile">${esc(first.slice(0, 1).toUpperCase())}</button></div>
    <h1 class="hello">Hello, ${esc(first)}!</h1><p class="hello-sub">${sales ? 'Aaj ka kaam, ek nazar mein' : 'Here’s your business overview'} · ${esc(fd(today()))}</p>
    <div data-pend></div><div data-d>${loading}</div></div>`;
  const D = $('[data-d]', v);
  const draw = async () => {
    const [from, to] = periodRange();
    // saved dashboard shows instantly, fresh numbers replace it a moment later
    await swr(`/api/dashboard?from=${from}&to=${to}`, d => { D.innerHTML = sales ? salesmanHome(d) : staffHome(d); }, { persist: true });
  };
  const n = notice.unread + (can.boss() ? notice.pending : 0), dot = $('[data-dot]', v); if (dot && n) { dot.hidden = false; dot.textContent = n > 9 ? '9+' : n; }
  pendingCard($('[data-pend]', v));
  v.onclick = e => {
    const b = e.target.closest('[data-k],[data-go],[data-voicecta],[data-newbill]');
    if (!b) return;
    if (b.dataset.k) { period = b.dataset.k; D.style.opacity = .55; draw().finally(() => { D.style.opacity = 1; }).catch(fail); return; }
    if (b.dataset.go) go(b.dataset.go);
    if (b.dataset.voicecta !== undefined) openVoice();
    if (b.dataset.newbill !== undefined) newBill('sale');
  };
  await draw();
});

function staffHome(d) {
  const admin = can.boss(), stale = Math.round((Date.parse(today()) - Date.parse(d.lastEntry || today())) / 864e5);
  const m = d.monthly, ser = k => m.map(x => x[k]);
  const ch = pctChg(d.sales, d.prev?.sales), up = ch == null || ch >= 0;
  const label = { today: 'Sales today', month: 'Sales this month', year: 'Sales this year', all: 'Total sales' }[period];
  const tiles = [
    ['Sales', d.sales, 'cart', 'var(--brand2)', 'bills', ser('sales')],
    ['Received', d.recovery, 'checkc', 'var(--green)', 'report/daybook', ser('recovery')],
    ['Customers owe', d.receivable, 'people', 'var(--orange)', 'recovery', ser('receivable')],
    ['Cash & Bank', d.cashTotal, 'bank', 'var(--teal)', 'accounts', ser('cash')],
    admin ? ['Gross profit', d.gp, 'chart', 'var(--purple)', 'report/pl', ser('gp')] : ['Expenses', d.expenses, 'receipt', 'var(--purple)', 'report/pl', ser('expenses')],
    d.payable >= 0 ? ['You owe suppliers', d.payable, 'tag', 'var(--pink)', 'parties/V', ser('payable')] : ['Advance with suppliers', -d.payable, 'tag', 'var(--pink)', 'parties/V', ser('payable').map(x => -x)],
  ];
  const max = Math.max(...m.map(x => x.sales), 1), cur = m.at(-1);
  return `<div class="hero"><div class="k">${ic('chart')}${label}</div><div class="big num">${rs(d.sales)}</div>
      ${ch == null ? `<span class="chg">${esc(fd(d.from))} – ${esc(fd(d.to))}</span>` : `<span class="chg"><i class="${up ? '' : 'dn'}">${ic(up ? 'arrowup' : 'arrowdown')}</i><b class="${up ? '' : 'dn'}">${up ? '+' : ''}${Math.round(ch * 100)}%</b> vs previous ${period === 'today' ? 'day' : period === 'month' ? 'period' : 'period'}</span>`}
      <button class="more" data-go="report/pl">Details ${ic('arrow')}</button></div>
    <div class="pills" role="tablist">${PERIODS.map(([k, l]) => `<button data-k="${k}" class="${period === k ? 'on' : ''}" role="tab" aria-selected="${period === k}">${l}</button>`).join('')}</div>
    <div class="ktiles">${tiles.map(t => `<button class="kt" style="--c:${t[3]}" data-go="${t[4]}"><span class="ki">${ic(t[2])}</span><span class="kl">${t[0]}</span><span class="kv num">${short(t[1])}</span>${spark(t[5], t[3])}<span class="go">${ic('chevr')}</span></button>`).join('')}</div>
    <button class="vbanner" data-voicecta><span class="m">${ic('mic')}</span><span class="t"><b>Bol kar entry karein</b><span>“3 kg ghee Mehran Hotel ko diya 3000 ka”</span></span>${wave()}</button>
    ${stale > 3 ? `<div class="notice">${ic('warn')}<div>Last entry was on <b>${esc(fd(d.lastEntry))}</b> (${stale} days ago). Add the bills since then so the numbers are right.</div></div>` : ''}
    <div class="card ov"><div class="hd">${ic('chart')}<b>Sales overview</b><span class="tag">Last 12 months</span></div>
      <div class="num2"><b class="num">${rs(cur.sales)}</b><span class="l2">this month so far · last month ${short(m.at(-2)?.sales || 0)}</span></div>
      <div class="bars">${m.map((x, k) => `<div class="b ${k === 11 ? 'on' : ''}" title="${esc(monShort(x.m))}: ${esc(rs(x.sales))}">${k === 11 ? `<span class="tipv">${short(x.sales)}</span>` : ''}<div class="bb" style="height:${Math.max(x.sales / max * 100, 2)}%;animation-delay:${k * 30}ms"></div><span>${monShort(x.m)}</span></div>`).join('')}</div></div>
    ${d.owe.length ? `<div class="sec-h">To collect<button data-go="recovery">See all</button></div><div class="list">${d.owe.map(o => `<button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} days` : 'Advance'}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('')}</div>` : ''}
    ${d.alerts.length ? `<div class="sec-h">Needs attention</div><div class="list">${d.alerts.map(a => `<div class="row with-icon"><span class="ico" style="background:var(--${a.level === 'red' ? 'red' : a.level === 'yellow' ? 'yellow' : 'orange'})">${ic('warn')}</span><span class="grow"><span class="t" style="white-space:normal">${esc(nice(a.text))}</span><span class="s" style="white-space:normal">${esc(nice(a.hint || ''))}</span></span></div>`).join('')}</div>` : ''}
    <div class="sec-h">Recent bills<button data-go="bills">See all</button></div>
    <div class="list">${d.recent.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party))}</span><span class="s">${esc(i.no)} · ${esc(fdShort(i.date))}</span></span><span class="v num"><b>${rs(i.total)}</b><br>${status({ ...i, kind: 'sale' })}</span>${chev}</button>`).join('')}</div>`;
}

function salesmanHome(d) {
  return `<div class="hero"><div class="k">${ic('cart')}Sold today</div><div class="big num">${rs(d.billed)}</div><span class="chg">${d.bills} bill${d.bills === 1 ? '' : 's'} · ${rs(d.recovery)} collected</span><button class="more" data-newbill>New bill ${ic('arrow')}</button></div>
    <button class="vbanner" data-voicecta><span class="m">${ic('mic')}</span><span class="t"><b>Bol kar entry karein</b><span>Sale ya recovery, bas bolein</span></span>${wave()}</button>
    ${d.collect.length ? `<div class="sec-h">To collect<button data-go="recovery">See all</button></div><div class="list">${d.collect.map(o => `<button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} days` : ''}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('')}</div>` : ''}
    <div class="sec-h">My bills</div>
    ${d.recent.length ? `<div class="list">${d.recent.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party))}</span><span class="s">${esc(i.no)} · ${esc(fdShort(i.date))}</span></span><span class="v num"><b>${rs(i.total)}</b></span>${chev}</button>`).join('')}</div>` : `<div class="empty">${ic('doc')}<div>No bills yet</div></div>`}`;
}

/* =============================== BILLS =============================== */
let billKind = 'sale';
route(/^bills(?:\/(sale|purchase|returns))?$/, async (v, k) => {
  if (UI === 'web') return go('register');
  if (k) billKind = k;
  if (!can.staff()) billKind = 'sale';
  const body = page(v, { title: 'Bills', right: `<button class="nbtn" data-table aria-label="Table">${ic('list')}</button><button class="nbtn" data-new aria-label="New">${ic('plus')}</button>` });
  $('[data-table]', v).onclick = () => go('register');
  $('[data-new]', v).onclick = async () => {
    if (!can.staff()) return newBill('sale');
    const kind = await actionSheet('New', [{ label: 'Sale bill', value: 'sale' }, { label: 'Purchase bill', value: 'purchase' }, { label: 'Sales return', value: 'sale_return' }, { label: 'Purchase return', value: 'purchase_return' }]);
    if (kind) newBill(kind);
  };
  body.innerHTML = `${can.staff() ? `<div class="seg" data-kind>${[['sale', 'Sales'], ['purchase', 'Purchases'], ['returns', 'Returns']].map(([x, l]) => `<button data-x="${x}" class="${billKind === x ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <button class="banner tbl" data-go="register">${ic('list')}<span class="grow"><b>Table view (register)</b><small>Customer / supplier ke sab bills, tareekh aur totals ke saath</small></span>${chev}</button>
    <div class="search">${ic('search')}<input placeholder="Search name or bill no." data-q autocomplete="off"></div><div data-l>${loading}</div>`;
  const L = $('[data-l]', body), Q = $('[data-q]', body);
  let off = 0, rows = [];
  try { const pre = sessionStorage.getItem('qt.q'); if (pre) { Q.value = pre; sessionStorage.removeItem('qt.q'); } } catch {}
  const load = async (more) => {
    if (!more) { off = 0; rows = []; }
    const kinds = billKind === 'returns' ? ['sale_return', 'purchase_return'] : [billKind];
    const urls = kinds.map(kk => `/api/invoices?kind=${kk}&q=${encodeURIComponent(Q.value.trim())}&offset=${off}&limit=60`);
    const base = rows;
    const paint = got => {
      got = got.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
      rows = base.concat(got);
      L.innerHTML = rows.length ? `<div class="list">${rows.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party || '—'))}</span><span class="s">${esc(i.no)} · ${esc(fd(i.date))}${i.source === 'voice' ? ' · voice' : ''}</span></span><span class="v num"><b>${rs(i.total)}</b><br>${status(i)}</span>${chev}</button>`).join('')}</div>${got.length === 60 ? '<button class="btn gray" style="margin-top:12px" data-more>Load more</button>' : ''}`
      : `<div class="empty">${ic('doc')}<div>No bills</div></div>`;
    };
    if (urls.length === 1 && !more) await swr(urls[0], paint, { persist: !Q.value.trim() });
    else paint((await Promise.all(urls.map(u => api(u)))).flat());
    off += 60;
  };
  let t; Q.oninput = () => { clearTimeout(t); t = setTimeout(() => load().catch(fail), 250); };
  body.onclick = e => { const b = e.target.closest('[data-x],[data-go],[data-more]'); if (!b) return; if (b.dataset.x) { billKind = b.dataset.x; $$('[data-x]', body).forEach(x => x.classList.toggle('on', x === b)); L.innerHTML = loading; load().catch(fail); } if (b.dataset.go) go(b.dataset.go); if (b.dataset.more !== undefined) load(true).catch(fail); };
  await load();
});

/* ---------- invoice view ---------- */
let paperMode = 'a4';
route(/^bill\/(\d+)(?:\?(share)(?:=1)?)?$/, async (v, id, share) => {
  const d = await api('/api/invoices/' + id);
  const i = d.invoice, p = d.party;
  const body = page(v, { title: i.no, back: 'bills', backLabel: 'Bills', sub: `${KLABEL[i.kind]} · ${esc(nice(p?.name || ''))} · ${esc(fd(i.date))}` });
  const due = r2(i.total - i.paid);
  // balance on the bill: off unless switched on for this customer (remembered per customer)
  const BK = 'qt.bal.' + (p?.id || 0);
  let showBal = false; try { showBal = localStorage.getItem(BK) === '1'; } catch {}
  body.innerHTML = `<div class="seg" data-mode>${[['a4', 'A4 Invoice'], ['slip', 'Receipt 80mm']].map(([k, l]) => `<button data-m="${k}" class="${paperMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${p?.kind === 'C' && (i.kind === 'sale' || i.kind === 'sale_return') ? `<div class="list balsw"><div class="row"><span class="grow"><span class="t">Purana balance bill par</span><span class="s">Previous balance ${rs(d.previous)} · total due ${rs(d.after)}</span></span><input type="checkbox" class="toggle" data-bal ${showBal ? 'checked' : ''}></div></div>` : ''}
    <div class="paperwrap" data-paper></div>
    <div class="btns b3" style="margin-top:16px"><button class="btn gray" data-view>${ic('pdf')} PDF / Image</button><button class="btn" data-share>${ic('share')} Send</button><button class="btn gray" data-wa ${waPhone(p?.phone) ? '' : 'disabled'}>${ic('chat')} WhatsApp</button></div>
    <div class="list" style="margin-top:20px">
      ${i.kind === 'sale' && due > 0.5 ? `<button class="row action" data-recv>${ic('down')}<span class="grow">Receive payment</span><span class="v num">${rs(due)}</span></button>` : ''}
      ${p ? `<button class="row" data-go="party/${p.id}"><span class="grow">${p.kind === 'C' ? 'Customer' : 'Supplier'} account</span><span class="v">${esc(nice(p.name))}</span>${chev}</button>` : ''}
      <div class="row"><span class="grow">Made by</span><span class="v">${esc(i.created_by_name || '—')}${i.source === 'voice' ? ' · by voice' : i.legacy ? ' · old software' : ''}</span></div>
      ${i.edited_at ? `<div class="row"><span class="grow">Last edited</span><span class="v">${esc(fd(String(i.edited_at).slice(0, 10)))}</span></div>` : ''}
      ${!i.legacy && (can.staff() || (i.kind === 'sale' && i.created_by === S.user.id)) ? `<button class="row action" data-editbill>${ic('pencil')}<span class="grow">Edit bill</span>${chev}</button>` : ''}
      ${can.staff() || i.kind === 'sale' ? `<button class="row action" data-copybill>${ic('doc')}<span class="grow">Isi jaisa naya invoice</span>${chev}</button>` : ''}
      ${can.staff() && (i.kind === 'sale' || i.kind === 'purchase') ? `<button class="row action" data-retbill>${ic('return')}<span class="grow">${i.kind === 'sale' ? 'Sales return' : 'Purchase return'} — is invoice se</span>${chev}</button>` : ''}
      ${i.ref_no ? `<div class="row"><span class="grow">Against invoice</span><span class="v">${esc(i.ref_no)}</span></div>` : ''}
      ${p ? `<button class="row" data-go="register?party=${p.id}&kind=all"><span class="grow">${esc(nice(p.name))} ke sab bills (table)</span>${chev}</button>` : ''}
      ${!waPhone(p?.phone) && p ? `<button class="row action" data-phone><span class="grow">Add WhatsApp number</span></button>` : ''}
    </div>
    ${can.boss() && !i.legacy ? `<div class="list" style="margin-top:20px"><button class="row danger" data-cancel>Cancel this bill</button></div><p class="sec-f">Cancelling removes the bill, its payment and its stock movement. It is recorded in the activity log.</p>` : ''}`;
  const W = $('[data-paper]', body);
  const drawPaper = () => { W.innerHTML = invoiceHTML(d, { slip: paperMode === 'slip', balance: showBal }); fitPaper(W); };
  drawPaper();
  const doShare = () => shareDoc(invoiceHTML(d, { slip: paperMode === 'slip', balance: showBal }), { name: `${i.no}`, phone: p?.phone, text: billText(d, { balance: showBal }) });
  body.onchange = e => { if (e.target.dataset.bal !== undefined) { showBal = e.target.checked; try { localStorage.setItem(BK, showBal ? '1' : '0'); } catch {} drawPaper(); } };
  body.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m) { paperMode = b.dataset.m; $$('[data-m]', body).forEach(x => x.classList.toggle('on', x === b)); drawPaper(); }
    if (b.dataset.share !== undefined) doShare();
    if (b.dataset.wa !== undefined) open(`https://wa.me/${waPhone(p.phone)}?text=${encodeURIComponent(billText(d, { balance: showBal }))}`, '_blank');
    if (b.dataset.recv !== undefined) receiveMoney(p.id, due);
    if (b.dataset.editbill !== undefined) newBill(i.kind, null, { edit: d });
    if (b.dataset.copybill !== undefined) newBill(i.kind, null, { copy: d });
    if (b.dataset.retbill !== undefined) newBill(i.kind === 'sale' ? 'sale_return' : 'purchase_return', null, { retd: d, ret: i });
    if (b.dataset.view !== undefined) viewDoc(invoiceHTML(d, { slip: paperMode === 'slip', balance: showBal }), { name: `${i.no}`, phone: p?.phone, text: billText(d, { balance: showBal }), title: i.no });
    if (b.dataset.go) go(b.dataset.go);
    if (b.dataset.phone !== undefined) partyForm(p.kind, party(p.id) || p);
    if (b.dataset.cancel !== undefined) {
      if (!(await confirmBox(`Cancel bill ${i.no}? Stock and ledger will be reversed.`, 'Cancel bill', true))) return;
      try { await api('/api/invoices/' + i.id, { method: 'DELETE' }); await reloadBoot(); hud('Bill cancelled'); go('bills'); } catch (err) { fail(err); }
    }
  };
  if (share) { history.replaceState(null, '', '#bill/' + id); setTimeout(doShare, 500); }
});

/* ---------- new bill ---------- */
export async function newBill(kind = 'sale', partyId = null, pre = null) {
  const C = S.boot.company, isSale = kind === 'sale' || kind === 'sale_return', pk = isSale ? 'C' : 'V';
  const outgoing = kind === 'sale' || kind === 'purchase_return';   // stock leaves the godown
  // Purchase: the supplier's own item list (what we bought from them before) as an order sheet.
  // Sale and returns: pick items one by one (cards), as before.
  const sheetMode = kind === 'purchase';
  const B = { kind, party: partyId ? party(partyId) : null, discount: 0, discTxt: '', allDp: 0, tax: (C.tax_pct || 0) > 0, taxPct: C.tax_pct || 18, pay: 'credit', paid: 0, account: '1000', date: today(), note: '' };
  let rates = {};
  const rateOf = p => rates[p.id] || (kind === 'purchase' || kind === 'purchase_return' ? p.cost || p.price : p.price) || 0;
  const tpFor = p => (isSale ? +p.price || 0 : 0);
  const loadRates = async () => { rates = B.party ? await api(`/api/parties/${B.party.id}/rates`).catch(() => ({})) : {}; };
  // one line per product: qty (charged) + free (sample / bonus, Rs 0), rate, TP
  const L = new Map(); let order = [];
  const lineOf = p => { let l = L.get(p.id); if (!l) { l = { p: p.id, qty: 0, free: 0, rate: rateOf(p), tp: tpFor(p) }; if (isSale && B.allDp && l.tp > 0) l.rate = r2(l.tp * (1 - B.allDp / 100)); L.set(p.id, l); } return l; };
  const filled = () => order.map(id => L.get(id)).filter(l => l && (l.qty > 0 || l.free > 0));
  // pre.edit: change an existing bill (same number); pre.copy: same items again; pre.retd: a return against a bill
  const src = pre?.edit || pre?.copy || pre?.retd, ed = pre?.edit?.invoice;
  if (src) {
    const i = src.invoice;
    B.party = party(i.party_id) || src.party;
    for (const x of src.lines.filter(x => x.product_id)) {
      let l = L.get(x.product_id); if (!l) { l = { p: x.product_id, qty: 0, free: 0, rate: +x.rate, tp: 0 }; L.set(x.product_id, l); order.push(x.product_id); }
      if (+x.rate > 0) { l.qty += +x.qty; l.rate = +x.rate; l.tp = isSale ? Math.max(+(ed ? x.tp : 0) || +(product(x.product_id)?.price) || 0, 0) : 0; } else l.free += +x.qty;
    }
    if (ed) {
      B.date = i.date; B.discTxt = +i.discount ? String(+i.discount) : ''; B.tax = +i.tax_pct > 0; B.taxPct = +i.tax_pct || B.taxPct; B.note = /^Voice:/.test(i.note || '') ? '' : (i.note || '');
      if (+i.paid > 0) { B.pay = i.pay_account && i.pay_account !== '1000' ? 'bank' : 'cash'; B.paid = +i.paid; B.account = i.pay_account || '1000'; }
    }
  }
  await loadRates();
  for (const l of L.values()) { const p = product(l.p); if (!p) continue; if (!(l.rate > 0)) l.rate = rateOf(p); if (isSale && !l.tp) l.tp = tpFor(p); }
  // purchase sheet = items on this bill + everything we bought from this supplier before
  const supplierList = () => { if (!sheetMode) return; const keep = order.filter(id => (L.get(id)?.qty > 0 || L.get(id)?.free > 0)), seen = new Set(keep);
    order = [...keep, ...Object.keys(rates).map(Number).filter(id => product(id) && !seen.has(id))]; };
  supplierList();

  // TP = trade price from the price list. Item discount = TP - rate; bill discount can be typed as Rs or %.
  const tpOf = l => (isSale && l.qty > 0 ? Math.max(+l.tp || 0, l.rate) : 0);
  const pctOf = l => (isSale && l.tp > 0 && l.tp > l.rate ? r2((l.tp - l.rate) / l.tp * 100) : 0);
  const pc1 = l => Math.round(pctOf(l) * 10) / 10;
  const billDisc = sub => { const t = String(B.discTxt || '').trim(); const v = parseFloat(t) || 0; return Math.min(r2(/%$/.test(t) ? sub * v / 100 : v), sub); };
  const T = () => { const F = filled(), sub = r2(F.reduce((a, l) => a + l.qty * l.rate, 0)), gross = r2(F.reduce((a, l) => a + l.qty * tpOf(l), 0)), item = isSale ? r2(gross - sub) : 0, disc = billDisc(sub); B.discount = disc;
    const net = r2(sub - disc), tax = B.tax ? r2(net * B.taxPct / 100) : 0, total = r2(net + tax);
    return { n: F.length, q: r2(F.reduce((a, l) => a + l.qty, 0)), fr: r2(F.reduce((a, l) => a + l.free, 0)), sub, gross, item, disc, alld: r2(item + disc), net, tax, total, paid: B.pay === 'credit' ? 0 : Math.min(B.paid || total, total) }; };

  // stock check: an edited bill gives its old qty back first
  const had = {}; if (ed) for (const x of pre.edit.lines) had[x.product_id] = (had[x.product_id] || 0) + (+x.qty || 0);
  const avail = p => +p.stock + (outgoing ? (had[p.id] || 0) : 0);
  const over = l => { const p = product(l.p); return p && outgoing ? r2(l.qty + l.free - avail(p)) : 0; };
  const warn = l => { const p = product(l.p); if (!p || !(l.qty > 0 || l.free > 0)) return ''; const sh = over(l);
    if (sh > 0) return avail(p) > 0 ? `Stock mein sirf ${fq(avail(p))} ${p.unit} hai — ${fq(sh)} zyada` : `Stock ${fq(avail(p))} ${p.unit} hai — ${fq(sh)} zyada bik raha hai`; if (kind === 'sale' && l.qty > 0 && p.cost && l.rate < p.cost && can.boss()) return `Cost (${rs(p.cost)}) se kam rate`; return ''; };
  const offTxt = l => { if (!isSale || !(l.tp > 0) || !(l.qty > 0)) return ''; if (l.rate < l.tp) return `<span class="grn">−${rs2(l.tp - l.rate)} · ${rs(r2((l.tp - l.rate) * l.qty))} off</span>`; if (l.rate > l.tp) return `<span class="orange">TP se ${rs2(l.rate - l.tp)} zyada</span>`; return '<span class="l2">TP rate</span>'; };
  const amtTxt = l => (l.qty > 0 ? rs2(l.qty * l.rate) : l.free > 0 ? 'FREE' : rs2(0));

  const title = ed ? `Edit ${ed.no}` : { sale: 'Sales Invoice', purchase: 'Purchase Invoice', sale_return: 'Sales Return', purchase_return: 'Purchase Return' }[kind] + (pre?.ret ? ` · ${pre.ret.no}` : '');
  const foot = document.createElement('div'); foot.style.cssText = 'display:contents';
  foot.innerHTML = `<div class="tot"><small data-tn>Total</small><b class="num" data-tt>Rs 0</b></div><button class="btn" data-save>${ed ? 'Update' : 'Save'}</button>`;
  const s = sheet({ title, full: true, body: '<div data-b class="bform"></div>', footer: foot });
  const b = $('[data-b]', s.el);
  const val = x => (x ? String(x) : '');
  const fixBtn = id => (can.staff() && outgoing ? `<button data-fix="${id}">Stock theek karein</button>` : '');

  // ---- sale / returns: one card per item (stepper qty × rate, free, TP & discount) ----
  const cardHTML = id => { const p = product(id), l = L.get(id), w = warn(l);
    return `<div class="item bi ${over(l) > 0 ? 'bad' : ''}" data-id="${id}"><div class="nm">${esc(nice(p?.name))}<small data-st>${fq(p ? avail(p) : 0)} ${esc(p?.unit || '')} stock${isSale && p?.price > 0 ? ` · TP ${n2(p.price)}` : ''}</small></div><div class="amt num" data-amt>${amtTxt(l)}</div>
      <div class="ctl"><div class="stepper"><button data-dq="${id}:-1" aria-label="Less">−</button><input inputmode="decimal" data-f="qty" value="${l.qty}" aria-label="Quantity"><button data-dq="${id}:1" aria-label="More">+</button></div><span class="l2">×</span><input class="rate" inputmode="decimal" data-f="rate" value="${l.rate}" aria-label="Rate"><button class="x" data-rm="${id}" aria-label="Remove">${ic('trash')}</button></div>
      <div class="dl"><label class="frl">Free / sample<input inputmode="decimal" data-f="free" value="${val(l.free)}" placeholder="0" aria-label="Free quantity"></label>
        ${isSale && l.tp > 0 ? `<label class="dp">Disc<input inputmode="decimal" data-f="dp" value="${val(pc1(l))}" placeholder="0" aria-label="Discount percent">%</label><span class="off" data-off>${offTxt(l)}</span>` : ''}</div>
      <div class="sw" ${w ? '' : 'hidden'}><span data-w>${esc(w)}</span>${fixBtn(id)}</div></div>`; };
  // ---- purchase: supplier's list, Qty | Free / sample | Rate ----
  const rowHTML = id => { const p = product(id), l = L.get(id) || { qty: 0, free: 0, rate: rateOf(p) }, on = l.qty > 0 || l.free > 0, w = warn(l);
    return `<div class="srow ${on ? 'on' : ''}" data-id="${id}">
      <div class="sh"><b>${esc(nice(p.name))}</b><span class="sa num" data-amt>${on ? amtTxt(l) : ''}</span></div>
      <div class="sm">${fq(avail(p))} ${esc(p.unit)} stock${rates[id] ? ` · last rate ${n2(rates[id])}` : ''}</div>
      <div class="sf f3"><label><small>Qty</small><input data-f="qty" inputmode="decimal" value="${val(l.qty)}" placeholder="0"></label>
        <label class="fr"><small>Free / sample</small><input data-f="free" inputmode="decimal" value="${val(l.free)}" placeholder="0"></label>
        <label class="rt"><small>Rate</small><input data-f="rate" inputmode="decimal" value="${val(l.rate)}" placeholder="0"></label></div>
      <div class="sw" ${w ? '' : 'hidden'}><span data-w>${esc(w)}</span></div></div>`; };
  const quick = () => { const ids = [...Object.keys(rates).map(Number), ...S.boot.products.map(p => p.id)]; const seen = new Set(order); const out = [];
    for (const id of ids) { if (!seen.has(id) && product(id)) { seen.add(id); out.push(id); } if (out.length >= 8) break; } return out; };
  const drawItems = () => {
    const box = $('[data-items]', b);
    if (sheetMode) {
      box.innerHTML = `${order.length ? `<div class="sheetl">${order.map(rowHTML).join('')}</div>`
          : `<div class="empty" style="padding:18px 10px">${B.party ? 'Is supplier se pehle koi item nahi liya.<br>Neeche "Item add karein" se daalein.' : 'Pehle supplier chunein — us se liye hue items yahan aa jayenge.'}</div>`}
        <div class="list" style="margin-top:10px"><button class="row action" data-add>${ic('plus')}<span class="grow">Item add karein (list se)</span></button>${can.staff() ? `<button class="row action" data-new>${ic('cube')}<span class="grow">Naya product banayein</span></button>` : ''}</div>`;
    } else {
      const qk = quick();
      box.innerHTML = `<div class="list">${order.map(cardHTML).join('')}<button class="row action" data-add>${ic('plus')}<span class="grow">Add item</span></button></div>
        ${qk.length ? `<div class="chips">${qk.map(id => `<button class="chip" data-quick="${id}">+ ${esc(nice(product(id).name).replace(/\s*\(.*$/, ''))}</button>`).join('')}</div>` : ''}`;
    }
  };

  const draw = () => {
    const t = T();
    b.innerHTML = `<div class="bhead">
        <button class="bparty" data-party>${B.party ? avatar(B.party.name) : `<span class="avatar">${ic('people')}</span>`}<span class="grow"><span class="t">${B.party ? esc(nice(B.party.name)) : `<span class="tint">${pk === 'C' ? 'Customer' : 'Supplier'} chunein</span>`}</span>
          ${B.party ? `<span class="s">Balance <b class="num">${rs(B.party.balance)}</b>${B.party.city ? ' · ' + esc(nice(B.party.city)) : ''}</span>` : '<span class="s">Tap karein</span>'}</span>${chev}</button>
        <label class="bdate">${ic('calendar')}<span>Date</span><input type="date" data-date value="${B.date}"></label></div>
      <div class="sec-h">${sheetMode ? 'Is supplier ke items' : 'Items'}</div>
      <div data-items></div>
      <div class="sec-h">Summary</div>
      <div class="list bsum">
        <div class="row"><span class="grow l2" data-cnt></span></div>
        ${isSale ? `<div class="row" data-grow ${t.item > 0 ? '' : 'hidden'}><span class="grow">Amount at TP</span><span class="v num" data-gross>${rs2(t.gross)}</span></div>
        <div class="row" data-irow ${t.item > 0 ? '' : 'hidden'}><span class="grow">Item discount</span><span class="v num grn" data-item>−${rs2(t.item)}</span></div>` : ''}
        <div class="row"><span class="grow">Subtotal</span><span class="v num" data-sub>${rs2(t.sub)}</span></div>
        ${isSale ? `<div class="row"><label>Sab items par Disc %</label><input class="fld num" inputmode="decimal" data-alldp value="${val(B.allDp)}" placeholder="e.g. 3"></div>` : ''}
        <div class="row"><label>Bill discount</label><input class="fld num" inputmode="decimal" data-disc value="${esc(B.discTxt || '')}" placeholder="Rs ya % (500 / 2%)"></div>
        <div class="row" data-drow ${t.alld > 0 ? '' : 'hidden'}><span class="grow"><b>Total discount</b></span><b class="v num grn" data-alld></b></div>
        <div class="row"><span class="grow">Sales tax ${B.taxPct}%</span><input type="checkbox" class="toggle" data-tax ${B.tax ? 'checked' : ''}></div>
        <div class="row" data-trow ${B.tax ? '' : 'hidden'}><span class="grow">Tax amount</span><span class="v num" data-taxv>${rs2(t.tax)}</span></div>
        <div class="row"><label>Note</label><input class="fld" data-note value="${esc(B.note)}" placeholder="Optional"></div>
      </div>
      ${kind === 'sale' || kind === 'purchase' ? `<div class="sec-h">Payment</div><div class="list">
        <div class="row"><div class="seg" style="margin:0;flex:1" data-pay>${[['credit', kind === 'sale' ? 'Credit (udhaar)' : 'Credit'], ['cash', 'Cash'], ...(can.staff() ? [['bank', 'Bank']] : [])].map(([k, l]) => `<button data-p="${k}" class="${B.pay === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        ${B.pay !== 'credit' ? `<div class="row"><label>${kind === 'sale' ? 'Received' : 'Paid'}</label><input class="fld num" inputmode="decimal" data-paid value="${B.paid || t.total}"></div>` : ''}
        ${B.pay === 'bank' ? `<button class="row" data-acc><span class="grow">Account</span><span class="v">${esc(nice((S.boot.accounts.find(a => a.code === B.account) || {}).name || 'Choose'))}</span>${chev}</button>` : ''}
      </div>` : ''}
      <p class="sec-f" data-err style="color:var(--red)"></p>`;
    drawItems(); upd();
  };
  const upd = () => { const t = T(), set = (sel, v) => { const el = $(sel, b); if (el) el.textContent = v; }, show = (sel, on) => { const el = $(sel, b); if (el) el.hidden = !on; };
    $('[data-tt]', s.el).textContent = rs2(t.total);
    $('[data-tn]', s.el).textContent = t.n ? `${t.n} item · ${fq(t.q)}${t.fr ? ` + ${fq(t.fr)} free` : ''}` : 'Total';
    set('[data-cnt]', t.n ? `${t.n} items · qty ${fq(t.q)}${t.fr ? ` · free / sample ${fq(t.fr)}` : ''}` : 'Abhi koi item nahi');
    set('[data-sub]', rs2(t.sub)); set('[data-gross]', rs2(t.gross)); set('[data-item]', '−' + rs2(t.item)); set('[data-taxv]', rs2(t.tax));
    set('[data-alld]', rs2(t.alld) + (t.gross > 0 || t.sub > 0 ? ` · ${r2(t.alld / (isSale && t.gross > 0 ? t.gross : t.sub || 1) * 100)}%` : ''));
    show('[data-grow]', t.item > 0); show('[data-irow]', t.item > 0); show('[data-drow]', t.alld > 0); };
  const updRow = id => { const r = $(`[data-id="${id}"]`, b), l = L.get(id); if (!r || !l) return; const on = l.qty > 0 || l.free > 0, w = warn(l);
    if (r.classList.contains('srow')) r.classList.toggle('on', on); r.classList.toggle('bad', over(l) > 0);
    $('[data-amt]', r).textContent = r.classList.contains('srow') && !on ? '' : amtTxt(l);
    const o = $('[data-off]', r); if (o) o.innerHTML = offTxt(l);
    $('.sw', r).hidden = !w; $('[data-w]', r).textContent = w; };
  const addLine = (p, focus = true) => { lineOf(p); if (!order.includes(p.id)) { if (sheetMode) order.unshift(p.id); else order.push(p.id); } const l = L.get(p.id); if (!sheetMode && !(l.qty > 0)) l.qty = 1;
    drawItems(); upd(); if (focus) setTimeout(() => { const q = $(`[data-id="${p.id}"] [data-f="qty"]`, b); if (q) { q.focus(); q.select(); } }, 60); };
  const addProduct = async () => {
    const list = S.boot.products.filter(p => !(sheetMode && order.includes(p.id))).map(p => ({ ...p, search: p.name + ' ' + (p.aliases || '') + ' ' + p.category }));
    const r = await picker({ title: 'Add item', items: list, render: p => `<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${fq(p.stock)} ${esc(p.unit)} in stock${isSale && p.price > 0 ? ` · TP ${rs(p.price)}` : ''}</span></span><span class="v num">${rs(rateOf(p))}${rates[p.id] ? `<br><small class="l2">last rate${isSale && p.price > rates[p.id] ? ` · ${r2((p.price - rates[p.id]) / p.price * 100)}% off` : ''}</small>` : ''}</span>`,
      addLabel: can.staff() ? 'New product' : null, onAdd: async x => { const np = await productForm(null, x); return np ? product(np.id) : null; } });
    if (r) addLine(product(r.id) || r);
  };

  b.oninput = e => {
    const t = e.target, f = t.dataset.f;
    if (f) { const row = t.closest('[data-id]'), id = +row.dataset.id, p = product(id), l = lineOf(p), v = Math.max(+t.value || 0, 0);
      if (f === 'qty') l.qty = v; else if (f === 'free') l.free = v;
      else if (f === 'rate') { l.rate = v; const dp = $('[data-f="dp"]', row); if (dp) dp.value = val(pc1(l)); }
      else if (f === 'dp') { if (l.tp > 0) { l.rate = r2(l.tp * (1 - Math.min(v, 100) / 100)); $('[data-f="rate"]', row).value = val(l.rate); } }
      updRow(id); return upd(); }
    if (t.dataset.alldp !== undefined) { B.allDp = Math.min(Math.max(+t.value || 0, 0), 100);
      for (const l of L.values()) if (l.tp > 0) { l.rate = r2(l.tp * (1 - B.allDp / 100)); const r = $(`[data-id="${l.p}"]`, b); if (r) { $('[data-f="rate"]', r).value = val(l.rate); const dp = $('[data-f="dp"]', r); if (dp) dp.value = val(B.allDp); updRow(l.p); } }
      return upd(); }
    if (t.dataset.disc !== undefined) { B.discTxt = t.value; return upd(); }
    if (t.dataset.paid !== undefined) B.paid = +t.value || 0;
    else if (t.dataset.note !== undefined) B.note = t.value;
    else if (t.dataset.date !== undefined) B.date = t.value;
  };
  b.onfocusin = e => { if (e.target.dataset.f) e.target.select?.(); };
  b.onchange = e => { if (e.target.dataset.tax !== undefined) { B.tax = e.target.checked; $('[data-trow]', b).hidden = !B.tax; upd(); } };
  b.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.party !== undefined) {
      const list = S.boot.parties.filter(p => p.kind === pk).map(p => ({ ...p, search: p.name + ' ' + p.city + ' ' + p.phone }));
      const r = await picker({ title: pk === 'C' ? 'Customer' : 'Supplier', items: list, render: p => `${avatar(p.name)}<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${esc(nice(p.city) || p.phone || '')}</span></span><span class="v num">${rs(p.balance)}</span>`,
        addLabel: `New ${pk === 'C' ? 'customer' : 'supplier'}`, onAdd: async x => partyForm(pk, null, x) });
      if (r) { B.party = party(r.id) || r; await loadRates(); for (const l of L.values()) { const p = product(l.p); if (p && rates[p.id] && !(l.qty > 0)) l.rate = rates[p.id]; } supplierList(); draw(); }
    }
    if (t.dataset.add !== undefined) addProduct();
    if (t.dataset.new !== undefined) { const np = await productForm(null, ''); const p = np && product(np.id); if (p) addLine(p); }
    if (t.dataset.quick) addLine(product(t.dataset.quick));
    if (t.dataset.dq) { const [id, dd] = t.dataset.dq.split(':'); const l = L.get(+id); l.qty = Math.max(0, r2(l.qty + +dd)); $(`[data-id="${id}"] [data-f="qty"]`, b).value = l.qty; updRow(+id); upd(); }
    if (t.dataset.rm) { const id = +t.dataset.rm; L.delete(id); order = order.filter(x => x !== id); drawItems(); upd(); }
    if (t.dataset.fix) { const id = +t.dataset.fix; stockAdjustForm(product(id), () => { const r = $(`[data-id="${id}"]`, b); if (r) r.outerHTML = sheetMode ? rowHTML(id) : cardHTML(id); upd(); }); }
    if (t.dataset.p) { B.pay = t.dataset.p; B.paid = 0; if (B.pay === 'bank') B.account = (cashAccounts().find(a => a.code !== '1000') || { code: '1000' }).code; else B.account = '1000'; draw(); }
    if (t.dataset.acc !== undefined) { const r = await picker({ title: 'Account', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { B.account = r.code; draw(); } }
  };
  $('[data-save]', s.el).onclick = async e => {
    const btn = e.currentTarget;   // read now: it is gone after the confirm box below
    const err = m => { $('[data-err]', b).textContent = m; hud(m, 'err'); };
    if (!B.party) return err(`${pk === 'C' ? 'Customer' : 'Supplier'} chunein.`);
    const F = filled();
    if (!F.length) return err('Kam az kam ek item ki qty likhein.');
    const noRate = F.find(l => l.qty > 0 && !(l.rate > 0));
    if (noRate) return err(`${nice(product(noRate.p)?.name)} ka rate likhein. Muft maal "Free / sample" mein likhein.`);
    const big = F.filter(l => over(l) > 0);
    if (big.length && !(await confirmBox(`${big.length} item stock se zyada hain (${big.slice(0, 3).map(l => nice(product(l.p)?.name)).join(', ')}${big.length > 3 ? '…' : ''}). Stock minus mein chala jayega. Phir bhi save karein?`, 'Haan, save karein'))) return;
    const t = T(); btn.disabled = true; btn.innerHTML = '<span class="spin" style="border-top-color:#fff"></span>';
    const lines = F.flatMap(l => [...(l.qty > 0 ? [{ product_id: l.p, qty: l.qty, rate: l.rate, tp: isSale ? l.tp : undefined }] : []), ...(l.free > 0 ? [{ product_id: l.p, qty: l.free, rate: 0, tp: 0 }] : [])]);
    try {
      const r = await api(ed ? `/api/invoices/${ed.id}` : '/api/invoices', { method: ed ? 'PUT' : 'POST', body: { ref_no: pre?.ret?.no || ed?.ref_no || '', kind, party_id: B.party.id, date: B.date, lines, discount: B.discount, tax_pct: B.tax ? B.taxPct : 0, paid: t.paid, pay_account: B.account, note: B.note } });
      s.close(); afterSubmit(r, x => { if (x) go(`bill/${x.id}${kind === 'sale' ? '?share' : ''}`); });
    } catch (x) { fail(x); btn.disabled = false; btn.textContent = ed ? 'Update' : 'Save'; }
  };
  draw();
  if (!B.party) setTimeout(() => $('[data-party]', b)?.click(), 400);
}

/* =============================== PARTIES =============================== */
let partyKind = 'C';
route(/^parties(?:\/(C|V))?$/, async (v, k) => {
  if (k) partyKind = k; if (!can.staff()) partyKind = 'C';
  const body = page(v, { title: can.staff() ? 'Parties' : 'Customers', right: `<button class="nbtn" data-new aria-label="Add">${ic('plus')}</button>` });
  $('[data-new]', v).onclick = async () => { const r = await partyForm(partyKind); if (r) render(); };
  body.innerHTML = `${can.staff() ? `<div class="seg">${[['C', 'Customers'], ['V', 'Suppliers']].map(([x, l]) => `<button data-x="${x}" class="${partyKind === x ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="search">${ic('search')}<input placeholder="Search" data-q autocomplete="off"></div><div data-sum></div><div data-l></div>`;
  const draw = () => {
    const q = $('[data-q]', body).value.trim().toLowerCase();
    const all = S.boot.parties.filter(p => p.kind === partyKind);
    const list = all.filter(p => !q || (p.name + ' ' + p.city + ' ' + p.phone).toLowerCase().includes(q)).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    const tot = all.reduce((a, p) => a + p.balance, 0);
    $('[data-sum]', body).innerHTML = `<p class="sec-f" style="margin:-6px 4px 10px">${all.length} ${partyKind === 'C' ? 'customers' : 'suppliers'} · total ${partyKind === 'C' ? 'to collect' : 'to pay'} <b class="num" style="color:var(--label)">${rs(tot)}</b></p>`;
    $('[data-l]', body).innerHTML = list.length ? `<div class="list">${list.map(p => `<button class="row with-avatar" data-go="party/${p.id}">${avatar(p.name)}<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${esc(nice(p.city) || p.phone || ' ')}</span></span><span class="v num ${p.balance > 0.5 ? (partyKind === 'C' ? 'red' : 'orange') : ''}">${Math.abs(p.balance) > 0.5 ? rs(p.balance) : 'Clear'}</span>${chev}</button>`).join('')}</div>` : `<div class="empty">${ic('people')}<div>Nobody here yet</div></div>`;
  };
  $('[data-q]', body).oninput = draw;
  body.onclick = e => { const b = e.target.closest('[data-x],[data-go]'); if (!b) return; if (b.dataset.x) { partyKind = b.dataset.x; $$('[data-x]', body).forEach(x => x.classList.toggle('on', x === b)); draw(); } else go(b.dataset.go); };
  draw();
});

route(/^party\/(\d+)$/, async (v, id) => {
  let from = fyFrom(), to = today();
  const p0 = party(id);
  const body = page(v, { title: p0 ? nice(p0.name) : 'Account', back: 'parties', backLabel: p0?.kind === 'V' ? 'Suppliers' : 'Customers', right: `<button class="nbtn" data-edit>Edit</button>` });
  const load = async () => {
    const d = await api(`/api/parties/${id}/ledger?from=${from}&to=${to}`);
    const p = d.party, cust = p.kind === 'C', ph = waPhone(p.phone);
    body.innerHTML = `<div class="card" style="text-align:center;padding:20px 16px">
        <div class="avatar" style="width:64px;height:64px;font-size:24px;margin:0 auto 10px">${esc(initials(p.name))}</div>
        <div class="l2" style="font-size:15px">${esc([nice(p.city), p.phone].filter(Boolean).join(' · ') || (cust ? 'Customer' : 'Supplier'))}</div>
        <div style="font-size:32px;font-weight:700;margin-top:10px" class="num ${d.closing > 0.5 ? (cust ? 'red' : 'orange') : ''}">${rs(d.closing)}</div>
        <div class="l2" style="font-size:13px">${cust ? (d.closing >= 0 ? 'owes you' : 'advance from customer') : (d.closing >= 0 ? 'you owe' : 'advance paid')}</div>
        <div class="btns" style="grid-template-columns:repeat(4,1fr);margin-top:16px;gap:8px">
          <button class="btn gray small" style="width:100%;flex-direction:column;height:56px;gap:2px;font-size:12px" data-a="bill">${ic('receipt')}Bill</button>
          <button class="btn gray small" style="width:100%;flex-direction:column;height:56px;gap:2px;font-size:12px" data-a="money">${ic(cust ? 'down' : 'up')}${cust ? 'Receive' : 'Pay'}</button>
          <button class="btn gray small" style="width:100%;flex-direction:column;height:56px;gap:2px;font-size:12px" data-a="call" ${p.phone ? '' : 'disabled'}>${ic('phone')}Call</button>
          <button class="btn gray small" style="width:100%;flex-direction:column;height:56px;gap:2px;font-size:12px" data-a="wa" ${ph ? '' : 'disabled'}>${ic('chat')}WhatsApp</button></div></div>
      <div class="sec-h">Statement</div>
      <div class="list"><div class="row"><label>From</label><input class="fld" type="date" data-from value="${from}"></div><div class="row"><label>To</label><input class="fld" type="date" data-to value="${to}"></div>
        <button class="row action" data-a="view">${ic('pdf')}<span class="grow">Statement dekhein (PDF / Image)</span></button>
        <button class="row action" data-a="stmt">${ic('share')}<span class="grow">Statement bhejein</span></button>
        <button class="row" data-go="register?party=${p.id}&kind=all">${ic('list')}<span class="grow">Sab bills (table)</span>${chev}</button>
        <button class="row" data-go="moneyreg?party=${p.id}&kind=all">${ic('wallet')}<span class="grow">Sab payments (table)</span>${chev}</button>
        ${cust ? `<button class="row" data-go="itemsales?party=${p.id}">${ic('cube')}<span class="grow">Is customer ne kya kya liya</span>${chev}</button>` : ''}</div>
      <div class="sec-h">Ledger<button data-a="csv">Excel</button></div>
      ${ledgerTable({ ...d, from, to }, { flip: !cust })}`;
    body.dataset.d = '1'; body._d = d;
  };
  body.onchange = e => { if (e.target.dataset.from !== undefined) from = e.target.value; if (e.target.dataset.to !== undefined) to = e.target.value; load().catch(fail); };
  body.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = body._d, p = d.party;
    if (b.dataset.go) return go(b.dataset.go);
    const a = b.dataset.a;
    if (a === 'bill') newBill(p.kind === 'C' ? 'sale' : 'purchase', p.id);
    if (a === 'money') (p.kind === 'C' ? receiveMoney(p.id) : payMoney(p.id));
    if (a === 'call') open('tel:' + p.phone.replace(/[^\d+]/g, ''));
    if (a === 'wa') open(`https://wa.me/${waPhone(p.phone)}?text=${encodeURIComponent(`Assalam-o-Alaikum ${nice(p.name)},\nAap ka balance ${rs(d.closing)} hai (${fd(d.to)}).\n\n${S.boot.company.name}`)}`, '_blank');
    if (a === 'view') viewDoc(statementHTML(d), { name: `Statement-${nice(p.name).replace(/\W+/g, '-')}`, phone: p.phone, title: nice(p.name), text: `${nice(p.name)}: balance ${rs(d.closing)} on ${fd(d.to)}. ${S.boot.company.name}` });
    if (a === 'csv') ledgerCSV(`Ledger-${nice(p.name).replace(/\W+/g, '-')}`, { ...d, from, to }, p.kind !== 'C');
    if (a === 'stmt') shareDoc(statementHTML(d), { name: `Statement-${nice(p.name).replace(/\W+/g, '-')}`, phone: p.phone, text: `${nice(p.name)}: balance ${rs(d.closing)} on ${fd(d.to)}. ${S.boot.company.name}` });
  };
  $('[data-edit]', v).onclick = async () => { const r = await partyForm(body._d.party.kind, body._d.party); if (r) load(); };
  await load();
});
const entryLabel = (l, cust) => {
  const t = l.type || '';
  if (/Sale Entry/.test(t)) return 'Sale bill'; if (/Purchase Entry/.test(t)) return 'Purchase bill';
  if (/Receipt/.test(t)) return cust ? 'Payment received' : 'Received'; if (/Payment/.test(t)) return cust ? 'Paid to customer' : 'Payment made';
  if (/Return/.test(t)) return 'Return'; return nice(String(l.memo || t).slice(0, 60));
};

export async function partyForm(kind, p = null, name = '') {
  return new Promise(resolve => {
    let saved = null;
    const s = sheet({ title: p ? 'Edit' : kind === 'V' ? 'New Supplier' : 'New Customer', right: 'Save', body: `<div class="list">
      <div class="row"><label>Name</label><input class="fld" data-f="name" value="${esc(p ? p.name : name)}" placeholder="Shop / person name"></div>
      <div class="row"><label>Mobile</label><input class="fld" data-f="phone" inputmode="tel" value="${esc(p?.phone || '')}" placeholder="03xx-xxxxxxx"></div>
      <div class="row"><label>City / area</label><input class="fld" data-f="city" value="${esc(p?.city || '')}"></div>
      <div class="row"><label>Address</label><input class="fld" data-f="address" value="${esc(p?.address || '')}"></div>
      <div class="row"><label>NTN / CNIC</label><input class="fld" data-f="ntn" value="${esc(p?.ntn || '')}"></div>
      ${!p && can.staff() ? `<div class="row"><label>Opening balance</label><input class="fld num" inputmode="decimal" data-f="opening" placeholder="${kind === 'V' ? 'Hum ne dena hai' : 'Is ne dena hai'} (Rs)"></div>` : ''}
      ${can.staff() && kind === 'C' ? `<div class="row"><label>Credit limit</label><input class="fld num" inputmode="decimal" data-f="credit_limit" value="${p?.credit_limit || ''}" placeholder="0 = no limit"></div>` : ''}</div>
      <p class="sec-f">Mobile number lets you send bills and reminders on WhatsApp.</p>`,
      onRight: async sh => {
        const body = { kind }; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.value; });
        try { saved = await api(p ? `/api/parties/${p.id}` : '/api/parties', { method: p ? 'PUT' : 'POST', body }); await reloadBoot(); sh.close(); if (saved.opening?.pending) afterSubmit(saved.opening); else hud('Saved'); } catch (e) { fail(e); }
      }, onClose: () => resolve(saved) });
    setTimeout(() => $('[data-f="name"]', s.el).focus(), 350);
  });
}

/* =============================== MONEY =============================== */
export function receiveMoney(partyId = null, amount = '') { moneyForm('receive', partyId, amount); }
export function payMoney(partyId = null) { moneyForm('pay', partyId, ''); }
function moneyForm(mode, partyId, amount) {
  const pk = mode === 'receive' ? 'C' : 'V';
  let P = partyId ? party(partyId) : null, acc = '1000';
  const s = sheet({ title: mode === 'receive' ? 'Receive Payment' : 'Make Payment', right: 'Save', body: `<div class="list">
      <button class="row" data-party><span class="grow" data-pn></span>${chev}</button>
      <div class="row"><label>Amount</label><input class="fld num" inputmode="decimal" data-amt value="${amount || ''}" placeholder="0" style="font-size:22px;font-weight:600"></div>
      ${can.staff() ? `<button class="row" data-acc><span class="grow">${mode === 'receive' ? 'Received in' : 'Paid from'}</span><span class="v" data-an></span>${chev}</button>` : ''}
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-note placeholder="Optional"></div></div>`,
    onRight: async sh => {
      const amt = +$('[data-amt]', sh.el).value;
      if (!P) return hud(`Choose a ${pk === 'C' ? 'customer' : 'supplier'}`, 'err');
      if (!(amt > 0)) return hud('Enter the amount', 'err');
      sh.setRight('Saving…', true);
      try { const r = await api(mode === 'receive' ? '/api/receipts' : '/api/payments', { body: { party_id: P.id, amount: amt, account: acc, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) render(); }); } catch (e) { sh.setRight('Save'); fail(e); }
    } });
  const drawP = () => { $('[data-pn]', s.el).innerHTML = P ? `<span class="t">${esc(nice(P.name))}</span><span class="s">Balance ${rs(P.balance)}</span>` : `<span class="tint">Choose ${pk === 'C' ? 'customer' : 'supplier'}</span>`; const an = $('[data-an]', s.el); if (an) an.textContent = nice((S.boot.accounts.find(a => a.code === acc) || {}).name || ''); };
  drawP();
  $('[data-party]', s.el).onclick = async () => { const r = await picker({ title: pk === 'C' ? 'Customer' : 'Supplier', items: S.boot.parties.filter(p => p.kind === pk).map(p => ({ ...p, search: p.name + ' ' + p.city })), render: p => `${avatar(p.name)}<span class="grow"><span class="t">${esc(nice(p.name))}</span></span><span class="v num">${rs(p.balance)}</span>` }); if (r) { P = r; drawP(); } };
  const ab = $('[data-acc]', s.el); if (ab) ab.onclick = async () => { const r = await picker({ title: 'Account', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { acc = r.code; drawP(); } };
  setTimeout(() => (P ? $('[data-amt]', s.el).focus() : $('[data-party]', s.el).click()), 380);
}

export function expenseForm(pre = null) {
  let acc = pre ? S.boot.accounts.find(a => a.code === pre) || null : null, from = '1000';
  const s = sheet({ title: 'Expense', right: 'Save', body: `<div class="list">
      <button class="row" data-acc><span class="grow" data-an><span class="tint">Choose expense type</span></span>${chev}</button>
      <div class="row"><label>Amount</label><input class="fld num" inputmode="decimal" data-amt placeholder="0" style="font-size:22px;font-weight:600"></div>
      <button class="row" data-from><span class="grow">Paid from</span><span class="v" data-fn>${esc(nice((S.boot.accounts.find(a => a.code === '1000') || {}).name || 'Cash'))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-note placeholder="e.g. petrol for van"></div></div>`,
    onRight: async sh => {
      const amt = +$('[data-amt]', sh.el).value;
      if (!acc) return hud('Choose expense type', 'err'); if (!(amt > 0)) return hud('Enter the amount', 'err');
      sh.setRight('Saving…', true);
      try { const r = await api('/api/expenses', { body: { account: acc.code, amount: amt, pay_account: from, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) render(); }); } catch (e) { sh.setRight('Save'); fail(e); }
    } });
  $('[data-acc]', s.el).onclick = async () => { const r = await picker({ title: 'Expense type', items: S.boot.accounts.filter(a => a.type === 'D' && a.grp !== 'Cost of Sales' && a.code !== '5000').map(a => ({ ...a, search: a.name + ' ' + a.grp })), render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(nice(a.grp))}</span></span>` }); if (r) { acc = r; $('[data-an]', s.el).textContent = nice(r.name); } };
  $('[data-from]', s.el).onclick = async () => { const r = await picker({ title: 'Paid from', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { from = r.code; $('[data-fn]', s.el).textContent = nice(r.name); } };
}

export function voucherForm() {
  const L = [{ account: null, party: null, debit: '', credit: '' }, { account: null, party: null, debit: '', credit: '' }];
  const s = sheet({ title: 'Journal Voucher', right: 'Save', full: true, body: '<div data-b></div>',
    onRight: async sh => {
      const lines = L.filter(l => l.account && (+l.debit || +l.credit)).map(l => ({ account: l.account.code, party_id: l.party?.id || null, debit: +l.debit || 0, credit: +l.credit || 0 }));
      sh.setRight('Saving…', true);
      try { const r = await api('/api/vouchers', { body: { date: $('[data-date]', sh.el).value, memo: $('[data-memo]', sh.el).value, lines } }); sh.close(); afterSubmit(r); } catch (e) { sh.setRight('Save'); fail(e); }
    } });
  const b = $('[data-b]', s.el);
  const draw = () => {
    const d = r2(L.reduce((a, l) => a + (+l.debit || 0), 0)), c = r2(L.reduce((a, l) => a + (+l.credit || 0), 0));
    b.innerHTML = `<div class="list"><div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div><div class="row"><label>Narration</label><input class="fld" data-memo placeholder="What is this entry for?"></div></div>
      ${L.map((l, k) => `<div class="sec-h">Line ${k + 1}${L.length > 2 ? `<button data-rm="${k}">Remove</button>` : ''}</div><div class="list">
        <button class="row" data-acc="${k}"><span class="grow">${l.account ? `${esc(l.account.code)} · ${esc(nice(l.account.name))}` : '<span class="tint">Choose account</span>'}</span>${chev}</button>
        ${l.account && (l.account.code === '1200' || l.account.code === '2000') ? `<button class="row" data-pty="${k}"><span class="grow">${l.party ? esc(nice(l.party.name)) : '<span class="tint">Choose party</span>'}</span>${chev}</button>` : ''}
        <div class="row"><label>Debit</label><input class="fld num" inputmode="decimal" data-dr="${k}" value="${l.debit}" placeholder="0"></div>
        <div class="row"><label>Credit</label><input class="fld num" inputmode="decimal" data-cr="${k}" value="${l.credit}" placeholder="0"></div></div>`).join('')}
      <div class="list" style="margin-top:14px"><button class="row action" data-addl>${ic('plus')}<span class="grow">Add line</span></button></div>
      <p class="sec-f">Debit ${rs2(d)} · Credit ${rs2(c)} ${d === c && d > 0 ? '<span class="green">· Balanced</span>' : '<span class="red">· Must be equal</span>'}</p>`;
  };
  b.oninput = e => { const t = e.target; if (t.dataset.dr !== undefined) L[+t.dataset.dr].debit = t.value; if (t.dataset.cr !== undefined) L[+t.dataset.cr].credit = t.value; const d = r2(L.reduce((a, l) => a + (+l.debit || 0), 0)), c = r2(L.reduce((a, l) => a + (+l.credit || 0), 0)); $$('.sec-f', b).at(-1).innerHTML = `Debit ${rs2(d)} · Credit ${rs2(c)} ${d === c && d > 0 ? '<span class="green">· Balanced</span>' : '<span class="red">· Must be equal</span>'}`; };
  b.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.acc) { const r = await picker({ title: 'Account', items: S.boot.accounts.map(a => ({ ...a, search: a.code + ' ' + a.name + ' ' + a.grp })), render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(a.code)} · ${esc(nice(a.grp))}</span></span>` }); if (r) { L[+t.dataset.acc].account = r; draw(); } }
    if (t.dataset.pty) { const k = +t.dataset.pty, kind = L[k].account.code === '1200' ? 'C' : 'V'; const r = await picker({ title: 'Party', items: S.boot.parties.filter(p => p.kind === kind).map(p => ({ ...p, search: p.name })), render: p => `<span class="grow">${esc(nice(p.name))}</span>` }); if (r) { L[k].party = r; draw(); } }
    if (t.dataset.addl !== undefined) { L.push({ account: null, party: null, debit: '', credit: '' }); draw(); }
    if (t.dataset.rm) { L.splice(+t.dataset.rm, 1); draw(); }
  };
  draw();
}

/* =============================== PRODUCTS =============================== */
route(/^products$/, async v => {
  const body = page(v, { title: 'Stock', back: 'more', backLabel: 'More', right: can.staff() ? `<button class="nbtn" data-new aria-label="Add">${ic('plus')}</button>` : '' });
  if (can.staff()) $('[data-new]', v).onclick = async () => { if (await productForm()) render(); };
  const over = S.boot.products.filter(p => p.stock < 0).length;
  body.innerHTML = `<button class="banner tbl" data-go="stock">${ic('list')}<span class="grow"><b>Stock report</b><small>Kitna aaya, kitna bika, kitna bacha${over ? ` · <span class="red">${over} oversold</span>` : ''}</small></span>${chev}</button>
    <div class="search">${ic('search')}<input placeholder="Search products" data-q autocomplete="off"></div><div data-sum></div><div data-l></div>`;
  const draw = () => {
    const q = $('[data-q]', body).value.trim().toLowerCase();
    const list = S.boot.products.filter(p => !q || (p.name + ' ' + p.category + ' ' + p.aliases).toLowerCase().includes(q));
    if (can.staff()) $('[data-sum]', body).innerHTML = `<p class="sec-f" style="margin:-6px 4px 10px">${S.boot.products.length} products · stock value at cost <b class="num" style="color:var(--label)">${rs(S.boot.products.reduce((a, p) => a + Math.max(p.stock, 0) * (p.cost || 0), 0))}</b></p>`;
    $('[data-l]', body).innerHTML = `<div class="list">${list.map(p => `<button class="row" data-p="${p.id}"><span class="grow"><span class="t">${esc(nice(p.name))}${p.stock < 0 ? ' <span class="badge red">Oversold</span>' : p.reorder > 0 && p.stock <= p.reorder ? ' <span class="badge orange">Kam</span>' : ''}</span><span class="s">${esc(nice(p.category) || '')}${can.staff() ? ` · cost ${rs(p.cost)}` : ''} · price ${p.price > 0 ? rs(p.price) : '<span class="orange">not set</span>'}</span></span><span class="v num ${p.stock < 0 ? 'red' : p.reorder > 0 && p.stock <= p.reorder ? 'orange' : ''}"><b>${fq(p.stock)}</b> ${esc(p.unit)}</span>${can.staff() ? chev : ''}</button>`).join('')}</div>`;
  };
  $('[data-q]', body).oninput = draw;
  body.onclick = e => { const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go); const b = e.target.closest('[data-p]'); if (b) go(`product/${b.dataset.p}`); };
  draw();
});

export function productForm(p = null, name = '') {
  return new Promise(resolve => {
    let saved = null;
    const s = sheet({ title: p ? 'Product' : 'New Product', right: 'Save', body: `<div class="list">
        <div class="row"><label>Name</label><input class="fld" data-f="name" value="${esc(p ? p.name : name)}"></div>
        <div class="row"><label>Category</label><input class="fld" data-f="category" value="${esc(p?.category || '')}" placeholder="Butter, Cheese…"></div>
        <div class="row"><label>Unit</label><input class="fld" data-f="unit" value="${esc(p?.unit || 'kg')}" placeholder="kg, pc, ctn"></div>
        <div class="row"><label>Sale price</label><input class="fld num" inputmode="decimal" data-f="price" value="${p?.price || ''}"></div>
        <div class="row"><label>Cost price</label><input class="fld num" inputmode="decimal" data-f="cost" value="${p?.cost || ''}"></div>
        <div class="row"><label>Reorder at</label><input class="fld num" inputmode="decimal" data-f="reorder" value="${p?.reorder || ''}" placeholder="0"></div>
        <div class="row"><label>Voice names</label><input class="fld" data-f="aliases" value="${esc(p?.aliases || '')}" placeholder="e.g. ghee, desi ghee"></div></div>
      <p class="sec-f">“Voice names” are other words people say for this product, separated by commas. They help voice entry find it.</p>
      ${p ? `<div class="sec-h">Stock</div><div class="list"><div class="row"><span class="grow">In stock</span><span class="v num">${fq(p.stock)} ${esc(p.unit)}</span></div><button class="row action" data-adj>${ic('pencil')}<span class="grow">Adjust stock (count / damage)</span></button></div>` : ''}`,
      onRight: async sh => {
        const body = {}; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.value; });
        try { saved = await api(p ? `/api/products/${p.id}` : '/api/products', { method: p ? 'PUT' : 'POST', body }); await reloadBoot(); hud('Saved'); sh.close(); } catch (e) { fail(e); }
      }, onClose: () => resolve(saved) });
    const adj = $('[data-adj]', s.el);
    if (adj) adj.onclick = () => stockAdjustForm(p, () => { s.close(); render(); });
  });
}

export function stockAdjustForm(p, done) {
  let mode = 'count';
  const sh = sheet({ title: 'Stock adjust', right: 'Save', body: `<p class="sec-f" style="margin-top:0"><b>${esc(nice(p.name))}</b> · abhi system mein <b>${fq(p.stock)} ${esc(p.unit)}</b></p>
    <div class="seg" data-m><button data-k="count" class="on">Ginti ke baad (asal stock)</button><button data-k="add">Kam / zyada karein</button></div>
    <div class="list"><div class="row"><label data-ql>Asal stock</label><input class="fld num" inputmode="decimal" data-q placeholder="${fq(Math.max(p.stock, 0))}" style="font-size:22px;font-weight:600"></div>
      <div class="row"><label>Wajah</label><select class="fld" data-r><option>Stock count</option><option>Damage / kharab</option><option>Expiry</option><option>Sample / free</option><option>Opening stock</option><option>Other</option></select></div></div>
    <p class="sec-f" data-h>Godown mein jitna maal gin kar mila, woh likhein. Farq khud adjust ho jayega.</p>`,
    onRight: async x => {
      const v = +$('[data-q]', x.el).value; if (!$('[data-q]', x.el).value.trim()) return hud('Qty likhein', 'err');
      const dq = mode === 'count' ? r2(v - p.stock) : v; if (!dq) return hud('Koi farq nahi', 'info');
      try { await api(`/api/products/${p.id}/adjust`, { body: { qty: dq, reason: $('[data-r]', x.el).value } }); await reloadBoot(); hud(`Stock ${dq > 0 ? '+' : ''}${fq(dq)} adjust ho gaya`); x.close(); done && done(); } catch (e) { fail(e); }
    } });
  sh.el.addEventListener('click', e => { const m = e.target.closest('[data-k]'); if (!m) return; mode = m.dataset.k; $$('[data-k]', sh.el).forEach(b => b.classList.toggle('on', b === m));
    $('[data-ql]', sh.el).textContent = mode === 'count' ? 'Asal stock' : 'Farq (+ / −)'; $('[data-h]', sh.el).textContent = mode === 'count' ? 'Godown mein jitna maal gin kar mila, woh likhein. Farq khud adjust ho jayega.' : 'Plus se barhayein (5), minus se kam karein (-2 kharab maal).'; });
}

/* =============================== MORE =============================== */
route(/^more$/, async v => {
  const staff = can.staff(), admin = can.admin(), boss = can.boss();
  const row = (icon, color, label, act) => `<button class="row with-icon" data-act="${act}"><span class="ico" style="background:${color}">${ic(icon)}</span><span class="grow">${label}</span>${chev}</button>`;
  const body = page(v, { title: 'More' });
  body.innerHTML = `<div class="list"><div class="row with-avatar">${avatar(S.user.name)}<span class="grow"><span class="t">${esc(S.user.name)}</span><span class="s">${esc(S.user.username)} · ${esc(ROLE_LABEL[S.user.role] || S.user.role)}</span></span></div></div>
    <div class="sec-h">Rozana ka kaam</div><div class="list">
      ${row('receipt', 'var(--tint)', 'Sales invoice', 'sale')}
      ${staff ? row('cart', 'var(--indigo)', 'Purchase invoice', 'purchase') : ''}
      ${row('down', 'var(--green)', 'Receive payment (recovery)', 'receive')}
      ${staff ? row('up', 'var(--orange)', 'Pay supplier', 'pay') + row('wallet', 'var(--red)', 'Expense', 'expense') : ''}
      ${staff ? row('return', 'var(--purple)', 'Sales return', 'sale_return') + row('return', 'var(--pink)', 'Purchase return', 'purchase_return') : ''}
      ${row('mic', 'var(--red)', 'Voice entry', 'voice')}
      ${staff ? row('book', 'var(--teal)', 'Cash book (aaj ka hisaab)', 'cashbook') : ''}</div>
    <div class="sec-h">Approvals & messages</div><div class="list">
      ${boss ? row('checkc', 'var(--orange)', `Approvals <span class="badge orange" data-apcount ${notice.pending ? '' : 'hidden'}>${notice.pending}</span>`, 'approvals') : ''}
      ${can.owner() ? '' : row('clock', 'var(--indigo)', 'Meri requests (approval)', 'myrequests')}
      ${row('bell', 'var(--red)', 'Notifications', 'notices')}</div>
    <div class="sec-h">Khata (ledgers)</div><div class="list">
      ${row('people', 'var(--tint)', 'Customers ka khata', 'ledgers/C')}
      ${row('bell', '#25b35e', 'Recovery list & reminders', 'recovery')}
      ${staff ? row('people', 'var(--indigo)', 'Suppliers ka khata', 'ledgers/V') + row('clock', 'var(--orange)', 'Payables (suppliers ko dena)', 'payables')
        + row('wallet', 'var(--red)', 'Kharche — head wise', 'ledgers/expense') + row('person', 'var(--purple)', 'Staff ledgers (salary / kharcha)', 'ledgers/staff')
        + row('tag', 'var(--pink)', 'Commission ledgers', 'ledgers/commission') + row('bank', 'var(--teal)', 'Cash & bank', 'ledgers/cash') + row('book', '#8e8e93', 'Partners (capital / drawings)', 'ledgers/partners') : ''}</div>
    <div class="sec-h">Stock</div><div class="list">
      ${row('cube', 'var(--teal)', 'Stock & products', 'products')}
      ${row('list', 'var(--purple)', 'Stock report (aaya · bika · bacha)', 'stock')}</div>
    <div class="sec-h">Registers & reports</div><div class="list">
      ${row('list', 'var(--tint)', 'Invoices register', 'register')}
      ${staff ? row('wallet', 'var(--green)', 'Payments register', 'moneyreg') : row('wallet', 'var(--green)', 'Meri wasooli (register)', 'moneyreg')}
      ${row('clock', 'var(--orange)', 'Outstanding (ageing)', 'aging')}
      ${row('cube', 'var(--teal)', 'Item-wise sales', 'itemsales')}
      ${row('people', 'var(--orange)', 'Customer summary', 'partysum')}
      ${staff ? row('people', 'var(--indigo)', 'Supplier summary', 'partysum/V') + row('chart', 'var(--green)', 'Sab reports', 'reports') : ''}</div>
    ${staff ? `<div class="sec-h">Accounting</div><div class="list">
      ${row('chart', 'var(--green)', 'Profit & Loss', 'report/pl')}
      ${row('book', 'var(--indigo)', 'Balance sheet', 'report/bs')}
      ${row('arrowup', 'var(--purple)', 'What moved this month', 'report/insights')}
      ${row('bank', 'var(--teal)', 'Cash flow', 'report/cashflow')}
      ${row('receipt', 'var(--pink)', 'Sales tax & FBR', 'report/tax')}
      ${row('book', 'var(--indigo)', 'Journal voucher', 'voucher')}
      ${row('list', '#8e8e93', 'Chart of accounts', 'accounts')}</div>` : ''}
    ${boss ? `<div class="sec-h">${can.owner() ? 'Owner' : 'Admin'}</div><div class="list">
      ${row('people', 'var(--tint)', 'Team & roles', 'users')}
      ${row('gear', '#8e8e93', 'Company, invoice & approval settings', 'settings')}
      ${row('lock', 'var(--red)', `Close books${S.boot.company.lock_date ? ' · up to ' + fd(S.boot.company.lock_date) : ''}`, 'closebooks')}
      ${row('clock', 'var(--orange)', 'Activity log', 'audit')}
      ${admin ? row('tray', 'var(--teal)', 'Download full backup', 'backup') + row('drop', 'var(--indigo)', 'Import old software data', 'import') : ''}</div>` : ''}
    <div class="sec-h">App</div><div class="list">
      ${row('sun', '#8e8e93', 'Appearance', 'theme')}
      ${row('lock', '#8e8e93', 'Change password', 'password')}
      <button class="row danger" data-act="logout">Sign out</button></div>
    <p class="sec-f" style="text-align:center;margin-top:20px">${esc(S.boot.company.name)} · version 1.3</p>`;
  body.onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'voice') openVoice();
    if (a === 'sale') newBill('sale');
    if (a === 'purchase') newBill('purchase');
    if (a === 'receive') receiveMoney();
    if (a === 'pay') payMoney();
    if (a === 'expense') expenseForm();
    if (a === 'voucher') voucherForm();
    if (a === 'return') { const k = await actionSheet('Return', [{ label: 'Sales return (customer gave back)', value: 'sale_return' }, { label: 'Purchase return (sent back to supplier)', value: 'purchase_return' }]); if (k) newBill(k); }
    if (['products', 'accounts', 'reports', 'users', 'audit', 'recovery', 'payables', 'approvals', 'myrequests', 'notices', 'register', 'moneyreg', 'itemsales', 'partysum', 'partysum/V', 'stock', 'aging', 'cashbook'].includes(a) || /^(ledgers|report)\//.test(a)) go(a);
    if (a === 'sale_return' || a === 'purchase_return') newBill(a);
    if (['insights', 'cashflow', 'tax'].includes(a)) go('report/' + a);
    if (a === 'closebooks') closeBooks();
    if (a === 'settings') settingsForm();
    if (a === 'password') passwordForm();
    if (a === 'theme') { const t = await actionSheet('Appearance', [{ label: 'Automatic', value: 'auto' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]); if (t) { try { localStorage.setItem('qt.theme', t); } catch {} if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; } }
    if (a === 'logout') { if (await confirmBox('Sign out from this phone?', 'Sign out', true)) { auth.clear(); location.hash = ''; location.reload(); } }
    if (a === 'backup') downloadBackup();
    if (a === 'import') importForm();
  };
});

export function passwordForm(forced = false) {
  return new Promise(resolve => {
    const s = sheet({ title: 'Change Password', left: forced ? 'Later' : 'Cancel', right: 'Save', body: `${forced ? '<p class="sec-f" style="margin:0 4px 12px">You are using the starting password. Choose your own now.</p>' : ''}<div class="list">
      <div class="row"><label>Current</label><input class="fld" type="password" data-o autocomplete="current-password"></div>
      <div class="row"><label>New</label><input class="fld" type="password" data-n autocomplete="new-password" placeholder="8+ characters"></div>
      <div class="row"><label>Repeat</label><input class="fld" type="password" data-n2 autocomplete="new-password"></div></div>`,
      onRight: async sh => {
        const n = $('[data-n]', sh.el).value; if (n.length < 8) return hud('Use 8 or more characters', 'err'); if (n !== $('[data-n2]', sh.el).value) return hud('Passwords do not match', 'err');
        try { const r = await api('/api/me/password', { body: { old: $('[data-o]', sh.el).value, new: n } }); auth.set(r.token, { ...auth.user, must_change: false }); hud('Password changed'); sh.close(); } catch (e) { fail(e); }
      }, onClose: resolve });
  });
}

function settingsForm() {
  const c = S.boot.company;
  sheet({ title: 'Company & Invoice', right: 'Save', body: `<div class="list">
    ${[['name', 'Name'], ['address', 'Address'], ['phone', 'Phone'], ['ntn', 'NTN'], ['strn', 'STRN'], ['email', 'Email'], ['footer', 'Invoice footer']].map(([k, l]) => `<div class="row"><label>${l}</label><input class="fld" data-f="${k}" value="${esc(c[k] || '')}"></div>`).join('')}
    <div class="row col"><label>Bank details (invoice par)</label><textarea class="fld" rows="3" data-f="bank" placeholder="Meezan Bank · A/C Title: Qayam Traders · A/C 0123-4567890 · IBAN PK..">${esc(c.bank || '')}</textarea></div>
    <div class="row col"><label>Terms & conditions</label><textarea class="fld" rows="3" data-f="terms" placeholder="Maal check kar ke wasool karein. Payment 15 din mein.">${esc(c.terms || '')}</textarea></div>
    <div class="row"><label>Sales tax %</label><input class="fld num" inputmode="decimal" data-f="tax_pct" value="${c.tax_pct || 0}"></div>
    <div class="row"><label>Approval above Rs</label><input class="fld num" inputmode="numeric" data-f="approval_limit" value="${c.approval_limit ?? 10000}"></div></div>
    <p class="sec-f">These details print on every invoice. Sales tax % is the default for new bills (0 = off). Entries above the approval amount wait for Zain or Rehan to approve.</p>`,
    onRight: async sh => { const body = {}; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.value; }); try { await api('/api/settings', { method: 'PUT', body }); await reloadBoot(); hud('Saved'); sh.close(); } catch (e) { fail(e); } } });
}

async function downloadBackup() {
  try {
    const res = await fetch('/api/admin/backup', { headers: { authorization: 'Bearer ' + auth.token } });
    if (!res.ok) throw new Error('Backup failed');
    const blob = await res.blob(), name = `qayam-backup-${today()}.json`;
    const Cap = window.Capacitor;
    if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem && Cap.Plugins?.Share) {
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      const { uri } = await Cap.Plugins.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
      await Cap.Plugins.Share.share({ files: [uri], title: name });
    } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
    hud('Backup ready');
  } catch (e) { fail(e); }
}

function importForm() {
  const s = sheet({ title: 'Import Old Data', body: `<p class="sec-f" style="margin:0 4px 14px">Choose <b>qayam-data.json</b> from the old software. This <b>replaces</b> all customers, suppliers, products, bills and ledger entries in this app. Users and settings stay.</p>
    <div class="list"><label class="row action" style="cursor:pointer">${ic('tray')}<span class="grow">Choose file</span><input type="file" accept=".json,application/json" hidden data-file></label></div><p class="sec-f" data-st></p>` });
  $('[data-file]', s.el).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    let data; try { data = JSON.parse(await f.text()); } catch { return hud('Not a valid file', 'err'); }
    if (!(await confirmBox(`Replace everything with this file? (${data.C?.length} customers, ${data.I?.length} bills, ${data.J?.length} entries)`, 'Replace', true))) return;
    $('[data-st]', s.el).innerHTML = '<span class="spin"></span> Importing…';
    try { const r = await api('/api/admin/import', { body: { confirm: 'REPLACE', data } }); await reloadBoot(); $('[data-st]', s.el).innerHTML = `Done: ${r.customers} customers, ${r.products} products, ${r.journals} entries. Trial balance ${r.balanced ? '<span class="green">balanced</span>' : '<span class="red">NOT balanced</span>'} (${rs2(r.trialDebit)}).`; hud('Imported'); } catch (x) { $('[data-st]', s.el).textContent = x.message; fail(x); }
  };
}

/* =============================== ACCOUNTS & REPORTS =============================== */
const TYPES = { A: 'Assets', B: 'Liabilities', E: 'Equity / Capital', C: 'Income', D: 'Expenses' };
route(/^accounts$/, async v => {
  const body = page(v, { title: 'Accounts', back: 'more', backLabel: 'More', right: `<button class="nbtn" data-new aria-label="Add">${ic('plus')}</button>` });
  $('[data-new]', v).onclick = accountForm;
  body.innerHTML = loading;
  const acc = await api('/api/accounts');
  body.innerHTML = `<div class="search">${ic('search')}<input placeholder="Search accounts" data-q></div><div data-l></div>`;
  const draw = () => {
    const q = $('[data-q]', body).value.trim().toLowerCase();
    $('[data-l]', body).innerHTML = Object.entries(TYPES).map(([t, label]) => {
      const list = acc.filter(a => a.type === t && (!q || (a.code + a.name + a.grp).toLowerCase().includes(q)));
      if (!list.length) return '';
      const nat = a => (t === 'A' || t === 'D' ? a.balance : -a.balance);
      return `<div class="sec-h">${label}<span class="num">${rs(list.reduce((s, a) => s + nat(a), 0))}</span></div><div class="list">${list.map(a => `<button class="row" data-go="account/${a.code}"><span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(a.code)} · ${esc(nice(a.grp))}</span></span><span class="v num">${rs(nat(a))}</span>${chev}</button>`).join('')}</div>`;
    }).join('');
  };
  $('[data-q]', body).oninput = draw; body.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); }; draw();
});
function accountForm() {
  sheet({ title: 'New Account', right: 'Save', body: `<div class="list"><div class="row"><label>Code</label><input class="fld num" inputmode="numeric" data-f="code" placeholder="e.g. 5310"></div><div class="row"><label>Name</label><input class="fld" data-f="name"></div>
    <div class="row"><label>Type</label><select class="fld" data-f="type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div class="row"><label>Group</label><input class="fld" data-f="grp" placeholder="e.g. Operating Expenses / Cash & Bank"></div></div>
    <p class="sec-f">For a new bank account use group “Cash & Bank”.</p>`,
    onRight: async sh => { const body = {}; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.value; }); try { await api('/api/accounts', { body }); await reloadBoot(); hud('Saved'); sh.close(); render(); } catch (e) { fail(e); } } });
}
const REPORTS = [['stock', 'Stock report (aaya · bika · bacha)', 'cube', 'var(--purple)', 'stock'], ['aging', 'Outstanding (ageing)', 'clock', 'var(--orange)', 'aging'], ['cashbook', 'Cash book', 'book', 'var(--teal)', 'cashbook'], ['ledgers', 'Ledgers (khata)', 'list', 'var(--tint)', 'ledgers'],
  ['register', 'Invoices register', 'list', 'var(--tint)', 'register'], ['moneyreg', 'Payments register', 'wallet', 'var(--green)', 'moneyreg'], ['itemsales', 'Item-wise sales', 'cube', 'var(--teal)', 'itemsales'],
  ['partysum', 'Customer summary', 'people', 'var(--orange)', 'partysum/C'], ['partysumv', 'Supplier summary', 'people', 'var(--indigo)', 'partysum/V'], ['payables', 'Payables ageing', 'clock', 'var(--red)', 'aging/V'],
  ['pl', 'Profit & Loss', 'chart', 'var(--green)'], ['bs', 'Balance Sheet', 'book', 'var(--indigo)'], ['insights', 'What moved (this vs last month)', 'arrowup', 'var(--purple)'], ['cashflow', 'Cash flow', 'bank', 'var(--teal)'],
  ['tb', 'Trial Balance', 'list', 'var(--tint)'], ['tax', 'Sales tax & FBR', 'receipt', 'var(--pink)'], ['daybook', 'Day Book', 'doc', 'var(--teal)']];
route(/^reports$/, async v => {
  const body = page(v, { title: 'Reports', back: 'more', backLabel: 'More' });
  body.innerHTML = `<div class="list">${REPORTS.map(([k, l, i, c, to]) => `<button class="row with-icon" data-go="${to || 'report/' + k}"><span class="ico" style="background:${c}">${ic(i)}</span><span class="grow">${l}</span>${chev}</button>`).join('')}</div>`;
  body.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
});
const RFROM = {};
route(/^report\/(\w+)$/, async (v, k) => {
  if (k === 'stock' || k === 'aging') return location.replace('#' + k);
  const meta = REPORTS.find(r => r[0] === k) || [k, 'Report'];
  let from = RFROM.from || fyFrom(), to = RFROM.to || today();
  const body = page(v, { title: meta[1], back: 'reports', backLabel: 'Reports' });
  const needsFrom = ['pl', 'daybook', 'cashflow', 'tax'].includes(k), needsTo = k !== 'stock';
  const load = async () => {
    const dates = `${needsFrom ? `<div class="row"><label>From</label><input class="fld" type="date" data-from value="${from}"></div>` : ''}${needsTo ? `<div class="row"><label>${needsFrom ? 'To' : 'As on'}</label><input class="fld" type="date" data-to value="${to}"></div>` : ''}`;
    let h = '';
    if (k === 'pl') {
      const d = await api(`/api/reports/profit-loss?from=${from}&to=${to}`);
      const sec = (t, rows, tot) => `<div class="sec-h">${t}<span class="num">${rs(tot)}</span></div><div class="list">${rows.map(r => `<div class="row"><span class="grow">${esc(nice(r.name))}</span><span class="v num">${rs(r.v)}</span></div>`).join('') || '<div class="row l2">None</div>'}</div>`;
      h = sec('Income', d.income, d.totalIncome) + sec('Cost of sales', d.cos, d.totalCos) + `<div class="list" style="margin-top:14px"><div class="row"><b class="grow">Gross profit</b><b class="num">${rs(d.grossProfit)}</b></div></div>` + sec('Expenses', d.exp, d.totalExp) + `<div class="list" style="margin-top:14px"><div class="row"><b class="grow">${d.netProfit >= 0 ? 'Net profit' : 'Net loss'}</b><b class="num ${d.netProfit >= 0 ? 'green' : 'red'}">${rs(d.netProfit)}</b></div></div>`;
    } else if (k === 'bs') {
      const d = await api(`/api/reports/balance-sheet?to=${to}`);
      const sec = (t, rows, tot) => `<div class="sec-h">${t}<span class="num">${rs(tot)}</span></div><div class="list">${rows.map(r => `<div class="row"><span class="grow">${esc(nice(r.name))}</span><span class="v num">${rs(r.v)}</span></div>`).join('')}</div>`;
      h = sec('Assets', d.assets, d.totalAssets) + sec('Liabilities', d.liabilities, d.totalLiabilities) + sec('Equity', [...d.equity, { name: 'Profit to date', v: d.profit }], d.totalEquity) + `<p class="sec-f">${Math.abs(d.check) < 1 ? '<span class="green">Balanced: assets = liabilities + equity</span>' : `<span class="red">Difference ${rs2(d.check)}</span>`}</p>`;
    } else if (k === 'tb') {
      const d = await api(`/api/reports/trial-balance?to=${to}`);
      h = `<div class="sec-h">Debit ${rs(d.debit)} · Credit ${rs(d.credit)}</div><div class="list">${d.rows.map(r => `<button class="row" data-go="account/${r.code}"><span class="grow"><span class="t">${esc(nice(r.name))}</span><span class="s">${esc(r.code)}</span></span><span class="v num">${r.debit ? 'Dr ' + n2(r.debit) : 'Cr ' + n2(r.credit)}</span></button>`).join('')}</div><p class="sec-f">${d.debit === d.credit ? '<span class="green">Debit equals credit.</span>' : '<span class="red">Not balanced!</span>'}</p>`;
    } else if (k === 'aging') {
      const d = await api(`/api/reports/aging?to=${to}`);
      const tot = d.buckets.reduce((a, x) => a + x, 0) || 1;
      h = `<div class="tiles" style="margin-top:14px">${[['0–30 days', 0], ['31–60 days', 1], ['61–90 days', 2], ['90+ days', 3]].map(([l, i]) => `<div class="tile"><div class="k ${i >= 2 ? 'red' : i === 1 ? 'orange' : 'green'}">${l}</div><div class="n num">${short(d.buckets[i])}</div><div class="d">${Math.round(d.buckets[i] / tot * 100)}%</div></div>`).join('')}</div>
        <div class="sec-h">Customers</div><div class="list">${d.rows.map(o => `<button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} days` : 'Advance'}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('')}</div>`;
    } else if (k === 'daybook') {
      const d = await api(`/api/reports/day-book?from=${from}&to=${to}`);
      h = `<div class="sec-h">${d.length} entries</div>${d.map(j => `<div class="list" style="margin-bottom:10px"><button class="row" ${j.ref_invoice ? `data-go="bill/${j.ref_invoice}"` : ''}><span class="grow"><span class="t">${esc(j.type)} · ${esc(j.no)}</span><span class="s">${esc(fd(j.date))} · ${esc(nice(String(j.memo).slice(0, 80)))}</span></span></button>${j.lines.map(l => `<div class="row" style="font-size:15px"><span class="grow l2">${esc(nice(l.name))}${l.party ? ' · ' + esc(nice(l.party)) : ''}</span><span class="v num">${l.debit ? 'Dr ' + n2(l.debit) : 'Cr ' + n2(l.credit)}</span></div>`).join('')}</div>`).join('')}`;
    } else if (k === 'cashflow') {
      const d = await api(`/api/reports/cash-flow?from=${from}&to=${to}`);
      const mx = Math.max(1, ...d.months.map(m => Math.max(m.in, m.out)));
      const grp = (t, rows, cls) => `<div class="sec-h">${t}</div><div class="list">${rows.map(r => `<div class="row"><span class="grow">${esc(nice(r.name))}</span><span class="v num ${cls}">${rs(r.v)}</span></div>`).join('') || '<div class="row l2">None</div>'}</div>`;
      h = `<div class="tiles" style="margin-top:14px"><div class="tile"><div class="k">Opening cash & bank</div><div class="n num">${short(d.opening)}</div></div><div class="tile"><div class="k">Closing cash & bank</div><div class="n num">${short(d.closing)}</div></div>
          <div class="tile"><div class="k green">Money in</div><div class="n num">${short(d.in)}</div></div><div class="tile"><div class="k red">Money out</div><div class="n num">${short(d.out)}</div></div></div>
        ${d.months.length > 1 ? `<div class="sec-h">Month by month</div><div class="list" style="padding:12px 16px">${d.months.map(m => `<div class="cfm"><span>${esc(monShort(m.m + '-01'))}</span><div><i class="g" style="width:${m.in / mx * 100}%"></i><i class="r" style="width:${m.out / mx * 100}%"></i></div><span class="num ${m.in - m.out >= 0 ? 'green' : 'red'}">${short(m.in - m.out)}</span></div>`).join('')}</div>` : ''}
        ${grp('Where money came from', d.inflows, 'green')}${grp('Where money went', d.outflows, 'red')}
        <p class="sec-f">Cash aur bank ke darmiyan transfer yahan shamil nahi.</p>`;
    } else if (k === 'tax') {
      const d = await api(`/api/reports/sales-tax?from=${from}&to=${to}`);
      h = `<div class="list" style="margin-top:14px"><div class="row"><span class="grow"><span class="t">Next FBR sales tax return</span><span class="s">Due ${esc(fd(d.next_due))} · ${d.days_left} din baqi</span></span><span class="badge ${d.days_left <= 5 ? 'red' : d.days_left <= 10 ? 'orange' : 'green'}">${d.days_left} din</span></div>
          <div class="row"><span class="grow">Sales tax payable (books)</span><b class="num">${rs(d.payable_now)}</b></div></div>
        <div class="tiles" style="margin-top:14px"><div class="tile"><div class="k">Output tax (sales)</div><div class="n num">${short(d.total.output)}</div></div><div class="tile"><div class="k">Input tax (purchases)</div><div class="n num">${short(d.total.input)}</div></div></div>
        <div class="sec-h">By month</div>${d.months.map(m => `<div class="list" style="margin-bottom:10px"><div class="row"><b class="grow">${esc(monShort(m.m + '-01'))} ${m.m.slice(0, 4)}</b><span class="l2" style="font-size:13px">Return due ${esc(fd(m.due))}</span></div>
          <div class="row"><span class="grow l2">Sales (ex-tax) · ${m.bills} bills</span><span class="num">${rs(m.sales)}</span></div><div class="row"><span class="grow l2">Output tax</span><span class="num">${rs(m.output)}</span></div>
          <div class="row"><span class="grow l2">Input tax</span><span class="num">-${rs(m.input)}</span></div><div class="row"><b class="grow">Net payable</b><b class="num">${rs(m.payable)}</b></div></div>`).join('') || '<div class="empty">Is dauran koi bill nahi</div>'}
        <p class="sec-f">FBR sales tax return har mahine ki 18 tareekh tak. Bill par tax lagane ke liye Settings mein Sales tax % set karein.</p>`;
    } else if (k === 'insights') {
      const d = await api(`/api/reports/insights?to=${to}`);
      const arrow = (x, goodUp = true) => x.diff === 0 ? '' : `<span class="badge ${(x.diff > 0) === goodUp ? 'green' : 'red'}">${x.diff > 0 ? '▲' : '▼'} ${x.pct === null ? short(Math.abs(x.diff)) : Math.abs(x.pct) + '%'}</span>`;
      const mv = (t, rows, link) => rows.length ? `<div class="sec-h">${t}</div><div class="list">${rows.map(r => `<${link ? `button data-go="${link}/${r.id}"` : 'div'} class="row"><span class="grow"><span class="t">${esc(nice(r.name || '—'))}</span><span class="s">${short(r.before)} → ${short(r.now)}</span></span><span class="v num ${r.diff > 0 ? 'green' : 'red'}">${r.diff > 0 ? '+' : ''}${short(r.diff)}</span></${link ? 'button' : 'div'}>`).join('')}</div>` : '';
      h = `<p class="sec-f" style="margin-top:12px">${esc(fd(d.period.from))} – ${esc(fd(d.period.to))} vs ${esc(fd(d.period.pfrom))} – ${esc(fd(d.period.pto))}</p>
        <div class="list">${d.metrics.map(x => `<div class="row"><span class="grow"><span class="t">${x.label}</span><span class="s">Last month ${rs(x.before)}</span></span><span class="v num"><b>${rs(x.now)}</b></span>${arrow(x, x.k !== 'exp')}</div>`).join('')}</div>
        ${mv('Customers: biggest changes', d.customers, 'party')}${mv('Products: biggest changes', d.products)}${mv('Expenses: biggest changes', d.expenses)}
        ${d.lost.length ? `<div class="sec-h">Pichle mahine liya, is mahine nahi</div><div class="list">${d.lost.map(r => `<button class="row" data-go="party/${r.id}"><span class="grow">${esc(nice(r.name))}</span><span class="v num">${rs(r.before)}</span>${chev}</button>`).join('')}</div><p class="sec-f">In customers se raabta karein.</p>` : ''}`;
    } else if (k === 'stock') {
      const d = await api('/api/reports/stock');
      const tot = d.reduce((a, p) => a + (+p.value || 0), 0);
      h = `<div class="sec-h">Total value ${rs(tot)}</div><div class="list">${d.map(p => `<div class="row"><span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${fq(p.stock)} ${esc(p.unit)} × ${rs(p.cost)}</span></span><span class="v num">${rs(p.value)}</span></div>`).join('')}</div>`;
    }
    body.innerHTML = (dates ? `<div class="list">${dates}</div>` : '') + h;
  };
  body.onchange = e => { if (e.target.dataset.from !== undefined) from = RFROM.from = e.target.value; if (e.target.dataset.to !== undefined) to = RFROM.to = e.target.value; load().catch(fail); };
  body.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
  body.innerHTML = loading; await load();
});

/* =============================== TEAM =============================== */
route(/^users$/, async v => {
  const body = page(v, { title: 'Team', back: 'more', backLabel: 'More', right: `<button class="nbtn" data-new aria-label="Add">${ic('plus')}</button>` });
  const load = async () => {
    const us = await api('/api/users');
    body.innerHTML = `<div class="list">${us.map(u => `<button class="row with-avatar" data-u="${u.id}">${avatar(u.name)}<span class="grow"><span class="t">${esc(u.name)}${u.active ? '' : ' <span class="badge gray">Off</span>'}</span><span class="s">${esc(u.username)} · ${esc(ROLE_LABEL[u.role] || u.role)}</span></span>${chev}</button>`).join('')}</div>
      <div class="sec-h">Kaun kya kar sakta hai</div><div class="list roles">
        <div class="row"><span class="grow"><span class="t">Owner</span><span class="s wrap">Sab kuch dekh aur kar sakta hai, Rs ${(S.boot.company.approval_limit ?? 10000).toLocaleString('en-US')} se upar ki entries approve / reject karta hai, profit dekhta hai.</span></span></div>
        <div class="row"><span class="grow"><span class="t">Manager</span><span class="s wrap">Rozana ka kaam: bills, purchase, stock, payments, kharche, vouchers, reports. Bari entries approval ke liye jati hain.</span></span></div>
        <div class="row"><span class="grow"><span class="t">Salesman</span><span class="s wrap">Sirf sale bill aur recovery, apne customers. Cost, profit, bank aur suppliers nahi dekh sakta.</span></span></div>
        <div class="row"><span class="grow"><span class="t">Admin (technical)</span><span class="s wrap">Software, team, backup aur data import.</span></span></div></div>`;
    body.onclick = e => { const b = e.target.closest('[data-u]'); if (b) userForm(us.find(u => u.id === +b.dataset.u), load); };
  };
  $('[data-new]', v).onclick = () => userForm(null, load);
  await load();
});
function userForm(u, done) {
  sheet({ title: u ? u.name : 'New Person', right: 'Save', body: `<div class="list">
    <div class="row"><label>Name</label><input class="fld" data-f="name" value="${esc(u?.name || '')}"></div>
    ${u ? '' : '<div class="row"><label>Username</label><input class="fld" data-f="username" autocapitalize="none" placeholder="e.g. kaif"></div>'}
    <div class="row"><label>Role</label><select class="fld" data-f="role">${[['salesman', 'Salesman'], ['manager', 'Manager'], ['owner', 'Owner'], ...(can.admin() || u?.role === 'admin' ? [['admin', 'Admin (technical)']] : []), ...(u?.role === 'accountant' ? [['accountant', 'Accountant']] : [])].map(([k, l]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="row"><label>Mobile</label><input class="fld" data-f="phone" inputmode="tel" value="${esc(u?.phone || '')}"></div>
    <div class="row"><label>${u ? 'New password' : 'Password'}</label><input class="fld" data-f="password" type="text" placeholder="${u ? 'leave empty to keep' : '8+ characters'}"></div>
    ${u ? `<div class="row"><span class="grow">Can sign in</span><input type="checkbox" class="toggle" data-f="active" ${u.active ? 'checked' : ''}></div>` : ''}</div>
    <p class="sec-f">They will be asked to choose their own password after first sign-in. Turning “Can sign in” off logs them out everywhere.</p>`,
    onRight: async sh => {
      const body = {}; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.type === 'checkbox' ? i.checked : i.value; });
      if (u && !body.password) delete body.password;
      try { await api(u ? `/api/users/${u.id}` : '/api/users', { method: u ? 'PUT' : 'POST', body }); hud('Saved'); sh.close(); done(); } catch (e) { fail(e); }
    } });
}
route(/^audit$/, async v => {
  const body = page(v, { title: 'Activity', back: 'more', backLabel: 'More' });
  const rows = await api('/api/audit');
  body.innerHTML = `<div class="list">${rows.map(r => `<div class="row"><span class="grow"><span class="t">${esc(r.user_name || 'System')} · ${esc(r.action)} ${esc(r.entity)}</span><span class="s">${esc(new Date(r.at).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' }))}${r.data?.no ? ' · ' + esc(r.data.no) : ''}${r.data?.total ? ' · ' + rs(r.data.total) : ''}</span></span></div>`).join('')}</div>`;
});
