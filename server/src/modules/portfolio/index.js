import { Router } from 'express';
import { z } from 'zod';
import { validate, money } from '../../middleware/validate.js';
import { manualPriceProvider } from './priceProviders.js';

export const ASSET_CLASSES = {
  thai_stock: 'หุ้นไทย',
  foreign_stock: 'หุ้นต่างประเทศ',
  mutual_fund: 'กองทุนรวม',
  tax_fund: 'กองทุนลดหย่อนภาษี (RMF/ThaiESG)',
  bond: 'ตราสารหนี้/หุ้นกู้',
  gold: 'ทองคำ',
  crypto: 'คริปโต',
  cash: 'เงินฝาก/เงินสด',
  other: 'อื่น ๆ',
};

const holdingSchema = z.object({
  symbol: z.string().trim().min(1).max(30),
  name: z.string().trim().max(100).optional().default(''),
  assetClass: z.enum(Object.keys(ASSET_CLASSES)),
  units: z.coerce.number().min(0).max(1e12),
  costPerUnit: money,
  pricePerUnit: money,
  currency: z.string().length(3).default('THB'),
  taxFund: z.enum(['', 'rmf', 'thaiEsg']).optional().default(''),
  purchaseYear: z.coerce.number().int().min(1990).max(2100).optional(),
});

function summarize(holdings) {
  let cost = 0;
  let value = 0;
  const byClass = {};
  for (const h of holdings) {
    const c = h.units * h.costPerUnit;
    const v = h.units * h.pricePerUnit;
    cost += c;
    value += v;
    byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + v;
  }
  return {
    cost,
    value,
    gain: value - cost,
    gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    allocation: Object.entries(byClass).map(([k, v]) => ({ assetClass: k, label: ASSET_CLASSES[k], value: v, pct: value > 0 ? (v / value) * 100 : 0 })),
  };
}

/** @type {import('../index.js').FinanceModule} */
export default {
  id: 'portfolio',
  name: 'พอร์ตการลงทุน',
  status: 'beta',
  scopes: { 'portfolio:read': 'อ่านพอร์ตการลงทุน' },

  register({ store, requireSession }) {
    const router = Router();
    router.use(requireSession);
    router.get('/meta', (req, res) => res.json({ assetClasses: ASSET_CLASSES, priceProviders: [manualPriceProvider.id] }));
    router.get('/holdings', (req, res) => {
      const holdings = store.list(req.userId, 'holding');
      res.json({ holdings, summary: summarize(holdings) });
    });
    router.post('/holdings', validate(holdingSchema), (req, res) => res.status(201).json(store.create(req.userId, 'holding', req.valid)));
    router.put('/holdings/:id', validate(holdingSchema), (req, res) =>
      store.update(req.userId, req.params.id, req.valid) ? res.json({ ok: true }) : res.status(404).json({ error: 'ไม่พบรายการ' }),
    );
    router.delete('/holdings/:id', (req, res) =>
      store.remove(req.userId, req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'ไม่พบรายการ' }),
    );
    return router;
  },

  apiRoutes({ store, requireApiKey }) {
    const router = Router();
    router.get('/holdings', requireApiKey('portfolio:read'), (req, res) => {
      const holdings = store.list(req.userId, 'holding');
      res.json({ holdings, summary: summarize(holdings) });
    });
    return router;
  },

  advisorContext({ store, userId }) {
    const holdings = store.list(userId, 'holding');
    if (!holdings.length) return null;
    const s = summarize(holdings);
    const alloc = s.allocation.map((a) => `${a.label} ${a.pct.toFixed(1)}%`).join(', ');
    return `พอร์ตการลงทุน: มูลค่า ${Math.round(s.value).toLocaleString('th-TH')} บาท, กำไร/ขาดทุน ${s.gainPct.toFixed(1)}%, สัดส่วน: ${alloc}`;
  },

  exportData({ store, userId }) {
    return { holdings: store.list(userId, 'holding') };
  },
};
