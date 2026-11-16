// Imports the old software's backup (qayam-data.json) into the new database, keeping every ledger entry.
import { SYSTEM_ACCOUNTS } from './db.js';
import { r2 } from './posting.js';
import { audit } from './auth.js';
import { trialBalance } from './reports.js';

export async function importLegacy(c, user, d) {
  const okShape = d && ['coa', 'P', 'C', 'V', 'I', 'B', 'J'].every(k => Array.isArray(d[k]));
  if (!okShape) throw Object.assign(new Error('This file is not a Qayam Traders backup.'), { status: 400 });

  await c.query('truncate invoice_lines, invoices, journal_lines, journals, voice_drafts, parties, products, counters restart identity cascade');

  for (const [code, name, type, grp] of d.coa) {
    await c.query(`insert into accounts(code, name, type, grp, system) values($1,$2,$3,$4,$5)
      on conflict (code) do update set name=excluded.name, type=excluded.type, grp=excluded.grp`, [String(code), name, type, grp || '', SYSTEM_ACCOUNTS.includes(String(code))]);
  }
  // make sure accounts used by the new app exist
  for (const [code, name, type, grp] of [['2200', 'Sales Tax Payable', 'B', 'Taxes Payable'], ['5500', 'Spoilage & Stock Adjustments', 'D', 'Operating Expenses'], ['3000', 'Opening Balance Equity', 'E', 'Capital']]) {
    await c.query(`insert into accounts(code, name, type, grp, system) values($1,$2,$3,$4,true) on conflict (code) do nothing`, [code, name, type, grp]);
  }

  const prod = {};
  for (const p of d.P) {
    const r = await c.query(`insert into products(name, category, unit, cost, price, stock, reorder, legacy_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [p.name, p.cat || '', p.unit || 'pc', r2(p.cost), r2(p.price), +p.stock || 0, +p.min || 0, p.id]);
    prod[p.id] = r.rows[0].id;
  }
  const party = {};
  for (const [kind, list] of [['C', d.C], ['V', d.V]]) {
    for (const x of list) {
      const phone = /\d{10,}/.test(String(x.phone || '').replace(/\D/g, '')) ? x.phone : '';
      const r = await c.query(`insert into parties(kind, name, city, phone, ntn, credit_limit, legacy_ref) values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [kind, x.name, x.city || '', phone, x.ntn || '', r2(x.limit), kind + x.id]);
      party[kind + x.id] = r.rows[0].id;
    }
  }

  // ledger: one journal per old voucher; the party goes on the receivable (1200) or payable (2000) side.
  // Sent in batches (ids assigned here after the truncate) so a remote database imports in seconds.
  let n = 0;
  const J = d.J.map((j, k) => ({ id: k + 1, j }));
  for (let s0 = 0; s0 < J.length; s0 += 400) {
    const part = J.slice(s0, s0 + 400);
    await c.query(`insert into journals(id, no, date, type, memo, legacy, created_by)
      select * , true, $6::int from unnest($1::int[], $2::text[], $3::date[], $4::text[], $5::text[])`,
      [part.map(x => x.id), part.map(x => x.j.no), part.map(x => x.j.date), part.map(x => x.j.type || 'Journal'), part.map(x => x.j.note || ''), user.id]);
    const L = { jid: [], acc: [], pid: [], dr: [], cr: [] };
    for (const { id, j } of part) {
      const pid = j.pa ? party[j.pa] : null;
      const pOn = acc => (pid && ((j.pa[0] === 'C' && acc === '1200') || (j.pa[0] === 'V' && acc === '2000')) ? pid : null);
      L.jid.push(id, id); L.acc.push(String(j.dr), String(j.cr)); L.pid.push(pOn(String(j.dr)), pOn(String(j.cr))); L.dr.push(r2(j.amt), 0); L.cr.push(0, r2(j.amt));
    }
    await c.query(`insert into journal_lines(journal_id, account, party_id, debit, credit) select * from unnest($1::int[], $2::text[], $3::int[], $4::numeric[], $5::numeric[])`, [L.jid, L.acc, L.pid, L.dr, L.cr]);
    n += part.length;
  }
  await c.query(`select setval(pg_get_serial_sequence('journals','id'), greatest((select max(id) from journals), 1))`);

  // bills (history only; their accounting is already in the ledger above)
  let invId = 0;
  const bills = async (list, kind, key, rateKey) => {
    const I = { id: [], no: [], date: [], pid: [], sub: [], disc: [], txp: [], tax: [], tot: [], paid: [], note: [] }, Ln = { iid: [], p: [], q: [], rate: [], amt: [] }, seen = new Set();
    for (const i of list) {
      if (seen.has(i.no)) continue; seen.add(i.no);
      const lines = (i.l || []).map(l => ({ p: prod[l.p] || null, q: +l.q, rate: r2(l[rateKey]), amt: r2(l.q * l[rateKey]) }));
      const sub = r2(lines.reduce((a, l) => a + l.amt, 0)), disc = r2(i.dc || 0), net = r2(sub - disc), tax = r2(net * (i.tx || 0) / 100), id = ++invId;
      I.id.push(id); I.no.push(i.no); I.date.push(i.date); I.pid.push(party[key + i[key === 'C' ? 'c' : 'v']] || null); I.sub.push(sub); I.disc.push(disc); I.txp.push(i.tx || 0); I.tax.push(tax); I.tot.push(r2(net + tax)); I.paid.push(r2(i.paid || 0)); I.note.push(i.note || '');
      for (const l of lines) { Ln.iid.push(id); Ln.p.push(l.p); Ln.q.push(l.q); Ln.rate.push(l.rate); Ln.amt.push(l.amt); }
    }
    if (!I.id.length) return;
    await c.query(`insert into invoices(id, kind, no, date, party_id, subtotal, discount, tax_pct, tax, total, paid, note, legacy, source, created_by)
      select u.id, $12, u.no, u.date, u.pid, u.sub, u.disc, u.txp, u.tax, u.tot, u.paid, u.note, true, 'import', $13::int
      from unnest($1::int[], $2::text[], $3::date[], $4::int[], $5::numeric[], $6::numeric[], $7::numeric[], $8::numeric[], $9::numeric[], $10::numeric[], $11::text[]) as u(id, no, date, pid, sub, disc, txp, tax, tot, paid, note)`,
      [I.id, I.no, I.date, I.pid, I.sub, I.disc, I.txp, I.tax, I.tot, I.paid, I.note, kind, user.id]);
    await c.query(`insert into invoice_lines(invoice_id, product_id, qty, rate, amount) select * from unnest($1::int[], $2::int[], $3::numeric[], $4::numeric[], $5::numeric[])`, [Ln.iid, Ln.p, Ln.q, Ln.rate, Ln.amt]);
  };
  await bills(d.I, 'sale', 'C', 'pr');
  await bills(d.B, 'purchase', 'V', 'c');
  await c.query(`select setval(pg_get_serial_sequence('invoices','id'), greatest((select max(id) from invoices), 1))`);

  const T = (d.T && d.T[0]) || {};
  const company = { name: T.name || d.co || 'Qayam Traders', address: T.addr || '', phone: T.phone || '', ntn: T.ntn || '', strn: T.strn || '', footer: T.foot || 'Thank you for your business.', tax_pct: +T.tax || 0 };
  await c.query(`insert into settings(key, value) values('company', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(company)]);
  await audit(user.id, 'import', 'legacy', null, { journals: n, invoices: d.I.length, bills: d.B.length });
  return { products: d.P.length, customers: d.C.length, suppliers: d.V.length, journals: n, sales: d.I.length, purchases: d.B.length };
}

export async function importCheck() {
  const tb = await trialBalance('9999-12-31');
  return { trialDebit: tb.debit, trialCredit: tb.credit, balanced: tb.debit === tb.credit };
}
