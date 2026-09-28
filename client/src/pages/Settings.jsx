import { useCallback, useEffect, useState } from 'react';
import { Download, KeyRound, LogOut, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { Field, Modal, useToast } from '../components/ui.jsx';

const ACTION_LABELS = {
  register: 'สมัครสมาชิก', login: 'เข้าสู่ระบบ', login_failed: 'เข้าสู่ระบบไม่สำเร็จ', account_locked: 'บัญชีถูกล็อกชั่วคราว',
  password_changed: 'เปลี่ยนรหัสผ่าน', api_key_created: 'สร้าง API key', api_key_revoked: 'ยกเลิก API key',
  data_exported: 'ดาวน์โหลดข้อมูล', logout_all: 'ออกจากระบบทุกอุปกรณ์', advisor_chat: 'ถาม AI',
};

export default function Settings({ onLogout }) {
  const toast = useToast();
  const [keys, setKeys] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [newKey, setNewKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });

  const load = useCallback(() => {
    api.get('/api/account/api-keys').then(setKeys);
    api.get('/api/account/audit').then(setAuditLog);
  }, []);
  useEffect(load, [load]);

  const revoke = async (id) => {
    if (!confirm('ยกเลิก API key นี้? แอปที่ใช้อยู่จะเรียกใช้งานไม่ได้ทันที')) return;
    await api.del(`/api/account/api-keys/${id}`);
    load();
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/auth/password', pw);
      toast('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่');
      onLogout();
    } catch (err) {
      toast(err.fields ? Object.values(err.fields).flat().join(' ') : err.message, 'error');
    }
  };

  const logoutAll = async () => {
    await api.post('/api/account/logout-all');
    onLogout();
  };

  return (
    <>
      <div className="page-head">
        <div><h1>ตั้งค่า & ความปลอดภัย</h1><p className="muted">จัดการการเข้าถึง API และสิทธิ์ในข้อมูลส่วนบุคคลของคุณ (PDPA)</p></div>
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <div className="card-head" style={{ marginBottom: 0 }}><h2><KeyRound size={18} /> API keys</h2><button className="btn sm primary" onClick={() => setCreating(true)}>สร้าง key</button></div>
          <p className="muted small" style={{ margin: 0 }}>ใช้เรียกคำนวณภาษีหรือถาม AI จากสคริปต์/แอปอื่น (เช่น n8n, Google Sheets, Python) ผ่าน <span className="kbd">/api/v1</span></p>
          {keys?.keys.length ? (
            <table className="table">
              <thead><tr><th>ชื่อ</th><th>สิทธิ์</th><th>ใช้ล่าสุด</th><th /></tr></thead>
              <tbody>
                {keys.keys.map((k) => (
                  <tr key={k.id}>
                    <td><b>{k.name}</b><div className="muted small"><span className="kbd">{k.prefix}…</span></div></td>
                    <td className="small">{k.scopes.map((s) => <span key={s} className="badge" style={{ margin: 2 }}>{s}</span>)}</td>
                    <td className="small muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('th-TH') : 'ยังไม่เคยใช้'}</td>
                    <td><button className="icon-btn" onClick={() => revoke(k.id)} title="ยกเลิก"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="muted small">ยังไม่มี API key</div>}
          <details>
            <summary className="small" style={{ cursor: 'pointer' }}>ตัวอย่างการเรียกใช้</summary>
            <div className="code" style={{ marginTop: 8 }}>{`curl -X POST ${location.origin}/api/v1/advisor/chat \\
  -H "Authorization: Bearer pfk_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"ลดหย่อนภาษีอะไรได้บ้าง"}],"stream":false,"shareContext":true}'

curl -X POST ${location.origin}/api/v1/tax/calculate \\
  -H "Authorization: Bearer pfk_xxx" -H "Content-Type: application/json" \\
  -d '{"year":2026,"income":{"salary":720000},"deductions":{"socialSecurity":9000}}'`}</div>
          </details>
        </div>

        <div className="card stack">
          <h2><ShieldAlert size={18} /> การปกป้องข้อมูลของคุณ</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>ข้อมูลรายได้/ค่าลดหย่อน/พอร์ต เข้ารหัส AES-256-GCM ด้วยกุญแจเฉพาะบัญชี</li>
            <li>อีเมลเก็บแบบแฮช ไม่มีข้อมูลระบุตัวตนแบบอ่านได้ในฐานข้อมูล</li>
            <li>AI ได้รับเฉพาะตัวเลขสรุป และระบบลบข้อมูลส่วนบุคคลออกก่อนส่ง</li>
            <li>ล็อกบัญชีอัตโนมัติเมื่อใส่รหัสผิด 5 ครั้ง · เซสชันหมดอายุเมื่อไม่ใช้งาน</li>
            <li>กด <span className="kbd">Alt</span>+<span className="kbd">P</span> เพื่อซ่อนตัวเลขเวลาอยู่ในที่สาธารณะ</li>
          </ul>
          <div className="row">
            <a className="btn" href="/api/account/export" download><Download size={16} /> ดาวน์โหลดข้อมูลทั้งหมด</a>
            <button className="btn" onClick={logoutAll}><LogOut size={16} /> ออกจากระบบทุกอุปกรณ์</button>
            <button className="btn danger" onClick={() => setDeleting(true)}><Trash2 size={16} /> ลบบัญชีถาวร</button>
          </div>
        </div>

        <form className="card stack" onSubmit={changePassword}>
          <h2>เปลี่ยนรหัสผ่าน</h2>
          <div className="form-grid">
            <Field label="รหัสผ่านปัจจุบัน"><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="รหัสผ่านใหม่"><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          </div>
          <div><button className="btn" disabled={!pw.current || !pw.next}>เปลี่ยนรหัสผ่าน</button></div>
        </form>

        <div className="card">
          <h2 style={{ marginBottom: 10 }}>ประวัติการใช้งานล่าสุด</h2>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="table small">
              <tbody>
                {auditLog.map((a, i) => (
                  <tr key={i}>
                    <td>{ACTION_LABELS[a.action] ?? a.action}{a.meta?.via === 'api_key' ? ' (API)' : ''}{a.meta?.allowed === false ? ' · ถูกบล็อก' : ''}</td>
                    <td className="muted r">{new Date(a.createdAt).toLocaleString('th-TH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {creating && keys && <CreateKeyModal scopes={keys.availableScopes} onClose={() => setCreating(false)} onCreated={(k) => { setCreating(false); setNewKey(k); load(); }} />}
      {newKey && (
        <Modal title="API key ใหม่" onClose={() => setNewKey(null)}>
          <div className="alert warn">คัดลอกเก็บไว้ตอนนี้ ระบบจะไม่แสดง key นี้อีก</div>
          <div className="code" style={{ margin: '12px 0', whiteSpace: 'normal', wordBreak: 'break-all' }}>{newKey.secret}</div>
          <button className="btn primary" onClick={() => navigator.clipboard.writeText(newKey.secret).then(() => toast('คัดลอกแล้ว'))}>คัดลอก</button>
        </Modal>
      )}
      {deleting && <DeleteModal onClose={() => setDeleting(false)} onDeleted={onLogout} />}
    </>
  );
}

function CreateKeyModal({ scopes, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(['tax:calculate']);
  const toggle = (s) => setSelected((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const submit = async (e) => {
    e.preventDefault();
    try {
      onCreated(await api.post('/api/account/api-keys', { name, scopes: selected }));
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Modal title="สร้าง API key" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="ชื่อ (เช่น n8n workflow)"><input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="field"><span>สิทธิ์ (ให้เท่าที่จำเป็น)</span>
          {Object.entries(scopes).map(([s, desc]) => (
            <label key={s} className="checkbox small"><input type="checkbox" checked={selected.includes(s)} onChange={() => toggle(s)} /><span className="kbd">{s}</span> {desc}</label>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!name || !selected.length}>สร้าง</button></div>
      </form>
    </Modal>
  );
}

function DeleteModal({ onClose, onDeleted }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/account/delete', { password, confirm: confirmText });
      onDeleted();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Modal title="ลบบัญชีถาวร" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="alert error">ข้อมูลทั้งหมดและกุญแจเข้ารหัสของคุณจะถูกทำลาย กู้คืนไม่ได้</div>
        <Field label="รหัสผ่าน"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label='พิมพ์ "DELETE" เพื่อยืนยัน'><input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></Field>
        <button className="btn danger" disabled={confirmText !== 'DELETE' || !password}>ลบบัญชีของฉัน</button>
      </form>
    </Modal>
  );
}
