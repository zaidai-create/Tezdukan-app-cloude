import { $, $$, esc, ic, chev, api, S, can, auth, party, product, reloadBoot, hud, fail, sheet, picker, actionSheet, confirmBox, route, go, render, page,
  rs, rs2, n2, qty as fq, short, r2, fd, fdShort, monShort, today, fyStart, nice, initials, waPhone } from './core.js';
import { invoiceHTML, statementHTML, fitPaper, shareDoc, billText } from './invoice.js';
import { openVoice } from './voice.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const avatar = name => `<span class="avatar">${esc(initials(name))}</span>`;
const fyFrom = () => fyStart(today());
const KLABEL = { sale: 'Sale', purchase: 'Purchase', sale_return: 'Sales return', purchase_return: 'Purchase return' };
const status = i => {
  if (i.kind === 'sale_return' || i.kind === 'purchase_return') return `<span class="badge gray">${KLABEL[i.kind]}</span>`;
  const due = i.total - i.paid;
  return due < 0.5 ? '<span class="badge green">Paid</span>' : i.paid > 0 ? `<span class="badge orange">Due ${rs(due)}</span>` : `<span class="badge red">Credit</span>`;
};
const cashAccounts = () => S.boot.accounts.filter(a => a.grp === 'Cash & Bank');
let period = 'month';
const periodRange = () => { const t = today(); return period === 'today' ? [t, t] : period === 'month' ? [t.slice(0, 8) + '01', t] : period === 'year' ? [fyFrom(), t] : ['2000-01-01', t]; };

/* =============================== HOME =============================== */
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4.5 5.4 7 8.6 7 12a7 7 0 0 1-14 0c0-3.4 2.5-6.6 7-12z"/><path d="M9.5 15.5a2.6 2.6 0 0 0 2.5 2.4"/></svg>';
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
  const sales = S.user.role === 'salesman', first = String(S.user.name || '').split(' ')[0];
  const alertsCount = () => (S._alerts || 0);
  v.innerHTML = `<div class="page"><div class="brandbar"><span class="brandmark">${MARK}</span><span class="brandtext"><b>${esc(nice(S.boot.company.name))}</b><span>Sales, stock and accounts</span></span>
      <button class="roundbtn" data-go="${sales ? 'bills' : 'report/aging'}" aria-label="Alerts">${ic('bell')}<span class="dot" data-dot hidden></span></button><button class="me" data-go="more" aria-label="Profile">${esc(first.slice(0, 1).toUpperCase())}</button></div>
    <h1 class="hello">Hello, ${esc(first)}!</h1><p class="hello-sub">${sales ? 'Aaj ka kaam, ek nazar mein' : 'Here’s your business overview'} · ${esc(fd(today()))}</p>
    <div data-d>${loading}</div></div>`;
  const D = $('[data-d]', v);
  const draw = async () => {
    const [from, to] = periodRange();
    const d = await api(`/api/dashboard?from=${from}&to=${to}`);
    D.innerHTML = sales ? salesmanHome(d) : staffHome(d);
    const dot = $('[data-dot]', v); if (dot) dot.hidden = !(d.alerts && d.alerts.length);
  };
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
  const admin = can.admin(), stale = Math.round((Date.parse(today()) - Date.parse(d.lastEntry || today())) / 864e5);
  const m = d.monthly, ser = k => m.map(x => x[k]);
  const ch = pctChg(d.sales, d.prev?.sales), up = ch == null || ch >= 0;
  const label = { today: 'Sales today', month: 'Sales this month', year: 'Sales this year', all: 'Total sales' }[period];
  const tiles = [
    ['Sales', d.sales, 'cart', 'var(--brand2)', 'bills', ser('sales')],
    ['Received', d.recovery, 'checkc', 'var(--green)', 'report/daybook', ser('recovery')],
    ['Customers owe', d.receivable, 'people', 'var(--orange)', 'report/aging', ser('receivable')],
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
    ${d.owe.length ? `<div class="sec-h">To collect<button data-go="report/aging">See all</button></div><div class="list">${d.owe.map(o => `<button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} days` : 'Advance'}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('')}</div>` : ''}
    ${d.alerts.length ? `<div class="sec-h">Needs attention</div><div class="list">${d.alerts.map(a => `<div class="row with-icon"><span class="ico" style="background:var(--${a.level === 'red' ? 'red' : a.level === 'yellow' ? 'yellow' : 'orange'})">${ic('warn')}</span><span class="grow"><span class="t" style="white-space:normal">${esc(nice(a.text))}</span><span class="s" style="white-space:normal">${esc(nice(a.hint || ''))}</span></span></div>`).join('')}</div>` : ''}
    <div class="sec-h">Recent bills<button data-go="bills">See all</button></div>
    <div class="list">${d.recent.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party))}</span><span class="s">${esc(i.no)} · ${esc(fdShort(i.date))}</span></span><span class="v num"><b>${rs(i.total)}</b><br>${status({ ...i, kind: 'sale' })}</span>${chev}</button>`).join('')}</div>`;
}

function salesmanHome(d) {
  return `<div class="hero"><div class="k">${ic('cart')}Sold today</div><div class="big num">${rs(d.billed)}</div><span class="chg">${d.bills} bill${d.bills === 1 ? '' : 's'} · ${rs(d.recovery)} collected</span><button class="more" data-newbill>New bill ${ic('arrow')}</button></div>
    <button class="vbanner" data-voicecta><span class="m">${ic('mic')}</span><span class="t"><b>Bol kar entry karein</b><span>Sale ya recovery, bas bolein</span></span>${wave()}</button>
    ${d.collect.length ? `<div class="sec-h">To collect</div><div class="list">${d.collect.map(o => `<button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} days` : ''}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('')}</div>` : ''}
    <div class="sec-h">My bills</div>
    ${d.recent.length ? `<div class="list">${d.recent.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party))}</span><span class="s">${esc(i.no)} · ${esc(fdShort(i.date))}</span></span><span class="v num"><b>${rs(i.total)}</b></span>${chev}</button>`).join('')}</div>` : `<div class="empty">${ic('doc')}<div>No bills yet</div></div>`}`;
}

/* =============================== BILLS =============================== */
let billKind = 'sale';
route(/^bills(?:\/(sale|purchase|returns))?$/, async (v, k) => {
  if (k) billKind = k;
  if (!can.staff()) billKind = 'sale';
  const body = page(v, { title: 'Bills', right: `<button class="nbtn" data-new aria-label="New">${ic('plus')}</button>` });
  $('[data-new]', v).onclick = async () => {
    if (!can.staff()) return newBill('sale');
    const kind = await actionSheet('New', [{ label: 'Sale bill', value: 'sale' }, { label: 'Purchase bill', value: 'purchase' }, { label: 'Sales return', value: 'sale_return' }, { label: 'Purchase return', value: 'purchase_return' }]);
    if (kind) newBill(kind);
  };
  body.innerHTML = `${can.staff() ? `<div class="seg" data-kind>${[['sale', 'Sales'], ['purchase', 'Purchases'], ['returns', 'Returns']].map(([x, l]) => `<button data-x="${x}" class="${billKind === x ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="search">${ic('search')}<input placeholder="Search name or bill no." data-q autocomplete="off"></div><div data-l>${loading}</div>`;
  const L = $('[data-l]', body), Q = $('[data-q]', body);
  let off = 0, rows = [];
  const load = async (more) => {
    if (!more) { off = 0; rows = []; }
    const kinds = billKind === 'returns' ? ['sale_return', 'purchase_return'] : [billKind];
    const got = (await Promise.all(kinds.map(kk => api(`/api/invoices?kind=${kk}&q=${encodeURIComponent(Q.value.trim())}&offset=${off}&limit=60`)))).flat();
    got.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    rows = rows.concat(got); off += 60;
    L.innerHTML = rows.length ? `<div class="list">${rows.map(i => `<button class="row" data-go="bill/${i.id}"><span class="grow"><span class="t">${esc(nice(i.party || '—'))}</span><span class="s">${esc(i.no)} · ${esc(fd(i.date))}${i.source === 'voice' ? ' · voice' : ''}</span></span><span class="v num"><b>${rs(i.total)}</b><br>${status(i)}</span>${chev}</button>`).join('')}</div>${got.length === 60 ? '<button class="btn gray" style="margin-top:12px" data-more>Load more</button>' : ''}`
      : `<div class="empty">${ic('doc')}<div>No bills</div></div>`;
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
  body.innerHTML = `<div class="seg" data-mode>${[['a4', 'A4 Invoice'], ['slip', 'Receipt 80mm']].map(([k, l]) => `<button data-m="${k}" class="${paperMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="paperwrap" data-paper></div>
    <div class="btns" style="margin-top:16px"><button class="btn" data-share>${ic('share')} Send</button><button class="btn gray" data-wa ${waPhone(p?.phone) ? '' : 'disabled'}>${ic('chat')} WhatsApp</button></div>
    <div class="list" style="margin-top:20px">
      ${i.kind === 'sale' && due > 0.5 ? `<button class="row action" data-recv>${ic('down')}<span class="grow">Receive payment</span><span class="v num">${rs(due)}</span></button>` : ''}
      ${p ? `<button class="row" data-go="party/${p.id}"><span class="grow">${p.kind === 'C' ? 'Customer' : 'Supplier'} account</span><span class="v">${esc(nice(p.name))}</span>${chev}</button>` : ''}
      <div class="row"><span class="grow">Made by</span><span class="v">${esc(i.created_by_name || '—')}${i.source === 'voice' ? ' · by voice' : i.legacy ? ' · old software' : ''}</span></div>
      ${!waPhone(p?.phone) && p ? `<button class="row action" data-phone><span class="grow">Add WhatsApp number</span></button>` : ''}
    </div>
    ${can.admin() && !i.legacy ? `<div class="list" style="margin-top:20px"><button class="row danger" data-cancel>Cancel this bill</button></div><p class="sec-f">Cancelling removes the bill, its payment and its stock movement. It is recorded in the activity log.</p>` : ''}`;
  const W = $('[data-paper]', body);
  const drawPaper = () => { W.innerHTML = invoiceHTML(d, { slip: paperMode === 'slip' }); fitPaper(W); };
  drawPaper();
  const doShare = () => shareDoc(invoiceHTML(d, { slip: paperMode === 'slip' }), { name: `${i.no}`, phone: p?.phone, text: billText(d) });
  body.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.m) { paperMode = b.dataset.m; $$('[data-m]', body).forEach(x => x.classList.toggle('on', x === b)); drawPaper(); }
    if (b.dataset.share !== undefined) doShare();
    if (b.dataset.wa !== undefined) open(`https://wa.me/${waPhone(p.phone)}?text=${encodeURIComponent(billText(d))}`, '_blank');
    if (b.dataset.recv !== undefined) receiveMoney(p.id, due);
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
export async function newBill(kind = 'sale', partyId = null) {
  const C = S.boot.company, isSale = kind === 'sale' || kind === 'sale_return', pk = isSale ? 'C' : 'V';
  const B = { kind, party: partyId ? party(partyId) : null, lines: [], discount: 0, tax: (C.tax_pct || 0) > 0, taxPct: C.tax_pct || 18, pay: 'credit', paid: 0, account: '1000', date: today(), note: '' };
  let rates = {};
  const loadRates = async () => { rates = B.party ? await api(`/api/parties/${B.party.id}/rates`).catch(() => ({})) : {}; };
  await loadRates();
  const T = () => { const sub = r2(B.lines.reduce((a, l) => a + l.qty * l.rate, 0)), disc = Math.min(B.discount || 0, sub), net = r2(sub - disc), tax = B.tax ? r2(net * B.taxPct / 100) : 0, total = r2(net + tax); return { sub, disc, net, tax, total, paid: B.pay === 'credit' ? 0 : Math.min(B.paid || total, total) }; };
  const title = { sale: 'New Sale', purchase: 'New Purchase', sale_return: 'Sales Return', purchase_return: 'Purchase Return' }[kind];
  const foot = document.createElement('div'); foot.style.cssText = 'display:contents';
  foot.innerHTML = `<div class="tot"><small>Total</small><b class="num" data-tt>Rs 0</b></div><button class="btn" data-save>Save</button>`;
  const s = sheet({ title, full: true, body: '<div data-b></div>', footer: foot });
  const b = $('[data-b]', s.el);
  const warn = l => { const p = product(l.p); if (!p) return ''; if ((kind === 'sale' || kind === 'purchase_return') && l.qty > p.stock) return `Only ${fq(p.stock)} in stock`; if (kind === 'sale' && p.cost && l.rate < p.cost && can.admin()) return `Below cost (${rs(p.cost)})`; return ''; };
  const draw = () => {
    const t = T(), pop = S.boot.products.slice(0, 8).filter(p => !B.lines.some(l => l.p === p.id));
    b.innerHTML = `<div class="list">
        <button class="row" data-party><span class="grow"><span class="t">${B.party ? esc(nice(B.party.name)) : `<span class="tint">Choose ${pk === 'C' ? 'customer' : 'supplier'}</span>`}</span>${B.party ? `<span class="s">Balance ${rs(B.party.balance)}</span>` : ''}</span>${chev}</button>
        <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${B.date}"></div></div>
      <div class="sec-h">Items</div>
      <div class="list">${B.lines.map((l, k) => { const p = product(l.p), w = warn(l); return `<div class="item"><div class="nm">${esc(nice(p?.name))}<small class="${w ? 'w' : ''}">${esc(w || `${fq(p?.stock)} ${p?.unit || ''} in stock`)}</small></div><div class="amt num">${rs2(l.qty * l.rate)}</div>
          <div class="ctl"><div class="stepper"><button data-dq="${k}:-1" aria-label="Less">−</button><input inputmode="decimal" data-q="${k}" value="${l.qty}" aria-label="Quantity"><button data-dq="${k}:1" aria-label="More">+</button></div><span class="l2">×</span><input class="rate" inputmode="decimal" data-r="${k}" value="${l.rate}" aria-label="Rate"><button class="x" data-rm="${k}" aria-label="Remove">${ic('trash')}</button></div></div>`; }).join('')}
        <button class="row action" data-add>${ic('plus')}<span class="grow">Add item</span></button></div>
      ${pop.length ? `<div class="chips">${pop.map(p => `<button class="chip" data-quick="${p.id}">+ ${esc(nice(p.name).replace(/\s*\(.*$/, ''))}</button>`).join('')}</div>` : ''}
      <div class="sec-h">Summary</div>
      <div class="list">
        <div class="row"><span class="grow">Subtotal</span><span class="v num" data-sub>${rs2(t.sub)}</span></div>
        <div class="row"><label>Discount</label><input class="fld num" inputmode="decimal" data-disc value="${B.discount || ''}" placeholder="0"></div>
        <div class="row"><span class="grow">Sales tax ${B.taxPct}%</span><input type="checkbox" class="toggle" data-tax ${B.tax ? 'checked' : ''}></div>
        ${B.tax ? `<div class="row"><span class="grow">Tax amount</span><span class="v num" data-taxv>${rs2(t.tax)}</span></div>` : ''}
        <div class="row"><label>Note</label><input class="fld" data-note value="${esc(B.note)}" placeholder="Optional"></div>
      </div>
      ${kind === 'sale' || kind === 'purchase' ? `<div class="sec-h">Payment</div><div class="list">
        <div class="row"><div class="seg" style="margin:0;flex:1" data-pay>${[['credit', kind === 'sale' ? 'Credit (udhaar)' : 'Credit'], ['cash', 'Cash'], ...(can.staff() ? [['bank', 'Bank']] : [])].map(([k, l]) => `<button data-p="${k}" class="${B.pay === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        ${B.pay !== 'credit' ? `<div class="row"><label>${kind === 'sale' ? 'Received' : 'Paid'}</label><input class="fld num" inputmode="decimal" data-paid value="${B.paid || t.total}"></div>` : ''}
        ${B.pay === 'bank' ? `<button class="row" data-acc><span class="grow">Account</span><span class="v">${esc(nice((S.boot.accounts.find(a => a.code === B.account) || {}).name || 'Choose'))}</span>${chev}</button>` : ''}
      </div>` : ''}
      <p class="sec-f" data-err style="color:var(--red)"></p>`;
    upd();
  };
  const upd = () => { const t = T(); $('[data-tt]', s.el).textContent = rs2(t.total); const sb = $('[data-sub]', b); if (sb) sb.textContent = rs2(t.sub); const tv = $('[data-taxv]', b); if (tv) tv.textContent = rs2(t.tax); B.lines.forEach((l, k) => { const a = $$('.item .amt', b)[k]; if (a) a.textContent = rs2(l.qty * l.rate); const w = $$('.item .nm small', b)[k], m = warn(l), p = product(l.p); if (w) { w.textContent = m || `${fq(p?.stock)} ${p?.unit || ''} in stock`; w.className = m ? 'w' : ''; } }); };
  const rateOf = p => rates[p.id] || (kind === 'purchase' || kind === 'purchase_return' ? p.cost || p.price : p.price) || 0;
  const addProduct = async () => {
    const list = S.boot.products.map(p => ({ ...p, search: p.name + ' ' + (p.aliases || '') + ' ' + p.category }));
    const r = await picker({ title: 'Add item', items: list, render: p => `<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${fq(p.stock)} ${esc(p.unit)} in stock</span></span><span class="v num">${rs(rateOf(p))}${rates[p.id] ? '<br><small class="l2">last rate</small>' : ''}</span>`,
      addLabel: can.staff() ? 'New product' : null, onAdd: async q => { const np = await productForm(null, q); return np ? product(np.id) : null; } });
    if (r) pushLine(r);
  };
  const pushLine = p => { const ex = B.lines.find(l => l.p === p.id); if (ex) ex.qty += 1; else B.lines.push({ p: p.id, qty: 1, rate: rateOf(p) }); draw(); const k = B.lines.findIndex(l => l.p === p.id); const q = $(`[data-q="${k}"]`, b); if (q) { q.focus(); q.select(); } };
  b.oninput = e => {
    const t = e.target;
    if (t.dataset.q !== undefined) { B.lines[+t.dataset.q].qty = +t.value || 0; upd(); }
    else if (t.dataset.r !== undefined) { B.lines[+t.dataset.r].rate = +t.value || 0; upd(); }
    else if (t.dataset.disc !== undefined) { B.discount = +t.value || 0; upd(); }
    else if (t.dataset.paid !== undefined) { B.paid = +t.value || 0; }
    else if (t.dataset.note !== undefined) B.note = t.value;
    else if (t.dataset.date !== undefined) B.date = t.value;
  };
  b.onchange = e => { if (e.target.dataset.tax !== undefined) { B.tax = e.target.checked; draw(); } };
  b.onclick = async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.party !== undefined) {
      const list = S.boot.parties.filter(p => p.kind === pk).map(p => ({ ...p, search: p.name + ' ' + p.city + ' ' + p.phone }));
      const r = await picker({ title: pk === 'C' ? 'Customer' : 'Supplier', items: list, render: p => `${avatar(p.name)}<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${esc(nice(p.city) || p.phone || '')}</span></span><span class="v num">${rs(p.balance)}</span>`,
        addLabel: `New ${pk === 'C' ? 'customer' : 'supplier'}`, onAdd: async q => partyForm(pk, null, q) });
      if (r) { B.party = party(r.id) || r; await loadRates(); B.lines.forEach(l => { const p = product(l.p); if (p && rates[p.id]) l.rate = rates[p.id]; }); draw(); }
    }
    if (t.dataset.add !== undefined) addProduct();
    if (t.dataset.quick) pushLine(product(t.dataset.quick));
    if (t.dataset.dq) { const [k, dd] = t.dataset.dq.split(':'); const l = B.lines[+k]; l.qty = Math.max(0, r2(l.qty + +dd)); $(`[data-q="${k}"]`, b).value = l.qty; upd(); }
    if (t.dataset.rm) { B.lines.splice(+t.dataset.rm, 1); draw(); }
    if (t.dataset.p) { B.pay = t.dataset.p; B.paid = 0; if (B.pay === 'bank') B.account = (cashAccounts().find(a => a.code !== '1000') || { code: '1000' }).code; else B.account = '1000'; draw(); }
    if (t.dataset.acc !== undefined) { const r = await picker({ title: 'Account', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { B.account = r.code; draw(); } }
  };
  $('[data-save]', s.el).onclick = async e => {
    const err = m => { $('[data-err]', b).textContent = m; hud(m, 'err'); };
    if (!B.party) return err(`Choose a ${pk === 'C' ? 'customer' : 'supplier'}.`);
    const lines = B.lines.filter(l => l.qty > 0);
    if (!lines.length) return err('Add at least one item.');
    if (lines.some(l => !(l.rate > 0))) return err('Every item needs a rate.');
    const t = T(), btn = e.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spin" style="border-top-color:#fff"></span>';
    try {
      const r = await api('/api/invoices', { body: { kind, party_id: B.party.id, date: B.date, lines: lines.map(l => ({ product_id: l.p, qty: l.qty, rate: l.rate })), discount: B.discount, tax_pct: B.tax ? B.taxPct : 0, paid: t.paid, pay_account: B.account, note: B.note } });
      await reloadBoot(); s.close(); hud('Saved'); go(`bill/${r.id}${kind === 'sale' ? '?share' : ''}`);
    } catch (x) { fail(x); btn.disabled = false; btn.textContent = 'Save'; }
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
        <button class="row action" data-a="stmt">${ic('share')}<span class="grow">Send statement (PDF)</span></button></div>
      <div class="sec-h">Entries</div>
      <div class="list"><div class="row"><span class="grow l2">Opening balance</span><span class="v num">${rs(d.opening)}</span></div>
      ${d.lines.slice().reverse().map(l => `<button class="row" ${l.ref_invoice ? `data-go="bill/${l.ref_invoice}"` : ''}><span class="grow"><span class="t">${esc(entryLabel(l, cust))}</span><span class="s">${esc(fd(l.date))} · ${esc(l.no)}</span></span><span class="v num"><b class="${(cust ? l.credit : l.debit) > 0 ? 'green' : ''}">${l.debit ? (cust ? '+' : '−') + rs(l.debit).slice(3) : (cust ? '−' : '+') + rs(l.credit).slice(3)}</b><br><small>${rs(l.balance)}</small></span></button>`).join('') || '<div class="empty">No entries in these dates</div>'}</div>`;
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
      ${can.staff() && kind === 'C' ? `<div class="row"><label>Credit limit</label><input class="fld num" inputmode="decimal" data-f="credit_limit" value="${p?.credit_limit || ''}" placeholder="0 = no limit"></div>` : ''}</div>
      <p class="sec-f">Mobile number lets you send bills and reminders on WhatsApp.</p>`,
      onRight: async sh => {
        const body = { kind }; $$('[data-f]', sh.el).forEach(i => { body[i.dataset.f] = i.value; });
        try { saved = await api(p ? `/api/parties/${p.id}` : '/api/parties', { method: p ? 'PUT' : 'POST', body }); await reloadBoot(); hud('Saved'); sh.close(); } catch (e) { fail(e); }
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
      try { await api(mode === 'receive' ? '/api/receipts' : '/api/payments', { body: { party_id: P.id, amount: amt, account: acc, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); await reloadBoot(); hud('Saved'); sh.close(); render(); } catch (e) { fail(e); }
    } });
  const drawP = () => { $('[data-pn]', s.el).innerHTML = P ? `<span class="t">${esc(nice(P.name))}</span><span class="s">Balance ${rs(P.balance)}</span>` : `<span class="tint">Choose ${pk === 'C' ? 'customer' : 'supplier'}</span>`; const an = $('[data-an]', s.el); if (an) an.textContent = nice((S.boot.accounts.find(a => a.code === acc) || {}).name || ''); };
  drawP();
  $('[data-party]', s.el).onclick = async () => { const r = await picker({ title: pk === 'C' ? 'Customer' : 'Supplier', items: S.boot.parties.filter(p => p.kind === pk).map(p => ({ ...p, search: p.name + ' ' + p.city })), render: p => `${avatar(p.name)}<span class="grow"><span class="t">${esc(nice(p.name))}</span></span><span class="v num">${rs(p.balance)}</span>` }); if (r) { P = r; drawP(); } };
  const ab = $('[data-acc]', s.el); if (ab) ab.onclick = async () => { const r = await picker({ title: 'Account', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { acc = r.code; drawP(); } };
  setTimeout(() => (P ? $('[data-amt]', s.el).focus() : $('[data-party]', s.el).click()), 380);
}

export function expenseForm() {
  let acc = null, from = '1000';
  const s = sheet({ title: 'Expense', right: 'Save', body: `<div class="list">
      <button class="row" data-acc><span class="grow" data-an><span class="tint">Choose expense type</span></span>${chev}</button>
      <div class="row"><label>Amount</label><input class="fld num" inputmode="decimal" data-amt placeholder="0" style="font-size:22px;font-weight:600"></div>
      <button class="row" data-from><span class="grow">Paid from</span><span class="v" data-fn>${esc(nice((S.boot.accounts.find(a => a.code === '1000') || {}).name || 'Cash'))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-note placeholder="e.g. petrol for van"></div></div>`,
    onRight: async sh => {
      const amt = +$('[data-amt]', sh.el).value;
      if (!acc) return hud('Choose expense type', 'err'); if (!(amt > 0)) return hud('Enter the amount', 'err');
      try { await api('/api/expenses', { body: { account: acc.code, amount: amt, pay_account: from, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); await reloadBoot(); hud('Saved'); sh.close(); render(); } catch (e) { fail(e); }
    } });
  $('[data-acc]', s.el).onclick = async () => { const r = await picker({ title: 'Expense type', items: S.boot.accounts.filter(a => a.type === 'D' && a.grp !== 'Cost of Sales' && a.code !== '5000').map(a => ({ ...a, search: a.name + ' ' + a.grp })), render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(nice(a.grp))}</span></span>` }); if (r) { acc = r; $('[data-an]', s.el).textContent = nice(r.name); } };
  $('[data-from]', s.el).onclick = async () => { const r = await picker({ title: 'Paid from', items: cashAccounts().map(a => ({ ...a, search: a.name })), render: a => `<span class="grow">${esc(nice(a.name))}</span>` }); if (r) { from = r.code; $('[data-fn]', s.el).textContent = nice(r.name); } };
}

export function voucherForm() {
  const L = [{ account: null, party: null, debit: '', credit: '' }, { account: null, party: null, debit: '', credit: '' }];
  const s = sheet({ title: 'Journal Voucher', right: 'Save', full: true, body: '<div data-b></div>',
    onRight: async sh => {
      const lines = L.filter(l => l.account && (+l.debit || +l.credit)).map(l => ({ account: l.account.code, party_id: l.party?.id || null, debit: +l.debit || 0, credit: +l.credit || 0 }));
      try { await api('/api/vouchers', { body: { date: $('[data-date]', sh.el).value, memo: $('[data-memo]', sh.el).value, lines } }); await reloadBoot(); hud('Saved'); sh.close(); } catch (e) { fail(e); }
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
  body.innerHTML = `<div class="search">${ic('search')}<input placeholder="Search products" data-q autocomplete="off"></div><div data-sum></div><div data-l></div>`;
  const draw = () => {
    const q = $('[data-q]', body).value.trim().toLowerCase();
    const list = S.boot.products.filter(p => !q || (p.name + ' ' + p.category + ' ' + p.aliases).toLowerCase().includes(q));
    if (can.staff()) $('[data-sum]', body).innerHTML = `<p class="sec-f" style="margin:-6px 4px 10px">${S.boot.products.length} products · stock value at cost <b class="num" style="color:var(--label)">${rs(S.boot.products.reduce((a, p) => a + Math.max(p.stock, 0) * (p.cost || 0), 0))}</b></p>`;
    $('[data-l]', body).innerHTML = `<div class="list">${list.map(p => `<button class="row" data-p="${p.id}"><span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${esc(nice(p.category) || '')}${can.staff() ? ` · cost ${rs(p.cost)}` : ''} · price ${p.price > 0 ? rs(p.price) : '<span class="orange">not set</span>'}</span></span><span class="v num ${p.stock < 0 ? 'red' : p.reorder > 0 && p.stock <= p.reorder ? 'orange' : ''}"><b>${fq(p.stock)}</b> ${esc(p.unit)}</span>${can.staff() ? chev : ''}</button>`).join('')}</div>`;
  };
  $('[data-q]', body).oninput = draw;
  body.onclick = async e => { const b = e.target.closest('[data-p]'); if (b && can.staff()) { if (await productForm(product(b.dataset.p))) draw(); } };
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
    if (adj) adj.onclick = async () => {
      const q = prompt(`Stock change for ${nice(p.name)}.\nUse minus to remove (e.g. -2 for damaged), plus to add (e.g. 5 after count).`);
      if (!q || !(+q)) return;
      const reason = prompt('Reason (count, damage, expiry…)', 'count correction') || 'count correction';
      try { await api(`/api/products/${p.id}/adjust`, { body: { qty: +q, reason } }); await reloadBoot(); hud('Stock adjusted'); s.close(); render(); } catch (e) { fail(e); }
    };
  });
}

/* =============================== MORE =============================== */
route(/^more$/, async v => {
  const staff = can.staff(), admin = can.admin();
  const row = (icon, color, label, act) => `<button class="row with-icon" data-act="${act}"><span class="ico" style="background:${color}">${ic(icon)}</span><span class="grow">${label}</span>${chev}</button>`;
  const body = page(v, { title: 'More' });
  body.innerHTML = `<div class="list"><div class="row with-avatar">${avatar(S.user.name)}<span class="grow"><span class="t">${esc(S.user.name)}</span><span class="s">${esc(S.user.username)} · ${esc({ admin: 'Admin', accountant: 'Accountant', salesman: 'Salesman' }[S.user.role])}</span></span></div></div>
    <div class="sec-h">Daily work</div><div class="list">
      ${row('mic', 'var(--red)', 'Voice entry', 'voice')}
      ${row('receipt', 'var(--tint)', 'New sale bill', 'sale')}
      ${row('down', 'var(--green)', 'Receive payment', 'receive')}
      ${staff ? row('cart', 'var(--indigo)', 'New purchase bill', 'purchase') + row('up', 'var(--orange)', 'Pay supplier', 'pay') + row('wallet', 'var(--red)', 'Expense', 'expense') + row('return', 'var(--purple)', 'Return (sale / purchase)', 'return') : ''}
      ${row('cube', 'var(--teal)', 'Stock & products', 'products')}</div>
    ${staff ? `<div class="sec-h">Accounts</div><div class="list">
      ${row('book', 'var(--indigo)', 'Journal voucher', 'voucher')}
      ${row('list', 'var(--tint)', 'Chart of accounts', 'accounts')}
      ${row('chart', 'var(--green)', 'Reports', 'reports')}</div>` : ''}
    ${admin ? `<div class="sec-h">Admin</div><div class="list">
      ${row('people', 'var(--tint)', 'Team & roles', 'users')}
      ${row('gear', '#8e8e93', 'Company & invoice settings', 'settings')}
      ${row('clock', 'var(--orange)', 'Activity log', 'audit')}
      ${row('tray', 'var(--teal)', 'Download full backup', 'backup')}
      ${row('drop', 'var(--indigo)', 'Import old software data', 'import')}</div>` : ''}
    <div class="sec-h">App</div><div class="list">
      ${row('sun', '#8e8e93', 'Appearance', 'theme')}
      ${row('lock', '#8e8e93', 'Change password', 'password')}
      <button class="row danger" data-act="logout">Sign out</button></div>
    <p class="sec-f" style="text-align:center;margin-top:20px">${esc(S.boot.company.name)} · version 1.0</p>`;
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
    if (['products', 'accounts', 'reports', 'users', 'audit'].includes(a)) go(a);
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
    ${[['name', 'Name'], ['address', 'Address'], ['phone', 'Phone'], ['ntn', 'NTN'], ['strn', 'STRN'], ['footer', 'Invoice footer']].map(([k, l]) => `<div class="row"><label>${l}</label><input class="fld" data-f="${k}" value="${esc(c[k] || '')}"></div>`).join('')}
    <div class="row"><label>Sales tax %</label><input class="fld num" inputmode="decimal" data-f="tax_pct" value="${c.tax_pct || 0}"></div></div>
    <p class="sec-f">These details print on every invoice. Sales tax % is the default for new bills (0 = off).</p>`,
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
route(/^account\/(\w+)$/, async (v, code) => {
  let from = fyFrom(), to = today();
  const a = S.boot.accounts.find(x => x.code === code) || { name: code };
  const body = page(v, { title: nice(a.name), back: 'accounts', backLabel: 'Accounts' });
  const load = async () => {
    const d = await api(`/api/reports/account-ledger?account=${code}&from=${from}&to=${to}`);
    body.innerHTML = `<div class="list"><div class="row"><label>From</label><input class="fld" type="date" data-from value="${from}"></div><div class="row"><label>To</label><input class="fld" type="date" data-to value="${to}"></div></div>
      <div class="sec-h">Balance ${rs(d.closing)}</div><div class="list"><div class="row"><span class="grow l2">Opening</span><span class="v num">${rs(d.opening)}</span></div>
      ${d.lines.slice().reverse().slice(0, 400).map(l => `<button class="row" ${l.ref_invoice ? `data-go="bill/${l.ref_invoice}"` : ''}><span class="grow"><span class="t">${esc(nice(String(l.memo || l.type).slice(0, 70)))}</span><span class="s">${esc(fd(l.date))} · ${esc(l.no)}</span></span><span class="v num"><b>${l.debit ? 'Dr ' + n2(l.debit) : 'Cr ' + n2(l.credit)}</b><br><small>${rs(l.balance)}</small></span></button>`).join('')}</div>`;
  };
  body.onchange = e => { if (e.target.dataset.from !== undefined) from = e.target.value; if (e.target.dataset.to !== undefined) to = e.target.value; load().catch(fail); };
  body.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
  await load();
});

const REPORTS = [['pl', 'Profit & Loss', 'chart', 'var(--green)'], ['bs', 'Balance Sheet', 'book', 'var(--indigo)'], ['tb', 'Trial Balance', 'list', 'var(--tint)'], ['aging', 'Receivables ageing', 'clock', 'var(--orange)'], ['daybook', 'Day Book', 'doc', 'var(--teal)'], ['stock', 'Stock valuation', 'cube', 'var(--purple)']];
route(/^reports$/, async v => {
  const body = page(v, { title: 'Reports', back: 'more', backLabel: 'More' });
  body.innerHTML = `<div class="list">${REPORTS.map(([k, l, i, c]) => `<button class="row with-icon" data-go="report/${k}"><span class="ico" style="background:${c}">${ic(i)}</span><span class="grow">${l}</span>${chev}</button>`).join('')}</div>`;
  body.onclick = e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); };
});
const RFROM = {};
route(/^report\/(\w+)$/, async (v, k) => {
  const meta = REPORTS.find(r => r[0] === k) || [k, 'Report'];
  let from = RFROM.from || fyFrom(), to = RFROM.to || today();
  const body = page(v, { title: meta[1], back: 'reports', backLabel: 'Reports' });
  const needsFrom = k === 'pl' || k === 'daybook', needsTo = k !== 'stock';
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
    body.innerHTML = `<div class="list">${us.map(u => `<button class="row with-avatar" data-u="${u.id}">${avatar(u.name)}<span class="grow"><span class="t">${esc(u.name)}${u.active ? '' : ' <span class="badge gray">Off</span>'}</span><span class="s">${esc(u.username)} · ${esc({ admin: 'Admin', accountant: 'Accountant', salesman: 'Salesman' }[u.role])}</span></span>${chev}</button>`).join('')}</div>
      <p class="sec-f">Everyone uses the same app. Each person signs in once with their own username; the app shows only what their role allows. Salesmen cannot see cost, profit, bank or supplier accounts.</p>`;
    body.onclick = e => { const b = e.target.closest('[data-u]'); if (b) userForm(us.find(u => u.id === +b.dataset.u), load); };
  };
  $('[data-new]', v).onclick = () => userForm(null, load);
  await load();
});
function userForm(u, done) {
  sheet({ title: u ? u.name : 'New Person', right: 'Save', body: `<div class="list">
    <div class="row"><label>Name</label><input class="fld" data-f="name" value="${esc(u?.name || '')}"></div>
    ${u ? '' : '<div class="row"><label>Username</label><input class="fld" data-f="username" autocapitalize="none" placeholder="e.g. kaif"></div>'}
    <div class="row"><label>Role</label><select class="fld" data-f="role">${[['salesman', 'Salesman'], ['accountant', 'Accountant'], ['admin', 'Admin']].map(([k, l]) => `<option value="${k}" ${u?.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
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
