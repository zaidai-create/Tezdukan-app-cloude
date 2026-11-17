// Shared helpers: formatting, API, icons, sheets, router.
// Two faces of the same software: /app = mobile app (green), everything else = web software (desktop).
export const UI = location.pathname.startsWith('/app') ? 'app' : 'web';
document.documentElement.dataset.ui = UI;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const NF2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NFQ = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
export const rs = n => (n < 0 ? '-' : '') + 'Rs ' + NF0.format(Math.abs(Math.round(+n || 0)));
export const rs2 = n => (n < 0 ? '-' : '') + 'Rs ' + NF2.format(Math.abs(+n || 0));
export const n2 = n => NF2.format(+n || 0);
export const qty = n => NFQ.format(+n || 0);
export const short = n => { const a = Math.abs(n), s = n < 0 ? '-' : ''; if (a >= 1e7) return `${s}Rs ${+(a / 1e7).toFixed(2)} Cr`; if (a >= 1e5) return `${s}Rs ${+(a / 1e5).toFixed(a >= 1e6 ? 1 : 2)} Lac`; return rs(n); };
export const r2 = n => Math.round((+n || 0) * 100) / 100;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fd = s => s ? `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}` : '';
export const fdShort = s => s ? `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}` : '';
export const monShort = m => MON[+m.slice(5, 7) - 1];
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
export const fyStart = s => { const y = +s.slice(0, 4), m = +s.slice(5, 7); return `${m >= 7 ? y : y - 1}-07-01`; };
const KEEP = new Set(['BAF', 'HBL', 'ABL', 'UBL', 'MCB', 'NBP', 'DHA', 'KHI', 'HYD', 'SNT', 'ZA', 'PC', 'NTN', 'STRN', 'KG', 'GM', 'RS', 'DD', 'S2']);
// Old data is in CAPITALS: show it in Title Case
export const nice = s => { s = String(s ?? '').trim(); if (s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s; return s.toLowerCase().replace(/[a-z0-9.&'/-]+/g, w => { const up = w.toUpperCase(); if (KEEP.has(up) || /^\d/.test(w)) return up; return w[0].toUpperCase() + w.slice(1); }); };
export const initials = s => nice(s).split(/\s+/).filter(w => /^[a-z]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '#';
export const waPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0092')) d = d.slice(2); if (d.startsWith('0')) d = '92' + d.slice(1); if (d.length === 10 && d.startsWith('3')) d = '92' + d; return d.length >= 11 ? d : ''; };

/* ---------- icons (SF Symbols–style strokes) ---------- */
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M17 14.5c2.4 0 4 1.5 4.5 4"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  chev: '<path d="M2 1.5 7 6.5 2 11.5"/>',
  back: '<path d="M15 4 7 12l8 8"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H5v10h14V11h-1"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.8 7L3 20.5 4.6 16A8 8 0 1 1 20 12z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  checkc: '<circle cx="12" cy="12" r="9.5"/><path d="m7.5 12.5 3 3 6-6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  xc: '<circle cx="12" cy="12" r="9.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
  cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  down: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v10M8 13l4 4 4-4"/>',
  up: '<circle cx="12" cy="12" r="9.5"/><path d="M12 17V7M8 11l4-4 4 4"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.6L20.5 7H6.4"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.3 3.8-6.5 8-6.5s7.3 2.2 8 6.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  logout: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  tray: '<path d="M4 14v6h16v-6M12 3v11M8 10l4 4 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3.5 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4.5M12 17.5v.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h.01"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  return: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  pdf: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 15.5h5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowup: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowdown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  chevr: '<path d="m9 5 7 7-7 7"/>',
  drop: '<path d="M12 3c4.5 5.4 7 8.6 7 12a7 7 0 0 1-14 0c0-3.4 2.5-6.6 7-12z"/>',
};
export const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
export const chev = `<svg class="i chev" viewBox="0 0 9 13" aria-hidden="true">${P.chev}</svg>`;

/* ---------- API ---------- */
const TOKEN = 'qt.token', USER = 'qt.user';
export const auth = {
  get token() { try { return localStorage.getItem(TOKEN); } catch { return null; } },
  get user() { try { return JSON.parse(localStorage.getItem(USER)); } catch { return null; } },
  set(token, user) { try { localStorage.setItem(TOKEN, token); if (user) localStorage.setItem(USER, JSON.stringify(user)); } catch {} },
  clear() { try { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); localStorage.removeItem('qt.boot'); Object.keys(localStorage).filter(k => k.startsWith('qt.c:')).forEach(k => localStorage.removeItem(k)); } catch {} mem.clear(); },
};
export class ApiError extends Error { constructor(m, s) { super(m); this.status = s; } }
export async function api(path, opts = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth.token) headers.authorization = 'Bearer ' + auth.token;
  let res;
  try { res = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
  catch { throw new ApiError('Internet nahi hai. Connection check karein.', 0); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.includes('/auth/login')) { auth.clear(); location.hash = ''; location.reload(); }
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status);
  if (opts.body || (opts.method && opts.method !== 'GET')) mem.clear();
  return data;
}

/* ---------- show saved data at once, then refresh (stale-while-revalidate) ---------- */
const mem = new Map();
export function peek(path) {
  if (mem.has(path)) return mem.get(path);
  try { const v = localStorage.getItem('qt.c:' + path); if (v) { const d = JSON.parse(v); mem.set(path, d); return d; } } catch {}
  return null;
}
// onData(data, fromCache) runs immediately with saved data (if any) and again when fresh data differs.
export async function swr(path, onData, { persist = false } = {}) {
  const old = peek(path), oldS = old ? JSON.stringify(old) : '';
  if (old) onData(old, true);
  const fresh = api(path).then(d => {
    mem.set(path, d);
    const s = JSON.stringify(d);
    if (persist) try { localStorage.setItem('qt.c:' + path, s); } catch {}
    if (s !== oldS) onData(d, false);
    return d;
  });
  if (!old) return fresh;
  fresh.catch(() => {});
  return old;
}

/* ---------- app state ---------- */
export const S = { boot: null, user: null };
export const ROLE_LABEL = { admin: 'Admin (technical)', owner: 'Owner', manager: 'Manager', accountant: 'Accountant', salesman: 'Salesman' };
export const can = {
  staff: () => ['admin', 'owner', 'manager', 'accountant'].includes(S.user?.role),   // all entries + reports
  boss: () => ['admin', 'owner'].includes(S.user?.role),                              // team, settings, cancel bills, profit
  owner: () => S.user?.role === 'owner',                                              // approves big entries
  admin: () => S.user?.role === 'admin',                                              // backup, import
};
// reload boot data without making the user wait
export const refreshBoot = () => reloadBoot().catch(() => {});
export const party = id => S.boot.parties.find(p => p.id === +id);
export const product = id => S.boot.products.find(p => p.id === +id);
export async function reloadBoot() {
  S.boot = await api('/api/boot');
  S.user = S.boot.user;
  try { localStorage.setItem('qt.boot', JSON.stringify(S.boot)); } catch {}
  return S.boot;
}

/* ---------- feedback ---------- */
export function hud(msg, kind = 'ok', ms = 1400) {
  const h = document.createElement('div');
  h.className = `hud ${kind}`;
  h.innerHTML = `${ic(kind === 'ok' ? 'checkc' : kind === 'err' ? 'xc' : 'clock')}<div></div>`;
  h.lastChild.textContent = msg;
  document.body.append(h);
  if (navigator.vibrate && kind !== 'info') navigator.vibrate(kind === 'ok' ? 15 : [20, 40, 20]);
  setTimeout(() => { h.style.transition = 'opacity .25s'; h.style.opacity = 0; setTimeout(() => h.remove(), 260); }, ms);
}
export const fail = e => hud(e.message || String(e), 'err', 2600);

/* ---------- sheets ---------- */
const stack = [];
export function sheet({ title, left = 'Cancel', right, onRight, body, footer, full = false, onClose }) {
  const dim = document.createElement('div'); dim.className = 'dim-bg';
  const el = document.createElement('div'); el.className = 'sheet' + (full ? ' full' : '');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="grab"></div><div class="sheet-h"><button class="nbtn" data-x>${esc(left)}</button><div class="tt">${esc(title || '')}</div><button class="nbtn r" data-r ${right ? '' : 'style="visibility:hidden"'}>${esc(right || '')}</button></div><div class="sheet-b"></div>${footer ? '<div class="sheet-f"></div>' : ''}`;
  const b = $('.sheet-b', el);
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body);
  if (footer) { const f = $('.sheet-f', el); if (typeof footer === 'string') f.innerHTML = footer; else f.append(footer); }
  document.body.append(dim, el);
  document.body.style.overflow = 'hidden';
  const api = {
    el, body: b,
    close(v) {
      if (api.closed) return; api.closed = true;
      el.classList.add('closing'); dim.classList.add('closing');
      setTimeout(() => { el.remove(); dim.remove(); if (!stack.length) document.body.style.overflow = ''; }, 240);
      stack.splice(stack.indexOf(api), 1);
      onClose && onClose(v);
    },
    setRight(txt, disabled) { const r = $('[data-r]', el); r.textContent = txt; r.style.visibility = txt ? '' : 'hidden'; r.disabled = !!disabled; r.style.opacity = disabled ? .4 : 1; },
  };
  stack.push(api);
  dim.onclick = () => api.close();
  $('[data-x]', el).onclick = () => api.close();
  $('[data-r]', el).onclick = () => onRight && onRight(api);
  return api;
}
export const closeTopSheet = () => { const s = stack[stack.length - 1]; if (s) { s.close(); return true; } return false; };
addEventListener('keydown', e => { if (e.key === 'Escape') closeTopSheet(); });

export function actionSheet(title, items) {
  return new Promise(resolve => {
    const dim = document.createElement('div'); dim.className = 'dim-bg'; dim.style.zIndex = 70;
    const el = document.createElement('div'); el.className = 'acts';
    el.innerHTML = `<div class="grp">${title ? `<div class="ttl">${esc(title)}</div>` : ''}${items.map((it, i) => `<button data-i="${i}" style="${it.danger ? 'color:var(--red)' : ''}">${it.icon ? ic(it.icon) : ''}${esc(it.label)}</button>`).join('')}</div><div class="grp"><button class="cancel" data-c>Cancel</button></div>`;
    document.body.append(dim, el);
    const done = v => { el.remove(); dim.remove(); resolve(v); };
    dim.onclick = () => done(null);
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.c !== undefined) return done(null); done(items[+b.dataset.i].value ?? +b.dataset.i); };
  });
}
export async function confirmBox(title, label = 'OK', danger = false) {
  return (await actionSheet(title, [{ label, value: true, danger }])) === true;
}

/* ---------- picker (searchable list in a sheet) ---------- */
export function picker({ title, items, render, search = 'Search', addLabel, onAdd }) {
  return new Promise(resolve => {
    let picked = null;
    const s = sheet({ title, full: true, body: `<div class="search">${ic('search')}<input placeholder="${esc(search)}" autocomplete="off"></div>${addLabel ? `<div class="list" style="margin-bottom:14px"><button class="row action" data-add>${ic('plus')}<span class="grow">${esc(addLabel)}</span></button></div>` : ''}<div class="list" data-l></div>`,
      onClose: () => resolve(picked) });
    const inp = $('input', s.el), L = $('[data-l]', s.el);
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const hits = items.filter(it => !q || it.search.toLowerCase().includes(q)).slice(0, 80);
      L.innerHTML = hits.length ? hits.map((it, i) => `<button class="row ${it.cls || ''}" data-i="${items.indexOf(it)}">${render(it)}</button>`).join('') : `<div class="empty">No match</div>`;
    };
    inp.oninput = draw; draw();
    setTimeout(() => inp.focus(), 350);
    L.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { picked = items[+b.dataset.i]; s.close(); } };
    if (addLabel) $('[data-add]', s.el).onclick = async () => { const v = await onAdd(inp.value.trim()); if (v) { picked = v; s.close(); } };
  });
}

/* ---------- router ---------- */
const routes = [];
export const route = (pattern, fn) => routes.push([pattern, fn]);
let lastDepth = 0;
export function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }
export async function render() {
  const h = location.hash.slice(1) || 'home';
  for (const [p, fn] of routes) {
    const m = h.match(p);
    if (m) {
      const depth = h.split('/').length;
      const view = $('#view');
      view.dataset.dir = depth < lastDepth ? 'back' : '';
      lastDepth = depth;
      $$('[data-tab]').forEach(t => t.classList.toggle('on', h.split('/')[0] === t.dataset.tab || (t.dataset.alias || '').split(' ').includes(h.split('/')[0])));
      try { await fn(view, ...m.slice(1)); } catch (e) { view.innerHTML = `<div class="page"><div class="empty">${ic('warn')}<div>${esc(e.message)}</div></div></div>`; }
      scrollTo(0, 0);
      return;
    }
  }
  go('home');
}

/* ---------- page frame with large title and collapsing bar ---------- */
export function page(view, { title, sub = '', back, backLabel = 'Back', right = '', body = '' }) {
  view.innerHTML = `<header class="nav" id="nav"><div class="nav-in">${back ? `<button class="nbtn" data-back>${ic('back')}${esc(backLabel)}</button>` : ''}<span class="nav-title">${esc(title)}</span><span class="sp"></span>${right}</div></header>
    <div class="page ${view.dataset.dir || ''}"><h1 class="large">${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}<div data-body>${body}</div></div>`;
  if (back) $('[data-back]', view).onclick = () => (history.length > 1 ? history.back() : go(back));
  return $('[data-body]', view);
}
addEventListener('scroll', () => { const n = $('#nav'); if (n) n.classList.toggle('solid', scrollY > 30); }, { passive: true });

export function loadScript(src) {
  return new Promise((res, rej) => { if ($(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); });
}

// Amount in words, Pakistani style (lakh / crore)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
const three = n => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '');
export function words(amount) {
  let n = Math.floor(Math.abs(amount)); const p = Math.round((Math.abs(amount) - n) * 100);
  if (n === 0 && !p) return 'Rupees Zero Only';
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push((cr >= 100 ? three(cr) : two(cr)) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (n) parts.push(three(n));
  return 'Rupees ' + parts.join(' ') + (p ? ' and ' + two(p) + ' Paisa' : '') + ' Only';
}
