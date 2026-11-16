import { parseVoice } from '../server/voice.js';
import { readFileSync } from 'node:fs';
const file = process.argv[2];
const d = file ? JSON.parse(readFileSync(file, 'utf8')) : null;
const products = d ? d.P.map(p => ({ id: p.id, name: p.name, unit: p.unit, price: p.price, cost: p.cost, aliases: '' })) : [];
const customers = d ? d.C.map(c => ({ id: c.id, name: c.name })) : [];
const vendors = d ? d.V.map(c => ({ id: c.id, name: c.name })) : [];
const expenseAccounts = d ? d.coa.filter(a => a[2] === 'D').map(a => ({ code: a[0], name: a[1] })) : [];
const ctx = { products, customers, vendors, expenseAccounts, lastRate: () => 0, rank: id => d ? d.I.reduce((a, i) => a + i.l.filter(l => l.p === id).reduce((x, l) => x + l.q, 0), 0) : 0 };
const S = [
  '3kg ghee mehran hotel ko diya 3000 ka',
  'hyderabad bakers ko 50 kilo butter premium 1330 rate se diya 30000 cash mila',
  'indus hotel ko 5 kg pure butter 2000 per kg',
  'grill town ko 2 carton classic mayonese 1800 ka rate udhaar',
  'saim ali se 50000 cash mila',
  'hyderabad bakers se teen lakh bank mein aaye',
  'petrol 2000 kharcha',
  '3kg ghee mehran hotel ko diya 3000 ka cash',
  'indus hotel ko 2 kg pure butter 4000 cash diye',
  'saim ali ko 20 kilo butter premium 1350 ka rate 10000 cash mila',
  'R S food se 500 kg butter premium 1150 rate kharida',
  'shah latif dairy ko 10 kg butter premium aur 4 kg substitute red85 diya',
  'noor ali quetta ko das kilo butter 1350',
];
for (const s of S) { const r = parseVoice(s, ctx); console.log('\n> ' + s + '\n', JSON.stringify({ intent: r.intent, party: r.party && [r.party.name, r.party.isNew], items: r.items.map(i => [i.name, i.qty, i.unit, i.rate, i.amount, i.candidates ? i.candidates.length : 0]), pay: r.payment, amount: r.amount, acc: r.account?.name, notes: r.notes })); }
