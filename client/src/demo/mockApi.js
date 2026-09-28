// Demo build only: an in-browser stand-in for the server so the UI can be tried without a backend.
// It reuses the real tax engine and PII redactor; data stays in this browser (localStorage).
import { calculateTax, projectEntries, suggestSavings } from '../../../server/src/tax/calculator.js';
import { getRules, SUPPORTED_YEARS } from '../../../server/src/tax/rules.js';
import { looksLikeInjection, redactPII } from '../../../server/src/services/pii.js';

const KEY = 'pf-demo-v1';
const YEAR = new Date().getFullYear();
const uid = () => Math.random().toString(36).slice(2, 10);

// The artifact viewer suppresses native confirm dialogs; accept them in the demo.
window.confirm = () => true;

function seed() {
  const entries = [];
  for (let m = 1; m <= Math.min(9, new Date().getMonth() + 1); m++) {
    entries.push({ id: uid(), year: YEAR, month: m, type: 'salary', amount: 55_000, withholding: 1_850, payer: 'บริษัทตัวอย่าง จำกัด', note: '', finalWithholding: false });
  }
  entries.push({ id: uid(), year: YEAR, month: 3, type: 'freelance', amount: 40_000, withholding: 1_200, payer: 'งานออกแบบเว็บไซต์', note: '', finalWithholding: false });
  entries.push({ id: uid(), year: YEAR, month: 5, type: 'investment', amount: 12_000, withholding: 1_200, payer: 'เงินปันผลหุ้น', note: '', finalWithholding: true });
  return {
    user: { id: 'demo', email: 'demo@example.com', displayName: 'ผู้ทดลองใช้', createdAt: Date.now() },
    loggedIn: true,
    entries,
    deductions: { [YEAR]: { socialSecurity: 9_000, lifeInsurance: 20_000, thaiEsg: 30_000, parents: 1 } },
    holdings: [
      { id: uid(), symbol: 'K-ESGSI', name: 'กองทุน Thai ESG', assetClass: 'tax_fund', units: 2_900, costPerUnit: 10.34, pricePerUnit: 10.92, currency: 'THB', taxFund: 'thaiEsg' },
      { id: uid(), symbol: 'SCBS&P500', name: 'กองทุนหุ้นสหรัฐ', assetClass: 'mutual_fund', units: 4_200, costPerUnit: 18.5, pricePerUnit: 21.1, currency: 'THB', taxFund: '' },
      { id: uid(), symbol: 'PTT', name: '', assetClass: 'thai_stock', units: 1_000, costPerUnit: 34.25, pricePerUnit: 32.5, currency: 'THB', taxFund: '' },
      { id: uid(), symbol: 'GOLD96.5', name: 'ทองคำแท่ง', assetClass: 'gold', units: 1, costPerUnit: 38_000, pricePerUnit: 41_500, currency: 'THB', taxFund: '' },
      { id: uid(), symbol: 'SAVINGS', name: 'เงินฝากออมทรัพย์', assetClass: 'cash', units: 1, costPerUnit: 80_000, pricePerUnit: 80_000, currency: 'THB', taxFund: '' },
    ],
    apiKeys: [],
    audit: [{ action: 'login', meta: null, createdAt: Date.now() }],
  };
}

let memory = null;
function load() {
  if (memory) return memory;
  try {
    memory = JSON.parse(localStorage.getItem(KEY)) ?? seed();
  } catch {
    memory = seed();
  }
  return memory;
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable: keep in memory */
  }
}

const ASSET_CLASSES = {
  thai_stock: 'หุ้นไทย', foreign_stock: 'หุ้นต่างประเทศ', mutual_fund: 'กองทุนรวม', tax_fund: 'กองทุนลดหย่อนภาษี (RMF/ThaiESG)',
  bond: 'ตราสารหนี้/หุ้นกู้', gold: 'ทองคำ', crypto: 'คริปโต', cash: 'เงินฝาก/เงินสด', other: 'อื่น ๆ',
};

function portfolioSummary(holdings) {
  let cost = 0;
  let value = 0;
  const byClass = {};
  for (const h of holdings) {
    cost += h.units * h.costPerUnit;
    value += h.units * h.pricePerUnit;
    byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + h.units * h.pricePerUnit;
  }
  return {
    cost, value, gain: value - cost, gainPct: cost ? ((value - cost) / cost) * 100 : 0,
    allocation: Object.entries(byClass).map(([k, v]) => ({ assetClass: k, label: ASSET_CLASSES[k], value: v, pct: value ? (v / value) * 100 : 0 })),
  };
}

function taxSummary(year) {
  const s = load();
  const entries = s.entries.filter((e) => e.year === year);
  const deductions = s.deductions[year] ?? {};
  const now = new Date();
  const monthsElapsed = year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, withholding: 0, byType: {} }));
  for (const e of entries) {
    const m = monthly[e.month - 1];
    m.income += e.amount;
    m.withholding += e.withholding;
    m.byType[e.type] = (m.byType[e.type] ?? 0) + e.amount;
  }
  const projectedEntries = projectEntries(entries, monthsElapsed);
  return {
    year, monthsElapsed, entryCount: entries.length, monthly, deductions,
    actual: calculateTax({ year, entries, deductions }),
    projected: calculateTax({ year, entries: projectedEntries, deductions }),
    suggestions: suggestSavings({ year, entries: projectedEntries, deductions }),
  };
}

const unauthorized = () => {
  window.dispatchEvent(new Event('pf:unauthorized'));
  throw Object.assign(new Error('กรุณาเข้าสู่ระบบ'), { status: 401 });
};

function route(method, url, body) {
  const s = load();
  const path = url.replace(/^\/api/, '');
  let m;
  if (path === '/auth/me') return s.loggedIn ? s.user : unauthorized();
  if (path === '/auth/login' || path === '/auth/register') {
    s.loggedIn = true;
    if (body.displayName) s.user.displayName = body.displayName;
    if (body.email) s.user.email = body.email;
    s.audit.unshift({ action: path.endsWith('login') ? 'login' : 'register', createdAt: Date.now() });
    return s.user;
  }
  if (path === '/auth/logout' || path === '/account/logout-all') {
    s.loggedIn = false;
    return { ok: true };
  }
  if (path === '/auth/password') return { ok: true };
  if ((m = path.match(/^\/tax\/rules\/(\d+)$/))) {
    const r = getRules(Number(m[1]));
    return { ...r, brackets: r.brackets.map((b) => ({ ...b, upTo: Number.isFinite(b.upTo) ? b.upTo : null })), supportedYears: SUPPORTED_YEARS };
  }
  if (path === '/tax/calculate') return { result: calculateTax(body), suggestions: suggestSavings(body) };
  if (!s.loggedIn) return unauthorized();

  if ((m = path.match(/^\/summary\/(\d+)$/))) return taxSummary(Number(m[1]));
  if ((m = path.match(/^\/income\/(\d+)$/)) && method === 'GET') {
    return s.entries.filter((e) => e.year === Number(m[1])).sort((a, b) => a.month - b.month);
  }
  if (path === '/income' && method === 'POST') {
    const e = { id: uid(), withholding: 0, finalWithholding: false, payer: '', note: '', ...body };
    s.entries.push(e);
    return e;
  }
  if (path === '/income/bulk') {
    const added = body.entries.map((e) => ({ id: uid(), ...e }));
    s.entries.push(...added);
    return added;
  }
  if ((m = path.match(/^\/income\/([\w-]+)$/))) {
    const idx = s.entries.findIndex((e) => e.id === m[1]);
    if (method === 'PUT') s.entries[idx] = { ...s.entries[idx], ...body };
    if (method === 'DELETE') s.entries.splice(idx, 1);
    return { ok: true };
  }
  if ((m = path.match(/^\/deductions\/(\d+)$/))) {
    if (method === 'PUT') s.deductions[m[1]] = body;
    return s.deductions[m[1]] ?? {};
  }
  if (path === '/advisor/status') return { enabled: false, model: 'demo' };
  if (path === '/modules/portfolio/meta') return { assetClasses: ASSET_CLASSES, priceProviders: ['manual'] };
  if (path === '/modules/portfolio/holdings') {
    if (method === 'POST') {
      const h = { id: uid(), ...body };
      s.holdings.push(h);
      return h;
    }
    return { holdings: s.holdings, summary: portfolioSummary(s.holdings) };
  }
  if ((m = path.match(/^\/modules\/portfolio\/holdings\/([\w-]+)$/))) {
    const idx = s.holdings.findIndex((h) => h.id === m[1]);
    if (method === 'PUT') s.holdings[idx] = { ...s.holdings[idx], ...body };
    if (method === 'DELETE') s.holdings.splice(idx, 1);
    return { ok: true };
  }
  if (path === '/account/api-keys') {
    const availableScopes = {
      'tax:calculate': 'คำนวณภาษีจากข้อมูลที่ส่งมา (ไม่แตะข้อมูลในบัญชี)', 'income:read': 'อ่านรายได้และสรุปภาษีของบัญชีนี้',
      'income:write': 'เพิ่มรายการรายได้', 'advisor:chat': 'ถาม AI ที่ปรึกษาการเงิน', 'portfolio:read': 'อ่านพอร์ตการลงทุน',
    };
    if (method === 'POST') {
      const secret = `pfk_demo_${uid()}${uid()}`;
      const k = { id: uid(), prefix: secret.slice(0, 10), name: body.name, scopes: body.scopes, createdAt: Date.now(), lastUsedAt: null };
      s.apiKeys.unshift(k);
      s.audit.unshift({ action: 'api_key_created', createdAt: Date.now() });
      return { ...k, secret };
    }
    return { keys: s.apiKeys, availableScopes };
  }
  if ((m = path.match(/^\/account\/api-keys\/([\w-]+)$/))) {
    s.apiKeys = s.apiKeys.filter((k) => k.id !== m[1]);
    return { ok: true };
  }
  if (path === '/account/audit') return s.audit.slice(0, 50);
  if (path === '/account/delete') {
    memory = seed();
    memory.loggedIn = false;
    return { ok: true };
  }
  throw Object.assign(new Error('เดโมไม่รองรับคำสั่งนี้'), { status: 404 });
}

async function request(method, url, body) {
  await new Promise((r) => setTimeout(r, 60));
  const out = route(method, url, body);
  persist();
  return structuredClone(out);
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body ?? {}),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};

// ---- advisor: same guard pipeline as the server, with a rule-based answer instead of Claude ----
const FINANCE_WORDS = /ภาษี|ลดหย่อน|เงิน|ออม|ลงทุน|หุ้น|กองทุน|rmf|esg|ประกัน|เกษียณ|หนี้|ดอกเบี้ย|งบ|รายได้|รายจ่าย|เศรษฐ|เงินเฟ้อ|ทอง|คริปโต|พอร์ต|ปันผล|บาท|ฟรีแลนซ์|ยื่น|tax|invest|saving|budget|debt|stock|fund|retire|insurance|inflation|econom|finance|money|สวัสดี|ขอบคุณ|hello|hi\b/i;
const fmt = (n) => Math.round(n).toLocaleString('th-TH');

function demoAnswer(question, shareContext, year) {
  const s = taxSummary(year);
  const p = s.projected;
  const top = s.suggestions.slice(0, 3);
  const lines = [];
  if (shareContext) {
    lines.push(`จากข้อมูลของคุณ ปี ${year + 543} รายได้ทั้งปีประมาณ ${fmt(p.income.gross)} บาท เงินได้สุทธิ ${fmt(p.netIncome)} บาท อยู่ขั้นภาษี ${p.marginalRate * 100}% ภาษีทั้งปีประมาณ ${fmt(p.taxDue)} บาท (${p.balance > 0 ? `ต้องจ่ายเพิ่ม ${fmt(p.balance)}` : `ได้คืน ${fmt(-p.balance)}`} บาท)`, '');
  }
  if (/เกษียณ|retire/i.test(question)) {
    lines.push('วางแผนเกษียณแบบง่าย ๆ:', '1. ตั้งเป้าเงินใช้ต่อเดือนหลังเกษียณ × 12 × จำนวนปีหลังเกษียณ แล้วเผื่อเงินเฟ้อราว 2–3% ต่อปี', '2. ใช้ PVD / RMF / ประกันบำนาญ ซึ่งลดหย่อนภาษีได้ด้วย (รวมกันไม่เกิน 500,000 บาท)', '3. ลงทุนสม่ำเสมอทุกเดือน (DCA) ในสินทรัพย์ที่กระจายความเสี่ยง และปรับสัดส่วนหุ้นลงเมื่อใกล้เกษียณ');
  } else if (/แบ่ง|ออม|budget|งบ/i.test(question)) {
    lines.push('สูตรเริ่มต้นที่นิยม 50/30/20:', '• 50% ค่าใช้จ่ายจำเป็น', '• 30% ใช้จ่ายตามใจ', '• 20% ออมและลงทุน (เริ่มจากเงินสำรองฉุกเฉิน 6 เดือน แล้วค่อยลงทุนระยะยาว)');
  } else if (/ฟรีแลนซ์|ยื่น/i.test(question)) {
    lines.push('ฟรีแลนซ์ (40(2)) ยื่น ภ.ง.ด.94 ครึ่งปี (ก.ค.–ก.ย.) ถ้ามีรายได้ประเภท 40(5)–(8) และยื่น ภ.ง.ด.90 ปลายปี (ภายใน 31 มี.ค. หรือ 8 เม.ย. ถ้ายื่นออนไลน์)', 'เอกสาร: หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ) ทุกใบ, หลักฐานค่าลดหย่อน เช่น ใบรับรองการซื้อกองทุน เบี้ยประกัน');
  } else if (/เงินเฟ้อ|inflation/i.test(question)) {
    lines.push('เงินเฟ้อทำให้เงินฝากดอกเบี้ยต่ำมีมูลค่าจริงลดลง ควรเก็บเงินสดแค่พอเป็นเงินฉุกเฉิน ส่วนที่เหลือกระจายไปในสินทรัพย์ที่มีโอกาสให้ผลตอบแทนสูงกว่าเงินเฟ้อในระยะยาว เช่น กองทุนหุ้น ตราสารหนี้ และทองคำ ตามระดับความเสี่ยงที่รับได้');
  } else {
    lines.push('แนวทางลดภาษีที่คุ้มที่สุดสำหรับคุณตอนนี้ (คำนวณจากข้อมูลจริงในแอป):');
    top.forEach((t, i) => lines.push(`${i + 1}. ${t.label}: ซื้อเพิ่มได้อีก ${fmt(t.room)} บาท ประหยัดภาษี ${fmt(t.taxSaved)} บาท (${t.hint})`));
    if (!top.length) lines.push('คุณใช้สิทธิลดหย่อนเต็มแล้ว หรือยังไม่มีภาษีที่ต้องเสีย');
    lines.push('', 'ทุกบาทที่ลดหย่อนได้ในขั้นภาษีปัจจุบันช่วยประหยัดภาษี ' + p.marginalRate * 100 + ' สตางค์ แต่ควรเลือกเฉพาะกองทุนที่เหมาะกับเป้าหมายและรับความเสี่ยงได้');
  }
  lines.push('', '(เดโม: คำตอบนี้มาจากกฎในระบบ เมื่อใส่ ANTHROPIC_API_KEY ในแอปจริง จะได้คำตอบจาก Claude ที่วิเคราะห์ละเอียดกว่านี้)');
  return lines.join('\n');
}

export async function streamChat(body, onEvent, signal) {
  const last = body.messages.at(-1).content;
  const { text, found } = redactPII(last);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(400);
  let reply;
  if (looksLikeInjection(text)) {
    onEvent('blocked', { reason: 'injection_heuristic' });
    reply = 'ขออภัยครับ คำขอนี้ไม่สามารถดำเนินการได้เพื่อความปลอดภัยของข้อมูล หากมีคำถามเรื่องการเงินหรือภาษี ยินดีช่วยครับ';
  } else if (!FINANCE_WORDS.test(text)) {
    onEvent('blocked', { reason: 'out_of_scope' });
    reply = 'ขออภัยครับ น้องเงินดีตอบได้เฉพาะเรื่องการเงิน ภาษี การลงทุน และเศรษฐศาสตร์เท่านั้น 🙏 ลองถามเช่น "ปีนี้ควรซื้อ ThaiESG เท่าไหร่ถึงคุ้ม" ได้เลยครับ';
  } else {
    if (Object.keys(found).length) onEvent('redacted', found);
    reply = demoAnswer(text, body.shareContext, body.year);
  }
  for (let i = 0; i < reply.length; i += 6) {
    if (signal?.aborted) return;
    onEvent('text', { text: reply.slice(i, i + 6) });
    await wait(12);
  }
  onEvent('done', { model: 'demo' });
}
