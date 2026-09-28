import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { decryptJson, encryptJson } from './crypto.js';
import { getDataKey } from './users.js';
import { calculateTax, projectEntries, suggestSavings } from '../tax/calculator.js';

const entryAad = (userId, id) => `income:${userId}:${id}`;
const dedAad = (userId, year) => `deductions:${userId}:${year}`;

export function listIncome(userId, year) {
  const dek = getDataKey(userId);
  return db
    .prepare('SELECT id, year, month, type, payload, created_at FROM income_entries WHERE user_id = ? AND year = ? ORDER BY month, created_at')
    .all(userId, year)
    .map((r) => ({ id: r.id, year: r.year, month: r.month, type: r.type, ...decryptJson(dek, r.payload, entryAad(userId, r.id)) }));
}

export function addIncome(userId, entry) {
  const id = crypto.randomUUID();
  const { year, month, type, ...secret } = entry;
  const payload = encryptJson(getDataKey(userId), secret, entryAad(userId, id));
  db.prepare('INSERT INTO income_entries (id, user_id, year, month, type, payload, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, userId, year, month, type, payload, Date.now());
  return { id, ...entry };
}

export function updateIncome(userId, id, entry) {
  const { year, month, type, ...secret } = entry;
  const payload = encryptJson(getDataKey(userId), secret, entryAad(userId, id));
  const r = db.prepare('UPDATE income_entries SET year = ?, month = ?, type = ?, payload = ? WHERE id = ? AND user_id = ?')
    .run(year, month, type, payload, id, userId);
  return r.changes > 0;
}

export function deleteIncome(userId, id) {
  return db.prepare('DELETE FROM income_entries WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
}

export function getDeductions(userId, year) {
  const row = db.prepare('SELECT payload FROM deductions WHERE user_id = ? AND year = ?').get(userId, year);
  return row ? decryptJson(getDataKey(userId), row.payload, dedAad(userId, year)) : {};
}

export function saveDeductions(userId, year, deductions) {
  const payload = encryptJson(getDataKey(userId), deductions, dedAad(userId, year));
  db.prepare('INSERT INTO deductions (user_id, year, payload) VALUES (?,?,?) ON CONFLICT(user_id, year) DO UPDATE SET payload = excluded.payload')
    .run(userId, year, payload);
}

/** Everything the dashboard needs for one tax year: actual-to-date, full-year projection, and savings ideas. */
export function taxSummary(userId, year, now = new Date()) {
  const entries = listIncome(userId, year);
  const deductions = getDeductions(userId, year);
  const monthsElapsed = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, withholding: 0, byType: {} }));
  for (const e of entries) {
    const m = monthly[e.month - 1];
    m.income += Number(e.amount) || 0;
    m.withholding += Number(e.withholding) || 0;
    m.byType[e.type] = (m.byType[e.type] ?? 0) + (Number(e.amount) || 0);
  }
  const projectedEntries = projectEntries(entries, monthsElapsed);
  return {
    year,
    monthsElapsed,
    entryCount: entries.length,
    monthly,
    deductions,
    actual: calculateTax({ year, entries, deductions }),
    projected: calculateTax({ year, entries: projectedEntries, deductions }),
    suggestions: suggestSavings({ year, entries: projectedEntries, deductions }),
  };
}

/** Anonymized numbers only — safe to hand to the AI advisor as context. */
export function advisorContext(userId, year) {
  const s = taxSummary(userId, year);
  const p = s.projected;
  const lines = [
    `ปีภาษี ${year} (ข้อมูล ${s.monthsElapsed} เดือน, ${s.entryCount} รายการ)`,
    `รายได้พึงประเมินทั้งปี (ประมาณการ): ${fmt(p.income.gross)} บาท`,
    `แยกประเภท: ${Object.entries(p.income.byType).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${fmt(v)}`).join(', ') || '-'}`,
    `ค่าใช้จ่ายหักได้: ${fmt(p.expenses.total)} | ค่าลดหย่อนรวม: ${fmt(p.allowances.total)}`,
    `ค่าลดหย่อนที่ใช้: ${p.allowances.lines.map((l) => `${l.label} ${fmt(l.allowed)}`).join(', ')}`,
    `เงินได้สุทธิ: ${fmt(p.netIncome)} | ภาษี: ${fmt(p.taxDue)} | อัตราภาษีขั้นสูงสุด: ${p.marginalRate * 100}% | อัตราภาษีที่แท้จริง: ${p.effectiveRate}%`,
    `ภาษีหัก ณ ที่จ่ายสะสม: ${fmt(p.withholding)} | ${p.balance >= 0 ? `ต้องชำระเพิ่ม ${fmt(p.balance)}` : `คาดว่าได้คืน ${fmt(-p.balance)}`}`,
    `ช่องลดหย่อนที่ยังเหลือ: ${s.suggestions.slice(0, 5).map((x) => `${x.label} อีก ${fmt(x.room)} (ประหยัด ${fmt(x.taxSaved)})`).join('; ') || '-'}`,
  ];
  return lines.join('\n');
}

const fmt = (n) => Math.round(n).toLocaleString('th-TH');
