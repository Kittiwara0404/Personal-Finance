import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, PiggyBank, Receipt, Sparkles, TrendingUp } from 'lucide-react';
import { BracketLadder, MonthlyIncomeChart } from '../components/charts.jsx';
import { Confetti, Gauge, Money, Stat, YearPicker } from '../components/ui.jsx';
import { THB, pct, toBE } from '../format.js';

function healthScore(s) {
  const p = s.projected;
  const potential = s.suggestions.reduce((sum, x) => sum + x.taxSaved, 0);
  const deductionUse = p.taxDue + potential > 0 ? 1 - potential / (p.taxDue + potential) : 1;
  const withholdingCover = p.taxDue > 0 ? Math.min(1, p.withholding / p.taxDue) : 1;
  const monthsWithData = s.monthly.filter((m) => m.income > 0).length;
  const completeness = s.monthsElapsed ? Math.min(1, monthsWithData / s.monthsElapsed) : 1;
  return {
    total: Math.round(deductionUse * 40 + withholdingCover * 30 + completeness * 30),
    parts: [
      { label: 'ใช้สิทธิลดหย่อนคุ้มค่า', value: deductionUse, weight: 40 },
      { label: 'ภาษีหัก ณ ที่จ่ายครอบคลุม', value: withholdingCover, weight: 30 },
      { label: 'บันทึกรายได้ครบทุกเดือน', value: completeness, weight: 30 },
    ],
  };
}

function daysToDeadline(year) {
  const deadline = new Date(year + 1, 3, 8); // ยื่นออนไลน์ 8 เม.ย. ของปีถัดไป
  return Math.ceil((deadline - new Date()) / 86_400_000);
}

export default function Dashboard({ summary, year, setYear, years, go, user }) {
  const [celebrate, setCelebrate] = useState(false);
  const refund = summary ? -summary.projected.balance : 0;

  useEffect(() => {
    if (refund > 0) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 4000);
      return () => clearTimeout(t);
    }
  }, [refund > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const health = useMemo(() => (summary ? healthScore(summary) : null), [summary]);
  if (!summary) return <div className="muted">กำลังโหลด…</div>;

  const { actual, projected, suggestions } = summary;
  const days = daysToDeadline(year);
  const greeting = new Date().getHours() < 12 ? 'อรุณสวัสดิ์' : new Date().getHours() < 18 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <>
      <Confetti run={celebrate} />
      <div className="page-head">
        <div>
          <h1>{greeting}{user.displayName ? ` คุณ${user.displayName}` : ''} 👋</h1>
          <p className="muted">ภาพรวมภาษีปี {toBE(year)} · ข้อมูล {summary.monthsElapsed} เดือน ({summary.entryCount} รายการ)</p>
        </div>
        <YearPicker year={year} setYear={setYear} years={years} />
      </div>

      {summary.entryCount === 0 && (
        <div className="card row between" style={{ marginBottom: 16 }}>
          <div>
            <h2>เริ่มต้นใน 30 วินาที 🚀</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>กรอกเงินเดือนเดือนเดียว แล้วกด "คัดลอกไปทุกเดือน" ระบบจะคำนวณภาษีทั้งปีให้ทันที</p>
          </div>
          <button className="btn primary" onClick={() => go('income')}>บันทึกรายได้ <ArrowRight size={16} /></button>
        </div>
      )}

      <div className="grid grid-4">
        <Stat hero label="รายได้ทั้งปี (ประมาณการ)" icon={<TrendingUp size={15} />} value={projected.income.gross} sub={<>ได้รับแล้ว <Money value={actual.income.gross} /></>} />
        <Stat label="ภาษีที่ต้องเสียทั้งปี" icon={<Receipt size={15} />} value={projected.taxDue} sub={`อัตราจริง ${pct(projected.effectiveRate)} · ขั้นสูงสุด ${projected.marginalRate * 100}%`} />
        <Stat label="หัก ณ ที่จ่ายแล้ว" icon={<PiggyBank size={15} />} value={actual.withholding} sub={`ประมาณการทั้งปี ฿${THB(projected.withholding)}`} />
        <div className={`card stat`}>
          <div className="label"><CalendarClock size={15} />{projected.balance > 0 ? 'ต้องชำระเพิ่ม' : 'คาดว่าได้คืน'}</div>
          <div className="value" style={{ color: projected.balance > 0 ? 'var(--danger)' : 'var(--brand)' }}>
            <Money value={Math.abs(projected.balance)} /> {projected.balance <= 0 && refund > 0 ? '🎉' : ''}
          </div>
          <div className="sub">{days > 0 ? `เหลือ ${days} วันถึงกำหนดยื่นออนไลน์ (8 เม.ย. ${toBE(year + 1)})` : 'เลยกำหนดยื่นแล้ว'}</div>
        </div>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><h2>รายได้รายเดือน</h2><button className="btn sm ghost" onClick={() => go('income')}>จัดการ <ArrowRight size={14} /></button></div>
          <MonthlyIncomeChart monthly={summary.monthly} />
        </div>
        <div className="card">
          <div className="card-head"><h2>บันไดภาษีของคุณ</h2><span className="muted small">เงินได้สุทธิ <Money value={projected.netIncome} /></span></div>
          <BracketLadder breakdown={projected.progressive.breakdown} marginalRate={projected.marginalRate} netIncome={projected.netIncome} />
          {projected.nextBracket.toLowerBracket > 0 && (
            <div className="alert ok" style={{ marginTop: 12 }}>
              <Sparkles size={18} />
              <div>ลดเงินได้สุทธิอีก <b className="money-val">฿{THB(projected.nextBracket.toLowerBracket)}</b> จะหลุดไปอยู่ขั้น {(projected.marginalRate * 100) - 5}% และทุกบาทที่ลดหย่อนตอนนี้ช่วยประหยัดภาษี {projected.marginalRate * 100} สตางค์</div>
            </div>
          )}
          {projected.method === 'minimum' && (
            <div className="alert warn" style={{ marginTop: 12 }}>ภาษีวิธีที่ 2 (0.5% ของเงินได้พึงประเมินนอก 40(1)) สูงกว่า จึงต้องเสียตามวิธีนี้</div>
          )}
        </div>
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><h2>💡 โอกาสประหยัดภาษี</h2><button className="btn sm ghost" onClick={() => go('tax')}>จำลอง <ArrowRight size={14} /></button></div>
          {suggestions.length === 0 ? (
            <div className="empty"><div className="big">🏆</div>คุณใช้สิทธิลดหย่อนครบแล้ว หรือยังไม่มีภาษีที่ต้องเสีย</div>
          ) : (
            <table className="table">
              <thead><tr><th>รายการ</th><th className="r">ซื้อเพิ่มได้อีก</th><th className="r">ประหยัดภาษี</th></tr></thead>
              <tbody>
                {suggestions.slice(0, 5).map((s) => (
                  <tr key={s.key}>
                    <td><b>{s.label}</b><div className="muted small">{s.hint}</div></td>
                    <td className="r"><Money value={s.room} /></td>
                    <td className="r" style={{ color: 'var(--brand)', fontWeight: 600 }}><Money value={s.taxSaved} /><div className="muted small">คืน {s.returnPct}%</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>คะแนนสุขภาพภาษี</h2><button className="btn sm ghost" onClick={() => go('advisor')}>ถาม AI <ArrowRight size={14} /></button></div>
          <Gauge value={health.total} label="จาก 100 คะแนน" />
          <div className="stack" style={{ marginTop: 14 }}>
            {health.parts.map((p) => (
              <div key={p.label}>
                <div className="row between small"><span>{p.label}</span><span className="muted">{Math.round(p.value * p.weight)}/{p.weight}</span></div>
                <div className="progress"><span style={{ width: `${p.value * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
