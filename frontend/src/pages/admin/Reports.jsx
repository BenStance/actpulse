// src/pages/shared/Reports.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  Info,
  MapPin,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { equipmentApi, organizationsApi, reportsApi, sitesApi } from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";
import { useThemeContext } from "../../context/ThemeContext";
import { formatDate } from "../../utils/formatDate";

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900";
const cardPad = `${card} p-4`;
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const tableHead =
  "bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const tableCell = "p-3 text-sm text-slate-700 dark:text-slate-200";

const PAGE_SIZES = [10, 20, 50, 100];

const hours = (ms) =>
  ms == null ? "—" : (Number(ms) / 3600000).toFixed(2);

const humanize = (v) =>
  String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ */
/*  Chart shell + variants                                            */
/* ------------------------------------------------------------------ */
function useChartTheme() {
  const { darkMode } = useThemeContext();
  return {
    darkMode,
    axisColor: darkMode ? "#94a3b8" : "#64748b",
    gridColor: darkMode ? "#1e293b" : "#eef2f7",
    tooltipStyle: {
      backgroundColor: darkMode
        ? "rgba(15,23,42,0.96)"
        : "rgba(255,255,255,0.98)",
      border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`,
      borderRadius: "0.75rem",
      color: darkMode ? "#e2e8f0" : "#0f172a",
      fontSize: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    },
    labelStyle: {
      color: darkMode ? "#f8fafc" : "#0f172a",
      fontWeight: 600,
    },
  };
}

function ChartShell({ title, subtitle, children, height = 300 }) {
  return (
    <section className={cardPad}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <BarChart3 size={16} className="shrink-0 text-slate-400" />
      </header>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </section>
  );
}

function EmptyChart({ message = "No data in this period." }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <TrendingUp size={18} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

/* --- Stacked bar --- */
function StackedBarChart({ title, subtitle, data, xKey, series, height = 300 }) {
  const t = useChartTheme();
  if (!data?.length)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={{ stroke: t.gridColor }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: t.axisColor }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={t.tooltipStyle}
            labelStyle={t.labelStyle}
            formatter={(v) => `${Number(v).toFixed(2)} h`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {series.map(([key, name, color]) => (
            <Bar key={key} dataKey={key} name={name} stackId="a" fill={color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* --- Line --- */
function LineChartCard({ title, subtitle, data, xKey, series, height = 300 }) {
  const t = useChartTheme();
  if (!data?.length)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={{ stroke: t.gridColor }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: t.axisColor }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {series.map(([key, name, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* --- Area --- */
function AreaChartCard({ title, subtitle, data, xKey, series, height = 300 }) {
  const t = useChartTheme();
  if (!data?.length)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <defs>
            {series.map(([key, , color]) => (
              <linearGradient key={key} id={`rpt-area-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={{ stroke: t.gridColor }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: t.axisColor }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {series.map(([key, name, color]) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#rpt-area-${key})`}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* --- Donut --- */
function DonutChartCard({ title, subtitle, data, centerLabel, height = 300 }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
  if (!total)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={t.tooltipStyle}
              labelStyle={t.labelStyle}
              formatter={(v) => `${Number(v).toFixed(2)} h`}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {centerLabel ?? total.toFixed(1)}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            equipment-hours
          </span>
        </div>
      </div>
    </ChartShell>
  );
}

/* --- Composed (bar + line) --- */
function ComposedChartCard({
  title,
  subtitle,
  data,
  xKey,
  barSeries = [],
  lineSeries = [],
  height = 300,
}) {
  const t = useChartTheme();
  if (!data?.length)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={{ stroke: t.gridColor }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: t.axisColor }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {barSeries.map(([key, name, color]) => (
            <Bar key={key} dataKey={key} name={name} fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} />
          ))}
          {lineSeries.map(([key, name, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={3}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Cue                                                           */
/* ------------------------------------------------------------------ */
const TILE_TONES = {
  brand: {
    ring: "ring-[#064789]/20 dark:ring-[#427aa1]/30",
    bg: "from-[#064789]/5 to-[#427aa1]/5 dark:from-[#064789]/15 dark:to-[#427aa1]/10",
    value: "text-[#064789] dark:text-[#8fc7e8]",
    icon: "bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]",
  },
  success: {
    ring: "ring-emerald-500/20",
    bg: "from-emerald-500/5 to-emerald-500/0 dark:from-emerald-500/10 dark:to-transparent",
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  warning: {
    ring: "ring-amber-500/20",
    bg: "from-amber-500/5 to-amber-500/0 dark:from-amber-500/10 dark:to-transparent",
    value: "text-amber-600 dark:text-amber-400",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  neutral: {
    ring: "ring-slate-400/20",
    bg: "from-slate-500/5 to-slate-500/0 dark:from-slate-500/10 dark:to-transparent",
    value: "text-slate-700 dark:text-slate-200",
    icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

function Cue({ title, value, note, tone = "brand", icon: Icon }) {
  const t = TILE_TONES[tone] || TILE_TONES.brand;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${t.bg} p-4 shadow-sm ring-1 ring-inset ${t.ring} transition-colors dark:border-slate-700`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-1.5 truncate text-2xl font-bold ${t.value}`}>
            {value ?? "—"}
          </p>
          {note && (
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {note}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Reports                                                           */
/* ================================================================== */
export default function Reports() {
  const [params] = useSearchParams();
  const admin = useAuthStore(
    (state) => state.user?.role === "Admin" || state.user?.role === "ADMIN"
  );

  const [organizations, setOrganizations] = useState([]);
  const [sites, setSites] = useState([]);
  const [equipment, setEquipment] = useState([]);

  const [filters, setFilters] = useState({
    organizationId: "",
    siteId: params.get("siteId") || "",
    type: "",
    equipmentId: params.get("equipmentId") || "",
    preset: "7d",
    timezone: params.get("timezone") || "Africa/Dar_es_Salaam",
    from: "",
    to: "",
  });

  const [report, setReport] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [events, setEvents] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ---------------- lookups ---------------- */
  useEffect(() => {
    Promise.all([
      sitesApi.list({ active: "all" }),
      equipmentApi.list({ active: "all" }),
    ])
      .then(([siteResult, equipmentResult]) => {
        setSites(siteResult.data || []);
        setEquipment(equipmentResult.data || []);
      })
      .catch(() => setError("Could not load report filters."));
    if (admin) {
      organizationsApi
        .list()
        .then(({ data }) => setOrganizations(data || []))
        .catch(() => undefined);
    }
  }, [admin]);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    if (filters.preset === "custom" && (!filters.from || !filters.to)) return;
    setLoading(true);
    setError("");
    try {
      const range = {
        preset: filters.preset,
        from:
          filters.preset === "custom"
            ? new Date(filters.from).toISOString()
            : undefined,
        to:
          filters.preset === "custom"
            ? new Date(filters.to).toISOString()
            : undefined,
        timezone: filters.timezone,
      };
      const fleetPromise = reportsApi.fleet({
        ...range,
        organizationId: filters.organizationId || undefined,
        siteId: filters.siteId || undefined,
        type: filters.type || undefined,
      });

      if (filters.equipmentId) {
        const [item, all, eventsResponse] = await Promise.all([
          reportsApi.equipment({ ...range, equipmentId: filters.equipmentId }),
          fleetPromise,
          reportsApi.events({
            ...range,
            equipmentId: filters.equipmentId,
            page,
            pageSize,
          }),
        ]);
        setReport(item.data);
        setFleet(all.data);
        setEvents(eventsResponse.data);
      } else {
        const { data } = await fleetPromise;
        setFleet(data);
        setReport(null);
        setEvents(null);
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load reports."
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- exports ---------------- */
  const downloadCsv = async () => {
    try {
      const { data } = await reportsApi.fleetCsv({
        preset: filters.preset,
        from:
          filters.preset === "custom"
            ? new Date(filters.from).toISOString()
            : undefined,
        to:
          filters.preset === "custom"
            ? new Date(filters.to).toISOString()
            : undefined,
        timezone: filters.timezone,
        organizationId: filters.organizationId,
        siteId: filters.siteId,
        type: filters.type,
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "actpulse-equipment-report.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not export CSV.");
    }
  };

  const downloadPdf = () => {
    if (!report) return;
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text("ACTPulse observed equipment duration", 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Equipment: ${report.equipment.name} (${report.equipment.type})`,
      14,
      24
    );
    doc.text(
      `Input: ${report.equipment.monitoringDefinition || "Unclassified"}`,
      14,
      30
    );
    doc.text(
      `Period UTC: ${report.period.from} to ${report.period.to}`,
      14,
      36
    );
    doc.text(
      `Calendar timezone: ${report.timezone}; unknown time is not counted as OFF`,
      14,
      42
    );
    autoTable(doc, {
      startY: 48,
      head: [["Day", "ON hours", "OFF hours", "Unknown hours", "Coverage"]],
      body: report.daily.map((row) => [
        row.day,
        hours(row.onMs),
        hours(row.offMs),
        hours(row.unknownMs),
        row.dataCoverage == null
          ? "—"
          : `${(row.dataCoverage * 100).toFixed(1)}%`,
      ]),
    });
    doc.save("actpulse-equipment-duration.pdf");
  };

  /* ---------------- derived ---------------- */
  const chart = useMemo(
    () =>
      report?.daily.map((row) => ({
        day: row.day,
        ON: row.onMs / 3600000,
        OFF: row.offMs / 3600000,
        Unknown: row.unknownMs / 3600000,
        Coverage:
          row.dataCoverage == null ? null : row.dataCoverage * 100,
        Sessions: row.observedOnSessionCount,
      })) || [],
    [report]
  );

  const eventTotalPages = Math.max(
    1,
    Math.ceil((events?.total || 0) / pageSize)
  );
  const goTo = (p) =>
    setPage(Math.max(1, Math.min(eventTotalPages, p)));

  /* ================================================================ */
  return (
    <PageContainer
      title="Reports"
      subtitle="Observed ON/OFF duration, unknown time and data coverage"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Report filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
                leftIcon={RefreshCw}
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCsv}
                disabled={!fleet}
                leftIcon={FileSpreadsheet}
              >
                CSV
              </Button>
              <Button
                size="sm"
                onClick={downloadPdf}
                disabled={!report}
                leftIcon={Download}
              >
                PDF
              </Button>
            </div>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {admin && (
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Organization
                </span>
                <select
                  className={selectClass}
                  value={filters.organizationId}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      organizationId: e.target.value,
                      siteId: "",
                      equipmentId: "",
                    })
                  }
                >
                  <option value="">All</option>
                  {organizations.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Site
              </span>
              <select
                className={selectClass}
                value={filters.siteId}
                onChange={(e) => {
                  const row = sites.find((s) => s.id === e.target.value);
                  setFilters({
                    ...filters,
                    siteId: e.target.value,
                    equipmentId: "",
                    timezone: row?.timezone || filters.timezone,
                  });
                }}
              >
                <option value="">All sites</option>
                {sites
                  .filter(
                    (row) =>
                      !filters.organizationId ||
                      row.organizationId === filters.organizationId
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Equipment
              </span>
              <select
                className={selectClass}
                value={filters.equipmentId}
                onChange={(e) => {
                  setFilters({ ...filters, equipmentId: e.target.value });
                  setPage(1);
                }}
              >
                <option value="">Fleet totals</option>
                {equipment
                  .filter(
                    (row) =>
                      (!filters.organizationId ||
                        row.organizationId === filters.organizationId) &&
                      (!filters.siteId || row.siteId === filters.siteId)
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Type
              </span>
              <select
                className={selectClass}
                value={filters.type}
                onChange={(e) =>
                  setFilters({ ...filters, type: e.target.value })
                }
              >
                <option value="">All types</option>
                <option value="GENERATOR">Generator</option>
                <option value="UPS">UPS</option>
                <option value="UNSPECIFIED">Needs classification</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Period
              </span>
              <select
                className={selectClass}
                value={filters.preset}
                onChange={(e) =>
                  setFilters({ ...filters, preset: e.target.value })
                }
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <Input
              label="Reporting timezone"
              value={filters.timezone}
              onChange={(e) =>
                setFilters({ ...filters, timezone: e.target.value })
              }
            />

            {filters.preset === "custom" && (
              <>
                <Input
                  label="From"
                  type="datetime-local"
                  value={filters.from}
                  onChange={(e) =>
                    setFilters({ ...filters, from: e.target.value })
                  }
                />
                <Input
                  label="To"
                  type="datetime-local"
                  value={filters.to}
                  onChange={(e) =>
                    setFilters({ ...filters, to: e.target.value })
                  }
                />
              </>
            )}
          </div>
        </section>

        {/* ============ MESSAGES ============ */}
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertTriangle size={16} />
            {error}
          </p>
        )}

        {/* ============ LOADING ============ */}
        {loading && !fleet ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Calculating reports…
              </p>
            </div>
          </div>
        ) : (
          fleet && (
            <>
              {/* ============ PERIOD BANNER ============ */}
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                UTC window{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {new Date(fleet.period.from).toLocaleString()}
                </strong>{" "}
                –{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {new Date(fleet.period.to).toLocaleString()}
                </strong>{" "}
                · calendar{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {fleet.period.timezone}
                </strong>
                . Summed durations are equipment-hours; unknown time is not OFF.
              </p>

              {/* ============ KPI CUES ============ */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Cue
                  title="Equipment"
                  value={fleet.totals.equipment}
                  icon={Cpu}
                  tone="brand"
                />
                <Cue
                  title="ON equipment-hours"
                  value={hours(fleet.totals.onMs)}
                  icon={Zap}
                  tone="success"
                />
                <Cue
                  title="OFF equipment-hours"
                  value={hours(fleet.totals.offMs)}
                  icon={Activity}
                  tone="neutral"
                />
                <Cue
                  title="Unknown equipment-hours"
                  value={hours(fleet.totals.unknownMs)}
                  icon={AlertTriangle}
                  tone="warning"
                />
                <Cue
                  title="Weighted coverage"
                  value={
                    fleet.totals.dataCoverage == null
                      ? "—"
                      : `${(fleet.totals.dataCoverage * 100).toFixed(1)}%`
                  }
                  icon={Gauge}
                  tone="brand"
                />
              </div>

              {/* ============ FLEET MIX DONUT ============ */}
              <div className="grid gap-4 lg:grid-cols-3">
                <DonutChartCard
                  title="Observed duration mix"
                  subtitle="ON / OFF / Unknown share of equipment-hours"
                  data={[
                    {
                      name: "ON",
                      value: Number(fleet.totals.onMs) / 3600000,
                      color: "#10b981",
                    },
                    {
                      name: "OFF",
                      value: Number(fleet.totals.offMs) / 3600000,
                      color: "#94a3b8",
                    },
                    {
                      name: "Unknown",
                      value: Number(fleet.totals.unknownMs) / 3600000,
                      color: "#f59e0b",
                    },
                  ]}
                  centerLabel={(
                    Number(fleet.totals.onMs) / 3600000 +
                    Number(fleet.totals.offMs) / 3600000 +
                    Number(fleet.totals.unknownMs) / 3600000
                  ).toFixed(1)}
                  height={300}
                />

                <ComposedChartCard
                  title="Duration by equipment"
                  subtitle="ON hours per equipment with coverage line"
                  data={fleet.equipment.map((row) => ({
                    name: row.name,
                    on: row.onMs / 3600000,
                    coverage:
                      row.dataCoverage == null ? null : row.dataCoverage * 100,
                  }))}
                  xKey="name"
                  barSeries={[["on", "ON hours", "#064789"]]}
                  lineSeries={[["coverage", "Coverage %", "#427aa1"]]}
                  height={300}
                />

                <AreaChartCard
                  title="Coverage distribution"
                  subtitle="How many equipment sit at each coverage tier"
                  data={[
                    {
                      tier: "0–20%",
                      count: fleet.equipment.filter(
                        (r) =>
                          r.dataCoverage != null && r.dataCoverage < 0.2
                      ).length,
                    },
                    {
                      tier: "20–40%",
                      count: fleet.equipment.filter(
                        (r) =>
                          r.dataCoverage != null &&
                          r.dataCoverage >= 0.2 &&
                          r.dataCoverage < 0.4
                      ).length,
                    },
                    {
                      tier: "40–60%",
                      count: fleet.equipment.filter(
                        (r) =>
                          r.dataCoverage != null &&
                          r.dataCoverage >= 0.4 &&
                          r.dataCoverage < 0.6
                      ).length,
                    },
                    {
                      tier: "60–80%",
                      count: fleet.equipment.filter(
                        (r) =>
                          r.dataCoverage != null &&
                          r.dataCoverage >= 0.6 &&
                          r.dataCoverage < 0.8
                      ).length,
                    },
                    {
                      tier: "80–100%",
                      count: fleet.equipment.filter(
                        (r) =>
                          r.dataCoverage != null && r.dataCoverage >= 0.8
                      ).length,
                    },
                  ]}
                  xKey="tier"
                  series={[["count", "Equipment", "#064789"]]}
                  height={300}
                />
              </div>

              {/* ============ EQUIPMENT DETAIL CHARTS ============ */}
              {report && (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <StackedBarChart
                      title="Daily ON / OFF / unknown hours"
                      subtitle={`${report.equipment.name} · ${humanize(report.equipment.monitoringDefinition) || "Unclassified"}`}
                      data={chart}
                      xKey="day"
                      series={[
                        ["ON", "ON", "#10b981"],
                        ["OFF", "OFF", "#94a3b8"],
                        ["Unknown", "Unknown", "#f59e0b"],
                      ]}
                      height={340}
                    />

                    <LineChartCard
                      title="Coverage & completed ON sessions"
                      subtitle="Percentage coverage alongside session count"
                      data={chart}
                      xKey="day"
                      series={[
                        ["Coverage", "Coverage %", "#064789"],
                        ["Sessions", "Sessions", "#e63f2e"],
                      ]}
                      height={340}
                    />
                  </div>

                  <section className={cardPad}>
                    <header className="mb-3 flex items-center gap-2">
                      <Gauge size={16} className="text-slate-400" />
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {report.equipment.name} · {report.equipment.monitoringDefinition
                          ? humanize(report.equipment.monitoringDefinition)
                          : "Input needs classification"}
                      </h2>
                    </header>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        [
                          "Completed ON sessions",
                          report.summary.completedOnSessionCount,
                          Activity,
                        ],
                        [
                          "Average completed",
                          `${hours(report.summary.averageCompletedOnSessionMs)} h`,
                          Clock,
                        ],
                        [
                          "Longest completed",
                          `${hours(report.summary.longestCompletedOnSessionMs)} h`,
                          TrendingUp,
                        ],
                        ["Current state", report.snapshot.state, Zap],
                        [
                          "Last contact",
                          report.snapshot.lastSeenAt
                            ? formatDate(report.snapshot.lastSeenAt, "UTC")
                            : "Never",
                          Clock,
                        ],
                        [
                          "ON share of known time",
                          report.summary.onShareOfKnown == null
                            ? "—"
                            : `${(report.summary.onShareOfKnown * 100).toFixed(1)}%`,
                          CheckCircle2,
                        ],
                      ].map(([label, value, Icon]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <Icon size={12} />
                            {label}
                          </div>
                          <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                            {value ?? "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={card}>
                    <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-slate-400" />
                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Event timeline
                        </h2>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {events?.total || 0}
                        </span>
                      </div>
                    </header>

                    {!events?.items?.length ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                          <Activity size={22} />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          No events in this period
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 p-4">
                        {events.items.map((event) => {
                          const isObs = event.type === "OBSERVATION";
                          const Icon = isObs ? Zap : Activity;
                          const tone = isObs
                            ? event.status === "ON"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            : event.status === "ONLINE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
                          return (
                            <div
                              key={event.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
                                >
                                  <Icon size={14} />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                    {isObs
                                      ? `${event.status} ${String(event.kind || "").toLowerCase()}`
                                      : `Monitor ${String(event.status || "").toLowerCase()}`}
                                  </p>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                    {formatDate(event.at, "UTC")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pager */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Page{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {page}
                        </strong>{" "}
                        of {eventTotalPages} · {events?.total || 0} events
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          Rows
                          <select
                            value={pageSize}
                            onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setPage(1);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {PAGE_SIZES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => goTo(1)}
                            disabled={page <= 1}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            aria-label="First page"
                          >
                            <ChevronsLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => goTo(page - 1)}
                            disabled={page <= 1}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            aria-label="Previous page"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => goTo(page + 1)}
                            disabled={page >= eventTotalPages}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            aria-label="Next page"
                          >
                            <ChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => goTo(eventTotalPages)}
                            disabled={page >= eventTotalPages}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                            aria-label="Last page"
                          >
                            <ChevronsRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* ============ EQUIPMENT COMPARISON ============ */}
              <section className={card}>
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Equipment comparison
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {fleet.equipment.length}
                    </span>
                  </div>
                </header>

                {fleet.equipment.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Cpu size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No accessible equipment in this period
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Equipment / site</th>
                          <th className="p-3">Input meaning</th>
                          <th className="p-3">ON h</th>
                          <th className="p-3">OFF h</th>
                          <th className="p-3">Unknown h</th>
                          <th className="p-3">Coverage</th>
                          <th className="p-3">Completed sessions</th>
                          <th className="p-3">Current</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fleet.equipment.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className={tableCell}>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                  {row.name}
                                </p>
                                <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                  <MapPin size={10} />
                                  {row.site?.name || "—"} · {row.type}
                                </p>
                              </div>
                            </td>
                            <td className={tableCell}>
                              {row.monitoringDefinition
                                ? humanize(row.monitoringDefinition)
                                : "Unclassified"}
                            </td>
                            <td className={`${tableCell} font-medium`}>
                              {hours(row.onMs)}
                            </td>
                            <td className={tableCell}>{hours(row.offMs)}</td>
                            <td className={tableCell}>{hours(row.unknownMs)}</td>
                            <td className={tableCell}>
                              {row.dataCoverage == null
                                ? "—"
                                : `${(row.dataCoverage * 100).toFixed(1)}%`}
                            </td>
                            <td className={tableCell}>
                              {row.completedOnSessionCount}
                            </td>
                            <td className={tableCell}>
                              {row.snapshot?.state || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )
        )}
      </div>
    </PageContainer>
  );
}