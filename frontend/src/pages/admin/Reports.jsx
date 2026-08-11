import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileBarChart2, RefreshCw, Clock, TrendingDown, TrendingUp, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import PageContainer from '../../components/layout/PageContainer';
import Input from '../../components/common/Input';
import { deviceApi, reportsApi } from '../../api/actPulse.Api';
import { useThemeContext } from '../../context/ThemeContext';

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function secondsToHours(sec) {
  return Number((sec / 3600).toFixed(2));
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="absolute top-0 left-0 h-1 w-full" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        </div>
        <div className="rounded-xl p-2" style={{ background: `${color}20` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Mobile breakdown row card ─────────────────────────────────────────────────
function BreakdownCard({ row }) {
  const isUptime = row.type === 'UPTIME';
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center justify-between mb-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          isUptime
            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-500/20 text-red-700 dark:text-red-400'
        }`}>
          {row.type}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {row.durationMinutes} min
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Start: <span className="text-slate-700 dark:text-slate-200">{row.start}</span>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        End: <span className="text-slate-700 dark:text-slate-200">{row.end}</span>
      </p>
    </div>
  );
}

export default function Reports() {
  const { darkMode } = useThemeContext();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const [deviceId, setDeviceId] = useState('');
  const [from, setFrom] = useState(toLocalInputValue(weekAgo));
  const [to, setTo] = useState(toLocalInputValue(now));

  const [uptimeReport, setUptimeReport] = useState(null);
  const [dailyReport, setDailyReport] = useState([]);
  const [eventsReport, setEventsReport] = useState(null);
  const [fleetSummary, setFleetSummary] = useState(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const res = await deviceApi.list();
        const list = res.data || [];
        setDevices(list);
        if (list.length > 0) setDeviceId((curr) => curr || list[0].id);
      } catch (e) {
        setError(e?.response?.data?.message || 'Failed to load devices');
      }
    };
    loadDevices();
  }, []);

  const loadReports = async () => {
    if (!deviceId || !from || !to) return;
    setLoading(true);
    setError('');
    try {
      const params = { deviceId, from: new Date(from).toISOString(), to: new Date(to).toISOString() };
      const [uptimeRes, dailyRes, eventsRes, fleetRes] = await Promise.all([
        reportsApi.getDeviceUptimeReport(params),
        reportsApi.getDeviceDailyReport(params),
        reportsApi.getDeviceEventsReport(params),
        reportsApi.getFleetSummary({ from: params.from, to: params.to }),
      ]);
      setUptimeReport(uptimeRes.data);
      setDailyReport(dailyRes.data || []);
      setEventsReport(eventsRes.data);
      setFleetSummary(fleetRes.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (deviceId) loadReports(); }, [deviceId]);

  const chartDaily = useMemo(
    () => dailyReport.map((d) => ({
      day: d.day,
      uptimeHours: secondsToHours(d.uptimeSeconds),
      downtimeHours: secondsToHours(d.downtimeSeconds),
      uptimePercentage: d.uptimePercentage,
    })),
    [dailyReport],
  );

  const eventFrequency = useMemo(() => {
    const map = new Map();
    (eventsReport?.events || []).forEach((e) => {
      const day = e.timestamp.slice(0, 10);
      map.set(day, (map.get(day) || 0) + 1);
    });
    return [...map.entries()].map(([day, count]) => ({ day, count }));
  }, [eventsReport]);

  const summary = uptimeReport?.summary || { uptimeSeconds: 0, downtimeSeconds: 0, uptimePercentage: 0 };
  const pieData = [
    { name: 'Uptime',   value: secondsToHours(summary.uptimeSeconds),   color: '#10b981' },
    { name: 'Downtime', value: secondsToHours(summary.downtimeSeconds),  color: '#ef4444' },
  ];

  const exportTablePdf = () => {
    if (!uptimeReport?.table?.length) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('ActPulse Device Uptime/Downtime Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Device: ${uptimeReport.device.name}`, 14, 24);
    doc.text(`From: ${uptimeReport.period.from}`, 14, 30);
    doc.text(`To: ${uptimeReport.period.to}`, 14, 36);
    autoTable(doc, {
      startY: 42,
      head: [['Start', 'End', 'Duration (Minutes)', 'Type']],
      body: uptimeReport.table.map((row) => [row.start, row.end, String(row.durationMinutes), row.type]),
      styles: { fontSize: 8 },
    });
    doc.save(`actpulse-report-${uptimeReport.device.name}.pdf`);
  };

  const axisColor = darkMode ? '#94a3b8' : '#64748b';
  const gridColor = darkMode ? '#1e293b' : '#f1f5f9';

  return (
    <PageContainer
      title="Reports"
      subtitle="Historical uptime/downtime analysis, events, and fleet summary"
      actions={[
        { label: loading ? 'Loading...' : 'Refresh', variant: 'outline', onClick: loadReports, icon: RefreshCw },
        { label: 'Export PDF', variant: 'primary', onClick: exportTablePdf, icon: Download },
      ]}
    >
      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Device</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <Input type="datetime-local" label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="datetime-local" label="To"   value={to}   onChange={(e) => setTo(e.target.value)} />
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-8">
        <StatCard label="Uptime %"       value={`${summary.uptimePercentage}%`}          icon={TrendingUp}   color="#10b981" delay={0.05} />
        <StatCard label="Uptime Hours"   value={secondsToHours(summary.uptimeSeconds)}   icon={Clock}        color="#064789" delay={0.1}  />
        <StatCard label="Downtime Hours" value={secondsToHours(summary.downtimeSeconds)} icon={TrendingDown} color="#ef4444" delay={0.15} />
        <StatCard label="Fleet Devices"  value={fleetSummary?.totals?.devices ?? 0}      icon={Cpu}          color="#427aa1" delay={0.2}  />
      </div>

      {/* ── Charts Row ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2 pb-8 pt-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Daily Uptime vs Downtime (Hours)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
                <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                <Tooltip />
                <Bar dataKey="uptimeHours"   fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="downtimeHours" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Uptime vs Downtime Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Event Frequency ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <FileBarChart2 size={16} /> Event Frequency by Day
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={eventFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke={darkMode ? '#93c5fd' : '#2563eb'} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div><br/>

      {/* ── Breakdown Table / Cards ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ">
        <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">Uptime / Downtime Breakdown</h3>

        {/* Mobile: cards (hidden on md+) */}
        <div className="flex flex-col gap-2 md:hidden">
          {uptimeReport?.table?.length ? (
            uptimeReport.table.map((row, idx) => (
              <BreakdownCard key={`${row.start}-${idx}`} row={row} />
            ))
          ) : (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No data in selected period.</p>
          )}
        </div>

        {/* Desktop: full table (hidden below md) */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">End</th>
                <th className="px-3 py-2">Duration (Minutes)</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(uptimeReport?.table || []).map((row, idx) => (
                <tr key={`${row.start}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">{row.start}</td>
                  <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">{row.end}</td>
                  <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">{row.durationMinutes}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.type === 'UPTIME'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-500/20 text-red-700 dark:text-red-400'
                    }`}>
                      {row.type}
                    </span>
                  </td>
                </tr>
              ))}
              {!uptimeReport?.table?.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No data in selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}