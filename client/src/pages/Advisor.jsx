import { useEffect, useRef, useState } from 'react';
import { Bot, Send, ShieldCheck, Square, Trash2 } from 'lucide-react';
import { api, streamChat } from '../api.js';

const STARTERS = [
  'ปีนี้ควรซื้อ ThaiESG หรือ RMF เท่าไหร่ถึงคุ้มสุด?',
  'ช่วยวิเคราะห์ภาษีของฉันและบอกวิธีลดภาษีแบบเป็นขั้นตอน',
  'เงินเดือน 40,000 ควรแบ่งเงินออมและลงทุนยังไง',
  'ฟรีแลนซ์ต้องยื่นภาษีกี่ครั้ง และเตรียมเอกสารอะไรบ้าง',
  'อัตราเงินเฟ้อสูงขึ้นมีผลกับเงินออมของฉันอย่างไร',
];

const REDACTION_LABELS = { email: 'อีเมล', thai_id: 'เลขบัตรประชาชน', card: 'เลขบัตรเครดิต', phone: 'เบอร์โทร', bank_account: 'เลขบัญชี', passport: 'เลขพาสปอร์ต', tax_id_label: 'เลขประจำตัว' };

export default function Advisor({ year }) {
  const [messages, setMessages] = useState([]); // kept in memory only — never persisted
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareContext, setShareContext] = useState(true);
  const [status, setStatus] = useState(null);
  const abortRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    api.get('/api/advisor/status').then(setStatus).catch(() => {});
    return () => abortRef.current?.abort();
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '', pending: true }]);
    setInput('');
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patch = (fn) => setMessages((ms) => [...ms.slice(0, -1), fn(ms.at(-1))]);
    try {
      await streamChat(
        { messages: history.map(({ role, content }) => ({ role, content })), shareContext, year },
        (event, data) => {
          if (event === 'text') patch((m) => ({ ...m, content: m.content + data.text, pending: false }));
          if (event === 'blocked') patch((m) => ({ ...m, blocked: data.reason }));
          if (event === 'redacted') setMessages((ms) => ms.map((m, i) => (i === ms.length - 2 ? { ...m, redacted: data } : m)));
          if (event === 'error') patch((m) => ({ ...m, content: data.error, error: true, pending: false }));
          if (event === 'done') patch((m) => ({ ...m, model: data.model, pending: false }));
        },
        ctrl.signal,
      );
    } catch (err) {
      if (err.name !== 'AbortError') patch((m) => ({ ...m, content: err.message, error: true, pending: false }));
    } finally {
      patch((m) => ({ ...m, pending: false }));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI ที่ปรึกษาการเงิน <span className="badge green">น้องเงินดี</span></h1>
          <p className="muted">ตอบเฉพาะเรื่องการเงิน ภาษี การลงทุน และเศรษฐศาสตร์ · {status ? (status.enabled ? `ขับเคลื่อนโดย ${status.model}` : 'โหมดออฟไลน์ (ยังไม่ได้ตั้งค่า API key)') : ''}</p>
        </div>
        <div className="row">
          <label className="checkbox small" title="ส่งเฉพาะตัวเลขสรุป ไม่มีชื่อ อีเมล หรือข้อมูลระบุตัวตน">
            <input type="checkbox" checked={shareContext} onChange={(e) => setShareContext(e.target.checked)} />
            ให้ AI ใช้ตัวเลขสรุปภาษีของฉัน
          </label>
          <button className="btn sm" onClick={() => setMessages([])} disabled={busy || !messages.length}><Trash2 size={14} /> ล้างแชท</button>
        </div>
      </div>

      <div className="card chat">
        <div className="chat-log" ref={logRef}>
          {messages.length === 0 && (
            <div className="empty stack" style={{ alignItems: 'center' }}>
              <div className="big"><Bot size={44} /></div>
              <h2 style={{ color: 'var(--text)' }}>สวัสดีครับ มีเรื่องเงิน ๆ ทอง ๆ ให้ช่วยไหม?</h2>
              <div className="chips" style={{ justifyContent: 'center', maxWidth: 680 }}>
                {STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
              <div className="small row" style={{ justifyContent: 'center' }}>
                <ShieldCheck size={15} /> ระบบจะลบเลขบัตรประชาชน เลขบัญชี เบอร์โทร และอีเมลออกก่อนส่งถึง AI · ประวัติแชทไม่ถูกบันทึก
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.blocked ? 'blocked' : ''}`}>
              {m.pending ? <span className="typing"><span /><span /><span /></span> : m.content}
              {m.redacted && (
                <div className="meta" style={{ color: 'rgb(255 255 255 / 0.85)' }}>
                  🛡️ ซ่อน {Object.entries(m.redacted).map(([k, v]) => `${REDACTION_LABELS[k] ?? k} ${v}`).join(', ')} ก่อนส่ง
                </div>
              )}
              {m.blocked && <div className="meta">🚧 นอกขอบเขตหรือถูกบล็อกเพื่อความปลอดภัย</div>}
            </div>
          ))}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <textarea
            className="input"
            rows={1}
            maxLength={2000}
            placeholder="ถามเรื่องภาษี การออม การลงทุน… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          {busy ? (
            <button type="button" className="btn" onClick={() => abortRef.current?.abort()}><Square size={16} /> หยุด</button>
          ) : (
            <button className="btn primary" disabled={!input.trim()}><Send size={16} /> ส่ง</button>
          )}
        </form>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>คำแนะนำจาก AI เป็นข้อมูลทั่วไป ไม่ใช่คำแนะนำการลงทุนจากผู้ได้รับใบอนุญาต ควรตรวจสอบก่อนตัดสินใจ</p>
    </>
  );
}
