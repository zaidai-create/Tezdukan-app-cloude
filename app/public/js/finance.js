// Money-side features: the + quick menu, recovery list with WhatsApp reminders, supplier payables, closing the books.
import { $, $$, esc, ic, chev, api, S, can, sheet, hud, fail, route, go, page, rs, short, fd, nice, initials, waPhone, today, reloadBoot, UI } from './core.js';
import { newBill, receiveMoney, expenseForm } from './screens.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const avatar = name => `<span class="avatar">${esc(initials(name))}</span>`;

/* ---------- + button: the three everyday actions ---------- */
export function quickAdd() {
  if ($('.qadd')) return;
  const staff = can.staff();
  const items = [
    ['sale', 'receipt', 'Sales Invoice', 'qa-blue'],
    ...(staff ? [['purchase', 'cart', 'Purchase Invoice', 'qa-indigo']] : []),
    ['recovery', 'down', 'Add Recovery', 'qa-green'],
    ...(staff ? [['expense', 'wallet', 'Add Expense', 'qa-orange']] : []),
  ];
  const dim = document.createElement('div'); dim.className = 'dim-bg qdim';
  const el = document.createElement('div'); el.className = 'qadd'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'New');
  el.innerHTML = `<div class="grab"></div><div class="qh"><b>Kya add karna hai?</b><button class="qx" data-x aria-label="Close">${ic('x')}</button></div>
    <div class="qgrid g${items.length}">${items.map(([k, i, l, c]) => `<button class="qbtn ${c}" data-k="${k}"><span class="qi">${ic(i)}</span><b>${l}</b></button>`).join('')}</div>
    ${staff ? `<div class="qrow"><button data-k="sale_return">${ic('return')}Sales Return</button><button data-k="purchase_return">${ic('return')}Purchase Return</button></div>` : ''}
    <button class="qmore" data-k="more">Baaki sab options: <b>More</b> ${ic('chevr')}</button>`;
  document.body.append(dim, el);
  const close = () => { el.classList.add('closing'); dim.classList.add('closing'); setTimeout(() => { el.remove(); dim.remove(); }, 200); };
  dim.onclick = close;
  el.onclick = e => {
    if (e.target.closest('[data-x]')) return close();
    const b = e.target.closest('[data-k]'); if (!b) return;
    close();
    const k = b.dataset.k;
    if (['sale', 'purchase', 'sale_return', 'purchase_return'].includes(k)) newBill(k);
    if (k === 'recovery') receiveMoney();
    if (k === 'expense') expenseForm();
    if (k === 'more') go('more');
  };
  setTimeout(() => $('.qbtn', el)?.focus(), 50);
}

/* ---------- recovery: who owes money, oldest first, one-tap WhatsApp reminder ---------- */
const reminderText = (o, c) => `Assalam-o-Alaikum ${nice(o.name)},\n${c.name} ke saath aap ka baqaya balance *${rs(o.balance)}* hai${o.days ? ` (sab se purana bill ${o.days} din pehle ka)` : ''}.\nMeharbani kar ke jald payment kar dein.${c.bank ? `\n\nBank: ${c.bank}` : ''}\n\nShukriya\n${c.name}${c.phone ? '\n' + c.phone : ''}`;
export function remind(o) {
  const ph = waPhone(o.phone);
  const url = `https://wa.me/${ph || ''}?text=${encodeURIComponent(reminderText(o, S.boot.company))}`;
  if (!ph) hud('Phone number nahi hai. WhatsApp mein contact khud chunein.', 'info', 2200);
  open(url, '_blank');
}

let rFilter = 0, rQuery = '';
route(/^recovery$/, async v => {
  const body = page(v, { title: 'Recovery', back: 'more', backLabel: 'More', sub: 'Kis se paise lene hain' });
  body.innerHTML = loading;
  const d = await api(`/api/reports/aging?to=${today()}`);
  const rows = d.rows.filter(o => o.balance > 0.5);
  const over = rows.filter(o => o.days > 30).reduce((a, o) => a + o.balance, 0);
  const draw = () => {
    const q = rQuery.toLowerCase();
    const list = rows.filter(o => o.days >= rFilter && (!q || String(o.name).toLowerCase().includes(q) || String(o.city || '').toLowerCase().includes(q)));
    $('[data-l]', body).innerHTML = list.length ? list.map(o => `<div class="rrow">
        <button class="row with-avatar" data-go="party/${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span>
          <span class="s">${o.days ? `<span class="${o.days > 60 ? 'red' : o.days > 30 ? 'orange' : ''}">${o.days} din</span>` : ''}${o.last_paid ? ` · last paid ${esc(fd(o.last_paid))}` : ' · kabhi payment nahi'}${o.limit && o.balance > o.limit ? ' · <span class="red">limit se zyada</span>' : ''}</span></span>
          <span class="v num"><b>${rs(o.balance)}</b></span></button>
        <div class="racts"><button class="chip wa" data-wa="${o.party_id}">${ic('chat')}Reminder</button><button class="chip" data-rec="${o.party_id}" data-amt="${o.balance}">${ic('down')}Receive</button>${o.phone ? `<a class="chip" href="tel:${esc(o.phone)}">${ic('phone')}Call</a>` : ''}</div></div>`).join('')
      : '<div class="empty">Koi baqaya nahi 🎉</div>';
    $('[data-n]', body).textContent = `${list.length} customers · ${rs(list.reduce((a, o) => a + o.balance, 0))}`;
  };
  body.innerHTML = `<div class="tiles" style="margin-top:6px">
      <div class="tile"><div class="k">Total to collect</div><div class="n num">${short(d.total)}</div><div class="d">${rows.length} customers</div></div>
      <div class="tile"><div class="k red">Over 30 days</div><div class="n num">${short(over)}</div><div class="d">${d.total ? Math.round(over / d.total * 100) : 0}% of dues</div></div></div>
    <div class="seg" data-f style="margin-top:14px">${[[0, 'All'], [31, '30+ din'], [61, '60+ din'], [91, '90+ din']].map(([k, l]) => `<button data-d="${k}" class="${rFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="search" style="margin-top:12px">${ic('search')}<input data-q placeholder="Customer ya city dhoondein" value="${esc(rQuery)}"></div>
    <div class="sec-h" data-n></div><div class="list" data-l></div>
    <p class="sec-f">Reminder WhatsApp par customer ko balance aur bank details ke saath message bhejta hai.</p>`;
  draw();
  $('[data-q]', body).oninput = e => { rQuery = e.target.value; draw(); };
  body.onclick = e => {
    const f = e.target.closest('[data-d]'); if (f) { rFilter = +f.dataset.d; $$('[data-d]', body).forEach(x => x.classList.toggle('on', x === f)); return draw(); }
    const w = e.target.closest('[data-wa]'); if (w) return remind(rows.find(o => String(o.party_id) === w.dataset.wa));
    const r = e.target.closest('[data-rec]'); if (r) return receiveMoney(+r.dataset.rec);
    const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go);
  };
});

/* ---------- payables: suppliers we owe ---------- */
route(/^payables$/, async v => {
  const body = page(v, { title: 'Payables', back: 'more', backLabel: 'More', sub: 'Suppliers ko kitna dena hai' });
  body.innerHTML = loading;
  const d = await api(`/api/reports/payables?to=${today()}`);
  const rows = d.rows.filter(o => o.balance > 0.5);
  body.innerHTML = `<div class="tiles" style="margin-top:6px">
      <div class="tile"><div class="k orange">Total payable</div><div class="n num">${short(d.total)}</div><div class="d">${rows.length} suppliers</div></div>
      <div class="tile"><div class="k red">Over 60 days</div><div class="n num">${short(d.buckets[2] + d.buckets[3])}</div><div class="d">Purane bills</div></div></div>
    <div class="sec-h">Suppliers</div><div class="list">${rows.map(o => `<button class="row with-avatar" data-pay="${o.party_id}">${avatar(o.name)}<span class="grow"><span class="t">${esc(nice(o.name))}</span><span class="s">${o.days ? `Oldest bill ${o.days} din` : 'Advance'}${o.last_paid ? ` · last paid ${esc(fd(o.last_paid))}` : ''}</span></span><span class="v num"><b>${rs(o.balance)}</b></span>${chev}</button>`).join('') || '<div class="empty">Kisi supplier ka baqaya nahi</div>'}</div>`;
  body.onclick = async e => { const b = e.target.closest('[data-pay]'); if (b) go(`party/${b.dataset.pay}`); };
});

/* ---------- close the books up to a date (period lock) ---------- */
export function closeBooks() {
  const c = S.boot.company, cur = c.lock_date || '';
  const lastMonthEnd = (() => { const t = today(); const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 0)); return d.toISOString().slice(0, 10); })();
  sheet({ title: 'Close books', right: 'Save', body: `<div class="list"><div class="row"><label>Closed up to</label><input class="fld" type="date" data-d value="${esc(cur)}"></div></div>
    <p class="sec-f">Is tareekh tak koi naya bill, payment ya entry nahi ban sakti aur purane bill cancel nahi honge. Mahine ka hisaab final karne ke baad lagayein. Khaali chhorein to sab khula rahega.</p>
    <div class="list" style="margin-top:12px"><button class="row action" data-lm>Last month tak band karein (${esc(fd(lastMonthEnd))})</button><button class="row action" data-open>Sab khol dein</button></div>`,
    onRight: async sh => {
      const v = $('[data-d]', sh.el).value;
      try { await api('/api/settings', { method: 'PUT', body: { lock_date: v } }); await reloadBoot(); hud(v ? `Books closed up to ${fd(v)}` : 'Books open'); sh.close(); } catch (e) { fail(e); }
    } }).el.addEventListener('click', e => {
    const s = e.currentTarget;
    if (e.target.closest('[data-lm]')) $('[data-d]', s).value = lastMonthEnd;
    if (e.target.closest('[data-open]')) $('[data-d]', s).value = '';
  });
}

export const quickAddLabel = UI === 'web' ? 'New' : 'Add';
