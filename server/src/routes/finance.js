import { Router } from 'express';
import { z } from 'zod';
import { money, validate, year } from '../middleware/validate.js';
import { requireSession } from '../middleware/auth.js';
import { addIncome, deleteIncome, getDeductions, listIncome, saveDeductions, taxSummary, updateIncome } from '../services/finance.js';
import { calculateTax, suggestSavings } from '../tax/calculator.js';
import { getRules, INCOME_TYPES, SUPPORTED_YEARS } from '../tax/rules.js';

export const incomeSchema = z.object({
  year,
  month: z.coerce.number().int().min(1).max(12),
  type: z.enum(INCOME_TYPES),
  amount: money,
  withholding: money.default(0),
  finalWithholding: z.boolean().optional().default(false),
  payer: z.string().trim().max(100).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
});

const count = z.coerce.number().int().min(0).max(20).default(0);
export const deductionsSchema = z.object({
  spouse: z.boolean().default(false),
  children: count,
  childrenBornFrom2018: count,
  parents: z.coerce.number().int().min(0).max(4).default(0),
  disabledDependents: count,
  socialSecurity: money.default(0),
  lifeInsurance: money.default(0),
  healthInsurance: money.default(0),
  parentsHealthInsurance: money.default(0),
  pensionInsurance: money.default(0),
  pvd: money.default(0),
  rmf: money.default(0),
  ssf: money.default(0),
  nsf: money.default(0),
  thaiEsg: money.default(0),
  homeLoanInterest: money.default(0),
  stimulus: money.default(0),
  donation: money.default(0),
  donationDouble: money.default(0),
  politicalDonation: money.default(0),
});

export const calcSchema = z.object({
  year,
  income: z.partialRecord(z.enum(INCOME_TYPES), money).default({}),
  withholding: money.default(0),
  deductions: deductionsSchema.partial().default({}),
});

const router = Router();

// Public: tax rules & stateless calculator (no personal data stored)
router.get('/tax/rules/:year', validate(z.object({ year }), 'params'), (req, res) => {
  const r = getRules(req.valid.year);
  res.json({ ...r, brackets: r.brackets.map((b) => ({ ...b, upTo: Number.isFinite(b.upTo) ? b.upTo : null })), supportedYears: SUPPORTED_YEARS });
});
router.post('/tax/calculate', validate(calcSchema), (req, res) => {
  res.json({ result: calculateTax(req.valid), suggestions: suggestSavings(req.valid) });
});

router.use(requireSession);

router.get('/income/:year', validate(z.object({ year }), 'params'), (req, res) => res.json(listIncome(req.userId, req.valid.year)));
router.post('/income', validate(incomeSchema), (req, res) => res.status(201).json(addIncome(req.userId, req.valid)));
router.post('/income/bulk', validate(z.object({ entries: z.array(incomeSchema).min(1).max(120) })), (req, res) => {
  res.status(201).json(req.valid.entries.map((e) => addIncome(req.userId, e)));
});
router.put('/income/:id', validate(incomeSchema), (req, res) =>
  updateIncome(req.userId, req.params.id, req.valid) ? res.json({ ok: true }) : res.status(404).json({ error: 'ไม่พบรายการ' }),
);
router.delete('/income/:id', (req, res) =>
  deleteIncome(req.userId, req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'ไม่พบรายการ' }),
);

router.get('/deductions/:year', validate(z.object({ year }), 'params'), (req, res) => res.json(getDeductions(req.userId, req.valid.year)));
router.put('/deductions/:year', validate(deductionsSchema), (req, res) => {
  const y = year.safeParse(req.params.year);
  if (!y.success) return res.status(400).json({ error: 'ปีไม่ถูกต้อง' });
  saveDeductions(req.userId, y.data, req.valid);
  res.json({ ok: true });
});

router.get('/summary/:year', validate(z.object({ year }), 'params'), (req, res) => res.json(taxSummary(req.userId, req.valid.year)));

export default router;
