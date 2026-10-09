import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useThemeContext } from '../../context/ThemeContext';

function CustomTooltip({ active, payload, darkMode }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: entry } = payload[0];
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
        borderColor: darkMode ? '#334155' : '#e2e8f0',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {name}
        </span>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

export default function StatusPie({ onCount = 0, offCount = 0 }) {
  const { darkMode, themeConfig } = useThemeContext();

  const data = useMemo(
    () => [
      { name: 'Online', value: onCount, color: themeConfig?.colors?.status?.success || '#10b981' },
      { name: 'Offline', value: offCount, color: themeConfig?.colors?.status?.warning || '#f97316' },
    ],
    [onCount, offCount, themeConfig]
  );

  const total = onCount + offCount;
  const uptimePct = total ? Math.round((onCount / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
          Device Status
        </h3>
        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
          Online vs offline distribution
        </p>
      </div>

      {/* Body */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-3">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={88}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              cornerRadius={6}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {uptimePct}%
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Online
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        {data.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-800/60"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {item.name}
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}