import { $, $$, esc, ic, api, auth, S, render, go, reloadBoot, hud } from './core.js';
import { newBill, passwordForm } from './screens.js';
import { openVoice } from './voice.js';

try { const t = localStorage.getItem('qt.theme'); if (t && t !== 'auto') document.documentElement.dataset.theme = t; } catch {}
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4.5 5.4 7 8.6 7 12a7 7 0 0 1-14 0c0-3.4 2.5-6.6 7-12z"/><path d="M9.5 15.5a2.6 2.6 0 0 0 2.5 2.4"/></svg>';

function loginScreen(msg = '') {
  let last = ''; try { last = localStorage.getItem('qt.lastuser') || ''; } catch {}
  $('#app').innerHTML = `<form class="login" autocomplete="on">
    <div class="appicon">${LOGO}</div><h1>Qayam Traders</h1><p>Sign in once. This phone stays signed in.</p>
    <div class="list">
      <div class="row"><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Username" value="${esc(last)}" required></div>
      <div class="row"><input name="password" type="password" autocomplete="current-password" placeholder="Password" required></div>
    </div>
    <div class="err">${esc(msg)}</div>
    <button class="btn" type="submit">Sign In</button>
    <p style="margin-top:22px;font-size:13px">Forgot your password? Ask the admin to reset it.</p></form>`;
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
      b.disabled = false; b.textContent = 'Sign In';
    }
  };
}

function shell() {
  const staff = ['admin', 'accountant'].includes(S.user.role);
  const tabs = [['home', 'Home', 'home', ''], ['bills', 'Bills', 'doc', 'bill'], ['+', 'New', 'plus', ''], ['parties', staff ? 'Parties' : 'Customers', 'people', 'party'], ['more', 'More', 'more', 'products accounts account reports report users audit']];
  const side = [['home', 'Home', 'home'], ['bills', 'Bills', 'doc'], ['parties', staff ? 'Parties' : 'Customers', 'people'], ['products', 'Stock', 'cube'], ...(staff ? [['accounts', 'Accounts', 'list'], ['reports', 'Reports', 'chart']] : []), ['more', 'More', 'more']];
  $('#app').innerHTML = `<div class="shell">
    <nav class="side" aria-label="Sections"><h1>${esc(S.boot.company.name)}</h1>
      <button data-newside>${ic('plus')}New Bill</button><button data-voiceside>${ic('mic')}Voice entry</button><div class="gap"></div>
      ${side.map(([k, l, i]) => `<button data-tab="${k}" data-alias="${k === 'bills' ? 'bill' : k === 'parties' ? 'party' : k === 'accounts' ? 'account' : k === 'reports' ? 'report' : k === 'more' ? 'users audit' : ''}" data-go="${k}">${ic(i)}${l}</button>`).join('')}</nav>
    <main class="main" id="view"></main></div>
    <nav class="tabbar" aria-label="Tabs"><div class="tabbar-in">${tabs.map(([k, l, i, alias]) => k === '+' ? `<button class="tab plus" data-plus aria-label="New bill"><span class="pl">${ic(i)}</span></button>` : `<button class="tab" data-tab="${k}" data-alias="${alias}" data-go="${k}">${ic(i)}<span>${l}</span></button>`).join('')}</div></nav>
    <button class="fab" data-fab aria-label="Voice entry">${ic('mic')}</button>`;
  document.body.onclick = e => {
    const t = e.target.closest('[data-go],[data-plus],[data-fab],[data-newside],[data-voiceside]');
    if (!t || t.closest('.page,.sheet,.acts')) return;
    if (t.dataset.plus !== undefined || t.dataset.newside !== undefined) newBill('sale');
    else if (t.dataset.fab !== undefined || t.dataset.voiceside !== undefined) openVoice();
    else go(t.dataset.go);
  };
}

async function start() {
  let cached = null; try { cached = JSON.parse(localStorage.getItem('qt.boot')); } catch {}
  if (cached && cached.user?.id === auth.user?.id) { S.boot = cached; S.user = cached.user; shell(); render(); reloadBoot().then(() => { $('.side h1') && ($('.side h1').textContent = S.boot.company.name); }).catch(() => {}); }
  else { $('#app').innerHTML = '<div class="loading" style="min-height:100vh"><span class="spin"></span></div>'; await reloadBoot(); shell(); render(); }
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
