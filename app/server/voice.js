// Turns a spoken/typed sentence (Roman Urdu / English mix) into a draft entry the user approves.
// Example: "3 kg ghee Mehran Hotel ko diya 3000 ka" -> sale, party Mehran Hotel (new), 3 kg Ghee, total 3000.
// Rule-based so it works without any paid AI key; the result is always shown for approval, never posted directly.

const DIG = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
const WORDNUM = {
  ek: 1, aik: 1, one: 1, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, panj: 5, five: 5,
  chay: 6, chhe: 6, chhay: 6, che: 6, six: 6, saat: 7, sat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9, das: 10, dus: 10, ten: 10,
  gyarah: 11, barah: 12, bara: 12, pandrah: 15, bees: 20, twenty: 20, pachees: 25, pachis: 25, tees: 30, chalees: 40, chalis: 40, pachas: 50, pachaas: 50, fifty: 50,
  adha: 0.5, aadha: 0.5, half: 0.5, dedh: 1.5, dhai: 2.5, dhaai: 2.5, sawa: 1.25,
};
const MULT = { sau: 100, so: 100, hundred: 100, hazar: 1000, hazaar: 1000, hajar: 1000, hzar: 1000, thousand: 1000, k: 1000, lakh: 100000, lac: 100000, lakhs: 100000, lacs: 100000 };
const UNITS = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', killo: 'kg',
  g: 'g', gm: 'g', gram: 'g', grams: 'g',
  pc: 'pc', pcs: 'pc', piece: 'pc', pieces: 'pc', nag: 'pc', adad: 'pc', dana: 'pc', packet: 'pc', packets: 'pc', pkt: 'pc', pouch: 'pc', pouches: 'pc', tin: 'pc',
  ctn: 'ctn', crtn: 'ctn', carton: 'ctn', cartons: 'ctn', cartoon: 'ctn', cartoons: 'ctn', peti: 'ctn', petiyan: 'ctn', box: 'ctn', boxes: 'ctn', dabba: 'ctn', dabbe: 'ctn',
  dozen: 'dozen', darjan: 'dozen', litre: 'ltr', liter: 'ltr', ltr: 'ltr', litres: 'ltr',
};
const STOP = new Set('ko ne se ka ki ke diya diye di dia de dena liya liye li le lia mila mile mili gaya gaye gai hai hain tha the thi aur and or or to ki ka wala wale wali ye yeh wo woh is us mein me main par pe per rate rs rupay rupaye rupees rupee rupe total sath saath ke bhai sahab sahib jo hua hue kiya kia kar karo karna entry bill bana banao sale sell sold diya. a an the of for at with from cash naqad naqd udhar udhaar udhaaar credit baqi baki bank online transfer received receive jama wasool wusool recovery payment paid kharcha kharch expense hisab hisaab se'.split(' '));
const GENERIC = new Set('hotel hotels restaurant restaurent resturant cafe traders trader trading store stores bakers bakery sweets dairy diary foods food grill mart general enterprises enterprise agency company co pvt ltd limited and & shop'.split(' '));
const CITY = new Set('hyderabad hyd karachi khi lahore quetta sukkur nawabshah talhar kotri jamshoro tando adam bhan auto m.p. khas hirabad latifabad qasimabad'.split(' '));

const W = s => String(s || '').toLowerCase();
function lev(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// how alike two words are, 0..1 (handles "mayonese" ~ "mayonnaise", "panir" ~ "paneer")
function sim(a, b) {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.9;
  const d = lev(a, b), L = Math.max(a.length, b.length);
  if (L <= 3) return d === 0 ? 1 : 0;
  return Math.max(0, 1 - d / L);
}

export function tokenize(text) {
  let s = W(text).replace(/[٠-٩۰-۹]/g, d => DIG[d]);
  s = s.replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d),(\d{3})/g, '$1$2');
  s = s.replace(/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|ltr|pcs|pc|ctn|k)\b/g, '$1 $2');
  s = s.replace(/rs\.?\s*/g, 'rs ').replace(/@/g, ' rate ').replace(/\//g, ' per ');
  return s.split(/[^a-z0-9.&؀-ۿ]+/).map(t => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
}

// Merge number words: "teen hazar paanch sau" -> 3500, "3 hazar" -> 3000, "2.5" -> 2.5
function numbers(tokens) {
  const out = []; let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const isNum = x => /^\d+(\.\d+)?$/.test(x) || (x in WORDNUM);
    const valOf = x => /^\d/.test(x) ? parseFloat(x) : WORDNUM[x];
    // "do" means two only before a unit or multiplier
    const doNum = t === 'do' && (tokens[i + 1] in UNITS || tokens[i + 1] in MULT);
    if (isNum(t) || doNum || (t in MULT && t !== 'k' && i + 1 < tokens.length && false)) {
      let total = 0, cur = doNum ? 2 : valOf(t), j = i + 1;
      for (;;) {
        const n = tokens[j];
        if (n in MULT && !(n === 'k' && j !== i + 1)) { total += (cur || 1) * MULT[n]; cur = 0; j++; continue; }
        if (n && (isNum(n) || (n === 'do' && (tokens[j + 1] in MULT))) && total > 0 && !cur) { cur = n === 'do' ? 2 : valOf(n); j++; continue; }
        break;
      }
      out.push({ kind: 'num', value: total + cur, start: i, end: j - 1 });
      i = j;
    } else { out.push({ kind: 'word', text: t, start: i, end: i }); i++; }
  }
  return out;
}

function phraseOf(name) {
  // core words of a product/party name: drop bracket details and pack sizes like 200GM, 1 CRTN = 30 PES
  return W(name).replace(/\(.*?\)/g, ' ').replace(/\b\d+(\.\d+)?\s*(kg|gm|g|gram|ml|ltr|pes|pcs)\b/g, ' ').split(/[^a-z0-9&]+/).filter(w => w && !/^\d+$/.test(w));
}

function bestMatch(words, entities, { threshold, weightOf, requireDistinct }) {
  // words: [{text, idx}] free words; returns best entity covering a contiguous window
  let best = null;
  for (const e of entities) {
    for (const ph of e.phrases) {
      if (!ph.length) continue;
      const totalW = ph.reduce((a, w) => a + weightOf(w), 0);
      for (let i = 0; i < words.length; i++) {
        for (let len = 1; len <= Math.min(5, words.length - i); len++) {
          const win = words.slice(i, i + len);
          if (win.some((w, k) => k > 0 && w.idx !== win[k - 1].idx + 1)) break;
          let got = 0, distinct = false; const used = new Set();
          for (const w of win) {
            let bi = -1, bs = 0;
            ph.forEach((p, k) => { if (used.has(k)) return; const s = sim(w.text, p); if (s > bs) { bs = s; bi = k; } });
            if (bs >= 0.78) { used.add(bi); got += weightOf(ph[bi]) * bs; if (!GENERIC.has(ph[bi]) && !CITY.has(ph[bi])) distinct = true; }
          }
          const unmatched = win.length - used.size;
          const score = got / totalW - unmatched * 0.25;
          const phraseDistinct = ph.some(p => !GENERIC.has(p) && !CITY.has(p));
          if ((requireDistinct && phraseDistinct && !distinct) || (requireDistinct && !phraseDistinct && used.size < ph.length) || score < threshold) continue;
          if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) < 1e-9 && len > best.len)) best = { e, score, from: win[0].idx, to: win[win.length - 1].idx, len };
        }
      }
    }
  }
  return best;
}

const title = s => s.replace(/\b[a-z]/g, c => c.toUpperCase());
const has = (toks, list) => toks.some(t => list.includes(t));

export function parseVoice(text, ctx) {
  // ctx: { products:[{id,name,aliases,unit,price,cost}], customers:[{id,name}], vendors:[{id,name}], expenseAccounts:[{code,name}], lastRate(pid, partyId) }
  const tokens = tokenize(text);
  const seq = numbers(tokens);
  const draft = { text, intent: 'unknown', party: null, items: [], payment: { mode: 'credit', amount: 0 }, amount: 0, account: null, notes: [] };
  if (!tokens.length) { draft.notes.push('Kuch samajh nahi aaya. Dobara bolein.'); return draft; }

  const SALE = ['diya', 'diye', 'dia', 'di', 'bheja', 'bheje', 'sale', 'sold', 'becha', 'beche', 'bechi', 'supply', 'deliver', 'delivered', 'gaya', 'gaye'];
  const BUY = ['kharida', 'kharide', 'khareeda', 'khareede', 'purchase', 'purchased', 'bought', 'mangwaya', 'mangwaye', 'aaya', 'aya', 'aaye', 'aye', 'liya', 'liye', 'lia'];
  const GOT = ['mila', 'mile', 'mili', 'received', 'receive', 'wasool', 'wusool', 'wasul', 'recovery', 'jama', 'aaye', 'aya', 'aaya'];
  const PAYW = ['paid', 'payment', 'adaigi', 'ada', 'chukaya', 'bheje', 'bheja', 'diye', 'diya', 'transfer'];
  const EXP = { fuel: ['petrol', 'diesel', 'fuel', 'tel'], rent: ['rent', 'kiraya', 'kiraaya'], salary: ['salary', 'tankhwah', 'tankhwa', 'pagar'], transport: ['transport', 'bhara', 'bhaara', 'rickshaw', 'loading', 'mazdoori', 'labour', 'labor'], repair: ['repair', 'marammat', 'mistri'], entertainment: ['chai', 'khana', 'lunch', 'dinner', 'mehman'], utility: ['bijli', 'electricity', 'gas', 'internet', 'mobile', 'load'], misc: ['kharcha', 'kharch', 'expense', 'misc'] };

  // 1) quantities: number + unit
  const used = new Set(); const qtys = [];
  seq.forEach((s, k) => {
    if (s.kind !== 'num') return; const nx = seq[k + 1];
    if (nx && nx.kind === 'word' && nx.text in UNITS) { qtys.push({ value: s.value, unit: UNITS[nx.text], pos: s.start, k }); used.add(k); used.add(k + 1); }
  });

  // 2) products (name or alias) among the free words
  const free = () => seq.map((s, k) => ({ s, k })).filter(x => x.s.kind === 'word' && !used.has(x.k) && !(x.s.text in UNITS)).map(x => ({ text: x.s.text, idx: x.s.start, k: x.k }));
  const prodEnts = ctx.products.map(p => ({ ...p, phrases: [phraseOf(p.name), ...String(p.aliases || '').split(',').map(a => phraseOf(a)).filter(a => a.length)] }));
  const items = [];
  for (let guard = 0; guard < 8; guard++) {
    const fw = free().filter(w => !STOP.has(w.text) && !GENERIC.has(w.text));
    if (!fw.length) break;
    const m = bestMatch(fw, prodEnts, { threshold: 0.55, weightOf: () => 1, requireDistinct: false });
    if (!m) break;
    // ambiguity: other products scoring almost the same (e.g. just "butter")
    const win = fw.filter(w => w.idx >= m.from && w.idx <= m.to);
    const pop = id => (ctx.rank ? ctx.rank(id) : 0);
    let alts = prodEnts.filter(e => e !== m.e).map(e => ({ e, s: bestMatch(win, [e], { threshold: 0, weightOf: () => 1, requireDistinct: false }) }))
      .filter(x => x.s && x.s.len >= m.len && x.s.score >= (m.len === 1 ? 0.45 : m.score - 0.05)).map(x => x.e);
    if (alts.length) {
      const all = [m.e, ...alts].sort((a, b) => pop(b.id) - pop(a.id));
      m.e = all[0]; alts = all.slice(1);
    }
    alts = alts.map(e => ({ id: e.id, name: e.name }));
    seq.forEach((s, k) => { if (s.kind === 'word' && s.start >= m.from && s.start <= m.to) used.add(k); });
    items.push({ product_id: m.e.id, name: m.e.name, pos: m.from, end: m.to, candidates: alts.length ? [{ id: m.e.id, name: m.e.name }, ...alts].slice(0, 6) : null });
  }

  const markIdx = seq.findIndex(s => s.kind === 'word' && ['ko', 'se', 'to', 'from', 'ne'].includes(s.text));
  const partySpan = new Set();
  if (markIdx > 0) for (let k = markIdx - 1, n = 0; k >= 0 && n < 3; k--, n++) { const s = seq[k]; if (s.kind !== 'word' || used.has(k) || STOP.has(s.text) || s.text in UNITS || qtys.some(q => s.start === q.pos + 2)) break; partySpan.add(s.start); }
  // unknown product next to a quantity: "3 kg ghee" where ghee is not in the list -> suggest new product
  for (const q of qtys) {
    const near = items.some(it => Math.abs(it.pos - q.pos) <= 4);
    if (near) continue;
    const after = seq.filter(s => s.kind === 'word' && s.start > q.pos + 1 && s.start <= q.pos + 4);
    const words = [];
    for (const s of after) { if (STOP.has(s.text) || s.text in UNITS || partySpan.has(s.start) || ctxPartyWord(s.text, ctx)) break; words.push(s.text); if (words.length === 2) break; }
    if (words.length) { items.push({ product_id: null, name: title(words.join(' ')), isNew: true, pos: q.pos + 2, end: q.pos + 1 + words.length }); seq.forEach((s, k) => { if (s.kind === 'word' && s.start > q.pos + 1 && s.start <= q.pos + 1 + words.length) used.add(k); }); }
  }
  items.sort((a, b) => a.pos - b.pos);

  // 3) intent
  const toks = tokens;
  const expKey = Object.entries(EXP).find(([, ws]) => has(toks, ws));
  if (items.length || qtys.length) draft.intent = has(toks, BUY) && !has(toks, ['diya', 'diye', 'becha', 'sold', 'sale']) ? 'purchase' : 'sale';
  else if (expKey && !has(toks, GOT)) draft.intent = 'expense';
  else if (has(toks, GOT)) draft.intent = 'receipt';
  else if (has(toks, PAYW)) draft.intent = 'payment';

  // 4) party: prefer words just before "ko" / "se" / "to" / "from" / "ne"
  const partyKind = draft.intent === 'purchase' || draft.intent === 'payment' ? 'V' : 'C';
  if (draft.intent !== 'expense') {
    const pool = partyKind === 'V' ? ctx.vendors : ctx.customers;
    const ents = pool.map(p => ({ ...p, phrases: [phraseOf(p.name)] }));
    const fw = free().filter(w => !STOP.has(w.text));
    const m = bestMatch(fw, ents, { threshold: 0.5, weightOf: w => (CITY.has(w) ? 0.3 : GENERIC.has(w) ? 0.5 : 1), requireDistinct: true });
    if (m) {
      draft.party = { id: m.e.id, name: m.e.name, kind: partyKind, isNew: false };
      seq.forEach((s, k) => { if (s.kind === 'word' && s.start >= m.from && s.start <= m.to) used.add(k); });
    } else {
      const mark = seq.findIndex(s => s.kind === 'word' && ['ko', 'se', 'to', 'from', 'ne'].includes(s.text));
      const words = [];
      if (mark > 0) for (let k = mark - 1; k >= 0 && words.length < 3; k--) { const s = seq[k]; if (s.kind !== 'word' || used.has(k) || STOP.has(s.text) || s.text in UNITS) break; words.unshift(s.text); }
      if (words.length) draft.party = { id: null, name: title(words.join(' ')), kind: partyKind, isNew: true };
      else draft.notes.push(partyKind === 'V' ? 'Supplier ka naam nahi mila, list se chunein.' : 'Customer ka naam nahi mila, list se chunein.');
    }
  }

  // 5) money numbers: everything that is not a quantity
  const money = seq.map((s, k) => ({ s, k })).filter(x => x.s.kind === 'num' && !used.has(x.k)).map(x => {
    const before = seq[x.k - 1]?.text, after = seq[x.k + 1]?.text, after2 = seq[x.k + 2]?.text;
    const near = [before, after, after2].filter(Boolean);
    return {
      value: x.s.value, pos: x.s.start,
      rate: before === 'rate' || after === 'rate' || after === 'per' || after2 === 'rate' || ((after === 'ka' || after === 'ke' || after === 'ki' || after === 'rs' || after === 'rupay') && (after2 === 'rate' || after2 === 'kilo' || after2 === 'kg' || after2 === 'hisab' || after2 === 'hisaab' || after2 === 'per')) || after === 'kilo',
      paid: (() => { const PW = ['cash', 'naqad', 'naqd', 'mila', 'mile', 'mili', 'received', 'advance', 'jama', 'diye'];
        if (draft.intent === 'receipt' || draft.intent === 'expense' || ['ka', 'ki', 'ke'].includes(after)) return false;
        return PW.includes(after) || PW.includes(before) || (after === 'rs' && PW.includes(after2)); })(),
    };
  });

  if (draft.intent === 'sale' || draft.intent === 'purchase') {
    const lastPos = items.length ? items[items.length - 1].pos : 0;
    items.forEach((it, i) => {
      const next = items[i + 1]?.pos ?? Infinity, prevEnd = i ? items[i - 1].end : -1;
      const q = qtys.filter(q => !q.taken && q.pos > prevEnd && q.pos < next).sort((a, b) => Math.abs(a.pos - it.pos) - Math.abs(b.pos - it.pos))[0];
      if (q) { q.taken = true; it.qty = q.value; it.unit = q.unit; }
      else { const bare = money.find(m => !m.taken && !m.paid && m.pos < it.pos && m.pos > prevEnd && m.value < 1000); if (bare) { bare.taken = true; it.qty = bare.value; } else it.qty = 1; }
      const p = it.product_id ? ctx.products.find(x => x.id === it.product_id) : null;
      it.unit = it.unit || p?.unit || 'pc';
      const pm = money.filter(m => !m.taken && !m.paid && m.pos > it.pos && (m.pos < next || i === items.length - 1));
      const mm = pm[0] || (i === items.length - 1 ? money.find(m => !m.taken && !m.paid && m.pos < it.pos && m.pos > lastPos - 99 && m.pos > (it.end ?? it.pos) - 99) : null);
      const ref = (p && draft.party?.id && ctx.lastRate(p.id, draft.party.id)) || (draft.intent === 'purchase' ? p?.cost : p?.price) || 0;
      if (mm) {
        mm.taken = true;
        const asRate = mm.rate || (!mm.rate && ref > 0 && it.qty > 1 && Math.abs(mm.value - ref) < Math.abs(mm.value - ref * it.qty));
        if (asRate) { it.rate = mm.value; it.amount = round2(mm.value * it.qty); }
        else { it.amount = mm.value; it.rate = round2(mm.value / it.qty); }
      } else if (items.length === 1 && money.filter(m => !m.taken).length === 1 && money.find(m => !m.taken).paid) {
        // "3 kg ghee 3000 cash diye": the only number is both the price and what was paid
        const only = money.find(m => !m.taken); only.taken = true; only.both = true;
        it.amount = only.value; it.rate = round2(only.value / it.qty);
        draft._paidAll = true;
      } else {
        it.rate = ref; it.amount = round2(ref * it.qty);
        if (ref) draft.notes.push(`${p ? p.name : it.name}: rate nahi bola, pichla rate ${ref} lagaya.`); else draft.notes.push(`${it.name}: rate bolein ya likhein.`);
      }
    });
    items.forEach(it => { delete it.pos; delete it.end; });
    draft.items = items;
    const total = round2(items.reduce((a, it) => a + (it.amount || 0), 0));
    const paidNum = money.find(m => m.paid && !m.taken);
    if (has(toks, ['udhar', 'udhaar', 'credit', 'baqi', 'baki', 'adhaar'])) draft.payment = { mode: 'credit', amount: 0 };
    else if (draft._paidAll) draft.payment = { mode: 'cash', amount: total };
    else if (paidNum) draft.payment = { mode: has(toks, ['bank', 'online', 'transfer', 'jazzcash', 'easypaisa', 'cheque', 'check']) ? 'bank' : 'cash', amount: Math.min(paidNum.value, total) };
    else if (has(toks, ['cash', 'naqad', 'naqd'])) draft.payment = { mode: 'cash', amount: total };
    else if (has(toks, ['bank', 'online', 'transfer', 'jazzcash', 'easypaisa'])) draft.payment = { mode: 'bank', amount: total };
    draft.total = total;
    if (!items.length) draft.notes.push('Product samajh nahi aaya, list se add karein.');
  } else {
    const amt = money.length ? Math.max(...money.map(m => m.value)) : 0;
    draft.amount = amt;
    if (!amt) draft.notes.push('Raqam (amount) nahi mili.');
    if (draft.intent === 'receipt' || draft.intent === 'payment') draft.payment = { mode: has(toks, ['bank', 'online', 'transfer', 'jazzcash', 'easypaisa', 'cheque']) ? 'bank' : 'cash', amount: amt };
    if (draft.intent === 'expense') {
      const key = expKey ? expKey[0] : 'misc';
      const want = { fuel: /fuel|petrol/i, rent: /rent/i, salary: /salary|payroll|wages/i, transport: /transport|freight/i, repair: /repair/i, entertainment: /entertain/i, utility: /utilit|electric|rent/i, misc: /misc/i }[key];
      const acc = ctx.expenseAccounts.find(a => want.test(a.name)) || ctx.expenseAccounts.find(a => /misc/i.test(a.name)) || ctx.expenseAccounts[0];
      draft.account = acc ? { code: acc.code, name: acc.name } : null;
      draft.note = title(toks.filter(t => !STOP.has(t) && !/^\d/.test(t) && !(t in MULT) && !(t in WORDNUM)).slice(0, 5).join(' '));
    }
  }
  delete draft._paidAll;
  if (draft.intent === 'unknown') draft.notes.push('Samajh nahi aaya ke sale hai, payment hai ya kharcha. Neeche se chunein.');
  return draft;
}

function ctxPartyWord(w, ctx) { return ['ko', 'se', 'to', 'from'].includes(w) || (ctx._partyWords || (ctx._partyWords = new Set(ctx.customers.concat(ctx.vendors).flatMap(p => phraseOf(p.name)).filter(x => !GENERIC.has(x) && !CITY.has(x))))).has(w); }
function round2(n) { return Math.round(n * 100) / 100; }
