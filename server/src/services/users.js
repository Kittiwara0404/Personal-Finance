import crypto from 'node:crypto';
import { db, transaction } from '../db/index.js';
import { config } from '../config.js';
import { decryptJson, encryptJson, hashPassword, newWrappedDataKey, unwrapDataKey, verifyPassword } from './crypto.js';

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

// Emails are looked up by keyed hash so the DB never holds them in clear.
const emailKey = crypto.createHmac('sha256', config.masterKey).update('email-index').digest();
const emailHash = (email) => crypto.createHmac('sha256', emailKey).update(email.trim().toLowerCase()).digest('hex');

export function getDataKey(userId) {
  const row = db.prepare('SELECT wrapped_dek FROM users WHERE id = ?').get(userId);
  if (!row) throw Object.assign(new Error('user not found'), { status: 404 });
  return unwrapDataKey(userId, row.wrapped_dek);
}

export async function createUser({ email, password, displayName }) {
  const hash = emailHash(email);
  if (db.prepare('SELECT 1 FROM users WHERE email_hash = ?').get(hash)) {
    throw Object.assign(new Error('อีเมลนี้ถูกใช้แล้ว'), { status: 409 });
  }
  const id = crypto.randomUUID();
  const wrapped = newWrappedDataKey(id);
  const dek = unwrapDataKey(id, wrapped);
  const profile = encryptJson(dek, { email: email.trim(), displayName: displayName?.trim() || '' }, `profile:${id}`);
  db.prepare('INSERT INTO users (id, email_hash, password_hash, wrapped_dek, profile, created_at) VALUES (?,?,?,?,?,?)')
    .run(id, hash, await hashPassword(password), wrapped, profile, Date.now());
  return { id };
}

/** Returns { user } on success or { error, status }. Locks the account after repeated failures. */
export async function authenticate(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE email_hash = ?').get(emailHash(email));
  if (!row) {
    await hashPassword(password); // equalize timing so unknown emails aren't distinguishable
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', status: 401 };
  }
  if (row.locked_until > Date.now()) {
    return { error: 'บัญชีถูกล็อกชั่วคราวจากการเข้าสู่ระบบผิดหลายครั้ง กรุณาลองใหม่ภายหลัง', status: 423 };
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    const failed = row.failed_logins + 1;
    const lockedUntil = failed >= MAX_FAILED ? Date.now() + LOCK_MS : 0;
    db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(lockedUntil ? 0 : failed, lockedUntil, row.id);
    return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', status: 401, locked: Boolean(lockedUntil), userId: row.id };
  }
  db.prepare('UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?').run(row.id);
  return { user: { id: row.id } };
}

export function getProfile(userId) {
  const row = db.prepare('SELECT profile, created_at FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return { id: userId, ...decryptJson(getDataKey(userId), row.profile, `profile:${userId}`), createdAt: row.created_at };
}

export async function changePassword(userId, current, next) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    throw Object.assign(new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง'), { status: 400 });
  }
  const hash = await hashPassword(next);
  transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  });
}

/** PDPA right to erasure. Cascades remove all rows; dropping the DEK shreds any backups. */
export function deleteUser(userId) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
