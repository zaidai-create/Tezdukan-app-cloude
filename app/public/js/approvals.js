// Approvals (owners), my requests, notifications bell, and what happens after an entry is saved.
import { $, $$, esc, ic, chev, api, S, can, sheet, hud, fail, route, go, page, rs, short, fd, nice, initials, waPhone, qty as fq, UI, swr, confirmBox, refreshBoot, ROLE_LABEL } from './core.js';

const loading = '<div class="loading"><span class="spin"></span></div>';
const avatar = name => `<span class="avatar">${esc(initials(name))}</span>`;
export const KIND = { sale: ['Sale bill', 'receipt', 'var(--tint)'], purchase: ['Purchase bill', 'cart', 'var(--indigo)'], sale_return: ['Sales return', 'return', 'var(--purple)'], purchase_return: ['Purchase return', 'return', 'var(--purple)'],
  receipt: ['Payment received', 'down', 'var(--green)'], payment: ['Paid to supplier', 'up', 'var(--orange)'], expense: ['Expense', 'wallet', 'var(--red)'], voucher: ['Journal voucher', 'book', 'var(--indigo)'] };
const when = t => { if (!t) return ''; const d = new Date(t), m = Math.round((Date.now() - d) / 60e3); if (m < 1) return 'abhi'; if (m < 60) return `${m} min pehle`; if (m < 24 * 60) return `${Math.round(m / 60)} ghante pehle`; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };

/* ---------- after saving any entry: either it is done, or it went to the owners ---------- */
export function afterSubmit(r, done) {
  refreshBoot();
  if (!r || !r.pending) { hud('Saved'); done && done(r); return; }
  poll(true);
  const owners = (S.boot.owners || []).filter(o => o.id !== S.user.id);
  const msg = `Assalam-o-Alaikum, ${S.user.name} ne ${KIND[r.kind]?.[0] || 'entry'} ${rs(r.amount)} approval ke liye bheja hai. Qayam Traders app mein Approvals kholein.`;
  const s = sheet({ title: 'Approval ke liye bheja', left: 'Close', body: `<div class="sent">
      <div class="sent-ic">${ic('clock')}</div>
      <h2>${rs(r.amount)}</h2><p>${esc(KIND[r.kind]?.[0] || 'Entry')} Rs ${(r.limit || 10000).toLocaleString('en-US')} se zyada hai, is liye owners (${owners.map(o => esc(o.name)).join(', ') || 'Zain, Rehan'}) ki approval ka intezar hai.<br>Approve hote hi books mein aa jayegi aur aap ko notification milega.</p></div>
    ${owners.some(o => waPhone(o.phone)) ? `<div class="sec-h">Owners ko WhatsApp par batayein</div><div class="list">${owners.filter(o => waPhone(o.phone)).map(o => `<a class="row with-icon" target="_blank" href="https://wa.me/${waPhone(o.phone)}?text=${encodeURIComponent(msg)}"><span class="ico" style="background:#25d366">${ic('chat')}</span><span class="grow">${esc(o.name)}</span>${chev}</a>`).join('')}</div>` : ''}
    <div class="list" style="margin-top:14px"><button class="row action" data-mine>Meri requests dekhein</button></div>`, onClose: () => done && done(null) });
  $('[data-mine]', s.el).onclick = () => { s.close(); go('myrequests'); };
}

/* ---------- one request card ---------- */
function card(a, { actions = false, own = false } = {}) {
  const k = KIND[a.kind] || ['Entry', 'doc', 'gray'];
  const st = a.status === 'pending' ? '<span class="badge orange">Pending</span>' : a.status === 'approved' ? '<span class="badge green">Approved</span>' : '<span class="badge red">Rejected</span>';
  const res = a.result && a.status === 'approved' ? (a.result.kind in { sale: 1, purchase: 1, sale_return: 1, purchase_return: 1 } ? `bill/${a.result.id}` : a.party_id ? `party/${a.party_id}` : '') : '';
  return `<div class="apr ${a.status}" data-id="${a.id}">
    <div class="apr-h"><span class="ico" style="background:${k[2]}">${ic(k[1])}</span><span class="grow"><b>${esc(k[0])}</b><small>${esc(nice(a.party || ''))}${a.date ? ' · ' + esc(fd(a.date)) : ''}</small></span><span class="apr-amt num">${rs(a.amount)}</span></div>
    ${a.lines?.length ? (() => { const off = a.lines.reduce((x, l) => x + (l.tp > l.rate ? (l.tp - l.rate) * l.qty : 0), 0) + (+a.discount || 0);
      return `<div class="apr-lines">${a.lines.map(l => `<div><span>${esc(nice(l.name))}${l.tp > l.rate ? `<small class="grn"> TP ${rs(l.tp)} · ${Math.round((l.tp - l.rate) / l.tp * 1000) / 10}% off</small>` : ''}</span><span>${fq(l.qty)} ${esc(l.unit || '')} × ${rs(l.rate)}</span><b class="num">${rs(l.amount)}</b></div>`).join('')}${off > 0.5 ? `<div class="paidl"><span class="grn">Total discount</span><span></span><b class="num grn">${rs(off)}</b></div>` : ''}${a.paid ? `<div class="paidl"><span>Cash/bank received</span><span></span><b class="num">${rs(a.paid)}</b></div>` : ''}</div>`; })() : ''}
    ${a.note && !/^Voice:/.test(a.note) ? `<div class="apr-note">${esc(a.note)}</div>` : ''}
    <div class="apr-m">${st}<span>By <b>${esc(a.by || '—')}</b> · ${esc(when(a.at))}</span></div>
    ${a.status !== 'pending' ? `<div class="apr-m"><span>${a.status === 'approved' ? 'Approved' : 'Rejected'} by <b>${esc(a.decided_by || '—')}</b> · ${esc(when(a.decided_at))}${a.reason ? ` · “${esc(a.reason)}”` : ''}</span>${res ? `<button class="chip" data-open="${res}">Open ${ic('chevr')}</button>` : ''}</div>` : ''}
    ${actions && a.status === 'pending' ? `<div class="apr-act"><button class="abtn no" data-rej="${a.id}">${ic('x')}Reject</button><button class="abtn yes" data-ok="${a.id}">${ic('check')}Approve</button></div>` : ''}
    ${own && a.status === 'pending' ? `<div class="apr-act"><button class="abtn no" data-wd="${a.id}">Request wapas lein</button></div>` : ''}
  </div>`;
}

async function decide(el, id, yes, after) {
  let reason = '';
  if (!yes) {
    reason = await new Promise(res => { const s = sheet({ title: 'Reject karein?', right: 'Reject', body: `<p class="sec-f" style="margin-top:0">Reject karne par yeh entry database se hata di jayegi. Bhejne wale ko message chala jayega.</p><div class="list"><div class="row"><input class="fld" style="text-align:left" data-r placeholder="Wajah (optional)"></div></div>`, onRight: sh => { res($('[data-r]', sh.el).value || ' '); sh.close(); }, onClose: () => res(null) }); });
    if (reason === null) return;
  }
  const b = el.querySelector(yes ? '[data-ok]' : '[data-rej]'); if (b) { b.disabled = true; b.innerHTML = '<span class="spin"></span>'; }
  try {
    const r = await api(`/api/approvals/${id}/${yes ? 'approve' : 'reject'}`, { body: { reason: reason.trim() } });
    hud(yes ? 'Approved · books mein aa gaya' : 'Rejected · hata diya gaya');
    el.classList.add('gone'); refreshBoot(); poll(true);
    setTimeout(() => after && after(r), 260);
  } catch (e) { fail(e); after && after(); }
}

/* ---------- owners: approvals + full record ---------- */
let atab = 'pending';
route(/^approvals$/, async v => {
  const body = page(v, { title: 'Approvals', back: 'more', backLabel: 'More', sub: can.owner() ? 'Bari entries aap ki approval ka intezar kar rahi hain' : 'Owners ki approval wali entries' });
  const draw = async () => {
    body.innerHTML = `<div class="seg" data-t>${[['pending', 'Pending'], ['done', 'Faisle'], ['all', 'Sab entries']].map(([k, l]) => `<button data-k="${k}" class="${atab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div data-l>${loading}</div>`;
    const L = $('[data-l]', body);
    if (atab === 'all') {
      await swr('/api/activity', rows => { L.innerHTML = activityList(rows); });
      return;
    }
    await swr('/api/approvals', d => {
      const items = d.items.filter(a => (atab === 'pending' ? a.status === 'pending' : a.status !== 'pending'));
      L.innerHTML = (atab === 'pending' ? `<p class="sec-f" style="margin:0 4px 10px">Rs ${(+d.limit).toLocaleString('en-US')} se upar ki entries yahan aati hain. Owners ki apni entries seedha save hoti hain.</p>` : '') +
        (items.length ? items.map(a => card(a, { actions: can.owner() })).join('') : `<div class="empty">${ic('checkc')}<div>${atab === 'pending' ? 'Koi pending approval nahi' : 'Abhi koi faisla nahi'}</div></div>`);
    });
  };
  body.onclick = e => {
    const t = e.target.closest('[data-k]'); if (t) { atab = t.dataset.k; draw().catch(fail); return; }
    const ok = e.target.closest('[data-ok],[data-rej]');
    if (ok) { const el = ok.closest('.apr'); decide(el, +(ok.dataset.ok || ok.dataset.rej), ok.dataset.ok !== undefined, () => draw().catch(fail)); return; }
    const o = e.target.closest('[data-open],[data-go]'); if (o) go(o.dataset.open || o.dataset.go);
  };
  await draw();
});

const ACT = { create: 'Entry', request: 'Approval maangi', approve: 'Approved', reject: 'Rejected', withdraw: 'Request wapas', cancel: 'Bill cancelled' };
function activityList(rows) {
  if (!rows.length) return `<div class="empty">Abhi kuch nahi</div>`;
  return `<div class="list">${rows.map(r => {
    const d = r.data || {}, amt = d.total ?? d.amt ?? d.amount;
    const kind = r.entity === 'invoice' ? (d.kind || 'sale') : r.entity === 'approval' ? d.kind : r.entity;
    const k = KIND[kind] || ['Entry', 'doc', '#8e8e93'];
    const how = r.action === 'create' ? (d.approval ? '<span class="badge green">Approved</span>' : '<span class="badge gray">Auto</span>') : r.action === 'request' ? '<span class="badge orange">Pending</span>' : r.action === 'approve' ? '<span class="badge green">Approved</span>' : r.action === 'reject' ? '<span class="badge red">Rejected</span>' : `<span class="badge gray">${esc(ACT[r.action] || r.action)}</span>`;
    const link = r.entity === 'invoice' && r.action === 'create' ? `bill/${r.ref}` : '';
    return `<${link ? `button data-go="${link}"` : 'div'} class="row with-icon"><span class="ico" style="background:${k[2]}">${ic(k[1])}</span><span class="grow"><span class="t">${esc(ACT[r.action] === 'Entry' ? k[0] : `${ACT[r.action] || r.action}: ${k[0]}`)}${d.party ? ' · ' + esc(nice(d.party)) : d.name ? ' · ' + esc(nice(d.name)) : ''}</span><span class="s">${esc(r.by || '')}${d.by && r.action !== 'create' ? ' ← ' + esc(d.by) : ''} · ${esc(when(r.at))}${d.no ? ' · ' + esc(d.no) : ''}</span></span><span class="v num"><b>${amt != null ? rs(amt) : ''}</b><br>${how}</span></${link ? 'button' : 'div'}>`;
  }).join('')}</div>`;
}

/* ---------- everyone: my requests ---------- */
route(/^myrequests$/, async v => {
  const body = page(v, { title: 'Meri requests', back: 'more', backLabel: 'More', sub: 'Jo entries approval ke liye gayi' });
  body.innerHTML = loading;
  const draw = () => swr(`/api/approvals?mine=1`, d => { body.innerHTML = d.items.length ? d.items.map(a => card(a, { own: true })).join('') : `<div class="empty">${ic('checkc')}<div>Koi request nahi</div></div>`; });
  body.onclick = async e => {
    const w = e.target.closest('[data-wd]');
    if (w) { if (!(await confirmBox('Yeh request wapas le lein? Entry nahi banegi.', 'Wapas lein', true))) return; try { await api(`/api/approvals/${w.dataset.wd}`, { method: 'DELETE' }); hud('Wapas le li'); draw(); poll(true); } catch (x) { fail(x); } return; }
    const o = e.target.closest('[data-open]'); if (o) go(o.dataset.open);
  };
  await draw();
});

/* ---------- notifications ---------- */
route(/^notices$/, async v => {
  const body = page(v, { title: 'Notifications', back: 'home', backLabel: 'Home' });
  body.innerHTML = loading;
  const d = await api('/api/notices');
  body.innerHTML = `${d.pending && can.boss() ? `<button class="banner warn" data-go="approvals">${ic('clock')}<span class="grow"><b>${d.pending} approval${d.pending > 1 ? 's' : ''} pending</b><small>Dekhne ke liye tap karein</small></span>${chev}</button>` : ''}
    ${d.items.length ? `<div class="list">${d.items.map(n => `<button class="row ntc ${n.read_at ? '' : 'unread'}" data-go="${esc((n.link || '').replace(/^#/, ''))}"><span class="grow"><span class="t">${esc(n.title)}</span><span class="s wrap">${esc(n.body)}</span><span class="s">${esc(when(n.created_at))}</span></span>${n.link ? chev : ''}</button>`).join('')}</div>` : `<div class="empty">${ic('bell')}<div>Koi notification nahi</div></div>`}`;
  if (d.unread) api('/api/notices/read', { body: {} }).then(() => poll(true)).catch(() => {});
  body.onclick = e => { const b = e.target.closest('[data-go]'); if (b && b.dataset.go) go(b.dataset.go); };
});

/* ---------- owner home: pending approvals card ---------- */
export async function pendingCard(host) {
  if (!can.owner() || !host) return;
  await swr('/api/approvals', d => {
    const p = d.items.filter(a => a.status === 'pending');
    host.innerHTML = p.length ? `<div class="sec-h">Approval chahiye <span class="pill-n">${p.length}</span><button data-go="approvals">Sab dekhein</button></div>${p.slice(0, 3).map(a => card(a, { actions: true })).join('')}` : '';
  }).catch(() => {});
  host.onclick = e => {
    const ok = e.target.closest('[data-ok],[data-rej]');
    if (ok) { e.stopPropagation(); decide(ok.closest('.apr'), +(ok.dataset.ok || ok.dataset.rej), ok.dataset.ok !== undefined, () => pendingCard(host)); }
  };
}

/* ---------- polling: badge, toast, system notification ---------- */
let lastSeen = null, timer = null, busy = false;
export const notice = { unread: 0, pending: 0 };
function paint() {
  const n = notice.unread + (can.boss() ? notice.pending : 0);
  $$('[data-dot]').forEach(d => { d.hidden = !n; d.textContent = n > 9 ? '9+' : n || ''; });
  $$('[data-apcount]').forEach(d => { d.hidden = !notice.pending; d.textContent = notice.pending; });
}
async function systemNotify(title, body) {
  try {
    const LN = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.LocalNotifications;
    if (LN) { await LN.requestPermissions?.(); await LN.schedule({ notifications: [{ id: Math.floor(Date.now() % 2e9), title, body }] }); return; }
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: '/icon-192.png' });
  } catch {}
}
export async function poll(force = false) {
  if (busy || !S.user) return; busy = true;
  try {
    const d = await api('/api/notices');
    notice.unread = d.unread; notice.pending = d.pending;
    paint();
    if (lastSeen !== null && d.last > lastSeen) {
      const fresh = d.items.filter(n => n.id > lastSeen && !n.read_at);
      if (fresh.length) { hud(fresh[0].title, 'info', 2600); systemNotify(fresh[0].title, fresh[0].body); if (location.hash === '' || location.hash === '#home' || location.hash === '#approvals') import('./core.js').then(m => m.render()); }
    }
    lastSeen = Math.max(lastSeen || 0, d.last);
  } catch {} finally { busy = false; }
  if (force) return;
}
export function startPolling() {
  clearInterval(timer);
  poll();
  timer = setInterval(() => { if (!document.hidden) poll(); }, 25e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  if ('Notification' in window && Notification.permission === 'default' && can.boss()) setTimeout(() => { try { Notification.requestPermission(); } catch {} }, 4000);
  window.Capacitor?.Plugins?.LocalNotifications?.requestPermissions?.().catch?.(() => {});
}
export { ROLE_LABEL };
