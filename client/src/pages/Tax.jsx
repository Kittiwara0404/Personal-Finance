import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Wand2 } from 'lucide-react';
import { api } from '../api.js';
import { Field, Money, MoneyInput, YearPicker, useToast } from '../components/ui.jsx';
import { THB, pct, toBE } from '../format.js';

const DEFAULTS = {
  spouse: false, children: 0, childrenBornFrom2018: 0, parents: 0, disabledDependents: 0,
  socialSecurity: 0, lifeInsurance: 0, healthInsurance: 0, parentsHealthInsurance: 0, pensionInsurance: 0,
  pvd: 0, rmf: 0, ssf: 0, nsf: 0, thaiEsg: 0, homeLoanInterest: 0, stimulus: 0, donation: 0, donationDouble: 0, politicalDonation: 0,
};

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Tax({ year, setYear, years, summary, refresh }) {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [d, setD] = useState(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState(null);
  const [whatIf, setWhatIf] = useState({ raise: 0, thaiEsg: 0, rmf: 0, pensionInsurance: 0 });
  const [whatIfResult, setWhatIfResult] = useState(null);
  const loadedYear = useRef(null);

  useEffect(() => {
    api.get(`/api/tax/rules/${year}`).then(setRules);
    api.get(`/api/deductions/${year}`).then((saved) => {
      setD({ ...DEFAULTS, ...saved });
      setDirty(false);
      loadedYear.current = year;
    });
  }, [year]);

  const income = summary?.projected.income.byType ?? {};
  const withholding = summary?.projected.withholding ?? 0;
  const debouncedD = useDebounced(d, 250);
  const debouncedWhatIf = useDebounced(whatIf, 250);

  useEffect(() => {
    if (!summary) return;
    api.post('/api/tax/calculate', { year, income, withholding, deductions: debouncedD }).then((r) => setResult(r.result));
  }, [debouncedD, summary]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!summary) return;
    const raised = Object.fromEntries(Object.entries(income).map(([k, v]) => [k, k === 'salary' ? v * (1 + debouncedWhatIf.raise / 100) : v]));
    const deductions = { ...debouncedD };
    for (const k of ['thaiEsg', 'rmf', 'pensionInsurance']) deductions[k] = (Number(deductions[k]) || 0) + debouncedWhatIf[k];
    api.post('/api/tax/calculate', { year, income: raised, withholding, deductions }).then((r) => setWhatIfResult(r.result));
  }, [debouncedWhatIf, debouncedD, summary]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (v) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  const save = async () => {
    try {
      await api.put(`/api/deductions/${year}`, d);
      setDirty(false);
      refresh();
      toast('บันทึกข้อมูลลดหย่อนแล้ว');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const autoFillSso = () => {
    const salaryMonths = summary?.monthly.filter((m) => m.byType.salary).length ?? 0;
    const cap = rules?.allowances.socialSecurityCap ?? 9000;
    set('socialSecurity')(Math.min(cap, Math.max(salaryMonths, 12) * (cap / 12)));
  };

  const gross = summary?.projected.income.gross ?? 0;
  const a = rules?.allowances;
  const sliders = useMemo(() => a && [
    { key: 'thaiEsg', label: 'ซื้อ Thai ESG เพิ่ม', max: Math.max(0, Math.min(gross * a.thaiEsgRate, a.thaiEsgCap) - d.thaiEsg) },
    { key: 'rmf', label: 'ซื้อ RMF เพิ่ม', max: Math.max(0, Math.min(gross * a.rmfRate, a.rmfCap) - d.rmf) },
    { key: 'pensionInsurance', label: 'ประกันบำนาญเพิ่ม', max: Math.max(0, Math.min(gross * a.pensionInsuranceRate, a.pensionInsuranceCap) - d.pensionInsurance) },
  ], [a, gross, d]);

  if (!summary || !rules) return <div className="muted">กำลังโหลด…</div>;
  const diff = result && whatIfResult ? whatIfResult.taxDue - result.taxDue : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ภาษี & ลดหย่อน</h1>
          <p className="muted">คำนวณจากรายได้ประมาณการทั้งปี {toBE(year)} · <Money value={gross} /> {rules.assumedFrom && <span className="badge amber">ใช้อัตราของปี {toBE(rules.assumedFrom)}</span>}</p>
        </div>
        <div className="row">
          <YearPicker year={year} setYear={setYear} years={years} />
          <button className="btn primary" onClick={save} disabled={!dirty}><Save size={16} /> {dirty ? 'บันทึก' : 'บันทึกแล้ว'}</button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <Section title="👨‍👩‍👧 ครอบครัว">
            <label className="checkbox"><input type="checkbox" checked={d.spouse} onChange={(e) => set('spouse')(e.target.checked)} /> คู่สมรสไม่มีเงินได้ (฿{THB(a.spouse)})</label>
            <div className="form-grid">
              <Counter label="จำนวนบุตร" value={d.children} onChange={set('children')} />
              <Counter label="บุตรที่เกิดตั้งแต่ปี 2561" value={d.childrenBornFrom2018} onChange={set('childrenBornFrom2018')} max={d.children} />
              <Counter label="บิดามารดาที่อุปการะ (อายุ 60+)" value={d.parents} onChange={set('parents')} max={4} />
              <Counter label="ผู้พิการที่อุปการะ" value={d.disabledDependents} onChange={set('disabledDependents')} />
            </div>
          </Section>
          <Section title="🛡️ ประกันสังคม & ประกัน">
            <div className="form-grid">
              <Field label="ประกันสังคม" hint={<>สูงสุด ฿{THB(a.socialSecurityCap)} <button type="button" className="btn sm ghost" onClick={autoFillSso}><Wand2 size={12} /> เติมอัตโนมัติ</button></>}>
                <MoneyInput value={d.socialSecurity} onChange={set('socialSecurity')} />
              </Field>
              <Field label="ประกันชีวิต" hint={`สูงสุด ฿${THB(a.lifeInsuranceCap)}`}><MoneyInput value={d.lifeInsurance} onChange={set('lifeInsurance')} /></Field>
              <Field label="ประกันสุขภาพตนเอง" hint={`สูงสุด ฿${THB(a.healthInsuranceCap)} (รวมประกันชีวิต ≤ ฿${THB(a.lifeAndHealthCombinedCap)})`}><MoneyInput value={d.healthInsurance} onChange={set('healthInsurance')} /></Field>
              <Field label="ประกันสุขภาพบิดามารดา" hint={`สูงสุด ฿${THB(a.parentsHealthInsuranceCap)}`}><MoneyInput value={d.parentsHealthInsurance} onChange={set('parentsHealthInsurance')} /></Field>
            </div>
          </Section>
          <Section title="📈 การออม & ลงทุน">
            <div className="form-grid">
              <Field label="Thai ESG" hint={`30% ของรายได้ ≤ ฿${THB(a.thaiEsgCap)}`}><MoneyInput value={d.thaiEsg} onChange={set('thaiEsg')} /></Field>
              <Field label="RMF" hint={`30% ของรายได้ ≤ ฿${THB(a.rmfCap)}`}><MoneyInput value={d.rmf} onChange={set('rmf')} /></Field>
              <Field label="กองทุนสำรองเลี้ยงชีพ (PVD)" hint="15% ของค่าจ้าง"><MoneyInput value={d.pvd} onChange={set('pvd')} /></Field>
              <Field label="ประกันบำนาญ" hint={`15% ของรายได้ ≤ ฿${THB(a.pensionInsuranceCap)}`}><MoneyInput value={d.pensionInsurance} onChange={set('pensionInsurance')} /></Field>
              <Field label="กอช." hint={`สูงสุด ฿${THB(a.nsfCap)}`}><MoneyInput value={d.nsf} onChange={set('nsf')} /></Field>
            </div>
            <small className="muted">กลุ่มเกษียณ (PVD + RMF + ประกันบำนาญ + กอช.) รวมกันไม่เกิน ฿{THB(a.retirementCombinedCap)}</small>
          </Section>
          <Section title="🏠 อื่น ๆ">
            <div className="form-grid">
              <Field label="ดอกเบี้ยบ้าน" hint={`สูงสุด ฿${THB(a.homeLoanInterestCap)}`}><MoneyInput value={d.homeLoanInterest} onChange={set('homeLoanInterest')} /></Field>
              {a.stimulusCap > 0 && <Field label={a.stimulusLabel} hint={`สูงสุด ฿${THB(a.stimulusCap)}`}><MoneyInput value={d.stimulus} onChange={set('stimulus')} /></Field>}
              <Field label="เงินบริจาคทั่วไป" hint="≤ 10% ของเงินได้หลังหักลดหย่อน"><MoneyInput value={d.donation} onChange={set('donation')} /></Field>
              <Field label="บริจาคการศึกษา/รพ.รัฐ" hint="หักได้ 2 เท่า"><MoneyInput value={d.donationDouble} onChange={set('donationDouble')} /></Field>
              <Field label="บริจาคพรรคการเมือง" hint={`สูงสุด ฿${THB(a.politicalDonationCap)}`}><MoneyInput value={d.politicalDonation} onChange={set('politicalDonation')} /></Field>
            </div>
          </Section>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 16 }}>
          {result && <ResultCard r={result} />}
          <div className="card">
            <div className="card-head"><h2>🔮 จำลอง What-if</h2><button className="btn sm ghost" onClick={() => setWhatIf({ raise: 0, thaiEsg: 0, rmf: 0, pensionInsurance: 0 })}>รีเซ็ต</button></div>
            <div className="stack">
              <div className="slider-row">
                <span className="small">เงินเดือนขึ้น</span>
                <input type="range" min={0} max={50} step={1} value={whatIf.raise} onChange={(e) => setWhatIf({ ...whatIf, raise: Number(e.target.value) })} />
                <b className="num" style={{ textAlign: 'right' }}>+{whatIf.raise}%</b>
              </div>
              {sliders.map((s) => (
                <div className="slider-row" key={s.key}>
                  <span className="small">{s.label}</span>
                  <input type="range" min={0} max={Math.round(s.max)} step={1000} value={Math.min(whatIf[s.key], s.max)} disabled={s.max < 1000}
                    onChange={(e) => setWhatIf({ ...whatIf, [s.key]: Number(e.target.value) })} />
                  <b className="num money-val" style={{ textAlign: 'right' }}>฿{THB(whatIf[s.key])}</b>
                </div>
              ))}
            </div>
            {whatIfResult && (
              <div className={`alert ${diff > 0 ? 'warn' : 'ok'}`} style={{ marginTop: 14 }}>
                <div>
                  ภาษีใหม่ <b><Money value={whatIfResult.taxDue} /></b>{' '}
                  {diff === 0 ? '(เท่าเดิม)' : diff < 0 ? <>ประหยัดได้ <b><Money value={-diff} /></b> 🎉</> : <>เพิ่มขึ้น <b><Money value={diff} /></b></>}
                  <div className="small">อัตราภาษีจริง {pct(whatIfResult.effectiveRate)} · ขั้นสูงสุด {whatIfResult.marginalRate * 100}%</div>
                </div>
              </div>
            )}
          </div>
          <p className="muted small">⚠️ ผลคำนวณเป็นการประมาณการตามกฎหมายที่ระบบรู้จัก กรุณาตรวจสอบกับกรมสรรพากรก่อนยื่นแบบ ภ.ง.ด.90/91</p>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <div className="card stack">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Counter({ label, value, onChange, max = 20 }) {
  return (
    <Field label={label}>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="btn sm" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <b className="num" style={{ minWidth: 24, textAlign: 'center' }}>{value}</b>
        <button type="button" className="btn sm" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </Field>
  );
}

function ResultCard({ r }) {
  const rows = [
    ['เงินได้พึงประเมิน', r.income.gross],
    ['หัก ค่าใช้จ่าย', -r.expenses.total],
    ['หัก ค่าลดหย่อน', -r.allowances.total],
    ['หัก เงินบริจาค', -r.donations.total],
  ];
  return (
    <div className="card">
      <div className="card-head"><h2>ผลคำนวณภาษี</h2><span className="badge green">ขั้น {r.marginalRate * 100}%</span></div>
      <table className="table">
        <tbody>
          {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="r"><Money value={v} /></td></tr>)}
          <tr><td><b>เงินได้สุทธิ</b></td><td className="r"><b><Money value={r.netIncome} /></b></td></tr>
          <tr><td><b>ภาษีที่ต้องเสีย</b>{r.method === 'minimum' && <span className="badge amber" style={{ marginLeft: 6 }}>วิธี 0.5%</span>}</td><td className="r"><b><Money value={r.taxDue} /></b></td></tr>
          <tr><td>หัก ณ ที่จ่ายแล้ว</td><td className="r"><Money value={-r.withholding} /></td></tr>
          <tr>
            <td><b>{r.balance > 0 ? 'ต้องชำระเพิ่ม' : 'ได้รับคืน'}</b></td>
            <td className="r" style={{ color: r.balance > 0 ? 'var(--danger)' : 'var(--brand)', fontWeight: 700, fontSize: '1.1rem' }}><Money value={Math.abs(r.balance)} /></td>
          </tr>
        </tbody>
      </table>
      <details style={{ marginTop: 10 }}>
        <summary className="small muted" style={{ cursor: 'pointer' }}>ดูรายละเอียดค่าลดหย่อน ({r.allowances.lines.length} รายการ)</summary>
        <table className="table small" style={{ marginTop: 8 }}>
          <thead><tr><th>รายการ</th><th className="r">กรอก</th><th className="r">ใช้สิทธิได้</th></tr></thead>
          <tbody>
            {r.allowances.lines.map((l) => (
              <tr key={l.key}><td>{l.label}</td><td className="r"><Money value={l.claimed} /></td><td className="r" style={{ color: l.allowed < l.claimed ? 'var(--danger)' : undefined }}><Money value={l.allowed} /></td></tr>
            ))}
          </tbody>
        </table>
        {r.allowances.retirementCapHit && <div className="alert warn small">กลุ่มเกษียณเกินเพดาน 500,000 ระบบปรับลดตามสัดส่วนแล้ว</div>}
      </details>
    </div>
  );
}
