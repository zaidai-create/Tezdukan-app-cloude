// Approval system: entries above the limit (default Rs 10,000) wait for an owner (Zain / Rehan).
// Pending entries are NOT in the books yet. Approve = posted to the books. Reject = removed (a short note stays in the activity log).
import { all, one, tx } from './db.js';
import { audit } from './auth.js';
import { runKind, amountOf, KINDS, UserError, need, isDate, today, r2, loadEditable } from './posting.js';

export const APPROVERS = ['owner'];
export const KIND_LABEL = { sale: 'Sale bill', purchase: 'Purchase bill', sale_return: 'Sales return', purchase_return: 'Purchase return', receipt: 'Payment received', payment: 'Payment to supplier', expense: 'Expense', voucher: 'Journal voucher', edit: 'Bill edit', opening: 'Opening balance',
  money: 'Money in / out', transfer: 'Fund transfer', note: 'Credit / debit note', loan: 'New loan', loan_txn: 'Loan entry', asset: 'Fixed asset', payroll: 'Payroll', salary: 'Salary payment' };
const rs = n => 'Rs ' + Math.round(n).toLocaleString('en-US');

// kept in memory; reset whenever anything is saved
let lim = null;
export const resetLimit = () => { lim = null; };
export async function approvalLimit() {
  if (lim !== null) return lim;
  const r = await one(`select value->>'approval_limit' v from settings where key='company'`);
  const v = r?.v === undefined || r?.v === null || r?.v === '' ? 10000 : +r.v;
  return (lim = Number.isFinite(v) && v >= 0 ? v : 10000);
}

const needsApproval = (user, amount, limit) => !APPROVERS.includes(user.role) && amount > limit;

// Either posts the entry now, or saves it as pending and tells the owners. Runs inside a transaction (client c).
export async function submit(c, user, kind, payload) {
  need(KIND_LABEL[kind], 'Unknown entry type.');
  let amount = amountOf(kind, payload), editOf = null;
  if (kind === 'edit') {
    // an edit needs approval if the bill was, or becomes, bigger than the limit
    editOf = await loadEditable(c, payload.invoice_id);
    payload = { ...payload, kind: editOf.kind };
    amount = Math.max(amount, +editOf.total);
  }
  const limit = await approvalLimit();
  if (!needsApproval(user, amount, limit)) return { kind, ...(await runKind(c, user, kind, payload)) };

  // light checks now (full checks run again when the owner approves)
  const b = { ...payload, date: isDate(payload.date) ? payload.date : today() };
  need(amount > 0, 'Enter an amount above zero.');
  if (KINDS[kind] || editOf) {
    need(Array.isArray(b.lines) && b.lines.length, 'Add at least one item.');
    if (user.role === 'salesman') need(kind === 'sale', 'Salesmen can make sale bills only.');
  }
  const pid = +b.party_id || null;
  const info = (await c.query(`select (select name from parties where id=$1) party, (select value->>'lock_date' from settings where key='company') lock`, [pid])).rows[0];
  if (pid) need(info.party, 'Party not found.');
  need(!info.lock || b.date > info.lock, `Books are closed up to ${info.lock}. Use a later date.`);
  const label = KIND_LABEL[kind];
  const summary = (editOf ? [`Bill edit ${editOf.no}`, info.party, `${rs(editOf.total)} → ${rs(amountOf('edit', b))}`] : [label, info.party, KINDS[kind] ? `${b.lines.length} item${b.lines.length > 1 ? 's' : ''}` : (b.note || '')]).filter(Boolean).join(' · ').slice(0, 300);
  const r = (await c.query(`with a as (insert into approvals(kind, amount, party_id, summary, payload, requested_by) values($1,$2,$3,$4,$5,$6) returning id),
      n as (insert into notices(user_id, title, body, link) select u.id, $7, $8, '#approvals' from users u, a where u.role = any($9::text[]) and u.active and u.id <> $6 returning 1)
    select (select id from a) id, (select count(*)::int from n) told`,
  [kind, amount, pid, summary, JSON.stringify(b), user.id, `Approval chahiye: ${rs(amount)}`, `${user.name}: ${summary}`, APPROVERS])).rows[0];
  audit(user.id, 'request', 'approval', r.id, { kind, amount, party: info.party, summary });
  return { pending: true, approval_id: r.id, kind, amount, limit, owners_told: r.told };
}

export async function approve(user, id) {
  return tx(async c => {
    const a = (await c.query(`select a.*, row_to_json(u) req from approvals a left join (select id, username, name, role, active from users) u on u.id = a.requested_by where a.id=$1 for update of a`, [id])).rows[0];
    need(a, 'Yeh request ab maujood nahi (shayad reject ho chuki).');
    need(a.status === 'pending', 'Yeh pehle hi approve ho chuki hai.');
    const req = a.req;
    need(req, 'Request bhejne wala user nahi mila.');
    const result = await runKind(c, req, a.kind, { ...a.payload, approval_id: a.id });
    const link = KINDS[a.kind] || a.kind === 'edit' ? `#bill/${result.id}` : a.party_id ? `#party/${a.party_id}` : '';
    await c.query(`with u as (update approvals set status='approved', decided_by=$2, decided_at=now(), result=$3 where id=$1)
      insert into notices(user_id, title, body, link) values($4, $5, $6, $7)`,
    [a.id, user.id, JSON.stringify({ ...result, kind: a.kind }), a.requested_by, `Approved: ${rs(a.amount)}`, `${user.name} ne approve kar diya · ${a.summary}`, link]);
    audit(user.id, 'approve', 'approval', a.id, { kind: a.kind, amount: a.amount, summary: a.summary, by: req.name, result });
    return { ok: true, result: { ...result, kind: a.kind }, link };
  });
}

export async function reject(user, id, reason = '') {
  return tx(async c => {
    const a = (await c.query(`delete from approvals where id=$1 and status='pending' returning *`, [id])).rows[0];
    need(a, 'Yeh request ab pending nahi hai.');
    const req = (await c.query('select (select name from users where id=$1) name, (select name from parties where id=$2) party', [a.requested_by, a.party_id])).rows[0];
    await c.query(`insert into notices(user_id, title, body, link) values($1, $2, $3, '#myrequests')`,
      [a.requested_by, `Rejected: ${rs(a.amount)}`, `${user.name} ne reject kar diya · ${a.summary}${reason ? ' · Wajah: ' + reason : ''}`]);
    await c.query(`insert into audit_log(user_id, action, entity, entity_id, data) values($1, 'reject', 'approval', $2, $3)`,
      [user.id, String(a.id), JSON.stringify({ kind: a.kind, amount: a.amount, summary: a.summary, party: req?.party, party_id: a.party_id, by: req?.name, by_id: a.requested_by, requested_at: a.requested_at, reason: String(reason).slice(0, 200), payload: a.payload })]);
    return { ok: true };
  });
}

export async function cancelOwn(user, id) {
  const a = await one(`delete from approvals where id=$1 and status='pending' and requested_by=$2 returning *`, [id, user.id]);
  need(a, 'Request nahi mili.');
  audit(user.id, 'withdraw', 'approval', a.id, { kind: a.kind, amount: a.amount, summary: a.summary });
  return { ok: true };
}

// Pending + recent decisions, with names, for the approvals screen.
export async function listApprovals(user, { mine = false } = {}) {
  const w = mine ? 'where a.requested_by = $1' : 'where ($1::int is not null)';
  const rows = await all(`select a.*, u.name requested_by_name, d.name decided_by_name, p.name party_name from approvals a
    left join users u on u.id=a.requested_by left join users d on d.id=a.decided_by left join parties p on p.id=a.party_id
    ${w} order by (a.status='pending') desc, a.requested_at desc limit 150`, [user.id]);
  const rej = await all(`select l.id, l.entity_id, l.at, l.data, u.name decided_by_name from audit_log l left join users u on u.id=l.user_id
    where l.entity='approval' and l.action='reject' ${mine ? `and (l.data->>'by_id')::int = $1` : 'and $1::int is not null'} order by l.id desc limit 100`, [user.id]);
  const pids = new Set();
  for (const a of [...rows, ...rej.map(x => ({ payload: x.data.payload, kind: x.data.kind }))]) (a.payload?.lines || []).forEach(l => pids.add(+l.product_id));
  const prods = pids.size ? Object.fromEntries((await all('select id, name, unit, price from products where id = any($1::int[])', [[...pids]])).map(p => [p.id, p])) : {};
  const lines = a => (KINDS[a.kind] || a.kind === 'edit') ? (a.payload?.lines || []).map(l => ({ name: prods[+l.product_id]?.name || 'Item', unit: prods[+l.product_id]?.unit || '', qty: +l.qty, rate: +l.rate, tp: ['sale', 'sale_return'].includes(a.kind === 'edit' ? a.payload?.kind : a.kind) && +l.rate > 0 ? Math.max(+l.tp || +prods[+l.product_id]?.price || 0, +l.rate) : 0, amount: r2(+l.qty * +l.rate) })) : [];
  const out = rows.map(a => ({ id: a.id, kind: a.kind, amount: a.amount, status: a.status, summary: a.summary, party: a.party_name, party_id: a.party_id, by: a.requested_by_name, by_id: a.requested_by,
    at: a.requested_at, decided_by: a.decided_by_name, decided_at: a.decided_at, result: a.result, date: a.payload?.date, note: a.payload?.note || a.payload?.memo || '', paid: a.payload?.paid || 0, discount: +a.payload?.discount || 0, lines: lines(a) }));
  for (const x of rej) out.push({ id: +x.entity_id, kind: x.data.kind, amount: x.data.amount, status: 'rejected', summary: x.data.summary, party: x.data.party, party_id: x.data.party_id, by: x.data.by, by_id: x.data.by_id, at: x.data.requested_at, decided_by: x.decided_by_name, decided_at: x.at, reason: x.data.reason, date: x.data.payload?.date, lines: lines({ kind: x.data.kind, payload: x.data.payload }) });
  const t = x => new Date(x.decided_at || x.at || 0).getTime();
  out.sort((a, b) => { const pa = a.status === 'pending', pb = b.status === 'pending'; if (pa !== pb) return pa ? -1 : 1; return t(b) - t(a); });
  return { limit: await approvalLimit(), items: out };
}

// Every money entry, newest first, with how it was approved: for the owners' record.
export async function activity(limit = 150) {
  const rows = await all(`select l.id, l.user_id, l.action, l.entity, l.entity_id, l.data, l.at, u.name user_name from audit_log l left join users u on u.id=l.user_id
    where (l.action='create' and l.entity in ('invoice','receipt','payment','expense','voucher')) or (l.entity='approval' and l.action in ('request','approve','reject','withdraw')) or (l.action='cancel' and l.entity='invoice')
    order by l.id desc limit $1`, [limit]);
  return rows.map(r => ({ id: r.id, at: r.at, by: r.user_name, action: r.action, entity: r.entity, ref: r.entity_id, data: r.data || {} }));
}

export async function notices(user) {
  const all_ = APPROVERS.includes(user.role) || user.role === 'admin';
  const [list, n] = await Promise.all([
    all('select id, title, body, link, created_at, read_at from notices where user_id=$1 order by id desc limit 40', [user.id]),
    one(`select (select count(*)::int from notices where user_id=$1 and read_at is null) unread,
      (select count(*)::int from approvals where status='pending' and ($2 or requested_by=$1)) pending`, [user.id, all_]),
  ]);
  return { unread: n.unread, pending: n.pending, items: list, last: list[0]?.id || 0 };
}
export { UserError };
