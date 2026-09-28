import { useCallback, useEffect, useState } from 'react';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Field, Modal, Money, MoneyInput, YearPicker, useToast } from '../components/ui.jsx';
import { INCOME_TYPES, MONTHS, THB, toBE } from '../format.js';

const blank = (year, month) => ({ year, month, type: 'salary', amount: 0, withholding: 0, finalWithholding: false, payer: '', note: '' });

export default function Income({ year, setYear, years, refresh }) {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [month, setMonth] = useState(Math.min(new Date().getMonth() + 1, 12));
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => api.get(`/api/income/${year}`).then(setEntries), [year]);
  useEffect(() => {
    load();
  }, [load]);

  const after = async (msg) => {
    await load();
    refresh();
    if (msg) toast(msg);
  };

  const save = async (entry) => {
    const { id, ...body } = entry;
    try {
      if (id) await api.put(`/api/income/${id}`, body);
      else await api.post('/api/income', body);
      setEditing(null);
      after(id ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มรายได้แล้ว ✅');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('ลบรายการนี้?')) return;
    await api.del(`/api/income/${id}`);
    after('ลบแล้ว');
  };

  // ลูกเล่น: คัดลอกรายการไปเดือนที่เหลือที่ยังไม่มีรายการประเภทเดียวกัน
  const copyForward = async (e) => {
    const target = Array.from({ length: 12 }, (_, i) => i + 1).filter(
      (m) => m > e.month && !entries.some((x) => x.month === m && x.type === e.type && x.payer === e.payer),
    );
    if (!target.length) return toast('ทุกเดือนถัดไปมีรายการนี้แล้ว');
    const { id, ...rest } = e; // eslint-disable-line no-unused-vars
    await api.post('/api/income/bulk', { entries: target.map((m) => ({ ...rest, month: m })) });
    after(`คัดลอกไป ${target.length} เดือน (${MONTHS[target[0] - 1]} – ${MONTHS[target.at(-1) - 1]}) ✨`);
  };

  const byMonth = Array.from({ length: 12 }, (_, i) => entries.filter((e) => e.month === i + 1));
  const maxMonth = Math.max(1, ...byMonth.map((l) => l.reduce((s, e) => s + e.amount, 0)));
  const now = new Date();
  const selected = byMonth[month - 1];
  const yearTotal = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>รายได้รายเดือน</h1>
          <p className="muted">ปี {toBE(year)} · รวม <Money value={yearTotal} /> · ข้อมูลทุกรายการถูกเข้ารหัสก่อนบันทึก</p>
        </div>
        <div className="row">
          <YearPicker year={year} setYear={setYear} years={years} />
          <button className="btn primary" onClick={() => setEditing(blank(year, month))}><Plus size={16} /> เพิ่มรายได้</button>
        </div>
      </div>

      <div className="months">
        {byMonth.map((list, i) => {
          const total = list.reduce((s, e) => s + e.amount, 0);
          const future = year > now.getFullYear() || (year === now.getFullYear() && i > now.getMonth());
          return (
            <button key={i} className={`month ${month === i + 1 ? 'selected' : ''} ${future ? 'future' : ''}`} onClick={() => setMonth(i + 1)}>
              <div className="m-name"><span>{MONTHS[i]}</span><span className="muted small">{list.length ? `${list.length} รายการ` : ''}</span></div>
              <div className="m-amt">{total ? <Money value={total} /> : <span className="muted">—</span>}</div>
              <div className="m-bar">
                {Object.entries(INCOME_TYPES).map(([t, cfg]) => {
                  const v = list.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);
                  return v ? <span key={t} style={{ width: `${(v / maxMonth) * 100}%`, background: cfg.color }} /> : null;
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <h2>{MONTHS[month - 1]} {toBE(year)}</h2>
          <button className="btn sm" onClick={() => setEditing(blank(year, month))}><Plus size={14} /> เพิ่มในเดือนนี้</button>
        </div>
        {selected.length === 0 ? (
          <div className="empty"><div className="big">🗓️</div>ยังไม่มีรายได้ในเดือนนี้</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>ประเภท</th><th>ผู้จ่าย/หมายเหตุ</th><th className="r">จำนวนเงิน</th><th className="r">หัก ณ ที่จ่าย</th><th /></tr></thead>
              <tbody>
                {selected.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="badge" style={{ background: `${INCOME_TYPES[e.type].color}22`, color: INCOME_TYPES[e.type].color }}>{INCOME_TYPES[e.type].code}</span>{' '}
                      {INCOME_TYPES[e.type].label}
                      {e.finalWithholding && <span className="badge" style={{ marginLeft: 6 }}>ภาษีสุดท้าย</span>}
                    </td>
                    <td className="muted">{[e.payer, e.note].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="r"><Money value={e.amount} digits={2} /></td>
                    <td className="r"><Money value={e.withholding} digits={2} /></td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      <button className="icon-btn" title="คัดลอกไปเดือนถัด ๆ ไป" onClick={() => copyForward(e)}><Copy size={16} /></button>
                      <button className="icon-btn" title="แก้ไข" onClick={() => setEditing(e)}><Pencil size={16} /></button>
                      <button className="icon-btn" title="ลบ" onClick={() => remove(e.id)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function EntryModal({ entry, onClose, onSave }) {
  const [e, setE] = useState(entry);
  const set = (k, v) => setE((x) => ({ ...x, [k]: v }));
  const suggestedWht = e.type === 'freelance' || e.type === 'professional' ? e.amount * 0.03 : e.type === 'rent' ? e.amount * 0.05 : e.type === 'investment' ? e.amount * 0.1 : null;

  return (
    <Modal title={entry.id ? 'แก้ไขรายได้' : 'เพิ่มรายได้'} onClose={onClose}>
      <form className="stack" onSubmit={(ev) => { ev.preventDefault(); onSave(e); }}>
        <div className="form-grid">
          <Field label="เดือน">
            <select className="input" value={e.month} onChange={(ev) => set('month', Number(ev.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field label="ประเภทเงินได้">
            <select className="input" value={e.type} onChange={(ev) => set('type', ev.target.value)}>
              {Object.entries(INCOME_TYPES).map(([k, v]) => <option key={k} value={k}>{v.code} {v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="จำนวนเงิน (บาท)"><MoneyInput value={e.amount} onChange={(v) => set('amount', v)} autoFocus /></Field>
        <Field
          label="ภาษีหัก ณ ที่จ่าย (บาท)"
          hint={suggestedWht ? <>อัตราทั่วไป ≈ ฿{THB(suggestedWht)} <button type="button" className="btn sm ghost" onClick={() => set('withholding', Math.round(suggestedWht * 100) / 100)}>ใช้ค่านี้</button></> : 'ดูจากสลิปเงินเดือน / หนังสือรับรอง 50 ทวิ'}
        >
          <MoneyInput value={e.withholding} onChange={(v) => set('withholding', v)} />
        </Field>
        {e.type === 'investment' && (
          <label className="checkbox small">
            <input type="checkbox" checked={e.finalWithholding} onChange={(ev) => set('finalWithholding', ev.target.checked)} />
            เลือกให้ภาษีหัก ณ ที่จ่ายเป็นภาษีสุดท้าย (ไม่นำมารวมคำนวณ)
          </label>
        )}
        <div className="form-grid">
          <Field label="ผู้จ่ายเงิน (ไม่บังคับ)"><input className="input" value={e.payer} maxLength={100} onChange={(ev) => set('payer', ev.target.value)} /></Field>
          <Field label="หมายเหตุ"><input className="input" value={e.note} maxLength={300} onChange={(ev) => set('note', ev.target.value)} /></Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={!e.amount}>บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
