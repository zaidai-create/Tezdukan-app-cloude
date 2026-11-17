// Ledgers: every khata in one place (customers, suppliers, expenses, staff, commission, partners, cash & bank)
// and a proper Dr/Cr ledger table for each, viewable as PDF / image inside the app.
import { $, $$, esc, ic, chev, api, S, can, sheet, picker, hud, fail, route, go, page, rs, n2, fd, nice, today, swr, reloadBoot } from './core.js';
import { ledgerHTML, viewDoc } from './invoice.js';
import { filterBar, wireFilters, initF, exportCSV } from './registers.js';
import { afterSubmit } from './approvals.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FD = x => { const t = String(x || '').slice(0, 10); return `<span class="dl">${esc(fd(x))}</span><span class="ds">${+t.slice(8, 10)} ${MON[+t.slice(5, 7) - 1] || ''} ${t.slice(2, 4)}</span>`; };
const DC = (b, flip) => { const v = flip ? -b : b; return Math.abs(v) < 0.005 ? '0.00' : `${n2(Math.abs(v))} <i class="${v > 0 ? 'dr' : 'cr'}">${v > 0 ? 'Dr' : 'Cr'}</i>`; };
const DCt = (b, flip) => { const v = flip ? -b : b; return Math.abs(v) < 0.005 ? '0.00' : `${n2(Math.abs(v))} ${v > 0 ? 'Dr' : 'Cr'}`; };

/* ---------- the ledger table used everywhere ---------- */
export function ledgerTable(d, { flip = false } = {}) {
  const dr = d.lines.reduce((a, l) => a + (+l.debit || 0), 0), cr = d.lines.reduce((a, l) => a + (+l.credit || 0), 0);
  const M = x => n2(x).replace(/\.(\d\d)$/, '<span class="dec">.$1</span>');
  const B = b => { const v = flip ? -b : b; return Math.abs(v) < 0.005 ? '0' : `${M(Math.abs(v))} <i class="${v > 0 ? 'dr' : 'cr'}">${v > 0 ? 'Dr' : 'Cr'}</i>`; };
  return `<div class="tscroll"><table class="rtable ledg"><thead><tr><th>Date</th><th class="vc">Voucher</th><th>Particulars</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead><tbody>
    <tr class="ob"><td>${FD(d.from)}</td><td class="vc"></td><td><b>Opening balance</b></td><td class="n"></td><td class="n"></td><td class="n bal"><b>${B(d.opening)}</b></td></tr>
    ${d.lines.map(l => `<tr ${l.ref_invoice ? `data-go="bill/${l.ref_invoice}"` : ''}><td>${FD(l.date)}<small class="vno">${esc(l.no || '')}</small></td><td class="vc">${esc(l.no || '')}</td><td class="pt"><div>${esc(nice(String(l.memo || l.type || '')).slice(0, 90))}</div></td><td class="n">${+l.debit ? M(l.debit) : ''}</td><td class="n">${+l.credit ? M(l.credit) : ''}</td><td class="n bal">${B(l.balance)}</td></tr>`).join('') || '<tr><td colspan="6" class="l2" style="text-align:center;padding:20px">Is dauran koi entry nahi</td></tr>'}
  </tbody><tfoot><tr><td>Total</td><td class="vc"></td><td>Closing balance</td><td class="n">${M(dr)}</td><td class="n">${M(cr)}</td><td class="n bal">${B(d.closing)}</td></tr></tfoot></table></div>`;
}
export const ledgerCSV = (name, d, flip) => exportCSV(name, [['date', 'Date', { fmt: x => fd(x) }], ['no', 'Voucher'], ['memo', 'Particulars'], ['debit', 'Debit', { n: 1 }], ['credit', 'Credit', { n: 1 }], ['balance', 'Balance', { fmt: x => DCt(x, flip) }]],
  [{ date: d.from, no: '', memo: 'Opening balance', debit: 0, credit: 0, balance: d.opening }, ...d.lines]);

/* ---------- hub ---------- */
const TABS = [['C', 'Customers'], ['V', 'Suppliers'], ['expense', 'Kharche'], ['staff', 'Staff'], ['commission', 'Commission'], ['partners', 'Partners'], ['cash', 'Cash & Bank'], ['all', 'Sab accounts']];
const NEW = { expense: ['expense', 'Naya kharcha head', 'e.g. Generator fuel'], staff: ['staff', 'Naya staff ledger', 'e.g. Kaif Salary'], commission: ['commission', 'Naya commission ledger', 'e.g. Ali Commission Payable'], partners: ['partner', 'Naya partner ledger', 'e.g. Zain Drawings'], cash: ['bank', 'Naya bank account', 'e.g. Meezan Bank'] };
let hubF = null, hubTab = 'expense';
route(/^ledgers(?:\/(\w+))?$/, async (v, tab) => {
  if (tab) hubTab = tab; if (!can.staff() && !['C'].includes(hubTab)) hubTab = 'C';
  if (!hubF) hubF = initF({}, 'year');
  const F = hubF;
  const body = page(v, { title: 'Ledgers (Khata)', back: 'more', backLabel: 'More', sub: 'Har khata ek jagah — tap karein, poora ledger khulega' });
  const draw = async () => {
    const tabs = can.staff() ? TABS : TABS.slice(0, 1);
    body.innerHTML = `<div class="chips tabs" data-tabs>${tabs.map(([k, l]) => `<button class="chip ${hubTab === k ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      ${['C', 'V'].includes(hubTab) ? '' : `<div data-f>${filterBar(F, { search: false })}</div>`}
      <div class="search">${ic('search')}<input data-hq placeholder="Naam se dhoondein" autocomplete="off"></div>
      ${NEW[hubTab] ? `<button class="banner tbl" data-new>${ic('plus')}<span class="grow"><b>${NEW[hubTab][1]}</b><small>Ek tap mein naya khata banayein</small></span>${chev}</button>` : ''}
      <div data-l>${loading}</div>`;
    const L = $('[data-l]', body), Q = $('[data-hq]', body);
    let rows = [], kind;
    if (['C', 'V'].includes(hubTab)) {
      kind = 'party';
      rows = S.boot.parties.filter(p => p.kind === hubTab).map(p => ({ id: p.id, name: p.name, sub: nice(p.city || ''), balance: p.balance })).sort((a, b) => b.balance - a.balance);
    } else {
      kind = 'acc';
      const all = await api(`/api/ledgers?from=${F.from}&to=${F.to}`);
      rows = all.filter(a => hubTab === 'all' || a.group === hubTab).map(a => ({ id: a.code, name: a.name, sub: `${a.code} · ${nice(a.grp)}`, period: a.type === 'D' ? a.debit - a.credit : a.type === 'A' ? a.debit - a.credit : a.credit - a.debit, balance: a.balance, type: a.type, entries: a.entries }));
      if (hubTab === 'expense' || hubTab === 'staff') rows.sort((a, b) => b.period - a.period);
    }
    const paint = () => {
      const q = Q.value.trim().toLowerCase();
      const list = rows.filter(r => !q || (r.name + ' ' + r.sub).toLowerCase().includes(q));
      const exp = hubTab === 'expense' || hubTab === 'staff';
      const tot = list.reduce((a, r) => a + (exp ? r.period : r.balance), 0);
      L.innerHTML = `<p class="sec-f" style="margin:0 4px 8px">${list.length} khate · ${exp ? `is dauran kharcha <b class="num" style="color:var(--label)">${rs(tot)}</b>` : `kul balance <b class="num" style="color:var(--label)">${rs(tot)}</b>`}</p>
        <div class="list">${list.map(r => `<button class="row" data-${kind}="${r.id}"><span class="grow"><span class="t">${esc(nice(r.name))}</span><span class="s">${esc(r.sub)}${kind === 'acc' && r.entries ? ` · ${r.entries} entries` : ''}</span></span>
          <span class="v num">${exp ? `<b>${rs(r.period)}</b><br><small>is dauran</small>` : `<b class="${r.balance > 0.5 && hubTab === 'C' ? 'red' : ''}">${rs(r.balance)}</b>`}</span>${chev}</button>`).join('') || '<div class="empty">Koi khata nahi</div>'}</div>`;
    };
    paint(); Q.oninput = paint;
  };
  body.onclick = async e => {
    const t = e.target.closest('[data-t]'); if (t) { hubTab = t.dataset.t; return draw().catch(fail); }
    const p = e.target.closest('[data-party]'); if (p) return go(`party/${p.dataset.party}`);
    const a = e.target.closest('[data-acc]'); if (a) return go(`account/${a.dataset.acc}`);
    if (e.target.closest('[data-new]')) {
      const [kind, label, ph] = NEW[hubTab];
      sheet({ title: label, right: 'Save', body: `<div class="list"><div class="row"><label>Naam</label><input class="fld" data-n placeholder="${esc(ph)}"></div></div><p class="sec-f">Is khate mein ab se entries aa sakti hain (kharcha, payment, voucher).</p>`,
        onRight: async sh => { try { const r = await api('/api/accounts/quick', { body: { kind, name: $('[data-n]', sh.el).value } }); await reloadBoot(); hud('Khata ban gaya'); sh.close(); go(`account/${r.code}`); } catch (x) { fail(x); } } });
      return;
    }
  };
  wireFilters(body, F, null, () => draw().catch(fail));
  await draw();
});

/* ---------- one account's ledger ---------- */
let accF = null;
route(/^account\/(\w+)$/, async (v, code) => {
  if (!accF) accF = initF({}, 'year');
  const F = accF;
  const a = S.boot.accounts.find(x => x.code === code) || { code, name: code, type: 'D', grp: '' };
  const isCash = a.grp === 'Cash & Bank', flip = false;
  const body = page(v, { title: nice(a.name), back: 'ledgers', backLabel: 'Ledgers' });
  let d = null;
  const load = async () => {
    $('[data-out]', body).style.opacity = .5;
    d = await api(`/api/reports/account-ledger?account=${encodeURIComponent(code)}&from=${F.from}&to=${F.to}`);
    d.from = F.from; d.to = F.to;
    const dr = d.lines.reduce((s, l) => s + +l.debit, 0), cr = d.lines.reduce((s, l) => s + +l.credit, 0);
    $('[data-out]', body).style.opacity = 1;
    $('[data-out]', body).innerHTML = `<div class="ledhead"><div><small>${esc(a.code)} · ${esc(nice(a.grp || ''))}</small><b class="num">${DC(d.closing, flip)}</b><span>Closing balance</span></div>
        <div class="lh2"><span>Debit <b class="num">${n2(dr)}</b></span><span>Credit <b class="num">${n2(cr)}</b></span>${a.type === 'D' ? `<span>Is dauran kharcha <b class="num">${n2(dr - cr)}</b></span>` : ''}</div></div>
      <div class="racts2"><button class="chip" data-view>${ic('pdf')} View PDF / Image</button><button class="chip" data-csv>${ic('tray')} Excel</button>${can.staff() && !isCash && a.code !== '1200' && a.code !== '2000' ? `<button class="chip pri" data-entry>${ic('plus')} Entry</button>` : ''}</div>
      ${ledgerTable(d, { flip })}`;
  };
  body.innerHTML = `${filterBar(F, { search: false })}<div data-out>${loading}</div>`;
  wireFilters(body, F, null, () => load().catch(fail));
  body.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) return go(g.dataset.go);
    if (!d) return;
    if (e.target.closest('[data-view]')) viewDoc(ledgerHTML({ ...d, company: S.boot.company }, { title: 'ACCOUNT LEDGER', who: a.name, whoLabel: nice(a.grp || 'Account'), whoLines: ['Code ' + a.code], flip }), { name: `Ledger-${nice(a.name).replace(/\W+/g, '-')}`, title: nice(a.name), text: `${nice(a.name)} ledger ${fd(d.from)} – ${fd(d.to)}` });
    if (e.target.closest('[data-csv]')) ledgerCSV(`Ledger-${nice(a.name).replace(/\W+/g, '-')}`, d, flip);
    if (e.target.closest('[data-entry]')) quickEntry(a, () => load().catch(fail));
  });
  await load();
});

/* ---------- quick entry on any ledger: money out / money in ---------- */
export function quickEntry(a, done) {
  const cashAccs = S.boot.accounts.filter(x => x.grp === 'Cash & Bank');
  const isComm = /comm/i.test(a.name) && a.type === 'B';
  const modes = a.type === 'D' ? [['out', 'Paid (cash/bank se)']] : a.type === 'E' ? [['out', 'Drawing (nikala)'], ['in', 'Capital (daala)']] : isComm ? [['accrue', 'Commission banti hai'], ['out', 'Commission paid']] : [['out', 'Paid (cash/bank se)'], ['in', 'Received (cash/bank mein)']];
  let mode = modes[0][0], from = '1000';
  const commExp = (S.boot.accounts.find(x => x.type === 'D' && /comm/i.test(x.name)) || {}).code;
  const s = sheet({ title: nice(a.name), right: 'Save', body: `<div class="seg" data-m>${modes.map(([k, l]) => `<button data-k="${k}" class="${k === mode ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="list"><div class="row"><label>Amount</label><input class="fld num" inputmode="decimal" data-amt placeholder="0" style="font-size:22px;font-weight:600"></div>
      <button class="row" data-from><span class="grow">Cash / bank</span><span class="v" data-fn>${esc(nice((cashAccs.find(x => x.code === from) || {}).name || 'Cash'))}</span>${chev}</button>
      <div class="row"><label>Date</label><input class="fld" type="date" data-date value="${today()}"></div>
      <div class="row"><label>Note</label><input class="fld" data-note placeholder="Optional"></div></div>
    <p class="sec-f" data-help></p>`,
    onRight: async sh => {
      const amt = +$('[data-amt]', sh.el).value; if (!(amt > 0)) return hud('Amount likhein', 'err');
      if (mode === 'accrue' && !commExp) return hud('Pehle "Commission Expenses" ka kharcha khata banayein', 'err');
      const other = mode === 'accrue' ? commExp : from;
      const lines = mode === 'in' ? [{ account: other, debit: amt, credit: 0 }, { account: a.code, debit: 0, credit: amt }]
        : mode === 'accrue' ? [{ account: commExp, debit: amt, credit: 0 }, { account: a.code, debit: 0, credit: amt }]
        : [{ account: a.code, debit: amt, credit: 0 }, { account: other, debit: 0, credit: amt }];
      sh.setRight('Saving…', true);
      try { const r = await api('/api/vouchers', { body: { date: $('[data-date]', sh.el).value, memo: `${nice(a.name)}${$('[data-note]', sh.el).value ? ' · ' + $('[data-note]', sh.el).value : ''}`, lines } }); sh.close(); afterSubmit(r, x => { if (x) done && done(); }); } catch (x) { sh.setRight('Save'); fail(x); }
    } });
  const help = () => { const h = $('[data-help]', s.el); h.textContent = mode === 'accrue' ? 'Commission expense mein jayegi aur is shakhs ka “dena hai” barh jayega. Cash nahi nikalta.' : mode === 'in' ? 'Paisa cash/bank mein aayega.' : 'Paisa cash/bank se jayega aur is khate mein likha jayega.'; $('[data-from]', s.el).style.display = mode === 'accrue' ? 'none' : ''; };
  help();
  s.el.addEventListener('click', async e => {
    const m = e.target.closest('[data-k]'); if (m) { mode = m.dataset.k; $$('[data-k]', s.el).forEach(x => x.classList.toggle('on', x === m)); help(); }
    if (e.target.closest('[data-from]')) { const r = await picker({ title: 'Cash / bank', items: cashAccs.map(x => ({ ...x, search: x.name })), render: x => `<span class="grow">${esc(nice(x.name))}</span>` }); if (r) { from = r.code; $('[data-fn]', s.el).textContent = nice(r.name); } }
  });
  setTimeout(() => $('[data-amt]', s.el)?.focus(), 350);
}
