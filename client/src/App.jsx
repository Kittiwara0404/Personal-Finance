import { useCallback, useEffect, useState } from 'react';
import { Bot, Briefcase, Calculator, Eye, EyeOff, LayoutDashboard, LogOut, Moon, Settings as SettingsIcon, Sun, Wallet } from 'lucide-react';
import { api } from './api.js';
import { ToastProvider } from './components/ui.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Income from './pages/Income.jsx';
import Tax from './pages/Tax.jsx';
import Advisor from './pages/Advisor.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, Comp: Dashboard },
  { id: 'income', label: 'รายได้รายเดือน', icon: Wallet, Comp: Income },
  { id: 'tax', label: 'ภาษี & ลดหย่อน', icon: Calculator, Comp: Tax },
  { id: 'advisor', label: 'AI ที่ปรึกษา', icon: Bot, Comp: Advisor },
  { id: 'portfolio', label: 'พอร์ตลงทุน', icon: Briefcase, Comp: Portfolio, badge: 'Beta' },
  { id: 'settings', label: 'ตั้งค่า & ความปลอดภัย', icon: SettingsIcon, Comp: Settings },
];

const LOCK_AFTER_MS = 5 * 60 * 1000;

const stored = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const store = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

export default function App() {
  const [user, setUser] = useState(undefined);
  const [page, setPage] = useState(() => location.hash.slice(1) || 'dashboard');
  const [year, setYear] = useState(new Date().getFullYear());
  const [theme, setTheme] = useState(() => stored('pf-theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [privacy, setPrivacy] = useState(() => stored('pf-privacy', '0') === '1');
  const [locked, setLocked] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/api/auth/me').then(setUser).catch(() => setUser(null));
    const onUnauth = () => setUser(null);
    window.addEventListener('pf:unauthorized', onUnauth);
    return () => window.removeEventListener('pf:unauthorized', onUnauth);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store('pf-theme', theme);
  }, [theme]);
  useEffect(() => store('pf-privacy', privacy ? '1' : '0'), [privacy]);
  useEffect(() => {
    location.hash = page;
  }, [page]);

  const refresh = useCallback(() => {
    if (!user) return;
    api.get(`/api/summary/${year}`).then(setSummary).catch(() => {});
  }, [user, year]);
  useEffect(refresh, [refresh]);

  // Privacy shield: blur the whole app after inactivity; also when the tab is hidden.
  useEffect(() => {
    if (!user) return;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setLocked(true), LOCK_AFTER_MS);
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user]);

  // Keyboard shortcuts: Alt+1..6 switch pages, Alt+P privacy mode
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      const idx = Number(e.key) - 1;
      if (PAGES[idx]) {
        e.preventDefault();
        setPage(PAGES[idx].id);
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPrivacy((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    setSummary(null);
  };

  if (user === undefined) return null;
  if (!user) {
    return (
      <ToastProvider>
        <Auth onAuthed={setUser} />
      </ToastProvider>
    );
  }

  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const years = [year - 1, year, year + 1].filter((y) => y >= 2025 && y <= new Date().getFullYear() + 1);
  const props = { user, year, setYear, years, summary, refresh, go: setPage, onLogout: logout };

  return (
    <ToastProvider>
      <div className={`shell ${privacy ? 'privacy' : ''}`}>
        <aside className="sidebar">
          <div className="logo"><div className="logo-mark">฿</div>เงินดี</div>
          {PAGES.map((p, i) => (
            <button key={p.id} className={`nav-item ${p.id === current.id ? 'active' : ''}`} onClick={() => setPage(p.id)} title={`Alt+${i + 1}`}>
              <p.icon size={18} /> {p.label}
              {p.badge && <span className="badge amber">{p.badge}</span>}
            </button>
          ))}
          <div className="sidebar-foot">
            <button className="nav-item" onClick={() => setPrivacy((p) => !p)} title="Alt+P">
              {privacy ? <EyeOff size={18} /> : <Eye size={18} />} {privacy ? 'ซ่อนตัวเลขอยู่' : 'โหมดซ่อนตัวเลข'}
            </button>
            <button className="nav-item" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            </button>
            <button className="nav-item" onClick={logout}><LogOut size={18} /> ออกจากระบบ</button>
            <div className="muted small" style={{ padding: '8px 12px' }}>สวัสดี {user.displayName || user.email.replace(/(.{2}).*(@.*)/, '$1***$2')}</div>
          </div>
        </aside>
        <main className="main">
          <current.Comp {...props} />
        </main>
        <nav className="mobile-nav">
          {PAGES.map((p) => (
            <button key={p.id} className={p.id === current.id ? 'active' : ''} onClick={() => setPage(p.id)}>
              <p.icon size={20} />
              {p.label.split(' ')[0]}
            </button>
          ))}
        </nav>
      </div>
      {locked && (
        <div className="lock" onClick={() => setLocked(false)} role="button" aria-label="ปลดล็อกหน้าจอ">
          <div>
            <div className="big">🔒</div>
            <h2>ซ่อนข้อมูลเพื่อความเป็นส่วนตัว</h2>
            <p>ไม่มีการใช้งาน 5 นาที · แตะเพื่อกลับมา</p>
          </div>
        </div>
      )}
    </ToastProvider>
  );
}
