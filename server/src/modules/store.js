import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { decryptJson, encryptJson } from '../services/crypto.js';
import { getDataKey } from '../services/users.js';

/**
 * Encrypted document store scoped to one module, so extensions persist data
 * without schema migrations and without ever seeing plaintext at rest.
 */
export function moduleStore(moduleId) {
  const aad = (userId, id) => `module:${moduleId}:${userId}:${id}`;
  return {
    list(userId, kind) {
      const dek = getDataKey(userId);
      return db
        .prepare('SELECT id, payload, created_at, updated_at FROM module_records WHERE user_id = ? AND module = ? AND kind = ? ORDER BY created_at')
        .all(userId, moduleId, kind)
        .map((r) => ({ id: r.id, ...decryptJson(dek, r.payload, aad(userId, r.id)), createdAt: r.created_at, updatedAt: r.updated_at }));
    },
    create(userId, kind, data) {
      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare('INSERT INTO module_records (id, user_id, module, kind, payload, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
        .run(id, userId, moduleId, kind, encryptJson(getDataKey(userId), data, aad(userId, id)), now, now);
      return { id, ...data };
    },
    update(userId, id, data) {
      return db
        .prepare('UPDATE module_records SET payload = ?, updated_at = ? WHERE id = ? AND user_id = ? AND module = ?')
        .run(encryptJson(getDataKey(userId), data, aad(userId, id)), Date.now(), id, userId, moduleId).changes > 0;
    },
    remove(userId, id) {
      return db.prepare('DELETE FROM module_records WHERE id = ? AND user_id = ? AND module = ?').run(id, userId, moduleId).changes > 0;
    },
  };
}
