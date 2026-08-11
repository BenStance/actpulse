import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useThemeContext } from '../../context/ThemeContext';

export default function StatusPie({ onCount = 0, offCount = 0 }) {
  const { darkMode } = useThemeContext();
  const data = [
    { name: 'ON', value: onCount, color: '#10b981' },
    { name: 'OFF', value: offCount, color: '#f97316' },
  ];

  const tooltipStyle = {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    color: darkMode ? '#e2e8f0' : '#0f172a',
    borderRadius: '0.75rem',
  };

  return (
    <div className="h-72 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">ON vs OFF</h3>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius={55}
            outerRadius={95}
            dataKey="value"
            label={{ fill: darkMode ? '#e2e8f0' : '#1e293b', fontSize: 12 }}
          >
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: darkMode ? '#f8fafc' : '#0f172a' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
