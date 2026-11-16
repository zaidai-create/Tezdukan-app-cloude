import { parseBest } from '../server/voice.js';
import { romanize } from '../public/js/roman.js';
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const qty = id => d.I.reduce((a, i) => a + i.l.filter(l => l.p === id).reduce((x, l) => x + l.q, 0), 0);
const ctx = { products: d.P.map(p => ({ id: p.id, name: p.name, unit: p.unit, price: p.price, cost: p.cost, aliases: '' })), customers: d.C.map(c => ({ id: c.id, name: c.name })), vendors: d.V.map(c => ({ id: c.id, name: c.name })), expenseAccounts: d.coa.filter(a => a[2] === 'D').map(a => ({ code: a[0], name: a[1] })), lastRate: () => 0, rank: qty };
const cases = [
  ['3 किलो घी मेहरान होटल को दिया 3000 का'],
  ['हैदराबाद बेकर्स को 50 किलो बटर प्रीमियम 1330 रेट से दिया 30000 कैश मिला'],
  ['سائم علی سے پچاس ہزار کیش ملا'],
  ['पेट्रोल 2000 खर्चा'],
  ['grill town ko 2 carton classic mayonese', 'grill town ko two carton classic mayonnaise 1800 ka rate udhaar', 'grill down co to carton classic mayonnaise'],
  ['Indus hotal ko 5 kilo pure batar 2000 per kilo'],
];
for (const c of cases) { const r = parseBest(c, ctx); console.log('\n> ' + c[0] + '\n  roman: ' + romanize(c[0]) + '\n ', JSON.stringify({ intent: r.intent, party: r.party && [r.party.name, r.party.isNew], items: r.items.map(i => [i.name, i.qty, i.unit, i.rate, i.amount]), pay: r.payment, amount: r.amount, acc: r.account?.name, picked: r.text })); }
