// Thai personal income tax (ภาษีเงินได้บุคคลธรรมดา) rules, keyed by tax year (ค.ศ.).
// Keep every legal number here so a new tax year is a data change, not a code change.
// Numbers must be re-verified against กรมสรรพากร (rd.go.th) each year before filing.

const BRACKETS = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
];

// Expense deduction per income type (มาตรา 40).
const EXPENSES = {
  salary: { label: '40(1) เงินเดือน/ค่าจ้าง', rate: 0.5, cap: 100_000, group: 'employment' },
  freelance: { label: '40(2) ค่านายหน้า/รับจ้างอิสระ', rate: 0.5, cap: 100_000, group: 'employment' },
  royalty: { label: '40(3) ค่าลิขสิทธิ์', rate: 0.5, cap: 100_000 },
  investment: { label: '40(4) ดอกเบี้ย/เงินปันผล', rate: 0, cap: 0 },
  rent: { label: '40(5) ค่าเช่าทรัพย์สิน', rate: 0.3, cap: Infinity },
  professional: { label: '40(6) วิชาชีพอิสระ', rate: 0.3, cap: Infinity },
  contract: { label: '40(7) รับเหมา', rate: 0.6, cap: Infinity },
  business: { label: '40(8) ธุรกิจ/ขายของออนไลน์', rate: 0.6, cap: Infinity },
  other: { label: 'อื่น ๆ', rate: 0, cap: 0 },
};

const BASE = {
  brackets: BRACKETS,
  expenses: EXPENSES,
  allowances: {
    personal: 60_000,
    spouse: 60_000,
    child: 30_000,
    childSecondFrom2018: 60_000,
    parent: 30_000,
    maxParents: 4,
    disabledDependent: 60_000,
    socialSecurityCap: 9_000,
    lifeInsuranceCap: 100_000,
    healthInsuranceCap: 25_000,
    lifeAndHealthCombinedCap: 100_000,
    parentsHealthInsuranceCap: 15_000,
    pensionInsuranceRate: 0.15,
    pensionInsuranceCap: 200_000,
    pvdRate: 0.15,
    pvdCap: 500_000,
    rmfRate: 0.3,
    rmfCap: 500_000,
    ssfRate: 0,
    ssfCap: 0,
    nsfCap: 30_000,
    retirementCombinedCap: 500_000,
    thaiEsgRate: 0.3,
    thaiEsgCap: 300_000,
    homeLoanInterestCap: 100_000,
    stimulusCap: 0,
    stimulusLabel: 'มาตรการกระตุ้นเศรษฐกิจ',
    politicalDonationCap: 10_000,
    donationPctOfNet: 0.1,
  },
  // วิธีที่ 2: 0.5% ของเงินได้พึงประเมิน (ยกเว้น 40(1)) เมื่อเงินได้ดังกล่าว >= 120,000
  // และผลคำนวณเกิน 5,000 บาท — ให้เสียตามวิธีที่ได้ยอดสูงกว่า
  minimumTax: { threshold: 120_000, rate: 0.005, exemptBelow: 5_000 },
  filingDeadline: { paper: '03-31', online: '04-08' },
};

export const RULES = {
  2025: {
    ...BASE,
    year: 2025,
    allowances: {
      ...BASE.allowances,
      stimulusCap: 50_000,
      stimulusLabel: 'Easy E-Receipt 2.0',
    },
  },
  2026: {
    ...BASE,
    year: 2026,
    allowances: {
      ...BASE.allowances,
      // ฐานค่าจ้างประกันสังคมปรับเป็น 17,500 บาท (5% = 875/เดือน) — ตรวจสอบประกาศล่าสุดก่อนยื่น
      socialSecurityCap: 10_500,
      stimulusCap: 0,
      stimulusLabel: 'มาตรการกระตุ้นเศรษฐกิจ (ถ้ามีประกาศ)',
    },
  },
};

export const SUPPORTED_YEARS = Object.keys(RULES).map(Number);
export const INCOME_TYPES = Object.keys(EXPENSES);

export function getRules(year) {
  const rules = RULES[year];
  if (!rules) {
    const latest = Math.max(...SUPPORTED_YEARS);
    return { ...RULES[latest], year, assumedFrom: latest };
  }
  return rules;
}
