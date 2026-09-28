import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { validate } from '../middleware/validate.js';
import { API_SCOPES, createApiKey, endSession } from '../middleware/auth.js';
import { audit, listAudit } from '../services/audit.js';
import { deleteUser, getProfile } from '../services/users.js';
import { verifyPassword } from '../services/crypto.js';
import { getDeductions, listIncome } from '../services/finance.js';
import { moduleList, moduleScopes, modulesExport } from '../modules/index.js';

export const allScopes = () => ({ ...API_SCOPES, ...moduleScopes() });

const router = Router();

router.get('/modules', (req, res) => res.json(moduleList()));

router.get('/api-keys', (req, res) => {
  const keys = db
    .prepare('SELECT id, prefix, name, scopes, created_at AS createdAt, last_used_at AS lastUsedAt FROM api_keys WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId)
    .map((k) => ({ ...k, scopes: JSON.parse(k.scopes) }));
  res.json({ keys, availableScopes: allScopes() });
});

router.post(
  '/api-keys',
  validate(z.object({ name: z.string().trim().min(1).max(60), scopes: z.array(z.string()).min(1) })),
  (req, res) => {
    const valid = Object.keys(allScopes());
    const scopes = [...new Set(req.valid.scopes)].filter((s) => valid.includes(s));
    if (!scopes.length) return res.status(400).json({ error: 'ต้องเลือกสิทธิ์อย่างน้อย 1 รายการ' });
    const count = db.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?').get(req.userId).n;
    if (count >= 10) return res.status(400).json({ error: 'สร้าง API key ได้สูงสุด 10 อัน' });
    const key = createApiKey(req.userId, req.valid.name, scopes);
    audit(req.userId, 'api_key_created', req, { id: key.id, scopes });
    // The secret is shown once and never stored in recoverable form.
    res.status(201).json({ ...key, scopes });
  },
);

router.delete('/api-keys/:id', (req, res) => {
  const ok = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.userId).changes > 0;
  if (ok) audit(req.userId, 'api_key_revoked', req, { id: req.params.id });
  res.status(ok ? 200 : 404).json(ok ? { ok } : { error: 'ไม่พบ API key' });
});

router.get('/audit', (req, res) => res.json(listAudit(req.userId)));

router.post('/logout-all', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.userId);
  audit(req.userId, 'logout_all', req);
  endSession(req, res);
  res.json({ ok: true });
});

// PDPA: right of access / data portability
router.get('/export', (req, res) => {
  const years = db.prepare('SELECT DISTINCT year FROM income_entries WHERE user_id = ? UNION SELECT year FROM deductions WHERE user_id = ?').all(req.userId, req.userId).map((r) => r.year);
  const data = {
    exportedAt: new Date().toISOString(),
    profile: getProfile(req.userId),
    years: Object.fromEntries(years.map((y) => [y, { income: listIncome(req.userId, y), deductions: getDeductions(req.userId, y) }])),
    modules: modulesExport(req.userId),
    auditLog: listAudit(req.userId, 500),
  };
  audit(req.userId, 'data_exported', req);
  res.set('Content-Disposition', `attachment; filename="personal-finance-export-${Date.now()}.json"`).json(data);
});

// PDPA: right to erasure — requires password re-entry
router.post('/delete', validate(z.object({ password: z.string().max(200), confirm: z.literal('DELETE') })), async (req, res) => {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId);
  if (!(await verifyPassword(req.valid.password, row.password_hash))) return res.status(400).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  endSession(req, res);
  deleteUser(req.userId);
  audit(null, 'account_deleted', req);
  res.json({ ok: true });
});

export default router;
