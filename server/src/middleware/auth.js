import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { randomToken, sha256 } from '../services/crypto.js';

export const SESSION_COOKIE = config.isProd ? '__Host-pf_session' : 'pf_session';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'strict',
  path: '/',
  maxAge: config.sessionTtlMs,
});

export function startSession(res, userId) {
  const token = randomToken();
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, last_seen) VALUES (?,?,?,?)')
    .run(sha256(token), userId, now + config.sessionTtlMs, now);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function endSession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(), maxAge: undefined });
}

function sessionUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const hash = sha256(token);
  const row = db.prepare('SELECT user_id, expires_at, last_seen FROM sessions WHERE token_hash = ?').get(hash);
  const now = Date.now();
  if (!row || row.expires_at < now || now - row.last_seen > config.sessionIdleMs) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now, hash);
  return row.user_id;
}

/** Browser session auth. State-changing requests also need the CSRF header (cross-site forms can't set it). */
export function requireSession(req, res, next) {
  const userId = sessionUser(req);
  if (!userId) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-pf-csrf') !== '1') {
    return res.status(403).json({ error: 'CSRF check failed' });
  }
  req.userId = userId;
  req.authMethod = 'session';
  next();
}

// ---- API keys (for calling the platform from scripts / other apps) ----

export const API_SCOPES = {
  'tax:calculate': 'คำนวณภาษีจากข้อมูลที่ส่งมา (ไม่แตะข้อมูลในบัญชี)',
  'income:read': 'อ่านรายได้และสรุปภาษีของบัญชีนี้',
  'income:write': 'เพิ่มรายการรายได้',
  'advisor:chat': 'ถาม AI ที่ปรึกษาการเงิน',
};

export function createApiKey(userId, name, scopes) {
  const secret = `pfk_${randomToken(24)}`;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO api_keys (id, user_id, key_hash, prefix, name, scopes, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, userId, sha256(secret), secret.slice(0, 10), name, JSON.stringify(scopes), Date.now());
  return { id, secret };
}

export function requireApiKey(scope) {
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const secret = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!secret.startsWith('pfk_')) return res.status(401).json({ error: 'Missing or invalid API key' });
    const row = db.prepare('SELECT id, user_id, scopes FROM api_keys WHERE key_hash = ?').get(sha256(secret));
    if (!row) return res.status(401).json({ error: 'Missing or invalid API key' });
    if (!JSON.parse(row.scopes).includes(scope)) return res.status(403).json({ error: `API key lacks scope ${scope}` });
    db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(Date.now(), row.id);
    req.userId = row.user_id;
    req.authMethod = 'api_key';
    req.apiKeyId = row.id;
    next();
  };
}
