export const THB = (n, digits = 0) =>
  (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

export const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const INCOME_TYPES = {
  salary: { label: 'เงินเดือน', code: '40(1)', color: '#0f9d76' },
  freelance: { label: 'ฟรีแลนซ์/นายหน้า', code: '40(2)', color: '#3b82f6' },
  royalty: { label: 'ค่าลิขสิทธิ์', code: '40(3)', color: '#a855f7' },
  investment: { label: 'ดอกเบี้ย/ปันผล', code: '40(4)', color: '#f59e0b' },
  rent: { label: 'ค่าเช่า', code: '40(5)', color: '#ec4899' },
  professional: { label: 'วิชาชีพอิสระ', code: '40(6)', color: '#14b8a6' },
  contract: { label: 'รับเหมา', code: '40(7)', color: '#f97316' },
  business: { label: 'ธุรกิจ/ขายของ', code: '40(8)', color: '#6366f1' },
  other: { label: 'อื่น ๆ', code: '-', color: '#94a3b8' },
};

export const toBE = (year) => year + 543;
