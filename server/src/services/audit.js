import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { config } from '../config.js';

// IPs are hashed with a server secret: enough to spot "new location" without storing raw IPs.
const ipKey = crypto.createHmac('sha256', config.masterKey).update('ip-audit').digest();
const hashIp = (ip) => (ip ? crypto.createHmac('sha256', ipKey).update(ip).digest('hex').slice(0, 16) : null);

export function audit(userId, action, req, meta) {
  db.prepare('INSERT INTO audit_log (user_id, action, ip_hash, meta, created_at) VALUES (?,?,?,?,?)')
    .run(userId ?? null, action, hashIp(req?.ip), meta ? JSON.stringify(meta) : null, Date.now());
}

export function listAudit(userId, limit = 50) {
  return db
    .prepare('SELECT action, ip_hash AS ipHash, meta, created_at AS createdAt FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit)
    .map((r) => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null }));
}
