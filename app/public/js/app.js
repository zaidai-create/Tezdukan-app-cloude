import { $, $$, esc, ic, api, auth, S, render, go, reloadBoot, hud, UI, nice, can, ROLE_LABEL } from './core.js';
import { newBill, passwordForm } from './screens.js';
import { openVoice } from './voice.js';
import { quickAdd } from './finance.js';
import { startPolling } from './approvals.js';
import './registers.js';

try { const t = localStorage.getItem('qt.theme'); if (t && t !== 'auto') document.documentElement.dataset.theme = t; } catch {}
const LOGO = '<img src="/brand/logo-mark.png" alt="">';

function loginScreen(msg = '') {
  let last = ''; try { last = localStorage.getItem('qt.lastuser') || ''; } catch {}
  if (UI === 'web') {
    $('#app').innerHTML = `<div class="wlogin"><div class="l"><div style="display:flex;gap:12px;align-items:center"><span class="appicon" style="width:48px;height:48px;border-radius:14px;margin:0;padding:6px">${LOGO}</span><b style="font-size:20px">Qayam Traders</b></div>
      <div><h1>Dairy distribution, accounts and stock in one place.</h1><ul><li>Bills, returns and payments with WhatsApp sharing</li><li>Live stock, customer balances and recovery</li><li>Ledger, trial balance, profit and balance sheet</li></ul></div><small style="opacity:.7">Protected sign-in. Each person sees only what their role allows.</small></div>
      <div class="r"><form autocomplete="on"><h2 style="font-size:28px;margin:0 0 4px">Welcome back</h2><p class="l2" style="margin:0 0 22px">Sign in to your workspace</p>
        <label>Username<input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(last)}" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="err">${esc(msg)}</div><button class="wbtn" style="width:100%;justify-content:center;height:46px" type="submit">Sign in</button>
        <p class="l2" style="margin-top:16px;font-size:13px">Forgot your password? Ask the admin to reset it. On a phone, open <b>/app</b> for the mobile app.</p></form></div></div>`;
    return wireLogin(last);
  }
  $('#app').innerHTML = `<form class="login" autocomplete="on">
    <img class="loginlogo" src="/brand/logo-full.png" alt="Qayam Traders"><p>Sign in once. This phone stays signed in.</p>
    <div class="list">
      <div class="row"><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Username" value="${esc(last)}" required></div>
      <div class="row"><input name="password" type="password" autocomplete="current-password" placeholder="Password" required></div>
    </div>
    <div class="err">${esc(msg)}</div>
    <button class="btn" type="submit">Sign In</button>
    <p style="margin-top:22px;font-size:13px">Forgot your password? Ask the admin to reset it.</p></form>`;
  wireLogin(last);
}
function wireLogin(last) {
  const f = $('form');
  setTimeout(() => (last ? f.password : f.username).focus(), 100);
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button', f); b.disabled = true; b.innerHTML = '<span class="spin" style="border-top-color:#fff"></span>';
    try {
      const r = await api('/api/auth/login', { body: { username: f.username.value, password: f.password.value } });
      auth.set(r.token, r.user);
      try { localStorage.setItem('qt.lastuser', r.user.username); } catch {}
      await start();
    } catch (x) {
      $('.err', f).textContent = x.message; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
      b.disabled = false; b.textContent = UI === 'web' ? 'Sign in' : 'Sign In';
    }
  };
}

function shell() {
  if (UI === 'web') return webShell();
  const staff = can.staff();
  const tabs = [['home', 'Home', 'home', ''], ['bills', 'Bills', 'doc', 'bill register'], ['+', 'New', 'plus', ''], ['parties', staff ? 'Parties' : 'Customers', 'people', 'party'], ['more', 'More', 'more', 'products product accounts account reports report users audit approvals myrequests notices recovery payables moneyreg itemsales partysum']];
  const side = [['home', 'Home', 'home'], ['bills', 'Bills', 'doc'], ['parties', staff ? 'Parties' : 'Customers', 'people'], ['products', 'Stock', 'cube'], ...(staff ? [['accounts', 'Accounts', 'list'], ['reports', 'Reports', 'chart']] : []), ['more', 'More', 'more']];
  $('#app').innerHTML = `<div class="shell">
    <nav class="side" aria-label="Sections"><h1>${esc(S.boot.company.name)}</h1>
      <button data-newside>${ic('plus')}New</button><button data-voiceside>${ic('mic')}Voice entry</button><div class="gap"></div>
      ${side.map(([k, l, i]) => `<button data-tab="${k}" data-alias="${k === 'bills' ? 'bill' : k === 'parties' ? 'party' : k === 'accounts' ? 'account' : k === 'reports' ? 'report' : k === 'more' ? 'users audit' : ''}" data-go="${k}">${ic(i)}${l}</button>`).join('')}</nav>
    <main class="main" id="view"></main></div>
    <nav class="tabbar" aria-label="Tabs"><div class="tabbar-in">${tabs.map(([k, l, i, alias]) => k === '+' ? `<button class="tab plus" data-plus aria-label="Add new"><span class="pl">${ic(i)}</span></button>` : `<button class="tab" data-tab="${k}" data-alias="${alias}" data-go="${k}">${ic(i)}<span>${l}</span></button>`).join('')}</div></nav>
    <button class="fab" data-fab aria-label="Voice entry">${ic('mic')}</button>`;
  document.body.onclick = e => {
    const t = e.target.closest('[data-go],[data-plus],[data-fab],[data-newside],[data-voiceside]');
    if (!t || t.closest('.page,.sheet,.acts')) return;
    if (t.dataset.plus !== undefined || t.dataset.newside !== undefined) quickAdd();
    else if (t.dataset.fab !== undefined || t.dataset.voiceside !== undefined) openVoice();
    else go(t.dataset.go);
  };
}

function webShell() {
  const staff = can.staff(), boss = can.boss();
  const N = [['home', 'Dashboard', 'home'], ...(boss ? [['approvals', 'Approvals', 'checkc']] : [['myrequests', 'My approval requests', 'clock']]), ['#', 'Sales & recovery'], ['bills', 'Bills', 'doc'], ['moneyreg', 'Payments register', 'wallet'], ['recovery', 'Recovery & reminders', 'bell'], ['parties', staff ? 'Customers & suppliers' : 'Customers', 'people'], ...(staff ? [['payables', 'Payables', 'clock']] : []), ['#', 'Stock'], ['products', 'Stock & products', 'cube'],
    ...(staff ? [['#', 'Accounts'], ['accounts', 'Chart of accounts', 'list'], ['reports', 'Reports', 'chart']] : []), ...(boss ? [['#', can.owner() ? 'Owner' : 'Admin'], ['users', 'Team & roles', 'person'], ['audit', 'Activity log', 'clock']] : []), ['more', 'More', 'more']];
  const alias = { bills: 'bill register', parties: 'party', accounts: 'account', reports: 'report itemsales partysum', products: 'product', moneyreg: '' };
  const first = String(S.user.name).split(' ')[0];
  $('#app').innerHTML = `<div class="wshell"><aside class="wside"><div class="wbrand">${LOGO}<div><b>${esc(nice(S.boot.company.name))}</b><small>Dairy distribution ERP</small></div></div>
      <nav class="wnav">${N.map(([k, l, i]) => k === '#' ? `<div class="sec">${l}</div>` : `<button data-tab="${k}" data-alias="${alias[k] || ''}" data-go="${k}">${ic(i)}${l}</button>`).join('')}</nav>
      <div class="wfoot"><span class="av">${esc(first.slice(0, 1))}</span><div><b>${esc(S.user.name)}</b><small>${esc(ROLE_LABEL[S.user.role] || S.user.role)}</small></div></div></aside>
    <div class="wmain"><header class="wtop"><label class="wsearch">${ic('search')}<input data-wsearch placeholder="Search bills by customer or number…"></label><span style="flex:1"></span>
      <button class="wicon bellw" data-go="notices" aria-label="Notifications" title="Notifications">${ic('bell')}<span class="dot" data-dot hidden></span></button><button class="wicon" data-voiceside aria-label="Voice entry" title="Voice entry">${ic('mic')}</button><button class="wbtn" data-newside>${ic('plus')}New</button></header>
      <main id="view"></main></div></div>
    <nav class="tabbar" aria-label="Tabs"><div class="tabbar-in">${[['home', 'Home', 'home'], ['bills', 'Bills', 'doc'], ['+', '', 'plus'], ['parties', 'Parties', 'people'], ['more', 'More', 'more']].map(([k, l, i]) => k === '+' ? `<button class="tab plus" data-plus aria-label="Add new"><span class="pl">${ic(i)}</span></button>` : `<button class="tab" data-tab="${k}" data-go="${k}">${ic(i)}<span>${l}</span></button>`).join('')}</div></nav>`;
  $('[data-wsearch]').onkeydown = e => { if (e.key === 'Enter') { try { sessionStorage.setItem('qt.q', e.target.value); } catch {} go('bills'); } };
  document.body.onclick = e => {
    const t = e.target.closest('[data-go],[data-plus],[data-newside],[data-voiceside]');
    if (!t || t.closest('.page,.sheet,.acts')) return;
    if (t.dataset.plus !== undefined || t.dataset.newside !== undefined) quickAdd();
    else if (t.dataset.voiceside !== undefined) openVoice();
    else go(t.dataset.go);
  };
  F();
}
function F() {}

async function start() {
  let cached = null; try { cached = JSON.parse(localStorage.getItem('qt.boot')); } catch {}
  if (cached && cached.user?.id === auth.user?.id) { S.boot = cached; S.user = cached.user; shell(); render(); reloadBoot().then(() => { if (S.user.role !== cached.user.role) { shell(); render(); } $('.side h1') && ($('.side h1').textContent = S.boot.company.name); }).catch(() => {}); }
  else { $('#app').innerHTML = '<div class="loading" style="min-height:100vh"><span class="spin"></span></div>'; await reloadBoot(); shell(); render(); }
  startPolling();
  if (S.user.must_change || auth.user?.must_change) setTimeout(() => passwordForm(true), 600);
}

addEventListener('hashchange', () => { if (S.boot) render(); });
const net = () => { let b = $('.offline'); if (navigator.onLine) { b && b.remove(); return; } if (!b) { b = document.createElement('div'); b.className = 'offline'; b.textContent = 'Offline: internet nahi hai'; document.body.append(b); } };
addEventListener('online', net); addEventListener('offline', net); net();
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('/sw.js').catch(() => {});

(async () => {
  if (!auth.token) return loginScreen();
  try { await start(); }
  catch (e) { if (e.status === 401) loginScreen(); else { $('#app').innerHTML = `<div class="login"><div class="appicon">${LOGO}</div><h1>Can't connect</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Try again</button></div>`; } }
})();
window.addEventListener('unhandledrejection', e => { if (e.reason?.message) hud(e.reason.message, 'err', 2400); });
