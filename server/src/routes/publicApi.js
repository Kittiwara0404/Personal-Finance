// Public REST API (v1) authenticated by personal API keys: `Authorization: Bearer pfk_...`
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireApiKey } from '../middleware/auth.js';
import { validate, year } from '../middleware/validate.js';
import { calculateTax, suggestSavings } from '../tax/calculator.js';
import { addIncome, listIncome, taxSummary } from '../services/finance.js';
import { calcSchema, incomeSchema } from './finance.js';
import { advisorLimiter, chatSchema, handleChat } from './advisor.js';

const router = Router();

router.use(rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Rate limit exceeded' } }));

router.post('/tax/calculate', requireApiKey('tax:calculate'), validate(calcSchema), (req, res) => {
  res.json({ result: calculateTax(req.valid), suggestions: suggestSavings(req.valid) });
});

router.get('/income/:year', requireApiKey('income:read'), validate(z.object({ year }), 'params'), (req, res) => {
  res.json(listIncome(req.userId, req.valid.year));
});

router.post('/income', requireApiKey('income:write'), validate(incomeSchema), (req, res) => {
  res.status(201).json(addIncome(req.userId, req.valid));
});

router.get('/summary/:year', requireApiKey('income:read'), validate(z.object({ year }), 'params'), (req, res) => {
  res.json(taxSummary(req.userId, req.valid.year));
});

router.post('/advisor/chat', requireApiKey('advisor:chat'), advisorLimiter, validate(chatSchema), handleChat);

export default router;
