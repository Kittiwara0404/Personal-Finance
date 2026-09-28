// Strip personal identifiers before any text leaves the server (e.g. to the AI provider).

function validThaiId(d) {
  if (!/^\d{13}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

function luhn(d) {
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const RULES = [
  { type: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Thai national ID, with or without dashes/spaces (1-2345-67890-12-3)
  {
    type: 'thai_id',
    re: /\b\d[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d\b/g,
    check: (m) => validThaiId(m.replace(/\D/g, '')),
  },
  { type: 'card', re: /\b(?:\d[ -]?){13,19}\b/g, check: (m) => luhn(m.replace(/\D/g, '')) },
  { type: 'phone', re: /(?:\+66[-\s]?|\b0)[689]\d[-\s]?\d{3}[-\s]?\d{4}\b/g },
  { type: 'phone', re: /\b0[2-7][-\s]?\d{3}[-\s]?\d{4}\b/g },
  // Bank account numbers usually written 123-4-56789-0
  { type: 'bank_account', re: /\b\d{3}-\d-\d{5}-\d\b/g },
  { type: 'passport', re: /\b[A-Z]{1,2}\d{6,8}\b/g },
  { type: 'tax_id_label', re: /(เลขประจำตัวผู้เสียภาษี|เลขบัตรประชาชน|บัญชีเลขที่|เลขบัญชี)\s*[:：]?\s*[\d-]{8,20}/g },
];

/** @returns {{ text: string, found: Record<string, number> }} */
export function redactPII(input) {
  let text = String(input ?? '');
  const found = {};
  for (const rule of RULES) {
    text = text.replace(rule.re, (m) => {
      if (rule.check && !rule.check(m)) return m;
      found[rule.type] = (found[rule.type] ?? 0) + 1;
      return `[${rule.type.toUpperCase()}_REDACTED]`;
    });
  }
  return { text, found };
}

// Common jailbreak phrasings. The LLM scope guard is the real defense; this catches the obvious ones cheaply.
const INJECTION = [
  /ignore (all|any|the|previous|prior|above).{0,20}(instructions|rules|prompt)/i,
  /(system|developer) prompt/i,
  /you are now|act as (?!.*(financial|tax|investment))/i,
  /jailbreak|DAN mode|do anything now/i,
  /ลืม(คำสั่ง|กฎ)|ไม่ต้องสนใจ(คำสั่ง|กฎ)|เพิกเฉยต่อคำสั่ง/,
  /(แสดง|บอก|เปิดเผย).{0,15}(system prompt|คำสั่งระบบ|ข้อมูลผู้ใช้คนอื่น)/i,
];

export function looksLikeInjection(text) {
  return INJECTION.some((re) => re.test(text));
}
