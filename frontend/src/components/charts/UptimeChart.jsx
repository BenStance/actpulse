import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useThemeContext } from '../../context/ThemeContext';

export default function UptimeChart({ data = [] }) {
  const { darkMode } = useThemeContext();

  const axisColor = darkMode ? '#cbd5e1' : '#475569';
  const gridColor = darkMode ? '#334155' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    color: darkMode ? '#e2e8f0' : '#0f172a',
    borderRadius: '0.75rem',
  };

  return (
    <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Uptime Events</h3>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fill: axisColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
          <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={{ stroke: gridColor }} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }} />
          <Bar dataKey="uptimeEvents" fill="#006ec7" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
