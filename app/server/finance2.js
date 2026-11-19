// Phase 1 finance modules: money in/out by category, fund transfers (contra), credit/debit notes, voucher reversal,
// loans (business + personal), bank reconciliation, fixed assets & depreciation, payroll, global search, general ledger.
// Every money movement is a balanced double-entry journal posted through post_journals (period lock + balance checked
// by the database). Entries that move money go through submit() so the approval rule (> limit) applies to them too.
import { one, all, q, tx } from './db.js';
import { audit } from './auth.js';
import { postJournal, postJournals, RUN, UserError, need, isDate, today, r2, checkLock } from './posting.js';

const isCashAcc = a => a.code === '1000' || /cash/i.test(a.name);
async function accMap(c, codes) {
  const r = await c.query('select code, name, type, grp from accounts where code = any($1::text[])', [codes.filter(Boolean).map(String)]);
  return Object.fromEntries(r.rows.map(a => [a.code, a]));
}
const cashOf = (accs, code) => { const a = accs[String(code)]; need(a, `Account ${code} does not exist.`); need(a.grp === 'Cash & Bank', `${a.name} is not a cash or bank account.`); return a; };

// A new ledger account in a code range (name must be unique).
export async function makeAccount(c, name, type, grp, lo, hi) {
  name = String(name || '').trim().toUpperCase(); need(name, 'Enter a name.');
  const ex = (await c.query('select code from accounts where upper(name) = $1', [name])).rows[0];
  if (ex) return ex.code;
  const m = (await c.query(`select coalesce(max(code::bigint), $1 - 1) m from accounts where code ~ '^[0-9]+$' and code::bigint between $1 and $2`, [lo, hi])).rows[0].m;
  need(+m + 1 <= hi, 'No free account code left in this range.');
  const code = String(+m + 1);
  await c.query('insert into accounts(code, name, type, grp) values($1,$2,$3,$4)', [code, name, type, grp]);
  return code;
}
// Well-known heads, created on first use.
const HEADS = {
  interestIncome: ['INTEREST INCOME', 'C', 'Revenue', 4101, 4199],
  interestExpense: ['INTEREST EXPENSE', 'D', 'Other Expense', 401160, 401199],
  badDebts: ['BAD DEBTS & LOAN WRITE-OFF', 'D', 'Other Expense', 401160, 401199],
  depreciation: ['DEPRECIATION EXPENSE', 'D', 'Other Expense', 401160, 401199],
  accumDep: ['ACCUMULATED DEPRECIATION', 'A', 'Fixed Assets', 106090, 106099],
  discountReceived: ['DISCOUNT RECEIVED', 'C', 'Revenue', 4101, 4199],
  assetGain: ['GAIN / LOSS ON ASSET SALE', 'C', 'Revenue', 4101, 4199],
};
const head = (c, k) => makeAccount(c, ...HEADS[k]);

/* ======================= money in / out by category ======================= */
// Categories are editable (Settings → transaction categories). Each one is a direction + the account it posts to.
export async function categories() {
  const s = await one(`select value from settings where key='tx_categories'`);
  if (s?.value?.length) return s.value;
  const accs = await all('select code, name, type, grp from accounts order by code');
  const find = (re, type) => accs.find(a => (!type || a.type === type) && re.test(a.name))?.code;
  const cap = find(/capital/i, 'E') || '3000', draw = find(/drawing/i, 'E') || cap;
  return [
    { id: 'capital', name: 'Capital investment', dir: 'in', account: cap },
    { id: 'partner', name: 'Partner contribution', dir: 'in', account: cap },
    { id: 'advin', name: 'Advance received', dir: 'in', account: find(/payable|advance/i, 'B') || '2000' },
    { id: 'income', name: 'Miscellaneous income', dir: 'in', account: find(/other income/i, 'C') || '4100' },
    { id: 'drawing', name: 'Owner withdrawal (drawings)', dir: 'out', account: draw },
    { id: 'advout', name: 'Advance given', dir: 'out', account: find(/receivable/i, 'A') && accs.find(a => a.grp === 'Other Receivables')?.code || find(/receivable/i, 'A') || '1200' },
    { id: 'expense', name: 'Miscellaneous expense', dir: 'out', account: find(/miscellaneous expense/i, 'D') || '5300' },
  ].filter(x => accs.some(a => a.code === x.account));
}
export async function saveCategories(user, list) {
  need(Array.isArray(list) && list.length <= 60, 'Send a list of categories.');
  const accs = new Set((await all('select code from accounts')).map(a => a.code));
  const clean = list.map((x, i) => ({ id: String(x.id || 'c' + Date.now().toString(36) + i).slice(0, 30), name: String(x.name || '').trim().slice(0, 60), dir: x.dir === 'out' ? 'out' : 'in', account: String(x.account || '') }))
    .filter(x => x.name && accs.has(x.account));
  await q(`insert into settings(key, value) values('tx_categories', $1) on conflict (key) do update set value = excluded.value`, [JSON.stringify(clean)]);
  audit(user.id, 'update', 'settings', 'tx_categories', { n: clean.length });
  return clean;
}
export async function money(c, user, b) {
  const date = isDate(b.date) ? b.date : today(), amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const dir = b.dir === 'out' ? 'out' : 'in';
  const accs = await accMap(c, [b.account, b.cash_account || '1000']);
  const head0 = accs[String(b.account)]; need(head0, 'Choose a category / account.'); need(head0.grp !== 'Cash & Bank', 'For cash ↔ bank use Fund transfer.');
  need(!['1200', '2000'].includes(head0.code) || +b.party_id, 'Choose the party for this entry.');
  const cash = cashOf(accs, b.cash_account || '1000');
  const pid = +b.party_id || null, label = String(b.label || head0.name);
  const lines = dir === 'in' ? [{ account: cash.code, debit: amt }, { account: head0.code, party_id: pid, credit: amt }] : [{ account: head0.code, party_id: pid, debit: amt }, { account: cash.code, credit: amt }];
  const j = await postJournal(c, { date, type: dir === 'in' ? (isCashAcc(cash) ? 'Cash Receipt' : 'Bank Receipt') : (isCashAcc(cash) ? 'Cash Payment' : 'Bank Payment'), vkind: 'money_' + dir,
    memo: `${label}${b.note ? ' · ' + String(b.note).slice(0, 200) : ''}`, lines, user_id: user.id });
  audit(user.id, 'create', 'money', j.id, { dir, label, account: head0.code, amt, no: j.no, approval: b.approval_id || undefined });
  return { ...j, amount: amt };
}

/* ======================= fund transfer (contra) ======================= */
export async function transfer(c, user, b) {
  const date = isDate(b.date) ? b.date : today(), amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  need(String(b.from) !== String(b.to), 'From and To must be different accounts.');
  const accs = await accMap(c, [b.from, b.to]); const f = cashOf(accs, b.from), t = cashOf(accs, b.to);
  const j = await postJournal(c, { date, type: 'Contra', vkind: 'contra', memo: `Transfer ${f.name} → ${t.name}${b.note ? ' · ' + String(b.note).slice(0, 200) : ''}`, user_id: user.id,
    lines: [{ account: t.code, debit: amt }, { account: f.code, credit: amt }] });
  audit(user.id, 'create', 'transfer', j.id, { from: f.code, to: t.code, amt, no: j.no });
  return { ...j, amount: amt };
}

/* ======================= credit / debit notes (party adjustments) ======================= */
// customer credit note: we reduce what they owe (Dr discount/sales, Cr receivable)
// customer debit note: we charge them more (Dr receivable, Cr income)
// supplier debit note: we reduce what we owe them (Dr payable, Cr discount received)
// supplier credit note: they charge us more (Dr expense, Cr payable)
export async function note(c, user, b) {
  const date = isDate(b.date) ? b.date : today(), amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const p = (await c.query('select id, kind, name from parties where id=$1 and active', [+b.party_id])).rows[0]; need(p, 'Choose the customer or supplier.');
  const kind = b.kind === 'debit' ? 'debit' : 'credit', cust = p.kind === 'C', ctrl = cust ? '1200' : '2000';
  let acc = String(b.account || '');
  if (!acc) acc = cust ? (kind === 'credit' ? ((await c.query(`select code from accounts where upper(name) like 'DISCOUNT ALLOWED%' limit 1`)).rows[0]?.code || '4000') : '4100')
    : (kind === 'debit' ? await head(c, 'discountReceived') : '5300');
  const a = (await accMap(c, [acc]))[acc]; need(a, `Account ${acc} does not exist.`); need(!['1200', '2000'].includes(a.code) && a.grp !== 'Cash & Bank', 'Choose an income, expense or adjustment account.');
  const reduce = (cust && kind === 'credit') || (!cust && kind === 'debit');   // the party balance goes down
  const lines = cust ? (reduce ? [{ account: a.code, debit: amt }, { account: ctrl, party_id: p.id, credit: amt }] : [{ account: ctrl, party_id: p.id, debit: amt }, { account: a.code, credit: amt }])
    : (reduce ? [{ account: ctrl, party_id: p.id, debit: amt }, { account: a.code, credit: amt }] : [{ account: a.code, debit: amt }, { account: ctrl, party_id: p.id, credit: amt }]);
  const j = await postJournal(c, { date, type: kind === 'credit' ? 'Credit Note' : 'Debit Note', vkind: kind + '_note', memo: `${kind === 'credit' ? 'Credit' : 'Debit'} note · ${p.name}${b.note ? ' · ' + String(b.note).slice(0, 200) : ''}`, lines, user_id: user.id });
  audit(user.id, 'create', 'note', j.id, { kind, party: p.name, amt, no: j.no });
  return { ...j, party_id: p.id, amount: amt };
}

/* ======================= reversal (instead of deleting) ======================= */
export async function reverseJournal(user, id, reason, date0) {
  return tx(async c => {
    const j = (await c.query('select * from journals where id=$1 for update', [+id])).rows[0]; need(j, 'Entry not found.');
    need(!j.ref_invoice, 'This entry belongs to a bill. Cancel or edit the bill instead.');
    need(!j.reversed_by, 'This entry is already reversed.'); need(!j.reverses, 'A reversal cannot be reversed. Post a fresh entry instead.');
    const ls = (await c.query('select account, party_id, debit, credit from journal_lines where journal_id=$1', [j.id])).rows;
    const date = isDate(date0) ? date0 : today();
    const [r] = await postJournals(c, [{ date, type: 'Reversal', vkind: 'reversal', reverses: j.id, memo: `Reversal of ${j.no}${reason ? ' · ' + String(reason).slice(0, 200) : ''}`, user_id: user.id,
      lines: ls.map(l => ({ account: l.account, party_id: l.party_id, debit: +l.credit, credit: +l.debit })) }]);
    await c.query('update journals set reversed_by=$1 where id=$2', [r.id, j.id]);
    // linked records follow the money: a reversed loan payment / payroll / depreciation no longer counts
    await c.query('delete from loan_txns where journal_id=$1', [j.id]);
    await c.query('delete from payroll_runs where journal_id=$1', [j.id]);
    await c.query('delete from asset_dep where journal_id=$1', [j.id]);
    audit(user.id, 'reverse', 'journal', j.id, { no: j.no, reversal: r.no, reason });
    return { ok: true, id: r.id, no: r.no };
  });
}

/* ======================= loans ======================= */
const addDays = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const addMonths = (d, n) => { const x = new Date(d + 'T00:00:00Z'), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + n); const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(day, last)); return x.toISOString().slice(0, 10); };
const years = L => (L.frequency === 'weekly' ? L.installments / 52 : L.frequency === 'once' ? 1 / 12 : L.installments / 12);
export function loanPlan(L, txns) {
  const lent = r2(txns.filter(t => t.kind === 'disburse' || t.kind === 'opening' || t.kind === 'charge').reduce((a, t) => a + +t.amount, 0)) || +L.principal;
  const interest = r2(lent * (+L.interest_pct / 100) * years(L)), payable = r2(lent + interest);
  const n = L.installments, each = r2(payable / n);
  const repaid = r2(txns.filter(t => t.kind === 'repay').reduce((a, t) => a + +t.amount, 0));
  const writeoff = r2(txns.filter(t => t.kind === 'writeoff').reduce((a, t) => a + +t.amount, 0));
  let left = repaid + writeoff; const t0 = today();
  const rows = Array.from({ length: n }, (_, k) => {
    const due = L.frequency === 'weekly' ? addDays(L.start_date, 7 * (k + 1)) : L.frequency === 'once' ? addMonths(L.start_date, 1) : addMonths(L.start_date, k + 1);
    const amount = k === n - 1 ? r2(payable - each * (n - 1)) : each, paid = r2(Math.min(amount, Math.max(left, 0))); left = r2(left - paid);
    return { k: k + 1, due, amount, paid, status: paid >= amount - 0.01 ? 'paid' : due < t0 ? 'overdue' : paid > 0 ? 'part' : 'due' };
  });
  const principalPaid = r2(txns.filter(t => t.kind === 'repay').reduce((a, t) => a + +t.principal, 0)), interestPaid = r2(txns.filter(t => t.kind === 'repay').reduce((a, t) => a + +t.interest, 0));
  const overdue = r2(rows.filter(r => r.status === 'overdue').reduce((a, r) => a + r.amount - r.paid, 0));
  const next = rows.find(r => r.status !== 'paid');
  return { lent, interest, payable, each, repaid, writeoff, principalPaid, interestPaid, remaining: r2(Math.max(payable - repaid - writeoff, 0)), overdue, next, rows };
}
async function loanBalance(L) {
  if (L.book === 'business' && L.account) {
    const b = await one('select coalesce(sum(debit - credit), 0) b from journal_lines where account=$1', [L.account]);
    return r2(L.direction === 'G' ? +b.b : -b.b);
  }
  const t = await all('select kind, amount, principal from loan_txns where loan_id=$1', [L.id]);
  return r2(t.reduce((a, x) => a + (['disburse', 'opening', 'charge'].includes(x.kind) ? +x.amount : x.kind === 'repay' ? -x.principal : x.kind === 'writeoff' ? -x.amount : 0), 0));
}
export async function listLoans() {
  const L = await all(`select l.*, (select coalesce(json_agg(t order by t.date, t.id), '[]') from loan_txns t where t.loan_id = l.id) txns from loans l order by l.status, l.created_at desc`);
  const bal = Object.fromEntries((await all(`select account, coalesce(sum(debit - credit), 0) b from journal_lines where account = any($1::text[]) group by account`, [L.filter(x => x.account).map(x => x.account)])).map(r => [r.account, +r.b]));
  return L.map(l => { const p = loanPlan(l, l.txns); const outstanding = l.book === 'business' && l.account ? r2(l.direction === 'G' ? bal[l.account] || 0 : -(bal[l.account] || 0)) : r2(l.txns.reduce((a, x) => a + (['disburse', 'opening', 'charge'].includes(x.kind) ? +x.amount : x.kind === 'repay' ? -x.principal : x.kind === 'writeoff' ? -x.amount : 0), 0));
    const { txns, ...rest } = l; return { ...rest, outstanding, overdue: p.overdue, next: p.next || null, repaid: p.repaid, lent: p.lent, payable: p.payable }; });
}
export async function loanDetail(id) {
  const L = await one('select l.*, a.name account_name from loans l left join accounts a on a.code = l.account where l.id=$1', [+id]); if (!L) throw new UserError('Loan not found.', 404);
  const txns = await all(`select t.*, j.no voucher, u.name by_name from loan_txns t left join journals j on j.id = t.journal_id left join users u on u.id = t.created_by where t.loan_id=$1 order by t.date, t.id`, [L.id]);
  const plan = loanPlan(L, txns);
  let bal = 0; const sign = L.direction === 'G' ? 1 : -1;
  const ledger = txns.map(t => { const dr = L.direction === 'G' ? (['disburse', 'opening', 'charge'].includes(t.kind) ? +t.amount : 0) : (t.kind === 'repay' ? +t.amount : t.kind === 'writeoff' ? +t.amount : 0);
    const cr = L.direction === 'G' ? (t.kind === 'repay' || t.kind === 'writeoff' ? +t.amount : 0) : (['disburse', 'opening', 'charge'].includes(t.kind) ? +t.amount : 0);
    bal = r2(bal + (dr - cr) * sign); return { ...t, debit: dr, credit: cr, balance: bal }; });
  return { loan: L, txns: ledger, plan, outstanding: await loanBalance(L) };
}
async function loanNo(c) { const n = (await c.query(`insert into counters(key, n) values('LOAN', 1) on conflict (key) do update set n = counters.n + 1 returning n`)).rows[0].n; return 'LN-' + String(n).padStart(4, '0'); }
// new loan: b = {direction, book, person, phone, cnic, principal, interest_pct, start_date, installments, frequency, cash_account, existing_account, opening, note}
export async function createLoan(c, user, b) {
  const dir = b.direction === 'T' ? 'T' : 'G', book = b.book === 'personal' ? 'personal' : 'business';
  const person = String(b.person || '').trim(); need(person, 'Enter the name of the person.');
  const amt = r2(b.principal); need(amt > 0, 'Enter the loan amount.');
  const date = isDate(b.start_date) ? b.start_date : today();
  const n = Math.min(Math.max(Math.floor(+b.installments || 1), 1), 600), freq = ['weekly', 'monthly', 'once'].includes(b.frequency) ? b.frequency : 'monthly';
  let account = null, j = null;
  const opening = !!b.opening;   // already given / taken before using the app
  const no = await loanNo(c);
  if (book === 'business') {
    if (b.existing_account) { const a = (await accMap(c, [b.existing_account]))[String(b.existing_account)]; need(a, 'Account not found.'); account = a.code; }
    // every loan gets its own ledger, so two loans to the same person never mix
    else account = dir === 'G' ? await makeAccount(c, `LOAN TO ${person} · ${no}`, 'A', 'Loans Given', 1100, 1199) : await makeAccount(c, `LOAN FROM ${person} · ${no}`, 'B', 'Loans Payable', 210000, 210499);
    if (!opening) {
      const accs = await accMap(c, [b.cash_account || '1000']); const cash = cashOf(accs, b.cash_account || '1000');
      j = await postJournal(c, { date, type: 'Loan', vkind: 'loan', memo: `Loan ${dir === 'G' ? 'given to' : 'taken from'} ${person}`, user_id: user.id,
        lines: dir === 'G' ? [{ account, debit: amt }, { account: cash.code, credit: amt }] : [{ account: cash.code, debit: amt }, { account, credit: amt }] });
    }
  }
  const L = (await c.query(`insert into loans(no, direction, book, person, phone, cnic, account, principal, interest_pct, start_date, installments, frequency, note, created_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`, [no, dir, book, person.slice(0, 80), String(b.phone || '').slice(0, 30), String(b.cnic || '').slice(0, 20), account, amt, Math.max(r2(b.interest_pct), 0), date, n, freq, String(b.note || '').slice(0, 300), user.id])).rows[0];
  await c.query(`insert into loan_txns(loan_id, date, kind, amount, principal, cash_account, journal_id, note, created_by) values($1,$2,$3,$4,$4,$5,$6,$7,$8)`,
    [L.id, date, opening ? 'opening' : 'disburse', amt, book === 'business' && !opening ? String(b.cash_account || '1000') : null, j?.id || null, opening ? 'Opening balance' : '', user.id]);
  audit(user.id, 'create', 'loan', L.id, { no, person, dir, book, amt, voucher: j?.no });
  return { id: L.id, no, amount: amt, voucher: j?.no };
}
// repayment / more money / write-off: b = {loan_id, kind, amount, date, cash_account, note}
export async function loanTxn(c, user, b) {
  const L = (await c.query('select * from loans where id=$1 for update', [+b.loan_id])).rows[0]; need(L, 'Loan not found.');
  need(L.status === 'active', 'This loan is closed.');
  const kind = ['repay', 'charge', 'writeoff'].includes(b.kind) ? b.kind : 'repay', amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const date = isDate(b.date) ? b.date : today();
  const txns = (await c.query('select * from loan_txns where loan_id=$1', [L.id])).rows, plan = loanPlan(L, txns);
  // interest share of a repayment, in proportion to the schedule (flat interest)
  let interest = 0;
  if (kind === 'repay' && plan.interest > 0) interest = r2(Math.min(amt * plan.interest / plan.payable, Math.max(plan.interest - plan.interestPaid, 0)));
  const principal = kind === 'repay' ? r2(amt - interest) : kind === 'writeoff' ? amt : 0;
  let j = null;
  if (L.book === 'business') {
    const G = L.direction === 'G';
    if (kind === 'writeoff') {
      j = await postJournal(c, { date, type: 'Loan', vkind: 'loan', memo: `Loan ${L.no} written off · ${L.person}`, user_id: user.id,
        lines: G ? [{ account: await head(c, 'badDebts'), debit: amt }, { account: L.account, credit: amt }] : [{ account: L.account, debit: amt }, { account: '4100', credit: amt }] });
    } else {
      const accs = await accMap(c, [b.cash_account || '1000']); const cash = cashOf(accs, b.cash_account || '1000');
      let lines;
      if (kind === 'charge') lines = G ? [{ account: L.account, debit: amt }, { account: cash.code, credit: amt }] : [{ account: cash.code, debit: amt }, { account: L.account, credit: amt }];
      else if (G) lines = [{ account: cash.code, debit: amt }, { account: L.account, credit: principal }, { account: await head(c, 'interestIncome'), credit: interest }];
      else lines = [{ account: L.account, debit: principal }, { account: await head(c, 'interestExpense'), debit: interest }, { account: cash.code, credit: amt }];
      j = await postJournal(c, { date, type: 'Loan', vkind: 'loan', memo: `${kind === 'charge' ? 'More loan' : 'Loan repayment'} ${L.no} · ${L.person}${b.note ? ' · ' + String(b.note).slice(0, 150) : ''}`, user_id: user.id, lines });
    }
  }
  await c.query(`insert into loan_txns(loan_id, date, kind, amount, principal, interest, cash_account, journal_id, note, created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [L.id, date, kind, amt, principal, interest, kind === 'writeoff' || L.book !== 'business' ? null : String(b.cash_account || '1000'), j?.id || null, String(b.note || '').slice(0, 300), user.id]);
  // fully settled → closed
  const after = loanPlan(L, [...txns, { kind, amount: amt, principal, interest }]);
  if (after.remaining <= 0.5 || kind === 'writeoff') await c.query(`update loans set status=$2 where id=$1`, [L.id, kind === 'writeoff' ? 'written_off' : 'closed']);
  audit(user.id, kind, 'loan', L.id, { no: L.no, amt, principal, interest, voucher: j?.no });
  return { ok: true, voucher: j?.no, amount: amt, principal, interest, closed: after.remaining <= 0.5 };
}

/* ======================= bank reconciliation ======================= */
export async function bankRec(account, to) {
  const a = await one(`select code, name from accounts where code=$1 and grp='Cash & Bank'`, [account]); if (!a) throw new UserError('Choose a bank account.');
  const lines = await all(`select jl.id, j.date, j.no, j.memo, j.type, jl.debit, jl.credit, bc.cleared_on from journal_lines jl join journals j on j.id = jl.journal_id
    left join bank_clear bc on bc.line_id = jl.id where jl.account=$1 and j.date <= $2 order by (bc.cleared_on is not null), j.date desc, j.id desc limit 2000`, [a.code, to]);
  const book = await one(`select coalesce(sum(jl.debit - jl.credit), 0) b from journal_lines jl join journals j on j.id = jl.journal_id where jl.account=$1 and j.date <= $2`, [a.code, to]);
  const cleared = await one(`select coalesce(sum(jl.debit - jl.credit), 0) b from journal_lines jl join bank_clear bc on bc.line_id = jl.id where jl.account=$1 and bc.cleared_on <= $2`, [a.code, to]);
  const st = await one(`select as_on, balance from bank_statements where account=$1 and as_on <= $2 order by as_on desc limit 1`, [a.code, to]);
  const pendIn = r2(lines.filter(l => !l.cleared_on).reduce((s, l) => s + +l.debit, 0)), pendOut = r2(lines.filter(l => !l.cleared_on).reduce((s, l) => s + +l.credit, 0));
  return { account: a, to, book: r2(book.b), cleared: r2(cleared.b), statement: st ? { as_on: st.as_on, balance: +st.balance } : null, difference: st ? r2(+st.balance - +cleared.b) : null, pendIn, pendOut, lines: lines.map(l => ({ ...l, debit: +l.debit, credit: +l.credit })) };
}
export async function bankClear(user, ids, on, clear) {
  ids = (Array.isArray(ids) ? ids : []).map(Number).filter(Boolean).slice(0, 500); need(ids.length, 'Choose entries.');
  if (clear) { need(isDate(on), 'Choose the date on the bank statement.'); await q(`insert into bank_clear(line_id, cleared_on, by_user) select x, $2, $3 from unnest($1::int[]) x on conflict (line_id) do update set cleared_on = excluded.cleared_on, by_user = excluded.by_user, at = now()`, [ids, on, user.id]); }
  else await q('delete from bank_clear where line_id = any($1::int[])', [ids]);
  audit(user.id, clear ? 'clear' : 'unclear', 'bank', null, { n: ids.length, on });
  return { ok: true };
}
export async function bankStatement(user, account, as_on, balance) {
  need(isDate(as_on), 'Choose the statement date.');
  await q(`insert into bank_statements(account, as_on, balance, by_user) values($1,$2,$3,$4) on conflict (account, as_on) do update set balance = excluded.balance, by_user = excluded.by_user, at = now()`, [account, as_on, r2(balance), user.id]);
  audit(user.id, 'statement', 'bank', account, { as_on, balance });
  return { ok: true };
}

/* ======================= fixed assets ======================= */
const monthsBetween = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
export async function listAssets() {
  const A = await all(`select a.*, ac.name account_name, coalesce((select sum(amount) from asset_dep d where d.asset_id = a.id), 0) dep, (select max(month) from asset_dep d where d.asset_id = a.id) last_month from assets a left join accounts ac on ac.code = a.account order by a.disposed_on nulls first, a.start_date desc`);
  return A.map(a => { const monthly = r2((+a.cost - +a.salvage) / a.life_months); return { ...a, cost: +a.cost, salvage: +a.salvage, dep: +a.dep, monthly, book: r2(+a.cost - +a.dep) }; });
}
// b = {name, category, account|new_account, cost, salvage, life_months, start_date, pay: cash|bank|credit|existing, pay_account, party_id}
export async function createAsset(c, user, b) {
  const name = String(b.name || '').trim(); need(name, 'Enter the asset name.');
  const cost = r2(b.cost); need(cost > 0, 'Enter the cost.');
  const life = Math.floor(+b.life_months || 0); need(life > 0 && life <= 600, 'Enter useful life in months (e.g. 60 for 5 years).');
  const date = isDate(b.start_date) ? b.start_date : today();
  let account = String(b.account || '');
  if (!account) account = await makeAccount(c, String(b.category || 'OTHER FIXED ASSETS').toUpperCase(), 'A', 'Fixed Assets', 106004, 106089);
  const a = (await accMap(c, [account]))[account]; need(a && a.type === 'A', 'Choose a fixed-asset account.');
  let j = null;
  if (b.pay !== 'existing') {
    let credit;
    if (b.pay === 'credit') { const p = (await c.query(`select id, name from parties where id=$1 and kind='V'`, [+b.party_id])).rows[0]; need(p, 'Choose the supplier.'); credit = { account: '2000', party_id: p.id, credit: cost }; }
    else { const accs = await accMap(c, [b.pay_account || '1000']); const cash = cashOf(accs, b.pay_account || '1000'); credit = { account: cash.code, credit: cost }; }
    j = await postJournal(c, { date, type: 'Fixed Asset', vkind: 'asset', memo: `Asset bought · ${name}`, user_id: user.id, lines: [{ account: a.code, debit: cost }, credit] });
  }
  const r = (await c.query(`insert into assets(name, category, account, cost, salvage, life_months, start_date, note, created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [name.slice(0, 80), String(b.category || '').slice(0, 40), a.code, cost, Math.min(Math.max(r2(b.salvage), 0), cost), life, date, String(b.note || '').slice(0, 300), user.id])).rows[0];
  audit(user.id, 'create', 'asset', r.id, { name, cost, voucher: j?.no });
  return { id: r.id, amount: cost, voucher: j?.no };
}
// post every month of depreciation not yet posted, up to and including `upto` (YYYY-MM)
export async function runDepreciation(user, upto) {
  need(/^\d{4}-\d{2}$/.test(upto || ''), 'Choose the month.');
  return tx(async c => {
    const A = (await c.query(`select a.*, coalesce((select sum(amount) from asset_dep d where d.asset_id=a.id), 0) dep, (select array_agg(to_char(month, 'YYYY-MM')) from asset_dep d where d.asset_id=a.id) done from assets a where disposed_on is null`)).rows;
    const byMonth = new Map();
    for (const a of A) {
      const start = a.start_date.slice(0, 7), done = new Set(a.done || []); let left = r2(+a.cost - +a.salvage - +a.dep); const monthly = r2((+a.cost - +a.salvage) / a.life_months);
      for (let k = 0; k <= monthsBetween(start + '-01', upto + '-01') && left > 0.009; k++) {
        const m = addMonths(start + '-01', k).slice(0, 7); if (done.has(m)) continue;
        const amt = r2(Math.min(monthly, left)); left = r2(left - amt);
        if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push({ a, amt });
      }
    }
    need(byMonth.size, 'Depreciation is already posted up to this month.');
    const dep = await head(c, 'depreciation'), acc = await head(c, 'accumDep'); let total = 0; const out = [];
    for (const [m, list] of [...byMonth.entries()].sort()) {
      const amt = r2(list.reduce((s, x) => s + x.amt, 0)); total = r2(total + amt);
      const lastDay = addDays(addMonths(m + '-01', 1), -1);
      const [j] = await postJournals(c, [{ date: lastDay, type: 'Depreciation', vkind: 'depreciation', memo: `Depreciation ${m} · ${list.length} asset${list.length > 1 ? 's' : ''}`, user_id: user.id, lines: [{ account: dep, debit: amt }, { account: acc, credit: amt }] }]);
      await c.query(`insert into asset_dep(asset_id, month, amount, journal_id) select * from unnest($1::int[], $2::date[], $3::numeric[], $4::int[])`, [list.map(x => x.a.id), list.map(() => m + '-01'), list.map(x => x.amt), list.map(() => j.id)]);
      out.push({ month: m, amount: amt, voucher: j.no });
    }
    audit(user.id, 'depreciation', 'asset', null, { upto, total, months: out.length });
    return { ok: true, total, months: out };
  });
}
export async function disposeAsset(user, id, b) {
  return tx(async c => {
    const a = (await c.query('select * from assets where id=$1 and disposed_on is null for update', [+id])).rows[0]; need(a, 'Asset not found or already sold.');
    const date = isDate(b.date) ? b.date : today(), price = Math.max(r2(b.amount), 0);
    const dep = r2((await c.query('select coalesce(sum(amount), 0) s from asset_dep where asset_id=$1', [a.id])).rows[0].s);
    const book = r2(+a.cost - dep), gain = r2(price - book);
    const lines = [{ account: a.account, credit: +a.cost }];
    if (dep > 0) lines.push({ account: await head(c, 'accumDep'), debit: dep });
    if (price > 0) { const accs = await accMap(c, [b.account || '1000']); lines.push({ account: cashOf(accs, b.account || '1000').code, debit: price }); }
    if (gain > 0) lines.push({ account: await head(c, 'assetGain'), credit: gain }); else if (gain < 0) lines.push({ account: await head(c, 'assetGain'), debit: -gain });
    const [j] = await postJournals(c, [{ date, type: 'Fixed Asset', vkind: 'asset', memo: `Asset sold / disposed · ${a.name}`, user_id: user.id, lines }]);
    await c.query('update assets set disposed_on=$2 where id=$1', [a.id, date]);
    audit(user.id, 'dispose', 'asset', a.id, { name: a.name, price, book, gain, voucher: j.no });
    return { ok: true, voucher: j.no, gain };
  });
}

/* ======================= payroll ======================= */
export async function listEmployees() {
  return all(`select e.*, coalesce((select sum(credit - debit) from journal_lines where account = e.payable), 0) due, ea.name account_name from employees e left join accounts ea on ea.code = e.account order by e.active desc, e.name`);
}
export async function saveEmployee(user, b, id = null) {
  return tx(async c => {
    const name = String(b.name || '').trim(); need(name, 'Enter the employee name.');
    const old = id ? (await c.query('select * from employees where id=$1', [+id])).rows[0] : null; if (id) need(old, 'Employee not found.');
    let account = String(b.account || old?.account || '');
    if (!account) account = await makeAccount(c, `${name} SALARY`, 'D', 'Payroll', 400000, 400499);
    const payable = old?.payable || await makeAccount(c, `SALARY PAYABLE - ${name}`, 'B', 'Salaries Payable', 202000, 202499);
    const f = [name.slice(0, 80), String(b.phone || '').slice(0, 30), String(b.cnic || '').slice(0, 20), String(b.designation || '').slice(0, 60), Math.max(r2(b.salary), 0), isDate(b.join_date) ? b.join_date : null, account, payable, b.active === false ? false : true];
    const r = old ? (await c.query('update employees set name=$1, phone=$2, cnic=$3, designation=$4, salary=$5, join_date=$6, account=$7, payable=$8, active=$9 where id=$10 returning *', [...f, old.id])).rows[0]
      : (await c.query('insert into employees(name, phone, cnic, designation, salary, join_date, account, payable, active) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *', f)).rows[0];
    audit(user.id, old ? 'update' : 'create', 'employee', r.id, { name, salary: f[4] });
    return r;
  });
}
// b = {month: 'YYYY-MM', lines: [{employee_id, amount}]}
export async function payrollRun(c, user, b) {
  need(/^\d{4}-\d{2}$/.test(b.month || ''), 'Choose the month.');
  const month = b.month + '-01';
  need(!(await c.query('select 1 from payroll_runs where month=$1', [month])).rowCount, 'Payroll for this month is already posted. Reverse that voucher first to post again.');
  const E = (await c.query('select * from employees where active')).rows; const want = new Map((b.lines || []).map(l => [+l.employee_id, r2(l.amount)]));
  const lines = E.map(e => ({ e, amt: want.has(e.id) ? want.get(e.id) : r2(e.salary) })).filter(x => x.amt > 0);
  need(lines.length, 'No salary to post.');
  const total = r2(lines.reduce((s, x) => s + x.amt, 0)), date = addDays(addMonths(month, 1), -1);
  const j = await postJournal(c, { date, type: 'Payroll', vkind: 'payroll', memo: `Salaries for ${b.month} · ${lines.length} staff`, user_id: user.id,
    lines: [...lines.map(x => ({ account: x.e.account, debit: x.amt })), ...lines.map(x => ({ account: x.e.payable, credit: x.amt }))] });
  await c.query('insert into payroll_runs(month, total, journal_id, lines, created_by) values($1,$2,$3,$4,$5)', [month, total, j.id, JSON.stringify(lines.map(x => ({ employee_id: x.e.id, name: x.e.name, amount: x.amt }))), user.id]);
  audit(user.id, 'payroll', 'payroll', j.id, { month: b.month, total, staff: lines.length, voucher: j.no });
  return { ...j, amount: total };
}
// b = {employee_id, amount, account, date, kind: salary|advance, note}
export async function salaryPay(c, user, b) {
  const e = (await c.query('select * from employees where id=$1', [+b.employee_id])).rows[0]; need(e, 'Employee not found.');
  const amt = r2(b.amount); need(amt > 0, 'Enter an amount above zero.');
  const accs = await accMap(c, [b.account || '1000']); const cash = cashOf(accs, b.account || '1000');
  const date = isDate(b.date) ? b.date : today();
  const j = await postJournal(c, { date, type: isCashAcc(cash) ? 'Cash Payment' : 'Bank Payment', vkind: 'salary', memo: `${b.kind === 'advance' ? 'Salary advance' : 'Salary paid'} · ${e.name}${b.note ? ' · ' + String(b.note).slice(0, 150) : ''}`, user_id: user.id,
    lines: [{ account: e.payable, debit: amt }, { account: cash.code, credit: amt }] });
  audit(user.id, 'pay', 'employee', e.id, { name: e.name, amt, kind: b.kind, voucher: j.no });
  return { ...j, amount: amt };
}

/* ======================= global search ======================= */
const STAFF = ['admin', 'owner', 'manager', 'accountant'];
export async function search(user, q0, type) {
  const qs = String(q0 || '').trim().slice(0, 60); if (qs.length < 1) return { q: qs, groups: [] };
  const like = '%' + qs.toLowerCase().replace(/[%_\\]/g, m => '\\' + m) + '%', num = +qs.replace(/[, ]/g, ''), isNum = qs.replace(/[, ]/g, '') !== '' && Number.isFinite(num);
  const staff = STAFF.includes(user.role), want = k => !type || type === 'all' || type === k;
  const tasks = [];
  if (want('products')) tasks.push(['products', 'Products', all(`select id, name, sku, barcode, unit, stock, price, category from products where active and (lower(name) like $1 or lower(sku) like $1 or barcode = $2 or lower(barcode) like $1 or lower(category) like $1 or lower(aliases) like $1) order by (barcode = $2) desc, name limit 8`, [like, qs])
    .then(r => r.map(p => ({ title: p.name, sub: [p.sku && 'SKU ' + p.sku, p.barcode && '▮ ' + p.barcode, `${+p.stock} ${p.unit} stock`, p.category].filter(Boolean).join(' · '), amount: +p.price, link: `product/${p.id}` })))]);
  if (want('parties')) tasks.push(['parties', staff ? 'Customers & suppliers' : 'Customers', all(`select id, kind, name, city, phone from parties where active ${staff ? '' : "and kind='C'"} and (lower(name) like $1 or lower(city) like $1 or phone like $1 or lower(ntn) like $1) order by name limit 8`, [like])
    .then(r => r.map(p => ({ title: p.name, sub: [p.kind === 'C' ? 'Customer' : 'Supplier', p.city, p.phone].filter(Boolean).join(' · '), badge: p.kind === 'C' ? 'Customer' : 'Supplier', link: `party/${p.id}` })))]);
  const invWhere = staff ? '' : `and i.kind='sale' and i.created_by=${+user.id}`;
  if (want('invoices')) tasks.push(['invoices', 'Invoices & bills', all(`select i.id, i.no, i.kind, i.date, i.total, p.name party from invoices i left join parties p on p.id = i.party_id where (lower(i.no) like $1 or lower(p.name) like $1 ${isNum ? 'or i.total = $2' : ''}) ${invWhere} order by i.date desc, i.id desc limit 8`, isNum ? [like, num] : [like])
    .then(r => r.map(i => ({ title: `${i.no} · ${i.party || ''}`, sub: `${({ sale: 'Sales invoice', purchase: 'Purchase invoice', sale_return: 'Sales return', purchase_return: 'Purchase return' })[i.kind]} · ${i.date}`, amount: +i.total, link: `bill/${i.id}` })))]);
  if (staff && want('vouchers')) tasks.push(['vouchers', 'Vouchers & transactions', all(`select j.id, j.no, j.date, j.type, j.memo, j.ref_invoice, j.reversed_by, (select sum(debit) from journal_lines where journal_id = j.id) amt from journals j where (lower(j.no) like $1 or lower(j.memo) like $1 ${isNum ? 'or exists (select 1 from journal_lines x where x.journal_id = j.id and x.debit = $2)' : ''}) order by j.date desc, j.id desc limit 10`, isNum ? [like, num] : [like])
    .then(r => r.map(j => ({ title: `${j.no} · ${j.type}`, sub: `${j.date} · ${j.memo}`.slice(0, 120), amount: +j.amt, badge: j.reversed_by ? 'Reversed' : '', link: j.ref_invoice ? `bill/${j.ref_invoice}` : `voucher/${j.id}` })))]);
  if (staff && want('loans')) tasks.push(['loans', 'Loans', all(`select id, no, person, direction, book, principal, status from loans where lower(person) like $1 or lower(no) like $1 or phone like $1 or cnic like $1 order by created_at desc limit 8`, [like])
    .then(r => r.map(l => ({ title: `${l.person} · ${l.no}`, sub: `${l.direction === 'G' ? 'Loan given' : 'Loan taken'} · ${l.book} · ${l.status}`, amount: +l.principal, link: `loan/${l.id}` })))]);
  if (staff && want('people')) tasks.push(['people', 'Employees', all(`select id, name, designation, phone, salary from employees where lower(name) like $1 or phone like $1 or cnic like $1 or lower(designation) like $1 order by name limit 8`, [like])
    .then(r => r.map(e => ({ title: e.name, sub: [e.designation, e.phone].filter(Boolean).join(' · ') || 'Employee', amount: +e.salary, link: `employee/${e.id}` })))]);
  if (staff && want('accounts')) tasks.push(['accounts', 'Accounts & ledgers', all(`select code, name, type, grp from accounts where lower(name) like $1 or code like $1 or lower(grp) like $1 order by code limit 8`, [like])
    .then(r => r.map(a => ({ title: a.name, sub: `${a.code} · ${a.grp || ''}`, link: `account/${a.code}` })))]);
  if (staff && want('assets')) tasks.push(['assets', 'Fixed assets', all(`select id, name, category, cost from assets where lower(name) like $1 or lower(category) like $1 order by name limit 6`, [like])
    .then(r => r.map(a => ({ title: a.name, sub: a.category || 'Fixed asset', amount: +a.cost, link: 'assets' })))]);
  const res = await Promise.all(tasks.map(t => t[2]));
  return { q: qs, groups: tasks.map((t, i) => ({ type: t[0], label: t[1], items: res[i] })).filter(g => g.items.length) };
}

/* ======================= reports ======================= */
export async function generalLedger(from, to, account) {
  const accs = await all(`select a.code, a.name, a.type, a.grp from accounts a where ($1::text is null or a.code = $1) and exists (select 1 from journal_lines jl join journals j on j.id = jl.journal_id where jl.account = a.code and j.date <= $2::date) order by a.code`, [account || null, to]);
  const codes = accs.map(a => a.code);
  const [ob, lines] = await Promise.all([
    all(`select jl.account, coalesce(sum(jl.debit - jl.credit), 0) b from journal_lines jl join journals j on j.id = jl.journal_id where jl.account = any($1::text[]) and j.date < $2 group by jl.account`, [codes, from]),
    all(`select jl.account, j.id, j.date, j.no, j.type, j.memo, j.ref_invoice, p.name party, jl.debit, jl.credit from journal_lines jl join journals j on j.id = jl.journal_id left join parties p on p.id = jl.party_id
      where jl.account = any($1::text[]) and j.date between $2 and $3 order by jl.account, j.date, j.id limit 20000`, [codes, from, to])]);
  const O = Object.fromEntries(ob.map(r => [r.account, r2(r.b)])), byAcc = new Map(codes.map(c => [c, []]));
  for (const l of lines) byAcc.get(l.account).push(l);
  return { from, to, accounts: accs.map(a => { let bal = O[a.code] || 0; const opening = bal;
    const ls = byAcc.get(a.code).map(l => { bal = r2(bal + +l.debit - +l.credit); return { ...l, debit: +l.debit, credit: +l.credit, balance: bal }; });
    return { ...a, opening, debit: r2(ls.reduce((s, l) => s + l.debit, 0)), credit: r2(ls.reduce((s, l) => s + l.credit, 0)), closing: bal, lines: ls }; }).filter(a => a.lines.length || Math.abs(a.opening) > 0.005) };
}
export async function expenseReport(from, to) {
  const rows = await all(`select a.code, a.name, a.grp, to_char(j.date, 'YYYY-MM') m, sum(jl.debit - jl.credit) v from journal_lines jl join journals j on j.id = jl.journal_id join accounts a on a.code = jl.account
    where a.type = 'D' and j.date between $1 and $2 group by a.code, a.name, a.grp, m order by a.code`, [from, to]);
  const months = [...new Set(rows.map(r => r.m))].sort(), heads = new Map();
  for (const r of rows) { const h = heads.get(r.code) || { code: r.code, name: r.name, grp: r.grp, total: 0, by: {} }; h.by[r.m] = r2(+r.v); h.total = r2(h.total + +r.v); heads.set(r.code, h); }
  const list = [...heads.values()].filter(h => Math.abs(h.total) > 0.005).sort((a, b) => b.total - a.total);
  return { from, to, months, heads: list, total: r2(list.reduce((s, h) => s + h.total, 0)) };
}
export async function loanRecovery() {
  const L = (await listLoans()).filter(l => l.status === 'active');
  return { given: L.filter(l => l.direction === 'G'), taken: L.filter(l => l.direction === 'T'),
    totals: { given: r2(L.filter(l => l.direction === 'G').reduce((s, l) => s + l.outstanding, 0)), taken: r2(L.filter(l => l.direction === 'T').reduce((s, l) => s + l.outstanding, 0)), overdue: r2(L.filter(l => l.direction === 'G').reduce((s, l) => s + l.overdue, 0)) } };
}
export async function recent(user, limit = 12) {
  const staff = STAFF.includes(user.role);
  const [inv, jr] = await Promise.all([
    all(`select i.id, i.no, i.kind, i.date, i.total, p.name party, i.created_at at from invoices i left join parties p on p.id = i.party_id ${staff ? '' : `where i.created_by = ${+user.id}`} order by i.id desc limit $1`, [limit]),
    staff ? all(`select j.id, j.no, j.type, j.date, j.memo, j.created_at at, (select sum(debit) from journal_lines where journal_id = j.id) amt from journals j where j.ref_invoice is null order by j.id desc limit $1`, [limit]) : []]);
  return [...inv.map(i => ({ kind: i.kind, title: `${i.no} · ${i.party || ''}`, date: i.date, amount: +i.total, at: i.at, link: `bill/${i.id}` })),
    ...jr.map(j => ({ kind: 'voucher', title: `${j.no} · ${j.type}`, sub: j.memo, date: j.date, amount: +j.amt, at: j.at, link: `voucher/${j.id}` }))].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
}

// entries that can wait for an owner's approval
Object.assign(RUN, { money, transfer, note, loan: createLoan, loan_txn: loanTxn, asset: createAsset, payroll: payrollRun, salary: salaryPay });
