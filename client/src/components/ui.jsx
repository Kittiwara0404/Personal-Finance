import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { THB } from '../format.js';

/** Money value that respects privacy mode (blurred until hover). */
export function Money({ value, digits = 0, unit = '฿', className = '' }) {
  return (
    <span className={`money-val num ${className}`}>
      {value < 0 ? '−' : ''}
      {unit === '฿' ? '฿' : ''}
      {THB(Math.abs(value), digits)}
      {unit && unit !== '฿' ? ` ${unit}` : ''}
    </span>
  );
}

export function Stat({ label, value, sub, icon, hero, money = true }) {
  return (
    <div className={`card stat ${hero ? 'hero' : ''}`}>
      <div className="label">{icon}{label}</div>
      <div className="value">{money ? <Money value={value} /> : value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Numeric input that shows thousands separators but stores a number. */
export function MoneyInput({ value, onChange, ...props }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? (value || value === 0 ? String(value) : '') : value ? THB(value) : '';
  return (
    <input
      className="input money"
      inputMode="decimal"
      placeholder="0"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/[^\d.]/g, ''));
        onChange(Number.isFinite(n) ? n : 0);
      }}
      {...props}
    />
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

// ---- toasts ----
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, kind = 'info') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export function Confetti({ run }) {
  const pieces = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 2.2 + Math.random() * 1.8,
      color: ['#0f9d76', '#f5a524', '#3b82f6', '#ec4899', '#a855f7'][i % 5],
    })),
    [run], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!run) return null;
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

/** Semi-circle gauge (0–100). */
export function Gauge({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  const angle = Math.PI * (1 - v / 100);
  const x = 75 + 62 * Math.cos(angle);
  const y = 78 - 62 * Math.sin(angle);
  const color = v >= 70 ? 'var(--brand)' : v >= 40 ? 'var(--accent)' : 'var(--danger)';
  return (
    <div>
      <div className="gauge">
        <svg viewBox="0 0 150 84">
          <path d="M13 78 A62 62 0 0 1 137 78" fill="none" stroke="var(--surface-2)" strokeWidth="12" strokeLinecap="round" />
          <path d={`M13 78 A62 62 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
        </svg>
        <div className="g-val" style={{ color }}>{Math.round(v)}</div>
      </div>
      {label && <div className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>{label}</div>}
    </div>
  );
}

export function YearPicker({ year, setYear, years }) {
  return (
    <div className="seg" role="tablist" aria-label="ปีภาษี">
      {years.map((y) => (
        <button key={y} className={y === year ? 'on' : ''} onClick={() => setYear(y)}>
          ปีภาษี {y + 543}
        </button>
      ))}
    </div>
  );
}
