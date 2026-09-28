import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { Field } from '../components/ui.jsx';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '', acceptPrivacy: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = mode === 'login'
        ? await api.post('/api/auth/login', { email: form.email, password: form.password })
        : await api.post('/api/auth/register', form);
      onAuthed(user);
    } catch (err) {
      setError(err.fields ? Object.values(err.fields).flat().join(' · ') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="logo" style={{ padding: 0 }}><div className="logo-mark" style={{ background: '#fff', color: '#0f9d76' }}>฿</div>เงินดี</div>
        <h1>จัดการรายได้ คำนวณภาษี<br />พร้อมที่ปรึกษา AI ส่วนตัว</h1>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>บันทึกรายได้รายเดือน ทุกประเภทตามมาตรา 40</li>
          <li>คำนวณภาษีอัตโนมัติ + จำลองการลดหย่อนแบบเรียลไทม์</li>
          <li>AI ตอบเฉพาะเรื่องการเงิน ภาษี และการลงทุน</li>
          <li>ข้อมูลเข้ารหัส AES-256 แยกกุญแจรายบุคคล ตาม PDPA</li>
        </ul>
      </section>
      <section className="auth-form">
        <form className="card stack" onSubmit={submit}>
          <div className="seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>เข้าสู่ระบบ</button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>สมัครสมาชิก</button>
          </div>
          {mode === 'register' && (
            <Field label="ชื่อที่ใช้แสดง (ไม่บังคับ)">
              <input className="input" value={form.displayName} onChange={set('displayName')} maxLength={60} autoComplete="nickname" />
            </Field>
          )}
          <Field label="อีเมล">
            <input className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="รหัสผ่าน" hint={mode === 'register' ? 'อย่างน้อย 10 ตัว มีทั้งตัวอักษรและตัวเลข' : undefined}>
            <input className="input" type="password" required value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          {mode === 'register' && (
            <label className="checkbox small">
              <input type="checkbox" checked={form.acceptPrivacy} onChange={set('acceptPrivacy')} />
              ยินยอมให้เก็บและประมวลผลข้อมูลการเงินของฉันแบบเข้ารหัส เพื่อคำนวณภาษีและให้คำแนะนำ (ขอลบหรือดาวน์โหลดข้อมูลได้ทุกเมื่อ)
            </label>
          )}
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี'}</button>
          <div className="muted small row"><ShieldCheck size={16} /> เซสชันหมดอายุอัตโนมัติเมื่อไม่ใช้งาน 30 นาที</div>
        </form>
      </section>
    </div>
  );
}
