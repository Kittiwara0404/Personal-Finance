import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { endSession, requireSession, startSession } from '../middleware/auth.js';
import { authenticate, changePassword, createUser, getProfile } from '../services/users.js';
import { audit } from '../services/audit.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'พยายามหลายครั้งเกินไป กรุณารอสักครู่' } });

const password = z
  .string()
  .min(10, 'รหัสผ่านอย่างน้อย 10 ตัวอักษร')
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'ต้องมีทั้งตัวอักษรและตัวเลข');

const registerSchema = z.object({
  email: z.email().max(200),
  password,
  displayName: z.string().trim().max(60).optional(),
  acceptPrivacy: z.literal(true, { error: 'กรุณายอมรับนโยบายความเป็นส่วนตัว' }),
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { id } = await createUser(req.valid);
  audit(id, 'register', req);
  startSession(res, id);
  res.status(201).json(getProfile(id));
});

router.post('/login', authLimiter, validate(z.object({ email: z.email(), password: z.string().max(200) })), async (req, res) => {
  const result = await authenticate(req.valid.email, req.valid.password);
  if (result.error) {
    if (result.userId) audit(result.userId, result.locked ? 'account_locked' : 'login_failed', req);
    return res.status(result.status).json({ error: result.error });
  }
  audit(result.user.id, 'login', req);
  startSession(res, result.user.id);
  res.json(getProfile(result.user.id));
});

router.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

router.get('/me', requireSession, (req, res) => res.json(getProfile(req.userId)));

router.post('/password', requireSession, validate(z.object({ current: z.string(), next: password })), async (req, res) => {
  await changePassword(req.userId, req.valid.current, req.valid.next);
  audit(req.userId, 'password_changed', req);
  endSession(req, res);
  res.json({ ok: true });
});

export default router;
