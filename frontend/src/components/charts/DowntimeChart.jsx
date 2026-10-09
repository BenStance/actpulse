import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useThemeContext } from '../../context/ThemeContext';

function CustomTooltip({ active, payload, label, darkMode }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-lg backdrop-blur"
      style={{
        backgroundColor: darkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)',
        borderColor: darkMode ? '#334155' : '#e2e8f0',
      }}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Downtime events:
        </span>
        <span className="text-sm font-bold text-rose-500">{value}</span>
      </div>
    </div>
  );
}

export default function DowntimeChart({ data = [] }) {
  const { darkMode, themeConfig } = useThemeContext();

  const axisColor = darkMode ? '#94a3b8' : '#64748b';
  const gridColor = darkMode ? '#1e293b' : '#eef2f7';
  const danger = themeConfig?.colors?.status?.error || '#ef4444';

  const total = useMemo(
    () => data.reduce((sum, d) => sum + (d.downtimeEvents || 0), 0),
    [data]
  );
  const avg = data.length ? (total / data.length).toFixed(1) : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
            Downtime Events
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            Outages over time
          </p>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-sm font-bold text-rose-500">{total}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Avg</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{avg}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 flex-1 px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="downtimeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={danger} stopOpacity={0.35} />
                <stop offset="100%" stopColor={danger} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
              dy={6}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: danger, strokeWidth: 1, strokeDasharray: '4 4' }}
              content={<CustomTooltip themeConfig={themeConfig} darkMode={darkMode} />}
            />
            <ReferenceLine y={0} stroke={gridColor} />
            <Area
              type="monotone"
              dataKey="downtimeEvents"
              stroke={danger}
              strokeWidth={2.5}
              fill="url(#downtimeFill)"
              dot={{ r: 3, fill: danger, strokeWidth: 2, stroke: darkMode ? '#0f172a' : '#fff' }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: darkMode ? '#0f172a' : '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
