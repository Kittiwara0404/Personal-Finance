import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTax, progressiveTax, suggestSavings, projectEntries } from '../src/tax/calculator.js';
import { getRules } from '../src/tax/rules.js';

const brackets = getRules(2026).brackets;

test('progressive tax: first 150k is exempt', () => {
  assert.equal(progressiveTax(150_000, brackets).tax, 0);
  assert.equal(progressiveTax(300_000, brackets).tax, 7_500);
  assert.equal(progressiveTax(500_000, brackets).tax, 27_500);
  assert.equal(progressiveTax(1_000_000, brackets).tax, 115_000);
  assert.equal(progressiveTax(1_000_000, brackets).marginalRate, 0.2);
});

test('salary 50,000/month, personal + social security only', () => {
  const r = calculateTax({
    year: 2025,
    income: { salary: 600_000 },
    deductions: { socialSecurity: 9_000 },
  });
  // 600,000 - 100,000 expense - 60,000 personal - 9,000 SSO = 431,000
  assert.equal(r.netIncome, 431_000);
  // 150k*5% + 131k*10% = 7,500 + 13,100
  assert.equal(r.taxDue, 20_600);
  assert.equal(r.marginalRate, 0.1);
});

test('life + health insurance share a 100k cap', () => {
  const r = calculateTax({ year: 2026, income: { salary: 2_000_000 }, deductions: { lifeInsurance: 100_000, healthInsurance: 25_000 } });
  const life = r.allowances.lines.find((l) => l.key === 'lifeInsurance').allowed;
  const health = r.allowances.lines.find((l) => l.key === 'healthInsurance').allowed;
  assert.equal(Math.round(life + health), 100_000);
});

test('retirement group capped at 500k combined', () => {
  const r = calculateTax({ year: 2026, income: { salary: 5_000_000 }, deductions: { rmf: 500_000, pvd: 500_000, pensionInsurance: 200_000 } });
  const total = ['rmf', 'pvd', 'pensionInsurance'].reduce((s, k) => s + r.allowances.lines.find((l) => l.key === k).allowed, 0);
  assert.equal(Math.round(total), 500_000);
  assert.equal(r.allowances.retirementCapHit, true);
});

test('second child born 2018+ gets 60k', () => {
  const r = calculateTax({ year: 2026, income: { salary: 1_000_000 }, deductions: { children: 2, childrenBornFrom2018: 2 } });
  assert.equal(r.allowances.lines.find((l) => l.key === 'children').allowed, 90_000);
});

test('minimum tax (0.5%) applies to large non-salary income with heavy deductions', () => {
  const r = calculateTax({ year: 2026, income: { business: 3_000_000 }, deductions: {} });
  // progressive: 3M - 60% (1.8M) - 60k = 1,140,000 -> 150k tax at 25% slab... should beat 15k minimum
  assert.equal(r.method, 'progressive');
  const low = calculateTax({ year: 2026, income: { rent: 1_200_000 }, deductions: { rmf: 360_000, thaiEsg: 300_000 } });
  assert.ok(low.taxDue >= low.minimumTax);
});

test('withholding produces refund balance', () => {
  const r = calculateTax({ year: 2026, entries: [
    { type: 'salary', amount: 30_000, withholding: 1_000, month: 1 },
    { type: 'salary', amount: 30_000, withholding: 1_000, month: 2 },
  ] });
  assert.equal(r.taxDue, 0);
  assert.equal(r.balance, -2_000);
});

test('final-withholding dividends excluded from computation', () => {
  const r = calculateTax({ year: 2026, entries: [{ type: 'investment', amount: 100_000, withholding: 10_000, finalWithholding: true, month: 3 }] });
  assert.equal(r.income.gross, 0);
  assert.equal(r.withholding, 0);
});

test('donation limited to 10% of net before donation', () => {
  const r = calculateTax({ year: 2026, income: { salary: 1_000_000 }, deductions: { donation: 1_000_000 } });
  assert.equal(r.donations.general, r.donations.cap);
});

test('savings suggestions are sorted and positive', () => {
  const s = suggestSavings({ year: 2026, income: { salary: 1_200_000 }, deductions: {} });
  assert.ok(s.length > 0);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].taxSaved >= s[i].taxSaved);
  assert.ok(s.every((x) => x.taxSaved > 0));
});

test('projection fills missing salary months', () => {
  const entries = [1, 2, 3].map((m) => ({ type: 'salary', amount: 40_000, withholding: 500, month: m }));
  const projected = projectEntries(entries, 3);
  const total = projected.reduce((s, e) => s + e.amount, 0);
  assert.equal(total, 480_000);
});
