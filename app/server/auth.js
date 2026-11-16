import crypto from 'node:crypto';
import { one, q } from './db.js';

const SECRET = process.env.APP_SECRET || (() => {
  console.warn('APP_SECRET is not set: using a random one, everyone will be logged out on restart.');
  return crypto.randomBytes(32).toString('hex');
})();
const TOKEN_DAYS = 365; // sign in once; stays signed in on that phone

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function checkPassword(pw, stored) {
  const [alg, s, k] = String(stored).split('$');
  if (alg !== 'scrypt' || !s || !k) return false;
  const key = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(k, 'hex');
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

const b64 = b => Buffer.from(b).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

export function makeToken(user) {
  const payload = b64(JSON.stringify({ u: user.id, v: user.token_version, e: Date.now() + TOKEN_DAYS * 864e5 }));
  return `${payload}.${sign(payload)}`;
}

async function userFromToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  let p; try { p = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (!p.e || p.e < Date.now()) return null;
  const u = await one('select id, username, name, role, active, must_change, token_version, phone from users where id=$1', [p.u]);
  if (!u || !u.active || u.token_version !== p.v) return null;
  return u;
}

export function requireAuth(...roles) {
  return async (req, res, next) => {
    try {
      const h = req.headers.authorization || '';
      const user = await userFromToken(h.startsWith('Bearer ') ? h.slice(7) : '');
      if (!user) return res.status(401).json({ error: 'Please sign in again.' });
      if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Your role cannot do this.' });
      req.user = user;
      next();
    } catch (e) { next(e); }
  };
}

// Simple brute-force guard for the login endpoint.
const tries = new Map();
export function loginAllowed(key) {
  const now = Date.now(), t = tries.get(key) || { n: 0, at: now };
  if (now - t.at > 15 * 60e3) { t.n = 0; t.at = now; }
  return t.n < 8;
}
export function loginFailed(key) { const t = tries.get(key) || { n: 0, at: Date.now() }; t.n++; tries.set(key, t); }
export function loginOk(key) { tries.delete(key); }

export async function audit(userId, action, entity, entityId, data) {
  await q('insert into audit_log(user_id, action, entity, entity_id, data) values($1,$2,$3,$4,$5)',
    [userId || null, action, entity, entityId == null ? null : String(entityId), data ? JSON.stringify(data) : null]).catch(() => {});
}

// First start: create the admin account from INITIAL_ADMIN_* env values if there are no users yet.
export async function seedAdmin() {
  const n = await one('select count(*)::int n from users');
  if (n.n > 0) return;
  const username = (process.env.INITIAL_ADMIN_USERNAME || 'zaid').toLowerCase();
  const pw = process.env.INITIAL_ADMIN_PASSWORD;
  if (!pw) { console.warn('No users and no INITIAL_ADMIN_PASSWORD set: nobody can sign in yet.'); return; }
  await q(`insert into users(username, name, role, pass_hash, must_change) values($1,$2,'admin',$3,true)`,
    [username, process.env.INITIAL_ADMIN_NAME || 'Zaid Khan', hashPassword(pw)]);
  console.log(`Created first admin user "${username}".`);
}
