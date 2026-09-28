import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { AllocationPie } from '../components/charts.jsx';
import { Field, Modal, Money, MoneyInput, Stat, useToast } from '../components/ui.jsx';
import { pct } from '../format.js';

const COLORS = ['#0f9d76', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#94a3b8'];
const blank = { symbol: '', name: '', assetClass: 'mutual_fund', units: 0, costPerUnit: 0, pricePerUnit: 0, currency: 'THB', taxFund: '' };

export default function Portfolio({ go }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => api.get('/api/modules/portfolio/holdings').then(setData), []);
  useEffect(() => {
    load();
    api.get('/api/modules/portfolio/meta').then(setMeta);
  }, [load]);

  const save = async (h) => {
    const { id, createdAt, updatedAt, ...body } = h; // eslint-disable-line no-unused-vars
    try {
      if (id) await api.put(`/api/modules/portfolio/holdings/${id}`, body);
      else await api.post('/api/modules/portfolio/holdings', body);
      setEditing(null);
      load();
      toast('บันทึกแล้ว');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const remove = async (id) => {
    if (!confirm('ลบสินทรัพย์นี้?')) return;
    await api.del(`/api/modules/portfolio/holdings/${id}`);
    load();
  };

  if (!data || !meta) return <div className="muted">กำลังโหลด…</div>;
  const { holdings, summary } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>พอร์ตการลงทุน <span className="badge amber">Beta</span></h1>
          <p className="muted">โมดูลส่วนขยาย · ตอนนี้กรอกราคาเอง รองรับการเชื่อมราคาอัตโนมัติ (SET / โบรกเกอร์ / คริปโต) ในอนาคต</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(blank)}><Plus size={16} /> เพิ่มสินทรัพย์</button>
      </div>

      <div className="grid grid-4">
        <Stat hero label="มูลค่าพอร์ต" value={summary.value} />
        <Stat label="ต้นทุนรวม" value={summary.cost} />
        <Stat label="กำไร/ขาดทุน" value={summary.gain} sub={<span style={{ color: summary.gain >= 0 ? 'var(--brand)' : 'var(--danger)' }}>{summary.gain >= 0 ? '▲' : '▼'} {pct(summary.gainPct, 2)}</span>} />
        <Stat label="จำนวนสินทรัพย์" value={holdings.length} money={false} sub={`${summary.allocation.length} ประเภท`} />
      </div>

      <div className="split" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-head"><h2>รายการถือครอง</h2></div>
          {holdings.length === 0 ? (
            <div className="empty"><div className="big">🌱</div>เริ่มเพิ่มกองทุน หุ้น หรือทองคำ เพื่อดูสัดส่วนพอร์ต</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>สินทรัพย์</th><th className="r">มูลค่า</th><th className="r">กำไร</th><th /></tr></thead>
                <tbody>
                  {holdings.map((h) => {
                    const value = h.units * h.pricePerUnit;
                    const gain = value - h.units * h.costPerUnit;
                    return (
                      <tr key={h.id}>
                        <td><b>{h.symbol}</b> {h.taxFund && <span className="badge green">{h.taxFund === 'rmf' ? 'RMF' : 'ThaiESG'}</span>}<div className="muted small">{meta.assetClasses[h.assetClass]}{h.name ? ` · ${h.name}` : ''}</div></td>
                        <td className="r"><Money value={value} /></td>
                        <td className="r" style={{ color: gain >= 0 ? 'var(--brand)' : 'var(--danger)' }}><Money value={gain} /></td>
                        <td className="r" style={{ whiteSpace: 'nowrap' }}>
                          <button className="icon-btn" onClick={() => setEditing(h)}><Pencil size={16} /></button>
                          <button className="icon-btn" onClick={() => remove(h.id)}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>สัดส่วนสินทรัพย์</h2><button className="btn sm ghost" onClick={() => go('advisor')}>ให้ AI วิเคราะห์</button></div>
          {summary.allocation.length ? <AllocationPie data={summary.allocation} colors={COLORS} /> : <div className="empty">—</div>}
        </div>
      </div>

      {editing && <HoldingModal holding={editing} classes={meta.assetClasses} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function HoldingModal({ holding, classes, onClose, onSave }) {
  const [h, setH] = useState(holding);
  const set = (k, v) => setH((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={holding.id ? 'แก้ไขสินทรัพย์' : 'เพิ่มสินทรัพย์'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(h); }}>
        <div className="form-grid">
          <Field label="สัญลักษณ์/ชื่อย่อ"><input className="input" required maxLength={30} value={h.symbol} onChange={(e) => set('symbol', e.target.value.toUpperCase())} autoFocus /></Field>
          <Field label="ประเภท">
            <select className="input" value={h.assetClass} onChange={(e) => set('assetClass', e.target.value)}>
              {Object.entries(classes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="ชื่อเต็ม (ไม่บังคับ)"><input className="input" maxLength={100} value={h.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="form-grid">
          <Field label="จำนวนหน่วย"><MoneyInput value={h.units} onChange={(v) => set('units', v)} /></Field>
          <Field label="ต้นทุน/หน่วย"><MoneyInput value={h.costPerUnit} onChange={(v) => set('costPerUnit', v)} /></Field>
          <Field label="ราคาปัจจุบัน/หน่วย"><MoneyInput value={h.pricePerUnit} onChange={(v) => set('pricePerUnit', v)} /></Field>
        </div>
        {h.assetClass === 'tax_fund' && (
          <Field label="ประเภทกองทุนลดหย่อน">
            <select className="input" value={h.taxFund} onChange={(e) => set('taxFund', e.target.value)}>
              <option value="">-</option><option value="rmf">RMF</option><option value="thaiEsg">Thai ESG</option>
            </select>
          </Field>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary">บันทึก</button>
        </div>
      </form>
    </Modal>
  );
}
