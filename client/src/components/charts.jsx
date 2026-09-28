import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { INCOME_TYPES, MONTHS, THB } from '../format.js';

const compact = (n) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export function MonthlyIncomeChart({ monthly }) {
  const types = Object.keys(INCOME_TYPES).filter((t) => monthly.some((m) => m.byType[t]));
  const data = monthly.map((m) => ({ name: MONTHS[m.month - 1], ...m.byType, withholding: m.withholding }));
  if (!types.length) return <div className="empty"><div className="big">📊</div>ยังไม่มีข้อมูลรายได้ในปีนี้</div>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={compact} tick={{ fontSize: 12, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v, k) => [`฿${THB(v)}`, INCOME_TYPES[k]?.label ?? k]}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
          cursor={{ fill: 'var(--surface-2)' }}
        />
        <Legend formatter={(k) => INCOME_TYPES[k]?.label ?? k} wrapperStyle={{ fontSize: 12 }} />
        {types.map((t, i) => (
          <Bar key={t} dataKey={t} stackId="a" fill={INCOME_TYPES[t].color} radius={i === types.length - 1 ? [6, 6, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AllocationPie({ data, colors }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={60} outerRadius={95} paddingAngle={2} stroke="none">
          {data.map((d, i) => <Cell key={d.label} fill={colors[i % colors.length]} />)}
        </Pie>
        <Tooltip formatter={(v, k) => [`฿${THB(v)}`, k]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Shows how much of each tax bracket the user's net income fills. */
export function BracketLadder({ breakdown, marginalRate, netIncome }) {
  const all = [
    [0, 150_000, 0], [150_000, 300_000, 0.05], [300_000, 500_000, 0.1], [500_000, 750_000, 0.15],
    [750_000, 1_000_000, 0.2], [1_000_000, 2_000_000, 0.25], [2_000_000, 5_000_000, 0.3], [5_000_000, null, 0.35],
  ];
  const shown = all.filter(([from], i) => i < 5 || netIncome > from);
  return (
    <div className="ladder">
      {shown.map(([from, to, rate]) => {
        const b = breakdown.find((x) => x.from === from);
        const width = to ? Math.min(100, ((b?.taxable ?? 0) / (to - from)) * 100) : b?.taxable ? 100 : 0;
        const isCurrent = rate === marginalRate && netIncome > from;
        return (
          <div key={from} className={`rung ${isCurrent ? 'current' : ''}`}>
            <div className="rate">{rate * 100}%{isCurrent ? ' 👈' : ''}</div>
            <div className="track">
              <div className="fill" style={{ width: `${width}%` }} />
              <div className="range">{THB(from)} – {to ? THB(to) : 'ขึ้นไป'}</div>
            </div>
            <div className="r num small" style={{ textAlign: 'right' }}>
              <span className="money-val">฿{THB(b?.tax ?? 0)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
