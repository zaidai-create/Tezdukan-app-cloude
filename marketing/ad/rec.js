// Records each ad scene as its own video clip from the demo server.
const { chromium } = require('playwright');
const fs = require('fs');
const B = 'http://127.0.0.1:4000', OUT = process.argv[2], ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// visible finger / cursor so viewers see what is tapped
const TOUCH = `
addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style');
  st.textContent = '.adtap{position:fixed;z-index:99999;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(37,99,235,.28);border:3px solid rgba(37,99,235,.85);pointer-events:none;animation:adtap .55s ease-out forwards}@keyframes adtap{from{transform:scale(.4);opacity:1}to{transform:scale(1.35);opacity:0}}' +
    '.adcur{position:fixed;z-index:99999;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(15,23,42,.18);border:2px solid rgba(15,23,42,.55);pointer-events:none;transition:left .25s, top .25s}';
  document.head.append(st);
  const cur = document.createElement('div'); cur.className = 'adcur'; cur.style.left = '-50px'; if (!matchMedia('(pointer: coarse)').matches) document.body.append(cur);
  addEventListener('pointermove', e => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
  addEventListener('pointerdown', e => { const t = document.createElement('div'); t.className = 'adtap'; t.style.left = e.clientX + 'px'; t.style.top = e.clientY + 'px'; document.body.append(t); setTimeout(() => t.remove(), 600); }, true);
});`;

async function token(u, p) {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  return r.json();
}
async function boot(t) { return (await fetch(B + '/api/boot', { headers: { authorization: 'Bearer ' + t } })).json(); }

async function ctxFor(b, user, { web = false, name }) {
  const L = await token(user, user === 'zaid' ? 'Test12345' : 'Pass12345');
  const bt = await boot(L.token);
  const size = web ? { width: 1440, height: 900 } : { width: 390, height: 844 };
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 2, ...(web ? {} : { isMobile: true, hasTouch: true }), serviceWorkers: 'block' });
  await ctx.addInitScript(([tk, u, bt, theme]) => { try { localStorage.setItem('qt.token', tk); localStorage.setItem('qt.user', JSON.stringify(u)); localStorage.setItem('qt.boot', JSON.stringify(bt)); localStorage.setItem('qt.theme', 'light'); } catch {} }, [L.token, L.user, bt]);
  await ctx.addInitScript(TOUCH);
  const page = await ctx.newPage();
  page.__name = name;
  // high-resolution recorder: Chrome screencast frames at device pixels, with their timestamps
  const cdp = await ctx.newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', f => { frames.push({ data: f.data, t: Date.now() / 1000 }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  page.__startRec = async () => { frames.length = 0; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 3000, maxHeight: 3000, everyNthFrame: 1 }); };
  page.__rec = { cdp, frames };
  return { ctx, page, token: L.token };
}
async function finish({ ctx, page }) {
  const { cdp, frames } = page.__rec;
  await sleep(300); const stopT = Date.now() / 1000; await cdp.send('Page.stopScreencast').catch(() => {});
  const dir = `${OUT}/${page.__name}_f`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((f, i) => { const fn = `${String(i).padStart(5, '0')}.jpg`; fs.writeFileSync(`${dir}/${fn}`, Buffer.from(f.data, 'base64')); const d = i + 1 < frames.length ? Math.max(frames[i + 1].t - f.t, 0.001) : Math.max(stopT - f.t, 0.1); lines.push(`file '${fn}'`, `duration ${d.toFixed(4)}`); });
  lines.push(`file '${String(frames.length - 1).padStart(5, '0')}.jpg'`);
  fs.writeFileSync(`${dir}/list.txt`, lines.join('\n'));
  await ctx.close();
  console.log('saved', page.__name, frames.length, 'frames', (stopT - frames[0].t).toFixed(1) + 's');
}
const tap = async (page, sel, opts = {}) => { const el = await page.waitForSelector(sel, { timeout: 15000 }); const bx = await el.boundingBox(); await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 8 }); await sleep(opts.pre ?? 250); await el.click(); await sleep(opts.post ?? 500); };
const scroll = async (page, dy, steps = 30, ms = 30) => { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(ms); } };
const typeIn = async (page, sel, text, delay = 70) => { await page.click(sel); await page.type(sel, text, { delay }); };

async function plainCtx(b, name) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(TOUCH);
  const page = await ctx.newPage(); page.__name = name;
  const cdp = await ctx.newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', f => { frames.push({ data: f.data, t: Date.now() / 1000 }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  page.__startRec = async () => { frames.length = 0; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 3000, maxHeight: 3000, everyNthFrame: 1 }); };
  page.__rec = { cdp, frames };
  return { ctx, page };
}
const scenes = {
  // S2 install from WhatsApp (illustration)
  async install(b) {
    const s = await plainCtx(b, 'install'); const p = s.page;
    await p.goto('file://' + __dirname + '/mock/install.html'); await sleep(300); await p.__startRec(); await sleep(2400);
    await tap(p, '#apk', { post: 2400 });
    await tap(p, '#apk', { post: 1500 });
    await tap(p, '#toSettings', { post: 1200 });
    await tap(p, '#allow', { post: 2200 });
    await tap(p, '#install', { post: 3000 });
    await tap(p, '#openApp', { post: 1600 });
    await tap(p, '#qapp', { post: 1800 });
    await finish(s);
  },
  // S3 first sign-in
  async login(b) {
    const s = await plainCtx(b, 'login'); const p = s.page;
    await p.goto(B + '/app/'); await p.waitForSelector('input[name=username]'); await sleep(500); await p.__startRec(); await sleep(900);
    await tap(p, 'input[name=username]'); await p.type('input[name=username]', 'abdulwahab', { delay: 85 }); await sleep(400);
    await tap(p, 'input[name=password]'); await p.type('input[name=password]', 'Pass12345', { delay: 85 }); await sleep(600);
    await tap(p, 'button[type=submit]'); await p.waitForSelector('.brandbar', { timeout: 20000 }); await sleep(2600);
    await finish(s);
  },
  // S3 app home
  async home(b) {
    const s = await ctxFor(b, 'zain', { name: 'home' }); const p = s.page;
    await p.goto(B + '/app/#home'); await p.waitForSelector('.kt', { timeout: 15000 }); await sleep(800); await p.__startRec(); await sleep(1400);
    await p.mouse.move(195, 500); await scroll(p, 520, 40, 40); await sleep(1500); await scroll(p, 700, 45, 40); await sleep(1500); await scroll(p, 600, 40, 40); await sleep(1500);
    await finish(s);
  },
  // S4 + S5 create bill and invoice
  async bill(b) {
    const s = await ctxFor(b, 'zain', { name: 'bill' }); const p = s.page;
    await p.goto(B + '/app/#home'); await p.waitForSelector('.kt'); await sleep(800); await p.__startRec(); await sleep(400);
    await tap(p, '.tab.plus'); await sleep(700);
    await tap(p, '.qbtn[data-k=bill]'); await p.waitForSelector('.sheet .search input'); await sleep(500);
    await p.type('.sheet .search input', 'mehran', { delay: 90 }); await sleep(500);
    await tap(p, '.sheet [data-i]'); await sleep(900);
    await tap(p, '[data-add]'); await sleep(500);
    await p.type('.sheet:last-of-type .search input', 'premium', { delay: 90 }); await sleep(500);
    await tap(p, '.sheet:last-of-type [data-i]'); await sleep(700);
    await p.fill('[data-q="0"]', ''); await p.type('[data-q="0"]', '8', { delay: 120 }); await sleep(500);
    await tap(p, '[data-dp="0"]'); await p.fill('[data-dp="0"]', ''); await p.type('[data-dp="0"]', '3', { delay: 150 }); await sleep(1300);
    await tap(p, '[data-add]'); await sleep(500);
    await p.type('.sheet:last-of-type .search input', 'classic', { delay: 90 }); await sleep(500);
    await tap(p, '.sheet:last-of-type [data-i]'); await sleep(700);
    await p.fill('[data-q="1"]', ''); await p.type('[data-q="1"]', '2', { delay: 120 }); await sleep(900);
    await p.evaluate(() => document.querySelector('.sheet-b').scrollBy({ top: 420, behavior: 'smooth' })); await sleep(1800);
    await tap(p, '[data-save]', { post: 300 }); await p.waitForSelector('.paper', { timeout: 15000 }); await sleep(1500);
    // invoice + share sheet
    if (await p.$('.acts')) { await sleep(1800); await tap(p, '.acts button.cancel'); }
    await sleep(800);
    await p.evaluate(() => { const w = document.querySelector('.paperwrap'); w.scrollIntoView({ behavior: 'smooth' }); }); await sleep(1500);
    await scroll(p, 300, 25, 40); await sleep(1200);
    await tap(p, '[data-share]'); await sleep(2600);
    await finish(s);
  },
  // S6 voice entry
  async voice(b) {
    const s = await ctxFor(b, 'zain', { name: 'voice' }); const p = s.page;
    // stand-in for the phone's speech recogniser: the sentence appears word by word, as when spoken
    await p.addInitScript(() => {
      class FakeSR { start() { const w = '3 kilo ghee Mehran Hotel ko diya 3000 ka'.split(' '); let i = 0;
        const tick = () => { i++; const res = [{ transcript: w.slice(0, i).join(' ') }]; res.isFinal = i === w.length; this.onresult && this.onresult({ results: [res], resultIndex: 0 });
          if (i < w.length) setTimeout(tick, 330); else setTimeout(() => this.onend && this.onend(), 500); };
        setTimeout(tick, 1100); }
        stop() { this.onend && this.onend(); } }
      window.SpeechRecognition = window.webkitSpeechRecognition = FakeSR;
    });
    await p.goto(B + '/app/#home'); await p.waitForSelector('.kt'); await sleep(800); await p.__startRec(); await sleep(200);
    await tap(p, '[data-fab]'); await p.waitForSelector('[data-text]'); await sleep(900);
    await tap(p, '[data-mic]', { post: 5600 });
    await tap(p, '[data-understand]'); await p.waitForSelector('.approve', { timeout: 15000 }); await sleep(2200);
    await p.evaluate(() => document.querySelector('.sheet-b').scrollBy({ top: 360, behavior: 'smooth' })); await sleep(2000);
    await tap(p, '[data-yes]', { post: 2500 });
    await finish(s);
  },
  // S7 approvals: Kaif sends a big bill, Zain approves
  async approve(b) {
    const k = await token('kaif', 'Pass12345');
    const r = await fetch(B + '/api/invoices', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + k.token }, body: JSON.stringify({ kind: 'sale', party_id: 2, lines: [{ product_id: 7, qty: 20, rate: 1310, tp: 1350 }], paid: 0 }) });
    console.log('kaif bill', await r.text());
    const s = await ctxFor(b, 'zain', { name: 'approve' }); const p = s.page;
    await p.goto(B + '/app/#home'); await p.waitForSelector('.apr', { timeout: 15000 }); await sleep(800); await p.__startRec(); await sleep(1700);
    await tap(p, '.roundbtn[data-go=notices]'); await sleep(2200);
    await tap(p, '[data-back]'); await p.waitForSelector('.apr'); await sleep(1200);
    await tap(p, '.apr [data-ok]', { post: 2800 });
    await finish(s);
  },
  // S8 recovery
  async recovery(b) {
    const s = await ctxFor(b, 'zain', { name: 'recovery' }); const p = s.page;
    await p.goto(B + '/app/#recovery'); await p.waitForSelector('.rrow'); await sleep(800); await p.__startRec(); await sleep(1000);
    await p.mouse.move(195, 600); await scroll(p, 380, 35, 40); await sleep(1200);
    const wa = await p.$('.rrow [data-wa]'); const bx = await wa.boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2, { steps: 10 }); await sleep(400);
    await p.evaluate(() => { window.open = () => null; }); await wa.click(); await sleep(1500);
    await scroll(p, 500, 35, 40); await sleep(1500);
    await finish(s);
  },
  // S9 web software
  async web(b) {
    const s = await ctxFor(b, 'rehan', { web: true, name: 'web' }); const p = s.page;
    await p.goto(B + '/#home'); await p.waitForSelector('.wkpi', { timeout: 15000 }); await sleep(1500); await p.__startRec(); await sleep(1000);
    await p.mouse.move(800, 500); await scroll(p, 600, 40, 30); await sleep(1300);
    await p.evaluate(() => scrollTo(0, 0));
    await tap(p, '.wnav [data-go=bills]'); await p.waitForSelector('.rtable', { timeout: 15000 }); await sleep(1500);
    await tap(p, '[data-fp]'); await p.waitForSelector('.sheet .search input'); await p.type('.sheet .search input', 'mehran', { delay: 90 }); await sleep(400); await tap(p, '.sheet [data-i]'); await sleep(2000);
    await p.goto(B + '/#itemsales'); await p.waitForSelector('.rtable'); await sleep(2200);
    await p.goto(B + '/#report/pl'); await p.waitForSelector('.sec-h'); await sleep(2200);
    await finish(s);
  },
  // S10 roles
  async roles(b) {
    const s = await ctxFor(b, 'zain', { name: 'roles' }); const p = s.page;
    await p.goto(B + '/app/#users'); await p.waitForSelector('[data-u]'); await sleep(800); await p.__startRec(); await sleep(1000);
    await p.mouse.move(195, 600); await scroll(p, 420, 35, 40); await sleep(2200);
    await finish(s);
  },
};

(async () => {
  fs.mkdirSync(OUT + '/tmp', { recursive: true });
  const b = await chromium.launch();
  for (const [k, fn] of Object.entries(scenes)) { if (ONLY.length && !ONLY.includes(k)) continue; try { await fn(b); } catch (e) { console.log('FAIL', k, e.message.split('\n')[0]); } }
  await b.close();
})();
