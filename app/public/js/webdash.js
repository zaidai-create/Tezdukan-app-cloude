// Web software dashboard (desktop), in the style of the first Qayam design. Live data from /api/dashboard.
import { $, $$, esc, ic, api, S, can, go, fail, rs, short, fd, fdShort, monShort, today, fyStart, nice, initials, swr } from './core.js';
import { pendingCard } from './approvals.js';
import { openVoice } from './voice.js';

let wperiod = 'year';
const RANGES = [['today', 'Today'], ['month', 'This month'], ['year', 'This year'], ['all', 'All time']];
const range = () => { const t = today(); return wperiod === 'today' ? [t, t] : wperiod === 'month' ? [t.slice(0, 8) + '01', t] : wperiod === 'year' ? [fyStart(t), t] : ['2000-01-01', t]; };
const pct = (a, b) => (b && Math.abs(b) > 1 ? (a - b) / Math.abs(b) : null);
const spark = (vals) => {
  const w = 96, h = 28, mx = Math.max(...vals), mn = Math.min(0, ...vals), sp = (mx - mn) || 1;
  const pts = vals.map((v, i) => [i * (w - 6) / (vals.length - 1 || 1) + 2, h - 4 - (v - mn) / sp * (h - 8)]);
  const last = pts.at(-1);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#a9b8cc" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="#2563eb" stroke="var(--card)" stroke-width="2"/></svg>`;
};

export async function webHome(v) {
  v.innerHTML = `<div class="page"><div class="wpend" data-pend></div><div data-d><div class="loading"><span class="spin"></span></div></div></div>`;
  const D = $('[data-d]', v);
  const draw = async () => { const [from, to] = range(); await swr(`/api/dashboard?from=${from}&to=${to}`, d => { D.innerHTML = html(d); mount(D, d); }, { persist: true }); };
  pendingCard($('[data-pend]', v));
  v.onclick = e => {
    const b = e.target.closest('[data-r],[data-go],[data-act]'); if (!b) return;
    if (b.dataset.r) { wperiod = b.dataset.r; D.style.opacity = .5; draw().catch(fail).finally(() => { D.style.opacity = 1; }); }
    if (b.dataset.go) go(b.dataset.go);
    if (b.dataset.act === 'voice') openVoice();
    if (b.dataset.act === 'bill') import('./screens.js').then(m => m.newBill('sale'));
    if (b.dataset.act === 'receive') import('./screens.js').then(m => m.receiveMoney());
    if (b.dataset.act === 'purchase') import('./screens.js').then(m => m.newBill('purchase'));
    if (b.dataset.act === 'expense') import('./screens.js').then(m => m.expenseForm());
  };
  await draw();
}

function html(d) {
  const admin = can.boss(), m = d.monthly, ser = k => m.map(x => x[k]);
  const label = RANGES.find(r => r[0] === wperiod)[1];
  const stale = Math.round((Date.parse(today()) - Date.parse(d.lastEntry || today())) / 864e5);
  const hour = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false }).format(new Date());
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const kpis = [
    ['Sales', d.sales, 'cart', '#2563eb', 'bills', ser('sales'), pct(d.sales, d.prev?.sales), true],
    admin ? ['Gross profit', d.gp, 'chart', '#0d9488', 'report/pl', ser('gp'), pct(d.gp, d.prev?.gp), true] : ['Expenses', d.expenses, 'receipt', '#be123c', 'report/pl', ser('expenses'), null, false],
    ['Recovery received', d.recovery, 'down', '#7c3aed', 'report/daybook', ser('recovery'), pct(d.recovery, d.prev?.recovery), true],
    ['Customers owe you', d.receivable, 'people', '#ea580c', 'recovery', ser('receivable'), null, false],
    d.payable >= 0 ? ['You owe suppliers', d.payable, 'tag', '#64748b', 'parties/V', ser('payable'), null, null] : ['Advance with suppliers', -d.payable, 'tag', '#64748b', 'parties/V', ser('payable').map(x => -x), null, null],
    ['Cash & bank', d.cashTotal, 'bank', '#0891b2', 'accounts', ser('cash'), null, true],
  ];
  const ag = d.aging, agt = ag.reduce((a, x) => a + x, 0) || 1, agc = ['#86b6ef', '#5598e7', '#2a78d6', '#184f95'];
  const totC = d.topCustomers.reduce((a, x) => a + x.v, 0) || 1, maxC = Math.max(...d.topCustomers.map(x => x.v), 1);
  const totP = d.topProducts.reduce((a, x) => a + x.v, 0) || 1, maxP = Math.max(...d.topProducts.map(x => x.v), 1);
  return `<section class="whero reveal"><div><span class="kick">${ic('clock')}${esc(fd(today()))} · Asia/Karachi</span><h1>${greet}, ${esc(String(S.user.name).split(' ')[0])}</h1>
      <p>${esc(label)}: <b>${short(d.sales)}</b> sales${admin ? `, <b>${short(d.gp)}</b> gross profit` : ''}, <b>${short(d.recovery)}</b> recovered.</p>
      ${stale > 3 ? `<span class="stale">${ic('warn')}Last entry ${esc(fd(d.lastEntry))} — ${stale} days ago. Books may be behind.</span>` : ''}</div>
    <div class="acts"><button class="glass pri" data-act="bill">${ic('plus')}New Bill</button><button class="glass" data-act="voice">${ic('mic')}Voice entry</button><button class="glass" data-act="receive">${ic('down')}Receive payment</button>${can.staff() ? `<button class="glass" data-act="purchase">${ic('cart')}Purchase</button><button class="glass" data-act="expense">${ic('wallet')}Expense</button>` : ''}</div></section>
  <div class="wfilters reveal" style="--i:1"><div class="wseg">${RANGES.map(([k, l]) => `<button data-r="${k}" class="${wperiod === k ? 'on' : ''}">${l}</button>`).join('')}</div><span class="l2">${esc(fd(d.from))} – ${esc(fd(d.to))}${d.prev ? ` · compared with ${esc(fdShort(d.prev.from))} – ${esc(fd(d.prev.to))}` : ''}</span></div>
  <div class="wgrid wk">${kpis.map((k, i) => { const dl = k[6]; return `<button class="wcard wkpi reveal" style="--i:${i + 2};--kc:${k[3]}" data-go="${k[4]}"><div class="h"><span class="ic2">${ic(k[2])}</span>${k[0]}</div><div class="val num">${short(k[1])}</div><div class="f">${dl == null ? `<span>${rs(k[1])}</span>` : `<span class="delta ${(dl >= 0) === k[7] ? 'good' : 'bad'}">${dl >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(dl * 100))}%</span><span>vs previous</span>`}${spark(k[5])}</div></button>`; }).join('')}</div>
  <div class="wgrid w21">
    <div class="wcard reveal" style="--i:8"><div class="wch"><div><h3>Sales and purchases</h3><p class="sub">Monthly · last 12 months</p></div><div class="legend"><span><i class="lk" style="background:var(--s1)"></i>Sales</span><span><i class="lk" style="background:var(--s2)"></i>Purchases</span></div></div><div class="wchart" data-chart></div></div>
    <div class="wcard reveal" style="--i:9"><div class="wch"><div><h3>What needs attention</h3><p class="sub">Worked out from your books</p></div></div>
      ${d.alerts.length ? d.alerts.slice(0, 6).map(a => `<div class="wal"><span class="sev ${a.level}">${a.level === 'red' ? 'Critical' : a.level === 'yellow' ? 'Check' : 'Fix soon'}</span><div><b>${esc(nice(a.text))}</b><small>${esc(nice(a.hint || ''))}</small></div></div>`).join('') : '<p class="l2">All clear.</p>'}</div>
  </div>
  <div class="wgrid w3">
    <div class="wcard reveal" style="--i:10"><div class="wch"><div><h3>Who owes you, and since when</h3><p class="sub">${rs(d.receivable)} outstanding</p></div></div>
      <div class="segbar">${['0–30', '31–60', '61–90', '90+'].map((l, i) => ag[i] > 0 ? `<div style="flex:${ag[i]} 1 0;background:${agc[i]};color:${i ? '#fff' : '#0b0b0b'}" title="${l} days: ${esc(rs(ag[i]))}">${ag[i] / agt > .12 ? Math.round(ag[i] / agt * 100) + '%' : ''}</div>` : '').join('')}</div>
      <div class="legend" style="margin-bottom:6px">${['0–30', '31–60', '61–90', '90+'].map((l, i) => `<span><i style="width:10px;height:10px;border-radius:3px;background:${agc[i]};display:inline-block"></i>${l} days</span>`).join('')}</div>
      ${d.owe.slice(0, 5).map(o => `<button class="wli" data-go="party/${o.party_id}"><span class="wav">${esc(initials(o.name))}</span><span class="g"><b>${esc(nice(o.name))}</b><small>${o.days ? `Oldest unpaid bill ${o.days} days` : 'Advance'}</small></span><span class="a">${short(o.balance)}</span></button>`).join('')}</div>
    <div class="wcard reveal" style="--i:11"><div class="wch"><div><h3>Top customers</h3><p class="sub">By sales · ${esc(label)}</p></div></div>
      ${d.topCustomers.map(c => `<div class="rk" title="${esc(Math.round(c.v / totC * 100))}% of sales"><span class="n">${esc(nice(c.name))}</span><span class="v">${short(c.v)}</span><span class="t"><i style="--w:${(c.v / maxC * 100).toFixed(1)}%"></i></span></div>`).join('') || '<p class="l2">No sales in this period.</p>'}</div>
    <div class="wcard reveal" style="--i:12"><div class="wch"><div><h3>Top products</h3><p class="sub">By invoice value · ${esc(label)}</p></div></div>
      ${d.topProducts.map(p => `<div class="rk" title="${esc(Math.round(p.v / totP * 100))}% of product sales"><span class="n">${esc(nice(p.name).replace(/\s*\(.*$/, ''))}<small>${Math.round(p.q).toLocaleString('en-US')} ${esc(p.unit)}</small></span><span class="v">${short(p.v)}</span><span class="t"><i style="--w:${(p.v / maxP * 100).toFixed(1)}%"></i></span></div>`).join('') || '<p class="l2">No sales in this period.</p>'}</div>
  </div>
  <div class="wgrid w3">
    <div class="wcard reveal" style="--i:13"><div class="wch"><div><h3>Cash and bank</h3><p class="sub">Balances today</p></div><b>${short(d.cashTotal)}</b></div>
      ${d.cash.map(a => `<button class="wli" data-go="account/${a.code}"><span class="wav">${ic(a.code === '1000' ? 'wallet' : 'bank')}</span><span class="g"><b>${esc(nice(a.name))}</b><small>Account ${esc(a.code)}</small></span><span class="a">${rs(a.balance)}</span></button>`).join('')}</div>
    <div class="wcard reveal" style="--i:14"><div class="wch"><div><h3>FBR Digital Invoicing</h3><p class="sub">Status: not connected yet</p></div></div>
      ${['Log in to IRIS → Digital Invoicing', 'Choose PRAL as licensed integrator', 'Whitelist the gateway server IP', 'Pass the sandbox test scenarios', 'Paste production token in Settings'].map((s, i) => `<div class="step"><i>${i + 1}</i>${s}</div>`).join('')}</div>
    <div class="wcard reveal" style="--i:15"><div class="wch"><div><h3>Quick actions</h3><p class="sub">Most used</p></div></div>
      ${[['bill', 'receipt', 'New sale bill'], ['voice', 'mic', 'Voice entry (bol kar)'], ['receive', 'down', 'Receive payment'], ...(can.staff() ? [['purchase', 'cart', 'New purchase'], ['expense', 'wallet', 'Expense']] : [])].map(([a, i, l]) => `<button class="wli" data-act="${a}"><span class="wav">${ic(i)}</span><span class="g"><b>${l}</b></span>${ic('chevr')}</button>`).join('')}</div>
  </div>
  <div class="wgrid"><div class="wcard reveal" style="--i:16"><div class="wch"><div><h3>Latest bills</h3><p class="sub">Most recent sales</p></div><button class="wbtn ghost" data-go="bills">View all ${ic('arrow')}</button></div>
    <div style="overflow-x:auto"><table class="wtable"><thead><tr><th>Bill</th><th>Date</th><th>Customer</th><th class="n">Amount</th><th class="n">Received</th><th>Payment</th></tr></thead><tbody>
    ${d.recent.map(i => { const due = i.total - i.paid; return `<tr data-go="bill/${i.id}"><td><b>${esc(i.no)}</b></td><td>${esc(fd(i.date))}</td><td>${esc(nice(i.party))}</td><td class="n">${rs(i.total)}</td><td class="n">${rs(i.paid)}</td><td>${due < .5 ? '<span class="badge green">Paid</span>' : i.paid > 0 ? '<span class="badge orange">Part paid</span>' : '<span class="badge red">On credit</span>'}</td></tr>`; }).join('')}</tbody></table></div></div></div>`;
}

function mount(D, d) {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.rk .t i', D).forEach(i => { i.style.width = i.style.getPropertyValue('--w'); })));
  const host = $('[data-chart]', D); if (!host) return;
  const m = d.monthly, n = m.length, W = Math.max(320, host.clientWidth), H = 270, L = 52, R = 12, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
  const nice2 = v => { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  const hi = nice2(Math.max(1, ...m.map(x => Math.max(x.sales, x.purchases))));
  const x = i => L + i * iw / (n - 1), y = v => T + ih - Math.max(v, 0) / hi * ih;
  const ax = v => v >= 1e7 ? (v / 1e7).toFixed(1).replace(/\.0$/, '') + ' Cr' : v >= 1e5 ? (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : v;
  let g = '';
  for (let t = 0; t <= 4; t++) { const v = hi * t / 4, yy = y(v).toFixed(1); g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${+yy + 4}" text-anchor="end">${ax(v)}</text>`; }
  m.forEach((p, i) => { if (i % (W < 600 ? 2 : 1) === 0) g += `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${monShort(p.m)}</text>`; });
  const path = k => m.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${g}<path class="ar" d="${path('sales')}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z"/><path class="ln" style="stroke:var(--s1)" d="${path('sales')}"/><path class="ln" style="stroke:var(--s2)" d="${path('purchases')}"/><g data-xh style="display:none"><line x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--label2)" opacity=".35"/><circle r="5" fill="var(--s1)" stroke="var(--card)" stroke-width="2"/><circle r="5" fill="var(--s2)" stroke="var(--card)" stroke-width="2"/></g><rect x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent" data-hit/></svg>`;
  $$('.ln', host).forEach(p => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.getBoundingClientRect(); p.classList.add('draw'); p.style.strokeDashoffset = 0; });
  let tip = $('.wtip'); if (!tip) { tip = document.createElement('div'); tip.className = 'wtip'; document.body.append(tip); }
  const svg = $('svg', host), xh = $('[data-xh]', host);
  $('[data-hit]', host).onpointermove = e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width, i = Math.max(0, Math.min(n - 1, Math.round((px - L) / (iw / (n - 1))))), p = m[i];
    xh.style.display = ''; $('line', xh).setAttribute('x1', x(i)); $('line', xh).setAttribute('x2', x(i));
    const cs = $$('circle', xh); cs[0].setAttribute('cx', x(i)); cs[0].setAttribute('cy', y(p.sales)); cs[1].setAttribute('cx', x(i)); cs[1].setAttribute('cy', y(p.purchases));
    tip.replaceChildren(); const t = document.createElement('div'); t.className = 'tt'; t.textContent = `${monShort(p.m)} ${p.m.slice(0, 4)}`; tip.append(t);
    [['Sales', p.sales, 'var(--s1)'], ['Purchases', p.purchases, 'var(--s2)'], ...(can.boss() ? [['Gross profit', p.gp]] : []), ['Recovery', p.recovery]].forEach(([l, v, c]) => { const row = document.createElement('div'); row.className = 'tr'; if (c) { const k = document.createElement('i'); k.style.cssText = `width:12px;height:2px;background:${c};display:inline-block`; row.append(k); } const b = document.createElement('b'); b.textContent = rs(v); const s = document.createElement('span'); s.textContent = l; row.append(b, s); tip.append(row); });
    tip.style.display = 'block'; tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 12) + 'px';
  };
  $('[data-hit]', host).onpointerleave = () => { xh.style.display = 'none'; tip.style.display = 'none'; };
}
