import { getRules, INCOME_TYPES } from './rules.js';

const round2 = (n) => Math.round(n * 100) / 100;
const clamp = (n, max) => Math.max(0, Math.min(Number(n) || 0, max));

/** Progressive tax with a per-bracket breakdown (used by the UI's bracket ladder). */
export function progressiveTax(netIncome, brackets) {
  let remaining = Math.max(0, netIncome);
  let lower = 0;
  let tax = 0;
  const breakdown = [];
  for (const b of brackets) {
    const width = b.upTo - lower;
    const taxable = Math.min(remaining, width);
    const t = taxable * b.rate;
    breakdown.push({ from: lower, to: b.upTo, rate: b.rate, taxable: round2(taxable), tax: round2(t) });
    tax += t;
    remaining -= taxable;
    lower = b.upTo;
    if (remaining <= 0) break;
  }
  const current = breakdown.findLast((b) => b.taxable > 0) ?? breakdown[0];
  return { tax: round2(tax), breakdown, marginalRate: netIncome > 0 ? current.rate : 0 };
}

/** Sum monthly entries into gross income / withholding per income type. */
export function aggregateIncome(entries = []) {
  const byType = Object.fromEntries(INCOME_TYPES.map((t) => [t, 0]));
  let withholding = 0;
  let finalTaxedInvestment = 0;
  let finalWithholding = 0;
  for (const e of entries) {
    const type = INCOME_TYPES.includes(e.type) ? e.type : 'other';
    const amount = Number(e.amount) || 0;
    const wht = Number(e.withholding) || 0;
    // ดอกเบี้ย/ปันผลที่เลือกให้ภาษีหัก ณ ที่จ่ายเป็นที่สุด ไม่ต้องนำมารวมคำนวณ
    if (type === 'investment' && e.finalWithholding) {
      finalTaxedInvestment += amount;
      finalWithholding += wht;
      continue;
    }
    byType[type] += amount;
    withholding += wht;
  }
  return { byType, withholding: round2(withholding), finalTaxedInvestment, finalWithholding };
}

function computeExpenses(byType, rules) {
  const items = [];
  const emp = rules.expenses.salary;
  const employmentIncome = (byType.salary || 0) + (byType.freelance || 0);
  if (employmentIncome > 0) {
    items.push({ type: 'salary+freelance', label: '40(1)+40(2)', amount: Math.min(employmentIncome * emp.rate, emp.cap) });
  }
  for (const [type, cfg] of Object.entries(rules.expenses)) {
    if (cfg.group === 'employment' || !byType[type]) continue;
    const amount = Math.min(byType[type] * cfg.rate, cfg.cap);
    if (amount > 0) items.push({ type, label: cfg.label, amount });
  }
  return { items, total: items.reduce((s, i) => s + i.amount, 0) };
}

/**
 * Allowances (ค่าลดหย่อน). Returns every line with the amount the law actually allows,
 * so the UI can show "claimed vs allowed".
 */
function computeAllowances(d, byType, gross, rules) {
  const a = rules.allowances;
  const lines = [];
  const add = (key, label, claimed, allowed) => lines.push({ key, label, claimed: round2(claimed), allowed: round2(allowed) });

  add('personal', 'ส่วนตัว', a.personal, a.personal);
  if (d.spouse) add('spouse', 'คู่สมรส (ไม่มีเงินได้)', a.spouse, a.spouse);

  const children = Math.max(0, Math.floor(d.children || 0));
  const childrenFrom2018 = Math.min(Math.max(0, Math.floor(d.childrenBornFrom2018 || 0)), children);
  if (children > 0) {
    // บุตรคนที่ 2 เป็นต้นไปที่เกิดตั้งแต่ปี 2561 ได้ 60,000; คนแรกได้ 30,000 เสมอ
    const hasOlderChild = children > childrenFrom2018;
    const bonusKids = hasOlderChild ? childrenFrom2018 : Math.max(0, childrenFrom2018 - 1);
    const amount = (children - bonusKids) * a.child + bonusKids * a.childSecondFrom2018;
    add('children', `บุตร ${children} คน`, amount, amount);
  }
  const parents = Math.min(Math.max(0, Math.floor(d.parents || 0)), a.maxParents);
  if (parents) add('parents', `อุปการะบิดามารดา ${parents} คน`, parents * a.parent, parents * a.parent);
  const disabled = Math.max(0, Math.floor(d.disabledDependents || 0));
  if (disabled) add('disabled', `อุปการะผู้พิการ ${disabled} คน`, disabled * a.disabledDependent, disabled * a.disabledDependent);

  add('socialSecurity', 'ประกันสังคม', d.socialSecurity || 0, clamp(d.socialSecurity, a.socialSecurityCap));

  const life = clamp(d.lifeInsurance, a.lifeInsuranceCap);
  const health = clamp(d.healthInsurance, a.healthInsuranceCap);
  const lifeHealthScale = life + health > a.lifeAndHealthCombinedCap ? a.lifeAndHealthCombinedCap / (life + health) : 1;
  add('lifeInsurance', 'เบี้ยประกันชีวิต', d.lifeInsurance || 0, life * lifeHealthScale);
  add('healthInsurance', 'เบี้ยประกันสุขภาพ', d.healthInsurance || 0, health * lifeHealthScale);
  add('parentsHealthInsurance', 'ประกันสุขภาพบิดามารดา', d.parentsHealthInsurance || 0, clamp(d.parentsHealthInsurance, a.parentsHealthInsuranceCap));

  // กลุ่มเกษียณ: PVD + RMF + ประกันบำนาญ + กอช. รวมกันไม่เกิน 500,000
  const wage = byType.salary || 0;
  const pvd = clamp(d.pvd, Math.min(wage * a.pvdRate, a.pvdCap));
  const rmf = clamp(d.rmf, Math.min(gross * a.rmfRate, a.rmfCap));
  const pension = clamp(d.pensionInsurance, Math.min(gross * a.pensionInsuranceRate, a.pensionInsuranceCap));
  const nsf = clamp(d.nsf, a.nsfCap);
  const ssf = clamp(d.ssf, Math.min(gross * a.ssfRate, a.ssfCap));
  const retirementTotal = pvd + rmf + pension + nsf + ssf;
  const scale = retirementTotal > a.retirementCombinedCap ? a.retirementCombinedCap / retirementTotal : 1;
  add('pvd', 'กองทุนสำรองเลี้ยงชีพ (PVD)', d.pvd || 0, pvd * scale);
  add('rmf', 'กองทุน RMF', d.rmf || 0, rmf * scale);
  add('pensionInsurance', 'ประกันชีวิตแบบบำนาญ', d.pensionInsurance || 0, pension * scale);
  add('nsf', 'กองทุนการออมแห่งชาติ (กอช.)', d.nsf || 0, nsf * scale);
  if (a.ssfCap > 0) add('ssf', 'กองทุน SSF', d.ssf || 0, ssf * scale);

  add('thaiEsg', 'กองทุน Thai ESG', d.thaiEsg || 0, clamp(d.thaiEsg, Math.min(gross * a.thaiEsgRate, a.thaiEsgCap)));
  add('homeLoanInterest', 'ดอกเบี้ยเงินกู้ซื้อที่อยู่อาศัย', d.homeLoanInterest || 0, clamp(d.homeLoanInterest, a.homeLoanInterestCap));
  if (a.stimulusCap > 0) add('stimulus', a.stimulusLabel, d.stimulus || 0, clamp(d.stimulus, a.stimulusCap));
  add('politicalDonation', 'บริจาคพรรคการเมือง', d.politicalDonation || 0, clamp(d.politicalDonation, a.politicalDonationCap));

  const visible = lines.filter((l) => l.claimed > 0 || l.allowed > 0);
  return { lines: visible, total: round2(visible.reduce((s, l) => s + l.allowed, 0)), retirementCapHit: scale < 1 };
}

/**
 * Full annual calculation.
 * @param {{ year:number, entries?:Array, income?:Record<string,number>, withholding?:number, deductions?:object }} input
 */
export function calculateTax(input) {
  const rules = getRules(input.year ?? new Date().getFullYear());
  const agg = input.entries
    ? aggregateIncome(input.entries)
    : { byType: { ...Object.fromEntries(INCOME_TYPES.map((t) => [t, 0])), ...input.income }, withholding: Number(input.withholding) || 0, finalTaxedInvestment: 0, finalWithholding: 0 };
  const byType = Object.fromEntries(Object.entries(agg.byType).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]));
  const gross = Object.values(byType).reduce((s, v) => s + v, 0);
  const d = input.deductions ?? {};

  const expenses = computeExpenses(byType, rules);
  const allowances = computeAllowances(d, byType, gross, rules);
  const afterAllowances = Math.max(0, gross - expenses.total - allowances.total);

  // เงินบริจาค: หักได้ไม่เกิน 10% ของเงินได้หลังหักค่าใช้จ่ายและค่าลดหย่อน (บริจาคการศึกษา/รพ. หักได้ 2 เท่า)
  const donationCap = afterAllowances * rules.allowances.donationPctOfNet;
  const doubleDonation = Math.min((Number(d.donationDouble) || 0) * 2, donationCap);
  const generalDonation = Math.min(Number(d.donation) || 0, Math.max(0, donationCap - doubleDonation));
  const donationTotal = doubleDonation + generalDonation;
  const netIncome = Math.max(0, afterAllowances - donationTotal);

  const prog = progressiveTax(netIncome, rules.brackets);

  const nonSalaryIncome = gross - byType.salary;
  let minimumTax = 0;
  if (nonSalaryIncome >= rules.minimumTax.threshold) {
    const t = nonSalaryIncome * rules.minimumTax.rate;
    minimumTax = t > rules.minimumTax.exemptBelow ? round2(t) : 0;
  }
  const method = minimumTax > prog.tax ? 'minimum' : 'progressive';
  const taxDue = Math.max(prog.tax, minimumTax);
  const balance = round2(taxDue - agg.withholding);

  return {
    year: rules.year,
    rulesAssumedFrom: rules.assumedFrom ?? null,
    income: { byType, gross: round2(gross), finalTaxedInvestment: agg.finalTaxedInvestment },
    expenses: { ...expenses, total: round2(expenses.total) },
    allowances,
    donations: { general: round2(generalDonation), double: round2(doubleDonation), total: round2(donationTotal), cap: round2(donationCap) },
    netIncome: round2(netIncome),
    progressive: prog,
    minimumTax,
    method,
    taxDue: round2(taxDue),
    withholding: agg.withholding,
    balance, // > 0 ต้องชำระเพิ่ม, < 0 ได้คืน
    effectiveRate: gross > 0 ? round2((taxDue / gross) * 100) : 0,
    marginalRate: prog.marginalRate,
    nextBracket: nextBracketInfo(netIncome, rules.brackets),
  };
}

function nextBracketInfo(netIncome, brackets) {
  const idx = brackets.findIndex((b) => netIncome <= b.upTo);
  const current = brackets[idx];
  const prevUpTo = idx > 0 ? brackets[idx - 1].upTo : 0;
  return {
    currentRate: current.rate,
    // ลดเงินได้สุทธิลงเท่านี้จะตกไปขั้นที่ต่ำกว่า
    toLowerBracket: idx > 0 ? round2(netIncome - prevUpTo) : 0,
    toHigherBracket: Number.isFinite(current.upTo) ? round2(current.upTo - netIncome) : null,
  };
}

/** Deductions the user can still use, ranked by exact tax saved (recalculates, not an estimate). */
export function suggestSavings(input) {
  const base = calculateTax(input);
  const rules = getRules(base.year);
  const a = rules.allowances;
  const gross = base.income.gross;
  const wage = base.income.byType.salary;
  const d = input.deductions ?? {};
  const candidates = [
    { key: 'thaiEsg', label: 'Thai ESG', max: Math.min(gross * a.thaiEsgRate, a.thaiEsgCap), hint: 'ถือครอง 5 ปีนับวันต่อวัน' },
    { key: 'rmf', label: 'RMF', max: Math.min(gross * a.rmfRate, a.rmfCap), hint: 'ถือจนอายุ 55 ปี และอย่างน้อย 5 ปี' },
    { key: 'pensionInsurance', label: 'ประกันบำนาญ', max: Math.min(gross * a.pensionInsuranceRate, a.pensionInsuranceCap), hint: 'ได้เงินคืนหลังเกษียณ' },
    { key: 'pvd', label: 'เพิ่มเงินสะสม PVD', max: Math.min(wage * a.pvdRate, a.pvdCap), hint: 'แจ้ง HR เพื่อเพิ่มอัตราสะสม' },
    { key: 'lifeInsurance', label: 'ประกันชีวิต', max: a.lifeInsuranceCap, hint: 'ระยะเวลาคุ้มครอง ≥ 10 ปี' },
    { key: 'healthInsurance', label: 'ประกันสุขภาพ', max: a.healthInsuranceCap, hint: 'รวมกับประกันชีวิตไม่เกิน 100,000' },
    { key: 'nsf', label: 'กอช.', max: a.nsfCap, hint: 'สำหรับผู้ไม่มีสวัสดิการบำนาญ' },
  ];
  if (a.stimulusCap > 0) candidates.push({ key: 'stimulus', label: a.stimulusLabel, max: a.stimulusCap, hint: 'ต้องมีใบกำกับภาษีอิเล็กทรอนิกส์' });

  return candidates
    .map((c) => {
      const room = Math.max(0, c.max - (Number(d[c.key]) || 0));
      if (room < 1) return null;
      const next = calculateTax({ ...input, deductions: { ...d, [c.key]: (Number(d[c.key]) || 0) + room } });
      const saved = round2(base.taxDue - next.taxDue);
      return saved > 0 ? { ...c, room: round2(room), taxSaved: saved, returnPct: round2((saved / room) * 100) } : null;
    })
    .filter(Boolean)
    .sort((x, y) => y.taxSaved - x.taxSaved);
}

/** Annualize recurring income (salary) from the months that have data; skipped once the year is over. */
export function projectEntries(entries, monthsElapsed) {
  if (!monthsElapsed || monthsElapsed >= 12) return entries;
  const recurring = new Set(['salary']);
  const extra = [];
  const byType = {};
  for (const e of entries) {
    if (!recurring.has(e.type)) continue;
    const cur = (byType[e.type] ??= { amount: 0, withholding: 0, months: new Set() });
    cur.amount += Number(e.amount) || 0;
    cur.withholding += Number(e.withholding) || 0;
    cur.months.add(e.month);
  }
  for (const [type, v] of Object.entries(byType)) {
    const n = v.months.size || 1;
    const missing = 12 - n;
    if (missing > 0) extra.push({ type, amount: (v.amount / n) * missing, withholding: (v.withholding / n) * missing, projected: true });
  }
  return [...entries, ...extra];
}
