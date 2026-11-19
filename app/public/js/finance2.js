// Finance & banking (phase 1): global search, money in/out, fund transfer, credit/debit notes, voucher view + reversal,
// loans (business + personal), bank reconciliation, fixed assets, payroll, general ledger / expense / loan reports, barcode scanning.
import { $, $$, esc, ic, chev, api, S, can, sheet, picker, hud, fail, route, go, page, rs, rs2, n2, fd, nice, today, reloadBoot, actionSheet, confirmBox, UI, product, short } from './core.js';
import { filterBar, wireFilters, initF, table, exportCSV, printTable, actions, rng, money } from './registers.js';
import { afterSubmit } from './approvals.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const cashAccs = () => S.boot.accounts.filter(a => a.grp === 'Cash & Bank');
const accName = code => nice((S.boot.accounts.find(a => a.code === code) || {}).name || code || '');
const TYPE_LABEL = { A: 'Asset', B: 'Liability', C: 'Income', D: 'Expense', E: 'Capital' };
const accPick = (title, filter = () => true) => picker({ title, items: S.boot.accounts.filter(filter).map(a => ({ ...a, search: a.name + ' ' + a.code + ' ' + a.grp })), render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(a.code)} · ${esc(a.grp || TYPE_LABEL[a.type])}</span></span>` });
const partyPick = (kind, title) => picker({ title, items: S.boot.parties.filter(p => !kind || p.kind === kind).map(p => ({ ...p, search: p.name + ' ' + p.city })), render: p => `<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${p.kind === 'C' ? 'Customer' : 'Supplier'}${p.city ? ' · ' + esc(nice(p.city)) : ''}</span></span><span class="v num">${rs(p.balance)}</span>` });
const ym = () => today().slice(0, 7);
const val = x => (x || x === 0 ? String(x) : '');
const st = (cls, txt) => `<span class="badge ${cls}">${esc(txt)}</span>`;

/* =============================== GLOBAL SEARCH =============================== */
const GTYPES = [['all', 'Sab'], ['products', 'Products'], ['parties', 'Parties'], ['invoices', 'Invoices'], ['vouchers', 'Vouchers'], ['loans', 'Loans'], ['people', 'Employees'], ['accounts', 'Accounts']];
const GICON = { products: 'cube', parties: 'people', invoices: 'doc', vouchers: 'book', loans: 'wallet', people: 'person', accounts: 'list', assets: 'cube' };
const recentQ = () => { try { return JSON.parse(localStorage.getItem('qt.gs') || '[]'); } catch { return []; } };
const saveQ = q => { try { localStorage.setItem('qt.gs', JSON.stringify([q, ...recentQ().filter(x => x !== q)].slice(0, 8))); } catch {} };
export function openSearch(q0 = '') {
  if ($('.gsearch')) return;
  let type = 'all', timer = null, seq = 0, sel = -1;
  const staff = can.staff(), types = staff ? GTYPES : GTYPES.filter(t => ['all', 'products', 'parties', 'invoices'].includes(t[0]));
  const el = document.createElement('div'); el.className = 'gsearch'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Search');
  el.innerHTML = `<div class="gs-box"><div class="gs-top">${ic('search')}<input data-gq placeholder="Kuch bhi dhoondein — product, barcode, customer, bill no, voucher, loan, amount…" autocomplete="off" value="${esc(q0)}">
      <button class="gs-scan" data-gscan title="Scan barcode" aria-label="Scan barcode">${ic('scan')}</button><button class="gs-x" data-gx aria-label="Close">Esc</button></div>
    <div class="gs-chips">${types.map(([k, l]) => `<button data-gt="${k}" class="${k === type ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="gs-res" data-gr></div></div>`;
  document.body.append(el); document.body.style.overflow = 'hidden';
  const inp = $('[data-gq]', el), R = $('[data-gr]', el);
  const close = () => { el.remove(); if (!$('.sheet')) document.body.style.overflow = ''; removeEventListener('keydown', key, true); };
  const open = (link, q) => { if (q) saveQ(q); close(); go(link); };
  const empty = () => { const r = recentQ();
    R.innerHTML = `${r.length ? `<div class="gs-h">Recent searches</div><div class="gs-recent">${r.map(x => `<button data-rq="${esc(x)}">${ic('clock')}${esc(x)}</button>`).join('')}</div>` : ''}
      <div class="gs-h">Jaldi kholein</div><div class="gs-quick">${[['bills', 'doc', 'Invoices'], ['parties', 'people', staff ? 'Customers & suppliers' : 'Customers'], ['products', 'cube', 'Products & stock'], ...(staff ? [['ledgers', 'list', 'Ledgers'], ['loans', 'wallet', 'Loans'], ['finance', 'bank', 'Money in / out'], ['report/pl', 'chart', 'Profit & loss'], ['gl', 'book', 'General ledger']] : [])].map(([l, i, t]) => `<button data-go2="${l}">${ic(i)}<span>${t}</span></button>`).join('')}</div>
      <p class="gs-tip">Tip: amount likh kar bhi dhoond sakte hain (e.g. 25000). Barcode scanner se scan karein to product seedha mil jata hai.</p>`; };
  const run = async () => {
    const q = inp.value.trim(); sel = -1; if (!q) return empty();
    const my = ++seq; R.innerHTML = `<div class="gs-load">${loading}</div>`;
    try {
      const d = await api(`/api/search?q=${encodeURIComponent(q)}&type=${type}`); if (my !== seq) return;
      // a scanned barcode that matches one product exactly: open it at once
      const prods = d.groups.find(g => g.type === 'products');
      if (prods && prods.items.length === 1 && /^\d{6,}$/.test(q) && prods.items[0].sub.includes(q) && d.groups.length === 1) return open(prods.items[0].link, q);
      R.innerHTML = d.groups.length ? d.groups.map(g => `<div class="gs-h">${ic(GICON[g.type] || 'list')}${esc(g.label)}<span>${g.items.length}</span></div>${g.items.map(it => `<button class="gs-it" data-link="${esc(it.link)}"><span class="gs-ic">${ic(GICON[g.type] || 'list')}</span><span class="grow"><b>${esc(nice(it.title))}</b><small>${esc(it.sub || '')}</small></span>${it.badge ? st(it.badge === 'Reversed' ? 'red' : 'gray', it.badge) : ''}${it.amount ? `<span class="num gs-amt">${rs(it.amount)}</span>` : ''}</button>`).join('')}`).join('')
        : `<div class="empty" style="padding:40px 10px">“${esc(q)}” se kuch nahi mila.<br><small class="l2">Spelling check karein ya “Sab” filter chunein.</small></div>`;
    } catch (e) { if (my === seq) R.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(); }
    const items = $$('.gs-it', el); if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((x, i) => x.classList.toggle('sel', i === sel)); items[sel].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); const it = items[sel >= 0 ? sel : 0]; open(it.dataset.link, inp.value.trim()); }
  };
  addEventListener('keydown', key, true);
  inp.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 220); };
  el.onclick = async e => {
    if (e.target === el || e.target.closest('[data-gx]')) return close();
    const t = e.target.closest('[data-gt]'); if (t) { type = t.dataset.gt; $$('[data-gt]', el).forEach(x => x.classList.toggle('on', x === t)); return run(); }
    const r = e.target.closest('[data-rq]'); if (r) { inp.value = r.dataset.rq; return run(); }
    const g = e.target.closest('[data-go2]'); if (g) { close(); return go(g.dataset.go2); }
    const it = e.target.closest('[data-link]'); if (it) return open(it.dataset.link, inp.value.trim());
    if (e.target.closest('[data-gscan]')) { const code = await scanBarcode(); if (code) { inp.value = code; run(); } }
  };
  run(); setTimeout(() => inp.focus(), 60);
}
document.addEventListener('click', e => { if (e.target.closest('[data-gsearch]')) { e.preventDefault(); openSearch(); } });
addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !$('.sheet'))) { if (!S.boot) return; e.preventDefault(); openSearch(); }
});

/* =============================== BARCODE SCANNER =============================== */
// Camera scanning where the browser supports it (Chrome / Android). A USB or Bluetooth scanner works everywhere:
// it simply types the code into any search box.
export function scanBarcode() {
  return new Promise(async resolve => {
    if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
      hud('Is device par camera scan nahi chalta. Barcode scanner lagayein ya number type karein.', 'info', 3200); return resolve(null);
    }
    let stream, done = false;
    const el = document.createElement('div'); el.className = 'scanner';
    el.innerHTML = `<video playsinline muted></video><div class="scan-frame"></div><p>Barcode ko frame ke andar rakhein</p><button data-sx>Band karein</button>`;
    document.body.append(el);
    const finish = v => { if (done) return; done = true; stream?.getTracks().forEach(t => t.stop()); el.remove(); resolve(v); };
    $('[data-sx]', el).onclick = () => finish(null);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('video', el); v.srcObject = stream; await v.play();
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf'] });
      const tick = async () => { if (done) return; try { const r = await det.detect(v); if (r[0]?.rawValue) { navigator.vibrate?.(60); return finish(r[0].rawValue); } } catch {} setTimeout(tick, 180); };
      tick();
    } catch (e) { finish(null); hud('Camera nahi khul saka: ' + (e.message || 'permission'), 'err', 3000); }
  });
}
export const productByCode = code => S.boot.products.find(p => p.barcode && p.barcode === String(code).trim()) || S.boot.products.find(p => p.sku && p.sku.toLowerCase() === String(code).trim().toLowerCase());

/* =============================== FINANCE HUB =============================== */
route(/^finance$/, async v => {
  const body = page(v, { title: 'Finance & banking', back: 'more', backLabel: 'More', sub: 'Paisa aana-jana, loans, bank, assets aur salary — sab ek jagah' });
  const tile = (act, icon, color, t, s) => `<button class="ftile" data-f="${act}"><span class="fi" style="background:${color}">${ic(icon)}</span><b>${t}</b><small>${s}</small></button>`;
  body.innerHTML = `<div class="fgrid">
      ${tile('in', 'down', 'var(--green)', 'Money In', 'Capital, income, advance')}${tile('out', 'up', 'var(--red)', 'Money Out', 'Drawings, kharcha, advance')}
      ${tile('transfer', 'swap', 'var(--teal)', 'Fund transfer', 'Cash ↔ bank (contra)')}${tile('note', 'receipt', 'var(--purple)', 'Credit / debit note', 'Party balance adjust')}
      ${tile('voucher', 'book', 'var(--indigo)', 'Journal voucher', 'Koi bhi Dr / Cr entry')}${tile('loans', 'wallet', 'var(--orange)', 'Loans', 'Diye / liye · qist')}
      ${tile('bankrec', 'bank', 'var(--tint)', 'Bank reconciliation', 'Statement se milayein')}${tile('assets', 'cube', '#8e6e53', 'Fixed assets', 'Gaari, machine · depreciation')}
      ${tile('payroll', 'person', 'var(--pink)', 'Payroll', 'Staff, salary, advance')}${tile('vouchers', 'list', '#8e8e93', 'All vouchers', 'Dhoondein, dekhein, reverse')}</div>
    ${can.boss() ? `<div class="list" style="margin-top:14px"><button class="row action" data-f="cats">${ic('tag')}<span class="grow">Transaction categories (Money In / Out ke khaane)</span>${chev}</button></div>` : ''}`;
  body.onclick = async e => { const t = e.target.closest('[data-f]'); if (!t) return; const f = t.dataset.f;
    if (f === 'in' || f === 'out') moneyForm(f); if (f === 'transfer') transferForm(); if (f === 'note') noteForm();
    if (f === 'voucher') (await import('./screens.js')).voucherForm(); if (f === 'cats') categoriesForm();
    if (['loans', 'bankrec', 'assets', 'payroll'].includes(f)) go(f); if (f === 'vouchers') go('moneyreg'); };
});

/* ---------- money in / out by category ---------- */
let CATS = null;
const loadCats = async () => (CATS = await api('/api/money/categories'));
export async function moneyForm(dir = 'in') {
  await loadCats().catch(fail); if (!CATS) return;
  let cat = CATS.find(c => c.dir === dir), account = cat?.account, cash = '1000', party = null;
  const s = sheet({ title: dir === 'in' ? 'Money In' : 'Money Out', right: 'Save', body: `<div class="seg" data-d><button data-dir="in" class="${dir === 'in' ? 'on' : ''}">${ic('down')} Money In</button><button data-dir="out" class="${dir === 'out' ? 'on' : ''}">${ic('up')} Money Out</button></div>
    <div class="list"><div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-amt placeholder="0"></div></div>
    <div class="sec-h">Kis cheez ka</div><div class="catgrid" data-cats></div>
    <div class="list" style="margin-top:12px"><button class="row" data-acc><span class="grow">Khata (account)</span><span class="v" data-an></span>${chev}</button>
      <button class="row" data-party hidden><span class="grow">Party</span><span class="v" data-pn>Chunein</span>${chev}</button>
      <button class="row" data-cash><span class="grow" data-cl>${dir === 'in' ? 'Kahan aaya' : 'Kahan se gaya'}</span><span class="v" data-cn>${esc(accName('1000'))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-note placeholder="Optional"></div></div>
    <p class="sec-f" data-help></p>`,
    onRight: async sh => {
      const amount = +$('[data-amt]', sh.el).value; if (!(amount > 0)) return hud('Amount likhein', 'err');
      if (!account) return hud('Khata chunein', 'err'); if (['1200', '2000'].includes(account) && !party) return hud('Party chunein', 'err');
      sh.setRight('Saving…', true);
      try { const r = await api('/api/money', { body: { dir, account, label: cat?.name || accName(account), amount, cash_account: cash, party_id: party?.id, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } });
        sh.close(); afterSubmit(r, x => { if (x) hud(`${dir === 'in' ? 'Money in' : 'Money out'} saved · ${x.no}`); }); } catch (x) { sh.setRight('Save'); fail(x); }
    } });
  const draw = () => {
    $('[data-cats]', s.el).innerHTML = CATS.filter(c => c.dir === dir).map(c => `<button data-cat="${esc(c.id)}" class="${cat?.id === c.id ? 'on' : ''}">${esc(c.name)}</button>`).join('') + '<button data-cat="">Koi aur khata…</button>';
    $('[data-an]', s.el).textContent = account ? accName(account) : 'Chunein';
    $('[data-party]', s.el).hidden = !['1200', '2000'].includes(account);
    $('[data-cl]', s.el).textContent = dir === 'in' ? 'Kahan aaya (cash / bank)' : 'Kahan se gaya (cash / bank)';
    const a = S.boot.accounts.find(x => x.code === account);
    $('[data-help]', s.el).textContent = a ? `Double entry: ${dir === 'in' ? `${accName(cash)} Dr · ${nice(a.name)} Cr` : `${nice(a.name)} Dr · ${accName(cash)} Cr`}. ${a.type === 'E' ? 'Yeh partner / owner ka capital khata hai.' : a.type === 'C' ? 'Yeh aamdani (income) mein jayega.' : a.type === 'D' ? 'Yeh kharche mein jayega.' : ''}` : '';
  };
  draw(); setTimeout(() => $('[data-amt]', s.el)?.focus(), 300);
  s.el.addEventListener('click', async e => {
    const d = e.target.closest('[data-dir]'); if (d) { dir = d.dataset.dir; $$('[data-dir]', s.el).forEach(x => x.classList.toggle('on', x === d)); $('.sheet-h .tt', s.el).textContent = dir === 'in' ? 'Money In' : 'Money Out'; cat = CATS.find(c => c.dir === dir); account = cat?.account; draw(); }
    const c = e.target.closest('[data-cat]'); if (c) { if (c.dataset.cat) { cat = CATS.find(x => x.id === c.dataset.cat); account = cat.account; draw(); } else { const r = await accPick('Khata chunein', a => a.grp !== 'Cash & Bank'); if (r) { cat = null; account = r.code; draw(); } } }
    if (e.target.closest('[data-acc]')) { const r = await accPick('Khata chunein', a => a.grp !== 'Cash & Bank'); if (r) { account = r.code; draw(); } }
    if (e.target.closest('[data-party]')) { const r = await partyPick(account === '1200' ? 'C' : 'V', 'Party'); if (r) { party = r; $('[data-pn]', s.el).textContent = nice(r.name); } }
    if (e.target.closest('[data-cash]')) { const r = await accPick('Cash / bank', a => a.grp === 'Cash & Bank'); if (r) { cash = r.code; $('[data-cn]', s.el).textContent = nice(r.name); draw(); } }
  });
}

/* ---------- fund transfer (contra) ---------- */
export function transferForm() {
  const C = cashAccs(); let from = '1000', to = (C.find(a => a.code !== '1000') || {}).code;
  const s = sheet({ title: 'Fund transfer', right: 'Save', body: `<div class="list"><div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-amt placeholder="0"></div>
      <button class="row" data-from><span class="grow">From (se)</span><span class="v" data-fn>${esc(accName(from))}</span>${chev}</button>
      <button class="row" data-to><span class="grow">To (mein)</span><span class="v" data-tn>${esc(accName(to))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div><div class="row"><label>Note</label><input class="fld" data-note placeholder="e.g. cash bank mein jama"></div></div>
    <p class="sec-f">Cash ko bank mein jama karna, bank se cash nikalna, ya ek bank se doosre mein — contra voucher (CTV) banta hai. Profit par asar nahi.</p>`,
    onRight: async sh => { const amount = +$('[data-amt]', sh.el).value; if (!(amount > 0)) return hud('Amount likhein', 'err'); if (!to || from === to) return hud('Do alag accounts chunein', 'err');
      sh.setRight('Saving…', true); try { const r = await api('/api/transfer', { body: { from, to, amount, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) hud('Transfer saved · ' + x.no); }); } catch (x) { sh.setRight('Save'); fail(x); } } });
  s.el.addEventListener('click', async e => {
    if (e.target.closest('[data-from]')) { const r = await accPick('From', a => a.grp === 'Cash & Bank'); if (r) { from = r.code; $('[data-fn]', s.el).textContent = nice(r.name); } }
    if (e.target.closest('[data-to]')) { const r = await accPick('To', a => a.grp === 'Cash & Bank'); if (r) { to = r.code; $('[data-tn]', s.el).textContent = nice(r.name); } }
  });
  setTimeout(() => $('[data-amt]', s.el)?.focus(), 300);
}

/* ---------- credit / debit note ---------- */
export function noteForm(pre = null) {
  let p = pre, kind = 'credit', account = '';
  const help = () => !p ? 'Pehle party chunein.' : p.kind === 'C' ? (kind === 'credit' ? 'Credit note: customer ka baqaya kam hoga (rate farq, discount, kharab maal).' : 'Debit note: customer ka baqaya barhega (extra charge).') : (kind === 'debit' ? 'Debit note: supplier ko dena kam hoga (discount, rate farq).' : 'Credit note: supplier ko dena barhega (extra charge).');
  const s = sheet({ title: 'Credit / debit note', right: 'Save', body: `<div class="list"><button class="row" data-p><span class="grow">Customer / supplier</span><span class="v" data-pn>${p ? esc(nice(p.name)) : 'Chunein'}</span>${chev}</button></div>
    <div class="seg" style="margin-top:12px" data-k><button data-kind="credit" class="on">Credit note</button><button data-kind="debit">Debit note</button></div>
    <div class="list"><div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-amt placeholder="0"></div>
      <button class="row" data-acc><span class="grow">Doosra khata</span><span class="v" data-an>Automatic</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div><div class="row"><label>Reason</label><input class="fld" data-note placeholder="e.g. rate difference"></div></div><p class="sec-f" data-h>${help()}</p>`,
    onRight: async sh => { if (!p) return hud('Party chunein', 'err'); const amount = +$('[data-amt]', sh.el).value; if (!(amount > 0)) return hud('Amount likhein', 'err');
      sh.setRight('Saving…', true); try { const r = await api('/api/notes', { body: { party_id: p.id, kind, amount, account, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) { hud('Note saved · ' + x.no); reloadBoot(); } }); } catch (x) { sh.setRight('Save'); fail(x); } } });
  s.el.addEventListener('click', async e => {
    if (e.target.closest('[data-p]')) { const r = await partyPick(null, 'Customer / supplier'); if (r) { p = r; $('[data-pn]', s.el).textContent = nice(r.name); $('[data-h]', s.el).textContent = help(); } }
    const k = e.target.closest('[data-kind]'); if (k) { kind = k.dataset.kind; $$('[data-kind]', s.el).forEach(x => x.classList.toggle('on', x === k)); $('[data-h]', s.el).textContent = help(); }
    if (e.target.closest('[data-acc]')) { const r = await accPick('Doosra khata', a => !['1200', '2000'].includes(a.code) && a.grp !== 'Cash & Bank'); if (r) { account = r.code; $('[data-an]', s.el).textContent = nice(r.name); } }
  });
}

/* ---------- categories editor (owner) ---------- */
export async function categoriesForm() {
  await loadCats().catch(fail); if (!CATS) return; let list = CATS.map(c => ({ ...c }));
  const s = sheet({ title: 'Transaction categories', right: 'Save', full: true, body: '<div data-l></div>',
    onRight: async sh => { try { CATS = await api('/api/money/categories', { method: 'PUT', body: { list } }); hud('Categories saved'); sh.close(); } catch (x) { fail(x); } } });
  const draw = () => { $('[data-l]', s.el).innerHTML = ['in', 'out'].map(d => `<div class="sec-h">${d === 'in' ? 'Money In' : 'Money Out'}</div><div class="list">${list.map((c, i) => c.dir !== d ? '' : `<div class="row"><span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc(accName(c.account))}</span></span><button class="chip" data-ed="${i}">Edit</button><button class="x" data-rm="${i}" aria-label="Remove">${ic('trash')}</button></div>`).join('')}
      <button class="row action" data-add="${d}">${ic('plus')}<span class="grow">Naya ${d === 'in' ? 'Money In' : 'Money Out'} khaana</span></button></div>`).join('') + '<p class="sec-f">Har khaana kisi account mein post hota hai. Jaise “Rent income” → Other income, “Ghar ka kharcha” → Drawings.</p>'; };
  draw();
  s.el.addEventListener('click', async e => {
    const rm = e.target.closest('[data-rm]'); if (rm) { list.splice(+rm.dataset.rm, 1); return draw(); }
    const ad = e.target.closest('[data-add]'), ed = e.target.closest('[data-ed]'); if (!ad && !ed) return;
    const c = ed ? list[+ed.dataset.ed] : { dir: ad.dataset.add };
    const name = await new Promise(res => { const x = sheet({ title: ed ? 'Edit' : 'Naya khaana', right: 'Next', body: `<div class="list"><div class="row"><label>Naam</label><input class="fld" data-n value="${esc(c.name || '')}" placeholder="e.g. Rent income"></div></div>`, onRight: sh => { const v = $('[data-n]', sh.el).value.trim(); if (!v) return hud('Naam likhein', 'err'); sh.close(v); }, onClose: v => res(v) }); setTimeout(() => $('[data-n]', x.el)?.focus(), 300); });
    if (!name) return; const a = await accPick('Kis account mein post ho', x => x.grp !== 'Cash & Bank'); if (!a) return;
    Object.assign(c, { name, account: a.code }); if (!ed) list.push(c); draw();
  });
}

/* =============================== VOUCHER VIEW + REVERSAL =============================== */
route(/^voucher\/(\d+)$/, async (v, id) => {
  const body = page(v, { title: 'Voucher', back: 'moneyreg', backLabel: 'Back' }); body.innerHTML = loading;
  const j = await api(`/api/journals/${id}`);
  $('.nav-title', v).textContent = j.no; $('h1.large', v).textContent = j.no;
  const dr = j.lines.reduce((a, l) => a + +l.debit, 0);
  const cols = [['account_name', 'Account', { fmt: (x, r) => `<b>${esc(nice(x))}</b><br><small class="l2">${esc(r.account)}${r.party ? ' · ' + esc(nice(r.party)) : ''}</small>` }], ['debit', 'Debit', { n: 1, fmt: money }], ['credit', 'Credit', { n: 1, fmt: money }]];
  body.innerHTML = `<div class="card vhead"><div><small>${esc(j.type)}</small><b class="num">${rs2(dr)}</b><span>${esc(fd(j.date))}${j.vkind ? ' · ' + esc(j.vkind.replace('_', ' ')) : ''}</span></div>
      ${j.reversed_by ? st('red', 'Reversed') : j.reverses ? st('orange', 'Reversal entry') : st('green', 'Posted')}</div>
    <p class="vmemo">${esc(j.memo || '')}</p>
    ${table(cols, j.lines, { debit: dr, credit: j.lines.reduce((a, l) => a + +l.credit, 0) })}
    <div class="racts2" style="margin-top:12px"><button class="chip" data-print>${ic('pdf')} PDF / Image</button>
      ${j.reverses ? `<button class="chip" data-go="voucher/${j.reverses}">Asal voucher dekhein</button>` : ''}${j.reversed_by ? `<button class="chip" data-go="voucher/${j.reversed_by}">Reversal dekhein</button>` : ''}
      ${j.ref_invoice ? `<button class="chip" data-go="bill/${j.ref_invoice}">Bill dekhein</button>` : ''}</div>
    ${can.boss() && !j.ref_invoice && !j.reversed_by && !j.reverses && !j.legacy ? `<div class="list" style="margin-top:16px"><button class="row danger" data-rev>${ic('return')}<span class="grow">Reverse karein (ulti entry)</span></button></div>
      <p class="sec-f">Reverse karne se asal voucher delete nahi hota — ek ulti entry (RVV) banti hai, dono record mein rehte hain. Yahi sahi accounting tareeka hai.</p>` : ''}`;
  body.onclick = async e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (e.target.closest('[data-print]')) printTable(`${j.type} · ${j.no}`, `${fd(j.date)} · ${j.memo || ''}`, cols, j.lines, { debit: dr, credit: dr });
    if (e.target.closest('[data-rev]')) {
      const reason = await new Promise(res => sheet({ title: 'Reverse ' + j.no, right: 'Reverse', body: `<div class="list"><div class="row"><label>Wajah</label><input class="fld" data-why placeholder="e.g. galat amount"></div><div class="row"><label>Date</label><input class="fld" type="date" data-d value="${today()}"></div></div>`,
        onRight: sh => sh.close({ reason: $('[data-why]', sh.el).value, date: $('[data-d]', sh.el).value }), onClose: res }));
      if (!reason) return;
      try { const r = await api(`/api/journals/${j.id}/reverse`, { body: reason }); hud('Reversed · ' + r.no); reloadBoot(); go(`voucher/${j.id}`); } catch (x) { fail(x); }
    }
  };
});

/* =============================== LOANS =============================== */
let LT = 'G', LB = 'all';
route(/^loans$/, async v => {
  const body = page(v, { title: 'Loans', back: 'finance', backLabel: 'Finance', sub: 'Jo qarz diya aur jo liya — qist, wapsi aur baqaya', right: `<button class="nbtn" data-new aria-label="New loan">${ic('plus')}</button>` });
  $('[data-new]', v).onclick = () => loanForm(LT);
  body.innerHTML = loading;
  const all = await api('/api/loans');
  const draw = () => {
    const L = all.filter(l => l.direction === LT && (LB === 'all' || l.book === LB));
    const act = L.filter(l => l.status === 'active'), out = act.reduce((a, l) => a + l.outstanding, 0), od = act.reduce((a, l) => a + l.overdue, 0);
    body.innerHTML = `<div class="seg"><button data-t="G" class="${LT === 'G' ? 'on' : ''}">Diye (given)</button><button data-t="T" class="${LT === 'T' ? 'on' : ''}">Liye (taken)</button></div>
      <div class="chips tabs" style="margin-top:10px">${[['all', 'Sab'], ['business', 'Business'], ['personal', 'Personal']].map(([k, l]) => `<button class="chip ${LB === k ? 'on' : ''}" data-b="${k}">${l}</button>`).join('')}</div>
      <div class="rsum"><div><small>${LT === 'G' ? 'Lena baqi' : 'Dena baqi'}</small><b>${rs(out)}</b></div><div><small>Overdue qist</small><b class="${od > 0 ? 'red' : ''}">${rs(od)}</b></div><div><small>Active loans</small><b>${act.length}</b></div></div>
      <div class="list">${L.map(l => `<button class="row with-avatar" data-go="loan/${l.id}"><span class="avatar">${esc(nice(l.person).slice(0, 2).toUpperCase())}</span><span class="grow"><span class="t">${esc(nice(l.person))} ${l.book === 'personal' ? st('gray', 'Personal') : ''}</span>
          <span class="s">${esc(l.no)} · ${l.status !== 'active' ? (l.status === 'closed' ? 'Closed ✓' : 'Written off') : l.overdue > 0 ? `<span class="red">${rs(l.overdue)} overdue</span>` : l.next ? `agli qist ${esc(fd(l.next.due))}` : ''}</span></span>
          <span class="v num"><b>${rs(l.outstanding)}</b></span>${chev}</button>`).join('') || `<div class="empty">${ic('wallet')}<div>Koi loan nahi. Upar <b>+</b> se naya loan likhein.</div></div>`}</div>
      <div class="racts2" style="margin-top:12px"><button class="chip" data-go="loanrec">${ic('chart')} Loan recovery report</button></div>`;
  };
  draw();
  body.onclick = e => { const t = e.target.closest('[data-t]'); if (t) { LT = t.dataset.t; return draw(); } const b2 = e.target.closest('[data-b]'); if (b2) { LB = b2.dataset.b; return draw(); } const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); };
});
export function loanForm(dir = 'G') {
  let book = 'business', cash = '1000', existing = '', opening = false;
  const s = sheet({ title: 'Naya loan', right: 'Save', full: true, body: `<div class="seg" data-d><button data-dir="G" class="${dir === 'G' ? 'on' : ''}">Qarz diya (given)</button><button data-dir="T" class="${dir === 'T' ? 'on' : ''}">Qarz liya (taken)</button></div>
    <div class="seg" style="margin-top:8px" data-bk><button data-book="business" class="on">Business</button><button data-book="personal">Personal (alag hisaab)</button></div>
    <div class="list"><div class="row"><label>Naam</label><input class="fld" data-f="person" placeholder="Kis ko / kis se"></div>
      <div class="row"><label>Phone</label><input class="fld" data-f="phone" inputmode="tel"></div><div class="row"><label>CNIC</label><input class="fld" data-f="cnic" placeholder="Optional"></div>
      <div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-f="principal" placeholder="0"></div>
      <div class="row"><label>Profit / interest % (saal)</label><input class="fld num" inputmode="decimal" data-f="interest_pct" placeholder="0"></div>
      <div class="row"><label>Qist (installments)</label><input class="fld num" inputmode="numeric" data-f="installments" value="1"></div>
      <div class="row"><label>Har qist</label><select class="fld" data-f="frequency"><option value="monthly">Mahana (monthly)</option><option value="weekly">Haftawar (weekly)</option><option value="once">Ek dafa</option></select></div>
      <div class="row"><label>Start date</label><input class="fld" type="date" data-f="start_date" value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-f="note" placeholder="Optional"></div></div>
    <div class="list" style="margin-top:12px" data-biz>
      <div class="row"><span class="grow">Pehle se diya / liya hua (purana loan)</span><input type="checkbox" class="toggle" data-open></div>
      <button class="row" data-cash><span class="grow">Paisa kahan se / kahan</span><span class="v" data-cn>${esc(accName('1000'))}</span>${chev}</button>
      <button class="row" data-ex><span class="grow">Purana ledger use karein</span><span class="v" data-en>Naya banega</span>${chev}</button></div>
    <p class="sec-f" data-h></p><div class="card" data-prev style="margin-top:10px"></div>`,
    onRight: async sh => {
      const b = { direction: dir, book, cash_account: cash, existing_account: existing || undefined, opening }; $$('[data-f]', sh.el).forEach(i => { b[i.dataset.f] = i.value; });
      if (!b.person.trim()) return hud('Naam likhein', 'err'); if (!(+b.principal > 0)) return hud('Amount likhein', 'err');
      sh.setRight('Saving…', true);
      try { const r = await api('/api/loans', { body: b }); sh.close(); await reloadBoot(); afterSubmit(r, x => { if (x) { hud(`Loan ${x.no} saved`); go(`loan/${x.id}`); } }); } catch (x) { sh.setRight('Save'); fail(x); }
    } });
  const help = () => { $('[data-biz]', s.el).hidden = book === 'personal'; $('[data-cash]', s.el).hidden = opening;
    $('[data-h]', s.el).textContent = book === 'personal' ? 'Personal loan sirf yahan record hota hai — business ke accounts, profit ya balance sheet mein nahi jata.' : opening ? 'Purana loan: sirf record banega, cash nahi hilega (balance pehle se khate mein hai ya opening ke taur par).' : dir === 'G' ? 'Paisa cash/bank se niklega aur is shakhs ka “loan diya” khata banega (asset).' : 'Paisa cash/bank mein aayega aur “loan liya” khata banega (liability).';
    const P = +$('[data-f="principal"]', s.el).value || 0, pct = +$('[data-f="interest_pct"]', s.el).value || 0, n = Math.max(+$('[data-f="installments"]', s.el).value || 1, 1), f = $('[data-f="frequency"]', s.el).value;
    const yrs = f === 'weekly' ? n / 52 : f === 'once' ? 1 / 12 : n / 12, total = P * (1 + pct / 100 * yrs);
    $('[data-prev]', s.el).innerHTML = P ? `<div class="kv"><span>Kul wapsi</span><b class="num">${rs2(total)}</b></div><div class="kv"><span>Profit / interest</span><b class="num">${rs2(total - P)}</b></div><div class="kv"><span>Har qist (${n})</span><b class="num">${rs2(total / n)}</b></div>` : '<span class="l2">Amount likhein — qist ka hisaab yahan dikhega</span>'; };
  help(); s.el.addEventListener('input', help);
  s.el.addEventListener('change', e => { if (e.target.dataset.open !== undefined) { opening = e.target.checked; help(); } });
  s.el.addEventListener('click', async e => {
    const d = e.target.closest('[data-dir]'); if (d) { dir = d.dataset.dir; $$('[data-dir]', s.el).forEach(x => x.classList.toggle('on', x === d)); help(); }
    const k = e.target.closest('[data-book]'); if (k) { book = k.dataset.book; $$('[data-book]', s.el).forEach(x => x.classList.toggle('on', x === k)); help(); }
    if (e.target.closest('[data-cash]')) { const r = await accPick('Cash / bank', a => a.grp === 'Cash & Bank'); if (r) { cash = r.code; $('[data-cn]', s.el).textContent = nice(r.name); } }
    if (e.target.closest('[data-ex]')) { const r = await accPick('Purana loan ledger', a => (dir === 'G' ? a.type === 'A' : a.type === 'B') && a.grp !== 'Cash & Bank' && !['1200', '2000', '1300'].includes(a.code)); if (r) { existing = r.code; $('[data-en]', s.el).textContent = nice(r.name); } }
  });
}
route(/^loan\/(\d+)$/, async (v, id) => {
  const body = page(v, { title: 'Loan', back: 'loans', backLabel: 'Loans' }); body.innerHTML = loading;
  const load = async () => {
    const d = await api(`/api/loans/${id}`), L = d.loan, P = d.plan, G = L.direction === 'G';
    $('.nav-title', v).textContent = nice(L.person); $('h1.large', v).textContent = nice(L.person);
    const sch = [['k', '#'], ['due', 'Due date', { fmt: x => fd(x) }], ['amount', 'Qist', { n: 1, fmt: x => n2(x) }], ['paid', 'Paid', { n: 1, fmt: money }], ['status', 'Status', { fmt: x => st({ paid: 'green', overdue: 'red', part: 'orange', due: 'gray' }[x], { paid: 'Paid', overdue: 'Overdue', part: 'Partly', due: 'Due' }[x]) }]];
    const led = [['date', 'Date', { fmt: x => fd(x) }], ['kind', 'Entry', { fmt: (x, r) => `${{ disburse: G ? 'Loan diya' : 'Loan liya', opening: 'Opening', repay: G ? 'Wapsi aayi' : 'Wapsi di', charge: 'Mazeed loan', writeoff: 'Write-off' }[x]}${r.interest > 0 ? `<br><small class="l2">principal ${n2(r.principal)} + profit ${n2(r.interest)}</small>` : ''}${r.voucher ? `<br><small class="l2">${esc(r.voucher)}</small>` : ''}` }], ['debit', 'Debit', { n: 1, fmt: money }], ['credit', 'Credit', { n: 1, fmt: money }], ['balance', 'Balance', { n: 1, fmt: x => n2(x), cls: 'b' }]];
    body.innerHTML = `<div class="card lhead"><div class="lh1"><small>${G ? 'Is se lena hai' : 'Is ko dena hai'}</small><b class="num">${rs2(d.outstanding)}</b>
        <span>${esc(L.no)} · ${L.book === 'personal' ? 'Personal (business se alag)' : 'Business'}${L.phone ? ' · ' + esc(L.phone) : ''}</span></div>
        <div class="lh2">${st(L.status === 'active' ? (P.overdue > 0 ? 'red' : 'green') : 'gray', L.status === 'active' ? (P.overdue > 0 ? 'Overdue' : 'Active') : L.status === 'closed' ? 'Closed' : 'Written off')}</div>
        <div class="lgrid"><div><small>Amount</small><b>${rs(P.lent)}</b></div><div><small>Profit ${+L.interest_pct}%</small><b>${rs(P.interest)}</b></div><div><small>Wapsi hui</small><b class="grn">${rs(P.repaid)}</b></div><div><small>Overdue</small><b class="${P.overdue > 0 ? 'red' : ''}">${rs(P.overdue)}</b></div></div>
        ${P.next ? `<div class="lnext">${ic('clock')} Agli qist <b>${rs2(P.next.amount - P.next.paid)}</b> · ${esc(fd(P.next.due))}</div>` : ''}</div>
      ${L.status === 'active' ? `<div class="btns b3" style="margin-top:12px"><button class="btn" data-x="repay">${ic(G ? 'down' : 'up')} ${G ? 'Wapsi li' : 'Wapsi di'}</button><button class="btn gray" data-x="charge">${ic('plus')} Aur loan</button><button class="btn gray" data-x="writeoff">Write-off</button></div>` : ''}
      <div class="sec-h">Ledger<button data-csv>Excel</button></div>${narrow() ? `<div class="list stk">${d.txns.map(t => `<div class="cbrow"><span class="l"><b>${{ disburse: G ? 'Loan diya' : 'Loan liya', opening: 'Opening', repay: G ? 'Wapsi aayi' : 'Wapsi di', charge: 'Mazeed loan', writeoff: 'Write-off' }[t.kind]}</b><small>${esc(fd(t.date))}${t.voucher ? ' · ' + esc(t.voucher) : ''}${t.interest > 0 ? ` · profit ${n2(t.interest)}` : ''}</small></span><span class="r"><b class="${t.debit ? '' : 'grn'}">${t.debit ? '+' + n2(t.debit) : '−' + n2(t.credit)}</b><small>bal ${n2(t.balance)}</small></span></div>`).join('')}</div>` : table(led, d.txns)}
      <div class="sec-h">Qist schedule (${L.installments} × ${L.frequency === 'weekly' ? 'weekly' : L.frequency === 'once' ? 'ek dafa' : 'monthly'})</div>${narrow() ? `<div class="list stk">${P.rows.map(r => `<div class="cbrow"><span class="l"><b>Qist ${r.k} · ${esc(fd(r.due))}</b><small>${r.paid ? 'paid ' + n2(r.paid) : 'abhi tak kuch nahi'}</small></span><span class="r"><b>${n2(r.amount)}</b><small>${sch[4][2].fmt(r.status)}</small></span></div>`).join('')}</div>` : table(sch, P.rows)}
      <div class="racts2" style="margin-top:12px"><button class="chip" data-print>${ic('pdf')} Statement PDF / Image</button>${L.account ? `<button class="chip" data-go="account/${L.account}">${ic('book')} Accounts ledger</button>` : ''}</div>
      ${L.note ? `<p class="sec-f">${esc(L.note)}</p>` : ''}`;
    body.onclick = async e => {
      const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
      if (e.target.closest('[data-csv]')) return exportCSV(`Loan-${L.no}`, led, d.txns);
      if (e.target.closest('[data-print]')) return printTable(`Loan statement · ${nice(L.person)}`, `${L.no} · ${G ? 'Loan given' : 'Loan taken'} · outstanding ${rs2(d.outstanding)}`, led, d.txns);
      const x = e.target.closest('[data-x]'); if (x) loanTxnForm(L, x.dataset.x, P, load);
    };
  };
  await load();
});
function loanTxnForm(L, kind, P, done) {
  let cash = '1000'; const G = L.direction === 'G';
  const title = { repay: G ? 'Wapsi li (repayment)' : 'Wapsi di (repayment)', charge: 'Mazeed loan', writeoff: 'Write-off' }[kind];
  const s = sheet({ title, right: 'Save', body: `<div class="list"><div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-amt value="${kind === 'repay' && P.next ? r2(P.next.amount - P.next.paid) : kind === 'writeoff' ? r2(P.remaining) : ''}"></div>
      ${kind !== 'writeoff' && L.book === 'business' ? `<button class="row" data-cash><span class="grow">${G === (kind === 'repay') ? 'Kahan aaya' : 'Kahan se gaya'}</span><span class="v" data-cn>${esc(accName('1000'))}</span>${chev}</button>` : ''}
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div><div class="row"><label>Note</label><input class="fld" data-note placeholder="Optional"></div></div>
    <p class="sec-f">${kind === 'repay' && +L.interest_pct > 0 ? 'Wapsi mein se profit/interest ka hissa khud alag hoga aur income/expense mein jayega.' : kind === 'writeoff' ? (G ? 'Write-off: yeh raqam wapas nahi aayegi — bad debts kharche mein jayegi aur loan band ho jayega.' : 'Write-off: yeh qarz maaf ho gaya — other income mein jayega.') : ''}</p>`,
    onRight: async sh => { const amount = +$('[data-amt]', sh.el).value; if (!(amount > 0)) return hud('Amount likhein', 'err');
      if (kind === 'writeoff' && !(await confirmBox(`${rs(amount)} write-off karein? Loan band ho jayega.`, 'Write-off', true))) return;
      sh.setRight('Saving…', true); try { const r = await api(`/api/loans/${L.id}/txn`, { body: { kind, amount, cash_account: cash, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) { hud(x.closed ? 'Loan poora wapas — closed ✓' : 'Saved'); done(); } }); } catch (x) { sh.setRight('Save'); fail(x); } } });
  s.el.addEventListener('click', async e => { if (e.target.closest('[data-cash]')) { const r = await accPick('Cash / bank', a => a.grp === 'Cash & Bank'); if (r) { cash = r.code; $('[data-cn]', s.el).textContent = nice(r.name); } } });
}
const r2 = x => Math.round(x * 100) / 100;
const narrow = () => innerWidth < 700;

/* =============================== BANK RECONCILIATION =============================== */
let BA = null, BSHOW = 'open';
route(/^bankrec$/, async v => {
  const banks = cashAccs().filter(a => a.code !== '1000'); if (!BA) BA = (banks[0] || cashAccs()[0] || {}).code;
  const body = page(v, { title: 'Bank reconciliation', back: 'finance', backLabel: 'Finance', sub: 'Bank statement se apni entries milayein' });
  let to = today(), picked = new Set();
  const load = async () => {
    body.innerHTML = loading; picked = new Set();
    const d = await api(`/api/bank-rec?account=${encodeURIComponent(BA)}&to=${to}`);
    const rows = d.lines.filter(l => (BSHOW === 'open' ? !l.cleared_on : !!l.cleared_on));
    body.innerHTML = `<div class="chips tabs">${banks.map(a => `<button class="chip ${BA === a.code ? 'on' : ''}" data-acc="${a.code}">${esc(nice(a.name))}</button>`).join('')}</div>
      <div class="list"><div class="row"><label>As on</label><input class="fld" type="date" data-to value="${to}"></div>
        <div class="row"><label>Bank statement balance</label><input class="fld num" inputmode="decimal" data-sb value="${d.statement ? d.statement.balance : ''}" placeholder="Statement ka closing"></div></div>
      <div class="rsum"><div><small>Books balance</small><b>${rs2(d.book)}</b></div><div><small>Cleared (bank mein)</small><b>${rs2(d.cleared)}</b></div>
        <div><small>Pending: in / out</small><b><span class="grn">${short(d.pendIn)}</span> / <span class="red">${short(d.pendOut)}</span></b></div><div><small>Statement − cleared</small><b class="${d.difference ? 'red' : 'grn'}">${d.difference === null ? '—' : d.difference ? rs2(d.difference) : 'Matched ✓'}</b></div></div>
      <div class="seg" style="margin-top:12px"><button data-sh="open" class="${BSHOW === 'open' ? 'on' : ''}">Pending (${d.lines.filter(l => !l.cleared_on).length})</button><button data-sh="done" class="${BSHOW === 'done' ? 'on' : ''}">Cleared</button></div>
      <div class="list brec">${rows.slice(0, 400).map(l => `<label class="row"><input type="checkbox" data-id="${l.id}"><span class="grow"><span class="t">${esc(l.memo || l.type)}</span><span class="s">${esc(fd(l.date))} · ${esc(l.no)}${l.cleared_on ? ' · cleared ' + esc(fd(l.cleared_on)) : ''}</span></span><span class="v num ${+l.debit ? 'grn' : 'red'}">${+l.debit ? '+' + n2(l.debit) : '−' + n2(l.credit)}</span></label>`).join('') || '<div class="empty">Kuch nahi</div>'}</div>
      <div class="brbar" data-bar hidden><span data-n></span>${BSHOW === 'open' ? `<input type="date" data-on value="${to}"><button class="btn" data-clear>Cleared mark karein</button>` : '<button class="btn gray" data-unclear>Wapas pending</button>'}</div>
      <p class="sec-f">Statement ki har entry jo aap ki books mein bhi hai, us par tick karein aur “Cleared” karein. Farq zero ho jaye to hisaab mil gaya.</p>`;
    const bar = () => { $('[data-bar]', body).hidden = !picked.size; const n = $('[data-n]', body); if (n) n.textContent = `${picked.size} chuni`; };
    body.onchange = async e => {
      if (e.target.dataset.id) { e.target.checked ? picked.add(+e.target.dataset.id) : picked.delete(+e.target.dataset.id); bar(); }
      if (e.target.dataset.to !== undefined) { to = e.target.value; load(); }
      if (e.target.dataset.sb !== undefined && e.target.value !== '') { try { await api('/api/bank-rec/statement', { body: { account: BA, as_on: to, balance: +e.target.value } }); hud('Statement balance saved'); load(); } catch (x) { fail(x); } }
    };
    body.onclick = async e => {
      const a = e.target.closest('[data-acc]'); if (a) { BA = a.dataset.acc; return load(); }
      const sh = e.target.closest('[data-sh]'); if (sh) { BSHOW = sh.dataset.sh; return load(); }
      if (e.target.closest('[data-clear]') || e.target.closest('[data-unclear]')) { const clear = !!e.target.closest('[data-clear]');
        try { await api('/api/bank-rec/clear', { body: { ids: [...picked], on: $('[data-on]', body)?.value || to, clear } }); hud(clear ? 'Cleared' : 'Pending'); load(); } catch (x) { fail(x); } }
    };
  };
  if (!BA) { body.innerHTML = '<div class="empty">Koi bank account nahi. Ledgers → Cash & Bank se banayein.</div>'; return; }
  await load();
});

/* =============================== FIXED ASSETS =============================== */
route(/^assets$/, async v => {
  const body = page(v, { title: 'Fixed assets', back: 'finance', backLabel: 'Finance', sub: 'Gaari, machine, furniture — kharid, depreciation aur book value', right: `<button class="nbtn" data-new aria-label="New asset">${ic('plus')}</button>` });
  const load = async () => {
    body.innerHTML = loading; const A = await api('/api/assets');
    const live = A.filter(a => !a.disposed_on), tc = live.reduce((s, a) => s + a.cost, 0), td = live.reduce((s, a) => s + a.dep, 0);
    const cols = [['name', 'Asset', { fmt: (x, r) => `<b>${esc(nice(x))}</b><br><small class="l2">${esc(nice(r.account_name || ''))} · from ${esc(fd(r.start_date))}${r.disposed_on ? ' · sold ' + esc(fd(r.disposed_on)) : ''}</small>` }], ['cost', 'Cost', { n: 1, fmt: x => n2(x) }], ['monthly', 'Per month', { n: 1, fmt: x => n2(x) }], ['dep', 'Depreciated', { n: 1, fmt: money }], ['book', 'Book value', { n: 1, fmt: x => n2(x), cls: 'b' }]];
    body.innerHTML = `<div class="rsum"><div><small>Cost</small><b>${rs(tc)}</b></div><div><small>Depreciation</small><b>${rs(td)}</b></div><div><small>Book value</small><b>${rs(tc - td)}</b></div><div><small>Assets</small><b>${live.length}</b></div></div>
      <div class="list" style="margin-top:12px"><div class="row"><label>Depreciation up to</label><input class="fld" type="month" data-m value="${ym()}"></div><button class="row action" data-run>${ic('chart')}<span class="grow">Depreciation post karein</span></button></div>
      <div class="racts2" style="margin:12px 0">${actions()}</div>${A.length ? table(cols, A, null, r => `data-a="${r.id}"`) : `<div class="empty">${ic('cube')}<div>Koi asset nahi. Upar <b>+</b> se add karein.</div></div>`}
      <p class="sec-f">Straight-line: (cost − bachi qeemat) ÷ mahine. Har mahine “Depreciation expense” Dr, “Accumulated depreciation” Cr. Asset row tap karein to bechne / hatane ka option.</p>`;
    body.onclick = async e => {
      if (e.target.closest('[data-csv]')) return exportCSV('Fixed-assets', cols, A);
      if (e.target.closest('[data-print]')) return printTable('Fixed asset register', 'As on ' + fd(today()), cols, A);
      if (e.target.closest('[data-run]')) { const m = $('[data-m]', body).value; try { const r = await api('/api/assets/depreciate', { body: { upto: m } }); hud(`Depreciation ${rs(r.total)} posted (${r.months.length} mahine)`); load(); } catch (x) { fail(x); } }
      const tr = e.target.closest('[data-a]'); if (tr && can.boss()) { const a = A.find(x => x.id === +tr.dataset.a); if (a.disposed_on) return;
        const c = await actionSheet(nice(a.name), [{ label: 'Bech diya / hata diya (dispose)', value: 'd', danger: true }]); if (c !== 'd') return;
        const r = await new Promise(res => sheet({ title: 'Dispose ' + nice(a.name), right: 'Save', body: `<div class="list"><div class="row"><label>Kitne mein becha</label><input class="fld num" inputmode="decimal" data-p placeholder="0 agar zaya hua"></div><div class="row"><label>Date</label><input class="fld" type="date" data-d value="${today()}"></div></div><p class="sec-f">Book value ${rs2(a.book)}. Farq gain/loss mein jayega.</p>`, onRight: sh => sh.close({ amount: +$('[data-p]', sh.el).value || 0, date: $('[data-d]', sh.el).value }), onClose: res }));
        if (r) { try { const x = await api(`/api/assets/${a.id}/dispose`, { body: r }); hud(`Disposed · ${x.voucher}`); load(); } catch (y) { fail(y); } } }
    };
  };
  $('[data-new]', v).onclick = () => assetForm(load);
  await load();
});
function assetForm(done) {
  let account = '', pay = 'cash', payAcc = '1000', party = null;
  const s = sheet({ title: 'Naya fixed asset', right: 'Save', full: true, body: `<div class="list"><div class="row"><label>Naam</label><input class="fld" data-f="name" placeholder="e.g. Suzuki pickup LEA-123"></div>
      <button class="row" data-acc><span class="grow">Asset khata</span><span class="v" data-an>Naya (category se)</span>${chev}</button>
      <div class="row"><label>Category</label><input class="fld" data-f="category" placeholder="Vehicles, Machinery, Furniture"></div>
      <div class="row"><label>Cost</label><input class="fld num big" inputmode="decimal" data-f="cost" placeholder="0"></div>
      <div class="row"><label>Bachi qeemat (salvage)</label><input class="fld num" inputmode="decimal" data-f="salvage" placeholder="0"></div>
      <div class="row"><label>Life (mahine)</label><input class="fld num" inputmode="numeric" data-f="life_months" value="60"></div>
      <div class="row"><label>Kharid date</label><input class="fld" type="date" data-f="start_date" value="${today()}"></div></div>
    <div class="sec-h">Payment</div><div class="seg" data-pay>${[['cash', 'Cash / bank'], ['credit', 'Udhaar (supplier)'], ['existing', 'Pehle se books mein']].map(([k, l]) => `<button data-p="${k}" class="${pay === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="list" data-pl><button class="row" data-pa><span class="grow" data-pt>Kahan se</span><span class="v" data-pn>${esc(accName('1000'))}</span>${chev}</button></div>
    <p class="sec-f">“Pehle se books mein” = asset ka paisa pehle hi khate mein hai, sirf register aur depreciation shuru karna hai.</p>`,
    onRight: async sh => { const b = { account, pay, pay_account: payAcc, party_id: party?.id }; $$('[data-f]', sh.el).forEach(i => { b[i.dataset.f] = i.value; });
      if (!b.name.trim() || !(+b.cost > 0)) return hud('Naam aur cost likhein', 'err'); if (pay === 'credit' && !party) return hud('Supplier chunein', 'err');
      sh.setRight('Saving…', true); try { const r = await api('/api/assets', { body: b }); sh.close(); await reloadBoot(); afterSubmit(r, x => { if (x) { hud('Asset saved'); done(); } }); } catch (x) { sh.setRight('Save'); fail(x); } } });
  const upd = () => { $('[data-pl]', s.el).hidden = pay === 'existing'; $('[data-pt]', s.el).textContent = pay === 'credit' ? 'Supplier' : 'Kahan se (cash / bank)'; $('[data-pn]', s.el).textContent = pay === 'credit' ? (party ? nice(party.name) : 'Chunein') : accName(payAcc); };
  s.el.addEventListener('click', async e => {
    const p = e.target.closest('[data-p]'); if (p) { pay = p.dataset.p; $$('[data-p]', s.el).forEach(x => x.classList.toggle('on', x === p)); upd(); }
    if (e.target.closest('[data-acc]')) { const r = await accPick('Asset khata', a => a.grp === 'Fixed Assets' && !/ACCUMULATED/i.test(a.name)); if (r) { account = r.code; $('[data-an]', s.el).textContent = nice(r.name); } }
    if (e.target.closest('[data-pa]')) { if (pay === 'credit') { const r = await partyPick('V', 'Supplier'); if (r) party = r; } else { const r = await accPick('Cash / bank', a => a.grp === 'Cash & Bank'); if (r) payAcc = r.code; } upd(); }
  });
}

/* =============================== PAYROLL =============================== */
route(/^payroll$/, async v => {
  const body = page(v, { title: 'Payroll', back: 'finance', backLabel: 'Finance', sub: 'Staff, mahana salary, advance aur payment', right: `<button class="nbtn" data-new aria-label="New employee">${ic('plus')}</button>` });
  const load = async () => {
    body.innerHTML = loading; const [E, R] = await Promise.all([api('/api/employees'), api('/api/payroll/runs')]);
    const act = E.filter(e => e.active), due = act.reduce((s, e) => s + +e.due, 0), monthly = act.reduce((s, e) => s + +e.salary, 0);
    body.innerHTML = `<div class="rsum"><div><small>Staff</small><b>${act.length}</b></div><div><small>Mahana salary</small><b>${rs(monthly)}</b></div><div><small>Dena baqi (net)</small><b class="${due > 0 ? 'orange' : ''}">${rs(due)}</b></div></div>
      <div class="btns" style="margin-top:12px"><button class="btn" data-run>${ic('receipt')} Salary post karein (mahina)</button><button class="btn gray" data-pay>${ic('up')} Salary / advance dein</button></div>
      <div class="sec-h">Employees</div><div class="list">${E.map(e => `<button class="row with-avatar" data-go="employee/${e.id}"><span class="avatar">${esc(nice(e.name).slice(0, 2).toUpperCase())}</span><span class="grow"><span class="t">${esc(nice(e.name))}${e.active ? '' : ' ' + st('gray', 'Inactive')}</span><span class="s">${esc(e.designation || 'Staff')} · ${rs(e.salary)}/mahina</span></span>
        <span class="v num ${+e.due > 0 ? 'orange' : +e.due < 0 ? 'grn' : ''}">${+e.due > 0 ? rs(e.due) + '<br><small class="l2">dena hai</small>' : +e.due < 0 ? rs(-e.due) + '<br><small class="l2">advance</small>' : 'Clear'}</span>${chev}</button>`).join('') || `<div class="empty">${ic('person')}<div>Koi employee nahi. Upar <b>+</b> se add karein.</div></div>`}</div>
      ${R.length ? `<div class="sec-h">Salary runs</div><div class="list">${R.map(r => `<button class="row" data-go="voucher/${r.journal_id}"><span class="grow"><span class="t">${esc(new Date(r.month).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</span><span class="s">${esc(r.voucher || '')} · ${r.lines.length} staff</span></span><span class="v num">${rs(r.total)}</span>${chev}</button>`).join('')}</div>` : ''}`;
    body.onclick = e => { const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go); if (e.target.closest('[data-run]')) runPayroll(act, load); if (e.target.closest('[data-pay]')) payForm(act, null, load); };
  };
  $('[data-new]', v).onclick = () => employeeForm(null, load);
  await load();
});
function employeeForm(e, done) {
  let account = e?.account || '';
  const s = sheet({ title: e ? 'Employee' : 'Naya employee', right: 'Save', body: `<div class="list"><div class="row"><label>Naam</label><input class="fld" data-f="name" value="${esc(e?.name || '')}"></div>
      <div class="row"><label>Designation</label><input class="fld" data-f="designation" value="${esc(e?.designation || '')}" placeholder="Driver, salesman, helper"></div>
      <div class="row"><label>Mahana salary</label><input class="fld num" inputmode="decimal" data-f="salary" value="${val(e?.salary)}"></div>
      <div class="row"><label>Phone</label><input class="fld" data-f="phone" value="${esc(e?.phone || '')}" inputmode="tel"></div><div class="row"><label>CNIC</label><input class="fld" data-f="cnic" value="${esc(e?.cnic || '')}"></div>
      <div class="row"><label>Joining date</label><input class="fld" type="date" data-f="join_date" value="${esc(e?.join_date || '')}"></div>
      <button class="row" data-acc><span class="grow">Salary kharcha khata</span><span class="v" data-an>${account ? esc(accName(account)) : 'Naya banega'}</span>${chev}</button>
      ${e ? `<div class="row"><span class="grow">Active</span><input type="checkbox" class="toggle" data-act ${e.active ? 'checked' : ''}></div>` : ''}</div>
    <p class="sec-f">Har employee ka apna “Salary payable” khata banta hai: salary post ho to dena barhta hai, payment / advance se kam hota hai.</p>`,
    onRight: async sh => { const b = { account }; $$('[data-f]', sh.el).forEach(i => { b[i.dataset.f] = i.value; }); if (e) b.active = $('[data-act]', sh.el).checked;
      if (!b.name.trim()) return hud('Naam likhein', 'err');
      try { await api(e ? `/api/employees/${e.id}` : '/api/employees', { method: e ? 'PUT' : 'POST', body: b }); await reloadBoot(); hud('Saved'); sh.close(); done && done(); } catch (x) { fail(x); } } });
  s.el.addEventListener('click', async ev => { if (ev.target.closest('[data-acc]')) { const r = await accPick('Salary kharcha khata', a => a.type === 'D'); if (r) { account = r.code; $('[data-an]', s.el).textContent = nice(r.name); } } });
}
function runPayroll(E, done) {
  const s = sheet({ title: 'Salary post karein', right: 'Post', full: true, body: `<div class="list"><div class="row"><label>Mahina</label><input class="fld" type="month" data-m value="${ym()}"></div></div>
    <div class="sec-h">Is mahine ki salary (badal sakte hain)</div><div class="list">${E.map(e => `<div class="row"><span class="grow"><span class="t">${esc(nice(e.name))}</span><span class="s">${esc(e.designation || '')}</span></span><input class="fld num" style="max-width:130px" inputmode="decimal" data-e="${e.id}" value="${val(e.salary)}"></div>`).join('') || '<div class="empty">Pehle employees add karein</div>'}</div>
    <p class="sec-f" data-tot></p><p class="sec-f">Salary kharche mein jayegi aur har shakhs ka “dena hai” barhega. Payment baad mein “Salary / advance dein” se.</p>`,
    onRight: async sh => { const lines = $$('[data-e]', sh.el).map(i => ({ employee_id: +i.dataset.e, amount: +i.value || 0 }));
      sh.setRight('Posting…', true); try { const r = await api('/api/payroll/run', { body: { month: $('[data-m]', sh.el).value, lines } }); sh.close(); afterSubmit(r, x => { if (x) { hud('Salary posted · ' + x.no); done(); } }); } catch (x) { sh.setRight('Post'); fail(x); } } });
  const tot = () => { $('[data-tot]', s.el).innerHTML = `Kul: <b>${rs($$('[data-e]', s.el).reduce((a, i) => a + (+i.value || 0), 0))}</b>`; }; tot(); s.el.addEventListener('input', tot);
}
function payForm(E, emp, done) {
  let e = emp, cash = '1000', kind = 'salary';
  const s = sheet({ title: 'Salary / advance dein', right: 'Save', body: `<div class="list"><button class="row" data-emp><span class="grow">Employee</span><span class="v" data-en>${e ? esc(nice(e.name)) : 'Chunein'}</span>${chev}</button></div>
    <div class="seg" style="margin-top:12px"><button data-k="salary" class="on">Salary payment</button><button data-k="advance">Advance</button></div>
    <div class="list"><div class="row"><label>Amount</label><input class="fld num big" inputmode="decimal" data-amt value="${e && +e.due > 0 ? val(e.due) : ''}"></div>
      <button class="row" data-cash><span class="grow">Kahan se</span><span class="v" data-cn>${esc(accName('1000'))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div><div class="row"><label>Note</label><input class="fld" data-note placeholder="Optional"></div></div>`,
    onRight: async sh => { if (!e) return hud('Employee chunein', 'err'); const amount = +$('[data-amt]', sh.el).value; if (!(amount > 0)) return hud('Amount likhein', 'err');
      sh.setRight('Saving…', true); try { const r = await api('/api/payroll/pay', { body: { employee_id: e.id, amount, account: cash, kind, date: $('[data-date]', sh.el).value, note: $('[data-note]', sh.el).value } }); sh.close(); afterSubmit(r, x => { if (x) { hud('Saved · ' + x.no); done(); } }); } catch (x) { sh.setRight('Save'); fail(x); } } });
  s.el.addEventListener('click', async ev => {
    const k = ev.target.closest('[data-k]'); if (k) { kind = k.dataset.k; $$('[data-k]', s.el).forEach(x => x.classList.toggle('on', x === k)); }
    if (ev.target.closest('[data-emp]')) { const r = await picker({ title: 'Employee', items: E.map(x => ({ ...x, search: x.name })), render: x => `<span class="grow"><span class="t">${esc(nice(x.name))}</span><span class="s">${esc(x.designation || '')}</span></span><span class="v num">${rs(x.due)}</span>` }); if (r) { e = r; $('[data-en]', s.el).textContent = nice(r.name); if (+r.due > 0) $('[data-amt]', s.el).value = r.due; } }
    if (ev.target.closest('[data-cash]')) { const r = await accPick('Cash / bank', a => a.grp === 'Cash & Bank'); if (r) { cash = r.code; $('[data-cn]', s.el).textContent = nice(r.name); } }
  });
}
route(/^employee\/(\d+)$/, async (v, id) => {
  const body = page(v, { title: 'Employee', back: 'payroll', backLabel: 'Payroll' }); body.innerHTML = loading;
  const load = async () => {
    const E = await api('/api/employees'), e = E.find(x => x.id === +id); if (!e) { body.innerHTML = '<div class="empty">Not found</div>'; return; }
    $('.nav-title', v).textContent = nice(e.name); $('h1.large', v).textContent = nice(e.name);
    const { ledgerTable } = await import('./ledgers.js');
    const from = today().slice(0, 4) - 1 + today().slice(4, 10);
    const d = await api(`/api/reports/account-ledger?account=${e.payable}&from=${from}&to=${today()}`);
    body.innerHTML = `<div class="card lhead"><div class="lh1"><small>${+e.due >= 0 ? 'Is ko dena hai' : 'Advance diya hua'}</small><b class="num">${rs2(Math.abs(+e.due))}</b><span>${esc(e.designation || 'Staff')} · ${rs(e.salary)}/mahina${e.phone ? ' · ' + esc(e.phone) : ''}</span></div></div>
      <div class="btns" style="margin-top:12px"><button class="btn" data-pay>${ic('up')} Salary / advance dein</button><button class="btn gray" data-edit>${ic('pencil')} Edit</button></div>
      <div class="sec-h">Salary ledger (pichle 12 mahine)</div>${ledgerTable({ ...d, from, to: today() }, { flip: true })}
      <div class="racts2" style="margin-top:12px"><button class="chip" data-go="account/${e.payable}">${ic('book')} Poora ledger</button>${e.account ? `<button class="chip" data-go="account/${e.account}">Salary kharcha khata</button>` : ''}</div>`;
    body.onclick = ev => { const g = ev.target.closest('[data-go]'); if (g) return go(g.dataset.go); if (ev.target.closest('[data-pay]')) payForm(E, e, load); if (ev.target.closest('[data-edit]')) employeeForm(e, load); };
  };
  await load();
});

/* =============================== REPORTS =============================== */
let GF = null, GACC = '';
route(/^gl$/, async v => {
  if (!GF) GF = initF({}, 'month'); const F = GF;
  const body = page(v, { title: 'General ledger', back: 'reports', backLabel: 'Reports', sub: 'Har account ki har entry — opening, debit, credit, balance' });
  body.innerHTML = `<div data-f>${filterBar(F, { search: false })}</div><div class="list" style="margin-bottom:10px"><button class="row" data-acc><span class="grow">Account</span><span class="v" data-an>${GACC ? esc(accName(GACC)) : 'Sab accounts'}</span>${chev}</button></div><div data-out>${loading}</div>`;
  let d;
  const cols = [['date', 'Date', { fmt: x => fd(x) }], ['no', 'Voucher'], ['memo', 'Particulars', { fmt: (x, r) => esc(nice(r.party ? r.party + ' · ' : '') + (x || r.type)).slice(0, 90) }], ['debit', 'Debit', { n: 1, fmt: money }], ['credit', 'Credit', { n: 1, fmt: money }], ['balance', 'Balance', { n: 1, fmt: x => n2(x), cls: 'b' }]];
  const load = async () => {
    const out = $('[data-out]', body); out.style.opacity = .5;
    d = await api(`/api/reports/general-ledger?from=${F.from}&to=${F.to}${GACC ? '&account=' + GACC : ''}`); out.style.opacity = 1;
    out.innerHTML = `${actions()}<p class="sec-f">${d.accounts.length} accounts · ${rng(F)}</p>${d.accounts.map(a => `<details class="glacc" ${d.accounts.length <= 3 ? 'open' : ''}><summary><span class="grow"><b>${esc(nice(a.name))}</b><small>${esc(a.code)} · ${esc(a.grp || '')}</small></span><span class="num">Op ${n2(a.opening)}<br><b>Cl ${n2(a.closing)}</b></span></summary>
      ${table(cols, [{ date: F.from, no: '', memo: 'Opening balance', debit: 0, credit: 0, balance: a.opening }, ...a.lines], { debit: a.debit, credit: a.credit, balance: a.closing }, r => (r.ref_invoice ? `data-go="bill/${r.ref_invoice}"` : r.id ? `data-go="voucher/${r.id}"` : ''))}</details>`).join('') || '<div class="empty">Is dauran koi entry nahi</div>'}`;
  };
  const flat = () => d.accounts.flatMap(a => [{ date: F.from, no: a.code, memo: `${a.name} — opening`, debit: 0, credit: 0, balance: a.opening }, ...a.lines]);
  wireFilters(body, F, null, () => load().catch(fail));
  body.addEventListener('click', async e => {
    if (e.target.closest('[data-acc]')) { const r = await picker({ title: 'Account', items: [{ code: '', name: 'Sab accounts', grp: '', search: 'all sab' }, ...S.boot.accounts.map(a => ({ ...a, search: a.name + ' ' + a.code }))], render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(a.code)}</span></span>` }); if (r) { GACC = r.code; $('[data-an]', body).textContent = r.code ? nice(r.name) : 'Sab accounts'; load().catch(fail); } }
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (!d) return;
    if (e.target.closest('[data-csv]')) exportCSV('General-ledger', cols, flat());
    if (e.target.closest('[data-print]')) printTable('General ledger', rng(F), cols, flat());
  });
  await load();
});
let EF = null;
route(/^expenses$/, async v => {
  if (!EF) EF = initF({}, 'year'); const F = EF;
  const body = page(v, { title: 'Expense report', back: 'reports', backLabel: 'Reports', sub: 'Kharcha head-wise aur mahine-wise' });
  body.innerHTML = `<div data-f>${filterBar(F, { search: false })}</div><div data-out>${loading}</div>`;
  let d, cols;
  const load = async () => {
    d = await api(`/api/reports/expenses?from=${F.from}&to=${F.to}`);
    const mn = m => new Date(m + '-01T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    cols = [['name', 'Expense head', { fmt: (x, r) => `<b>${esc(nice(x))}</b><br><small class="l2">${esc(r.grp || '')}</small>` }], ...d.months.map(m => [m, mn(m), { n: 1, fmt: money }]), ['total', 'Total', { n: 1, fmt: x => n2(x), cls: 'b' }], ['pct', '%', { n: 1, fmt: x => x + '%' }]];
    const rows = d.heads.map(h => ({ ...h, ...h.by, pct: d.total ? Math.round(h.total / d.total * 1000) / 10 : 0 }));
    const tot = { total: d.total, ...Object.fromEntries(d.months.map(m => [m, rows.reduce((s, r) => s + (r[m] || 0), 0)])) };
    d.rows = rows; d.tot = tot;
    $('[data-out]', body).innerHTML = `<div class="rsum"><div><small>Kul kharcha</small><b>${rs(d.total)}</b></div><div><small>Sab se bara</small><b>${esc(nice(rows[0]?.name || '—'))}</b></div><div><small>Heads</small><b>${rows.length}</b></div></div>
      ${actions()}${table(cols, rows, tot, r => `data-go="account/${r.code}"`)}<p class="sec-f">Cost of goods sold bhi kharche (D) mein shamil hai. Head par tap karein to us ka ledger khulega.</p>`;
  };
  wireFilters(body, F, null, () => load().catch(fail));
  body.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go); if (!d) return;
    if (e.target.closest('[data-csv]')) exportCSV('Expense-report', cols, d.rows, d.tot); if (e.target.closest('[data-print]')) printTable('Expense report', rng(F), cols, d.rows, d.tot); });
  await load();
});
route(/^loanrec$/, async v => {
  const body = page(v, { title: 'Loan recovery', back: 'loans', backLabel: 'Loans', sub: 'Kis se kitna lena hai, kitna overdue, agli qist kab' }); body.innerHTML = loading;
  const d = await api('/api/reports/loan-recovery');
  const cols = [['person', 'Person', { fmt: (x, r) => `<b>${esc(nice(x))}</b><br><small class="l2">${esc(r.no)} · ${r.book}</small>` }], ['lent', 'Amount', { n: 1, fmt: x => n2(x) }], ['repaid', 'Repaid', { n: 1, fmt: money }], ['outstanding', 'Outstanding', { n: 1, fmt: x => n2(x), cls: 'b' }], ['overdue', 'Overdue', { n: 1, fmt: money, cls: r => (r.overdue > 0 ? 'red' : '') }], ['next', 'Next due', { fmt: x => (x ? fd(x.due) : '—') }]];
  const sec = (t, rows) => `<div class="sec-h">${t}</div>${rows.length ? table(cols, rows, { lent: rows.reduce((s, r) => s + r.lent, 0), repaid: rows.reduce((s, r) => s + r.repaid, 0), outstanding: rows.reduce((s, r) => s + r.outstanding, 0), overdue: rows.reduce((s, r) => s + r.overdue, 0) }, r => `data-go="loan/${r.id}"`) : '<div class="empty">Koi active loan nahi</div>'}`;
  body.innerHTML = `<div class="rsum"><div><small>Lena (given)</small><b>${rs(d.totals.given)}</b></div><div><small>Overdue</small><b class="${d.totals.overdue ? 'red' : ''}">${rs(d.totals.overdue)}</b></div><div><small>Dena (taken)</small><b>${rs(d.totals.taken)}</b></div></div>${actions()}${sec('Diye hue loans (recovery)', d.given)}${sec('Liye hue loans (wapsi)', d.taken)}`;
  body.onclick = e => { const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go); const all = [...d.given, ...d.taken];
    if (e.target.closest('[data-csv]')) exportCSV('Loan-recovery', cols, all); if (e.target.closest('[data-print]')) printTable('Loan recovery', 'As on ' + fd(today()), cols, all); };
});

/* =============================== DASHBOARD: recent records + low stock =============================== */
const KIND_ICON = { sale: ['receipt', 'var(--tint)'], purchase: ['cart', 'var(--indigo)'], sale_return: ['return', 'var(--purple)'], purchase_return: ['return', 'var(--pink)'], voucher: ['book', 'var(--teal)'] };
export async function fillRecent(el) {
  if (!el) return;
  const low = S.boot.products.filter(p => +p.stock <= 0 || (+p.reorder > 0 && +p.stock <= +p.reorder)).sort((a, b) => a.stock - b.stock).slice(0, 6);
  let R = []; try { R = await api('/api/recent'); } catch {}
  el.innerHTML = `${low.length ? `<div class="sec-h">Stock alert<button data-go="stock">Stock report</button></div><div class="list">${low.map(p => `<button class="row" data-go="product/${p.id}"><span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${+p.reorder > 0 ? 'reorder at ' + +p.reorder + ' · ' : ''}${esc(p.category || '')}</span></span><span class="v num ${+p.stock < 0 ? 'red' : 'orange'}"><b>${+p.stock}</b> ${esc(p.unit)}</span>${chev}</button>`).join('')}</div>` : ''}
    ${R.length ? `<div class="sec-h">Recent records</div><div class="list">${R.slice(0, 8).map(r => { const [i, c] = KIND_ICON[r.kind] || KIND_ICON.voucher; return `<button class="row with-icon" data-go="${esc(r.link)}"><span class="ico" style="background:${c}">${ic(i)}</span><span class="grow"><span class="t">${esc(nice(r.title))}</span><span class="s">${esc(fd(r.date))}${r.sub ? ' · ' + esc(String(r.sub).slice(0, 50)) : ''}</span></span><span class="v num">${rs(r.amount)}</span>${chev}</button>`; }).join('')}</div>` : ''}`;
  el.onclick = e => { const g = e.target.closest('[data-go]'); if (g) { e.stopPropagation(); go(g.dataset.go); } };
}
