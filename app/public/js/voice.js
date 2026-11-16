// Voice entry: speak -> server understands -> approval card -> user approves -> entry saved.
import { $, $$, esc, ic, chev, api, S, can, sheet, picker, hud, fail, rs, qty as fq, nice, r2, reloadBoot, go } from './core.js';
import { romanize } from './roman.js';

// Google hears spoken Urdu best in "hi-IN" (same spoken language); the app always shows it back in Roman Urdu.
const LANGS = [['hi-IN', 'Urdu (best)'], ['ur-PK', 'اردو'], ['en-IN', 'English']];
const lang = () => { try { return localStorage.getItem('qt.lang2') || 'hi-IN'; } catch { return 'hi-IN'; } };

// One sentence per tap (Android repeats words in "continuous" mode), with up to 5 guesses of what was said.
function recognizer(onText, onState) {
  const Cap = window.Capacitor, Native = Cap?.isNativePlatform?.() && Cap.Plugins?.SpeechRecognition;
  if (Native) {
    const SR = Cap.Plugins.SpeechRecognition;
    return {
      async start(prefix) {
        try { const p = await (SR.requestPermissions ? SR.requestPermissions() : SR.requestPermission()); if (p && p.speechRecognition && p.speechRecognition !== 'granted') throw new Error('Mic permission nahi mili.'); } catch (e) { if (/permission/i.test(e.message)) throw e; }
        onState(true);
        try {
          const r = await SR.start({ language: lang(), maxResults: 5, partialResults: false, popup: false, prompt: 'Boliye' });
          const m = (r?.matches || []).filter(Boolean);
          if (m.length) onText(prefix + m[0], m.map(x => prefix + x), true);
        } finally { onState(false); }
      },
      async stop() { try { await SR.stop(); } catch {} onState(false); },
    };
  }
  const W = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!W) return null;
  let rec = null, on = false;
  return {
    start(prefix) {
      rec = new W(); rec.lang = lang(); rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 5;
      rec.onresult = e => {
        const res = e.results[e.results.length - 1];
        const alts = [...res].map(a => a.transcript).filter(Boolean);
        onText(prefix + alts[0], alts.map(a => prefix + a), res.isFinal);
      };
      rec.onend = () => { on = false; onState(false); };
      rec.onerror = e => { if (e.error === 'not-allowed') fail(new Error('Mic permission nahi mili. Browser settings mein allow karein.')); else if (e.error === 'no-speech') hud('Awaaz nahi aayi, dobara bolein', 'info'); };
      rec.start(); on = true; onState(true);
    },
    stop() { if (on && rec) rec.stop(); },
  };
}

export function openVoice() {
  const s = sheet({ title: 'Bol kar entry', full: true, body: `
    <button class="vmic" data-mic aria-label="Start or stop listening">${ic('mic')}</button>
    <div class="vstate" data-state>Mic dabayein aur bolein</div>
    <textarea class="vtext" data-text rows="3" placeholder="Ya yahan likhein, maslan: 3 kg ghee Mehran Hotel ko diya 3000 ka"></textarea>
    <div class="chips" data-heard></div>
    <div class="seg" style="margin-top:12px" data-lang>${LANGS.map(([k, l]) => `<button data-l="${k}" class="${lang() === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn" data-understand style="margin-top:4px">Samjho (Understand)</button>
    <div data-out></div>
    <p class="vex"><b>Tips:</b> ek waqt mein ek entry bolein, aahista aur saaf. Customer aur product ka naam waise bolein jaise list mein hai.<br><b>Misalein:</b><br>“Hyderabad Bakers ko 50 kilo butter premium 1330 rate se diya, 30000 cash mila”<br>“Saim Ali se 50 hazar cash mila”<br>“Petrol 2000 kharcha”${can.staff() ? '<br>“R S Food se 500 kg butter premium 1150 rate kharida”' : ''}</p>` });
  const T = $('[data-text]', s.el), M = $('[data-mic]', s.el), st = $('[data-state]', s.el), H = $('[data-heard]', s.el);
  let alts = [], listening = false;
  const showAlts = () => {
    const u = [...new Set(alts.map(a => romanize(a).trim()))].filter(a => a && a !== T.value.trim()).slice(0, 4);
    H.innerHTML = u.length ? `<span class="l2" style="font-size:13px;align-self:center;flex:none">Ya shayad:</span>${u.map(a => `<button class="chip" data-alt="${esc(a)}">${esc(a)}</button>`).join('')}` : '';
  };
  const rec = recognizer((text, list, final) => {
    T.value = romanize(text).trim();
    if (final) { alts = list; showAlts(); }
  }, on => {
    listening = on; M.classList.toggle('on', on);
    st.textContent = on ? 'Sun raha hoon… chup hone par khud ruk jayega' : (T.value ? 'Sahi likha hai? Zaroorat ho to theek karein, phir “Samjho”' : 'Mic dabayein aur ek jumla bolein');
  });
  if (!rec) st.innerHTML = 'Is browser mein app ka mic nahi chalta. Keyboard ka <b>mic</b> button daba kar bolein, ya likhein.';
  M.onclick = async () => {
    if (!rec) { T.focus(); return; }
    try { if (listening) await rec.stop(); else { const pre = T.value.trim() && !alts.length ? T.value.trim() + ' ' : ''; alts = []; H.innerHTML = ''; if (!pre) T.value = ''; await rec.start(pre); } } catch (e) { fail(e); }
  };
  H.onclick = e => { const b = e.target.closest('[data-alt]'); if (!b) return; const cur = T.value; T.value = b.dataset.alt; alts = [cur, ...alts]; showAlts(); };
  T.oninput = () => { alts = []; H.innerHTML = ''; };
  $('[data-lang]', s.el).onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; try { localStorage.setItem('qt.lang2', b.dataset.l); } catch {} $$('[data-l]', s.el).forEach(x => x.classList.toggle('on', x === b)); };
  $('[data-understand]', s.el).onclick = async () => {
    if (listening) await rec?.stop();
    const text = T.value.trim(); if (!text) return hud('Pehle kuch bolein ya likhein', 'err');
    const btn = $('[data-understand]', s.el); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    try { const r = await api('/api/voice/parse', { body: { text, alternatives: alts.map(a => romanize(a).trim()).filter(a => a && a !== text) } }); if (r.draft.text && r.draft.text !== text) T.value = r.draft.text; approvalCard(s, r.id, r.draft); }
    catch (e) { fail(e); }
    finally { btn.disabled = false; btn.textContent = 'Samjho (Understand)'; }
  };
  setTimeout(() => { if (rec) M.click(); }, 450);
}

const INTENTS = [['sale', 'Sale'], ['purchase', 'Purchase'], ['receipt', 'Received'], ['payment', 'Paid'], ['expense', 'Expense']];

function approvalCard(s, id, d) {
  const out = $('[data-out]', s.el);
  d.items = d.items || []; d.payment = d.payment || { mode: 'credit', amount: 0 };
  if (!S.user || S.user.role === 'salesman') d.intent = ['sale', 'receipt'].includes(d.intent) ? d.intent : 'sale';
  const kindOf = () => (d.intent === 'purchase' || d.intent === 'payment' ? 'V' : 'C');
  const total = () => r2(d.items.reduce((a, it) => a + (+it.qty || 0) * (+it.rate || 0), 0));
  const sentence = () => {
    const pn = d.party ? nice(d.party.name) : '(choose party)';
    if (d.intent === 'sale' || d.intent === 'purchase') {
      const its = d.items.map(it => `${fq(it.qty)} ${it.unit || ''} ${nice(it.name)}`.replace(/\s+/g, ' ').trim()).join(', ') || '(no items)';
      const paid = d.payment.mode === 'credit' ? 'on credit' : `${d.payment.mode === 'bank' ? 'bank' : 'cash'} ${d.payment.amount >= total() ? 'paid in full' : rs(d.payment.amount) + ' paid'}`;
      return `${its} ${d.intent === 'sale' ? 'sold to' : 'bought from'} ${pn} for ${rs(total())} · ${paid}`;
    }
    if (d.intent === 'receipt') return `${rs(d.amount)} received from ${pn} (${d.payment.mode === 'bank' ? 'bank' : 'cash'})`;
    if (d.intent === 'payment') return `${rs(d.amount)} paid to ${pn} (${d.payment.mode === 'bank' ? 'bank' : 'cash'})`;
    if (d.intent === 'expense') return `Expense ${rs(d.amount)} · ${d.account ? nice(d.account.name) : 'choose account'}${d.note ? ' · ' + d.note : ''}`;
    return 'Choose what this entry is';
  };
  const allowed = can.staff() ? INTENTS : INTENTS.filter(x => ['sale', 'receipt'].includes(x[0]));
  const draw = () => {
    const goods = d.intent === 'sale' || d.intent === 'purchase';
    out.innerHTML = `<div class="sec-h">Approval</div>
      <div class="approve"><div class="say">${esc(sentence())}</div><div class="meta">Aap ne kaha: “${esc(d.text)}”</div>${d.notes?.length ? `<ul class="notes">${d.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>
      <div class="seg" style="margin-top:14px" data-intent>${allowed.map(([k, l]) => `<button data-k="${k}" class="${d.intent === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${d.intent !== 'expense' ? `<div class="list"><button class="row" data-party><span class="grow"><span class="t">${d.party ? esc(nice(d.party.name)) : '<span class="tint">Choose ' + (kindOf() === 'V' ? 'supplier' : 'customer') + '</span>'}${d.party && !d.party.id ? '<span class="new">NEW</span>' : ''}</span><span class="s">${kindOf() === 'V' ? 'Supplier' : 'Customer'}</span></span>${chev}</button></div>` : ''}
      ${goods ? `<div class="sec-h">Items</div><div class="list">${d.items.map((it, k) => `<div class="item"><button class="nm" data-prod="${k}" style="border:0;background:none;text-align:left;padding:0;color:inherit">${esc(nice(it.name))}${!it.product_id ? '<span class="new">NEW</span>' : ''}${it.candidates?.length > 1 ? ' <span class="tint" style="font-size:13px">change</span>' : ''}<small>${esc(it.unit || '')}</small></button><div class="amt">${rs(it.qty * it.rate)}</div>
        <div class="ctl"><div class="stepper"><button data-dq="${k}:-1">−</button><input inputmode="decimal" data-q="${k}" value="${it.qty}"><button data-dq="${k}:1">+</button></div><span class="l2">×</span><input class="rate" inputmode="decimal" data-r="${k}" value="${it.rate}"><button class="x" data-rm="${k}" aria-label="Remove">${ic('trash')}</button></div></div>`).join('')}
        <button class="row action" data-additem>${ic('plus')}<span class="grow">Add item</span></button></div>` : ''}
      ${d.intent !== 'unknown' ? `<div class="sec-h">${goods ? 'Payment' : 'Amount'}</div><div class="list">
        ${goods ? `<div class="row"><div class="seg" style="margin:0;flex:1" data-pay>${[['credit', 'Credit'], ['cash', 'Cash'], ...(can.staff() ? [['bank', 'Bank']] : [])].map(([k, l]) => `<button data-p="${k}" class="${d.payment.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          ${d.payment.mode !== 'credit' ? `<div class="row"><label>Received</label><input class="fld num" inputmode="decimal" data-paid value="${d.payment.amount || total()}"></div>` : ''}
          <div class="row"><span class="grow" style="font-weight:600">Total</span><b class="num">${rs(total())}</b></div>`
        : `<div class="row"><label>Amount</label><input class="fld num" inputmode="decimal" data-amt value="${d.amount || ''}" placeholder="0"></div>
           ${d.intent !== 'expense' && can.staff() ? `<div class="row"><div class="seg" style="margin:0;flex:1" data-pay>${[['cash', 'Cash'], ['bank', 'Bank']].map(([k, l]) => `<button data-p="${k}" class="${d.payment.mode === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>` : ''}
           ${d.intent === 'expense' ? `<button class="row" data-acc><span class="grow">${d.account ? esc(nice(d.account.name)) : '<span class="tint">Choose expense account</span>'}</span>${chev}</button><div class="row"><label>Note</label><input class="fld" data-note value="${esc(d.note || '')}"></div>` : ''}`}
      </div>` : ''}
      <div class="btns" style="margin-top:20px"><button class="btn gray" data-no>Cancel</button><button class="btn green" data-yes>${ic('check')} Approve</button></div>`;
  };
  draw();
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  out.oninput = e => {
    const t = e.target;
    if (t.dataset.q !== undefined) { d.items[+t.dataset.q].qty = +t.value || 0; upd(); }
    if (t.dataset.r !== undefined) { d.items[+t.dataset.r].rate = +t.value || 0; upd(); }
    if (t.dataset.paid !== undefined) { d.payment.amount = +t.value || 0; upd(); }
    if (t.dataset.amt !== undefined) { d.amount = +t.value || 0; upd(); }
    if (t.dataset.note !== undefined) { d.note = t.value; upd(); }
  };
  const upd = () => { $('.say', out).textContent = sentence(); d.items.forEach((it, k) => { const a = $$('.item .amt', out)[k]; if (a) a.textContent = rs(it.qty * it.rate); }); const tb = $$('.row b.num', out).at(-1); if (tb && (d.intent === 'sale' || d.intent === 'purchase')) tb.textContent = rs(total()); };
  out.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { d.intent = b.dataset.k; if ((d.intent === 'receipt' || d.intent === 'payment') && !d.amount) d.amount = total() || d.payment.amount; if (d.party && d.party.kind && d.party.kind !== kindOf()) d.party = { id: null, name: d.party.name, kind: kindOf() }; if (d.payment.mode === 'credit' && (d.intent === 'receipt' || d.intent === 'payment')) d.payment.mode = 'cash'; draw(); return; }
    if (b.dataset.p) { d.payment.mode = b.dataset.p; if (b.dataset.p !== 'credit' && !d.payment.amount) d.payment.amount = total(); draw(); return; }
    if (b.dataset.dq) { const [k, dd] = b.dataset.dq.split(':'); const it = d.items[+k]; it.qty = Math.max(0, r2((+it.qty || 0) + +dd)); $(`[data-q="${k}"]`, out).value = it.qty; upd(); return; }
    if (b.dataset.rm) { d.items.splice(+b.dataset.rm, 1); draw(); return; }
    if (b.dataset.party !== undefined) {
      const kind = kindOf(), guess = d.party && !d.party.id ? d.party.name : '';
      const list = S.boot.parties.filter(p => p.kind === kind).map(p => ({ ...p, search: p.name + ' ' + p.city }));
      const r = await picker({ title: kind === 'V' ? 'Supplier' : 'Customer', items: list, render: p => `<span class="avatar">${esc(nice(p.name).slice(0, 1))}</span><span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${esc(nice(p.city) || '')}</span></span><span class="v num">${rs(p.balance)}</span>`,
        addLabel: guess ? `New: ${nice(guess)}` : 'Add new', onAdd: async q => ({ id: null, name: guess || q || 'New party', kind, isNew: true }) });
      if (r) { d.party = { id: r.id || null, name: r.name, kind }; draw(); }
      return;
    }
    if (b.dataset.prod !== undefined || b.dataset.additem !== undefined) {
      const k = b.dataset.prod !== undefined ? +b.dataset.prod : -1, cur = d.items[k];
      const cand = cur?.candidates?.map(c => c.id) || [];
      const list = S.boot.products.map(p => ({ ...p, search: p.name + ' ' + (p.aliases || ''), cls: cand.includes(p.id) ? '' : '' })).sort((a, b) => cand.includes(b.id) - cand.includes(a.id));
      const r = await picker({ title: 'Product', items: list, render: p => `<span class="grow"><span class="t">${esc(nice(p.name))}</span><span class="s">${fq(p.stock)} ${esc(p.unit)} in stock</span></span><span class="v num">${rs(p.price)}</span>`,
        addLabel: can.staff() ? (cur && !cur.product_id ? `New product: ${nice(cur.name)}` : 'New product') : null, onAdd: async q => ({ id: null, name: (cur && !cur.product_id ? cur.name : q) || 'New product', unit: cur?.unit || 'pc', price: cur?.rate || 0 }) });
      if (r) {
        const it = { product_id: r.id || null, name: r.name, unit: r.unit || 'pc', qty: cur?.qty || 1, rate: cur?.rate || (d.intent === 'purchase' ? r.cost : r.price) || 0 };
        if (k >= 0) d.items[k] = it; else d.items.push(it);
        draw();
      }
      return;
    }
    if (b.dataset.acc !== undefined) {
      const list = S.boot.accounts.filter(a => a.type === 'D' && a.grp !== 'Cost of Sales' && a.code !== '5000').map(a => ({ ...a, search: a.name + ' ' + a.code }));
      const r = await picker({ title: 'Expense account', items: list, render: a => `<span class="grow"><span class="t">${esc(nice(a.name))}</span><span class="s">${esc(a.code)}</span></span>` });
      if (r) { d.account = { code: r.code, name: r.name }; draw(); }
      return;
    }
    if (b.dataset.no !== undefined) { api(`/api/voice/${id}/reject`, { body: {} }).catch(() => {}); out.innerHTML = ''; return; }
    if (b.dataset.yes !== undefined) {
      if (d.intent === 'unknown') return hud('Upar se chunein: Sale, Received…', 'err');
      if (d.intent !== 'expense' && !d.party) return hud('Party chunein', 'err');
      if ((d.intent === 'sale' || d.intent === 'purchase') && (!d.items.length || d.items.some(it => !(it.qty > 0) || !(it.rate > 0)))) return hud('Har item ki qty aur rate likhein', 'err');
      if (d.intent === 'sale' || d.intent === 'purchase') { if (d.payment.mode !== 'credit') d.payment.amount = Math.min(d.payment.amount || total(), total()); }
      else { if (!(d.amount > 0)) return hud('Amount likhein', 'err'); d.payment.amount = d.amount; }
      if (d.intent === 'expense' && !d.account) return hud('Expense account chunein', 'err');
      b.disabled = true; b.innerHTML = '<span class="spin"></span>';
      try {
        const r = await api(`/api/voice/${id}/approve`, { body: { draft: d } });
        await reloadBoot();
        s.close();
        hud('Entry ho gayi');
        if (r.kind === 'sale' || r.kind === 'purchase') go(`bill/${r.id}?share`);
        else if (d.party?.id || r.kind === 'receipt' || r.kind === 'payment') { const p = S.boot.parties.find(x => x.name.toLowerCase() === d.party.name.toLowerCase()); if (p) go(`party/${p.id}`); }
      } catch (err) { fail(err); b.disabled = false; b.innerHTML = `${ic('check')} Approve`; }
    }
  };
}
