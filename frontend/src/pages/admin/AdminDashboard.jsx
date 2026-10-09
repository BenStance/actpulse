// src/pages/admin/AdminDashboard.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createReportDoc,
  formatNumber,
  titleCase,
} from "../../utils/pdfReport";
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
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarClock,
  ChevronRight,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  Server,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import {
  billingApi,
  dashboardApi,
  organizationsApi,
  sitesApi,
  usersApi,
} from "../../api/actPulse.Api";
import { getSocket } from "../../components/realtime/socket";
import { formatDate } from "../../utils/formatDate";
import { useThemeContext } from "../../context/ThemeContext";

/* ------------------------------------------------------------------ */
/*  Style tokens                                                      */
/* ------------------------------------------------------------------ */
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900";
const cardPad = `${card} p-5`;
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const linkClass =
  "font-medium text-[#064789] underline-offset-2 hover:underline dark:text-[#8fc7e8]";
const tableHead =
  "bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const tableCell = "p-3 text-sm text-slate-700 dark:text-slate-200";

const BRAND = {
  primary: "#064789",
  secondary: "#427aa1",
  accent: "#ebf2fa",
  darkPrimary: "#3a86b0",
  darkSecondary: "#6ca3c4",
};

const tabs = [
  ["overview", "Overview", Activity],
  ["customers", "Customers & Subscriptions", Users],
  ["billing", "Billing & Payments", Wallet],
  ["operations", "Equipment Operations", Cpu],
];

const money = (amount, currency) => `${currency} ${amount ?? "0"}`;
const hour = (value) =>
  `${(Number(value || 0) / 3600000).toFixed(2)} equipment-hours`;
const percentage = (value) =>
  value == null ? "Unavailable" : `${(Number(value) * 100).toFixed(1)}%`;
const label = (value) =>
  String(value ?? "—")
    .replaceAll("_", " ")
    .toLowerCase();
const organizationUrl = (id) =>
  `/admin/platform-billing?tab=organizations&organizationId=${id}`;
const csvCell = (value) => {
  const raw = String(value ?? "");
  const safe = /^[=+@-]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

/* ------------------------------------------------------------------ */
/*  Palette for multi-series charts                                   */
/* ------------------------------------------------------------------ */
const CHART_PALETTE = [
  BRAND.primary,
  BRAND.secondary,
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

/* ------------------------------------------------------------------ */
/*  Shared tooltip                                                    */
/* ------------------------------------------------------------------ */
function useChartTheme() {
  const { darkMode } = useThemeContext();
  return {
    darkMode,
    axisColor: darkMode ? "#94a3b8" : "#64748b",
    gridColor: darkMode ? "#1e293b" : "#eef2f7",
    tooltipStyle: {
      backgroundColor: darkMode ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.98)",
      border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`,
      borderRadius: "0.75rem",
      color: darkMode ? "#e2e8f0" : "#0f172a",
      fontSize: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    },
    labelStyle: {
      color: darkMode ? "#f8fafc" : "#0f172a",
      fontWeight: 600,
      marginBottom: 4,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Chart shell                                                       */
/* ------------------------------------------------------------------ */
function ChartShell({ title, subtitle, note, action, children, height = 280 }) {
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
        {action}
      </header>
      <div style={{ height }} className="w-full">
        {children}
      </div>
      {note && (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
          {note}
        </p>
      )}
    </section>
  );
}

function EmptyChart({ message = "No data for this view." }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center dark:border-slate-700">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <TrendingUp size={18} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  1) Bar chart — multi-series, rounded                              */
/* ------------------------------------------------------------------ */
function BarChartCard({ title, subtitle, data, xKey, series, height = 280 }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) =>
    series.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues) {
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  }
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 25 }}>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            angle={-20}
            textAnchor="end"
            height={55}
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={{ stroke: t.gridColor }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {series.map(([key, name, color]) => (
            <Bar
              key={key}
              dataKey={key}
              name={name}
              fill={color}
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  2) Area chart — gradient fills, smooth                            */
/* ------------------------------------------------------------------ */
function AreaChartCard({ title, subtitle, data, xKey, series, height = 280 }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) =>
    series.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues) {
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  }
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <defs>
            {series.map(([key, , color]) => (
              <linearGradient key={key} id={`area-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.45} />
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
          <YAxis
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={false}
            tickLine={false}
          />
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
              fill={`url(#area-${key})`}
              dot={{ r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  3) Composed chart — bars + line overlay                           */
/* ------------------------------------------------------------------ */
function ComposedChartCard({
  title,
  subtitle,
  data,
  xKey,
  barSeries = [],
  lineSeries = [],
  height = 280,
}) {
  const t = useChartTheme();
  const allSeries = [...barSeries, ...lineSeries];
  const hasValues = data?.some((row) =>
    allSeries.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues) {
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  }
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
          <YAxis
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: t.axisColor }} iconType="circle" />
          {barSeries.map(([key, name, color]) => (
            <Bar
              key={key}
              dataKey={key}
              name={name}
              fill={color}
              radius={[6, 6, 0, 0]}
              maxBarSize={38}
            />
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
/*  4) Donut chart with center label                                  */
/* ------------------------------------------------------------------ */
function DonutCard({ title, subtitle, data, height = 280, centerLabel }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
  if (!total) {
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  }
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
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color || CHART_PALETTE[i % CHART_PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {centerLabel ?? total}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total
          </span>
        </div>
      </div>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  5) Radial chart — single KPI gauge                                */
/* ------------------------------------------------------------------ */
function RadialCard({ title, subtitle, value, max = 100, color = BRAND.primary, unit = "%", height = 280 }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  const data = [{ name: title, value: pct, fill: color }];
  return (
    <ChartShell title={title} subtitle={subtitle} height={height}>
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="65%"
            outerRadius="95%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={12}
              background={{ fill: "rgba(148,163,184,0.12)" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-800 dark:text-slate-100">
            {Number(value)?.toFixed?.(1) ?? value}
            <span className="text-base text-slate-400">{unit}</span>
          </span>
        </div>
      </div>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  6) Line chart — multi-series, smooth                              */
/* ------------------------------------------------------------------ */
function LineChartCard({ title, subtitle, data, xKey, series, height = 280 }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) =>
    series.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues) {
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
  }
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
          <YAxis
            tick={{ fontSize: 11, fill: t.axisColor }}
            axisLine={false}
            tickLine={false}
          />
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
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Cue tile                                                          */
/* ------------------------------------------------------------------ */
const TILE_TONES = {
  brand: {
    ring: "ring-[#064789]/20 dark:ring-[#427aa1]/30",
    bg: "from-[#064789]/5 to-[#427aa1]/5 dark:from-[#064789]/15 dark:to-[#427aa1]/10",
    value: "text-[#064789] dark:text-[#8fc7e8]",
    icon: "bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]",
  },
  danger: {
    ring: "ring-rose-500/20",
    bg: "from-rose-500/5 to-rose-500/0 dark:from-rose-500/10 dark:to-transparent",
    value: "text-rose-600 dark:text-rose-400",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  warning: {
    ring: "ring-amber-500/20",
    bg: "from-amber-500/5 to-amber-500/0 dark:from-amber-500/10 dark:to-transparent",
    value: "text-amber-600 dark:text-amber-400",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  success: {
    ring: "ring-emerald-500/20",
    bg: "from-emerald-500/5 to-emerald-500/0 dark:from-emerald-500/10 dark:to-transparent",
    value: "text-emerald-600 dark:text-emerald-400",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  neutral: {
    ring: "ring-slate-400/20",
    bg: "from-slate-500/5 to-slate-500/0 dark:from-slate-500/10 dark:to-transparent",
    value: "text-slate-700 dark:text-slate-200",
    icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};

function Cue({ title, value, note, to, tone = "brand", icon: Icon }) {
  const t = TILE_TONES[tone] || TILE_TONES.brand;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className={`mt-1.5 truncate text-2xl font-bold ${t.value}`}>
            {value ?? "Unavailable"}
          </p>
          {note && (
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {note}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
      {to && (
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#064789] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#8fc7e8]">
          Open <ArrowUpRight size={12} />
        </div>
      )}
    </>
  );

  const base = `group relative block overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${t.bg} p-4 shadow-sm ring-1 ring-inset ${t.ring} transition-all duration-200 dark:border-slate-700`;

  return to ? (
    <Link
      to={to}
      className={`${base} hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#427aa1]`}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pager + Empty + PriorityCard                                      */
/* ------------------------------------------------------------------ */
function Pager({ page, size, total, onPage }) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Page <strong className="text-slate-700 dark:text-slate-200">{page}</strong> of{" "}
        {totalPages} · {total} records
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page * size >= total} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <FileText size={18} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}

function PriorityCard({ title, icon: Icon, tone = "brand", children }) {
  const t = TILE_TONES[tone] || TILE_TONES.brand;
  return (
    <section className={cardPad}>
      <header className="mb-3 flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.icon}`}>
          {Icon && <Icon size={14} />}
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
      </header>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

/* ================================================================== */
/*  AdminDashboard                                                    */
/* ================================================================== */
export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [filters, setFilters] = useState({
    preset: "7d",
    from: "",
    to: "",
    organizationId: "",
    siteId: "",
    timezone: "Africa/Dar_es_Salaam",
    currency: "",
  });
  const [orgPage, setOrgPage] = useState(1),
    [equipmentPage, setEquipmentPage] = useState(1);
  const [organizations, setOrganizations] = useState([]),
    [sites, setSites] = useState([]),
    [currencies, setCurrencies] = useState([]);
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [partial, setPartial] = useState(""),
    [notice, setNotice] = useState("");
  const [socketState, setSocketState] = useState("Connecting");
  const [modal, setModal] = useState(""),
    [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [confirmReview, setConfirmReview] = useState(false),
    [proofUrl, setProofUrl] = useState(""),
    [proofType, setProofType] = useState("");

  const params = useMemo(
    () => ({
      preset: filters.preset,
      ...(filters.preset === "custom" && filters.from && filters.to
        ? {
            from: new Date(filters.from).toISOString(),
            to: new Date(filters.to).toISOString(),
          }
        : {}),
      organizationId: filters.organizationId || undefined,
      siteId: filters.siteId || undefined,
      timezone: filters.timezone,
      currency: filters.currency || undefined,
      orgPage,
      equipmentPage,
      pageSize: 10,
    }),
    [filters, orgPage, equipmentPage]
  );

  const load = useCallback(async () => {
    if (filters.preset === "custom" && (!filters.from || !filters.to)) {
      setLoading(false);
      setError("Choose both custom dates to load the dashboard.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: response } = await dashboardApi.admin(params);
      setData(response);
      setCurrencies((old) => [
        ...new Set([
          ...old,
          ...(response.billing?.money || []).map((row) => row.currency),
        ]),
      ]);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load Admin statistics.");
    } finally {
      setLoading(false);
    }
  }, [params, filters.preset, filters.from, filters.to]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([organizationsApi.list(), sitesApi.list()]).then(
      ([orgs, siteRows]) => {
        if (!active) return;
        if (orgs.status === "fulfilled") setOrganizations(orgs.value.data);
        if (siteRows.status === "fulfilled") setSites(siteRows.value.data);
        if (orgs.status === "rejected" || siteRows.status === "rejected")
          setPartial("Some filter choices are unavailable. Statistics remain usable.");
      }
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let attached = null,
      refreshTimer;
    const schedule = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 1500);
    };
    const connected = () => {
      setSocketState("Connected");
      void load();
    };
    const disconnected = () => setSocketState("Disconnected");
    const unbind = () => {
      if (attached) {
        attached.off("connect", connected);
        attached.off("disconnect", disconnected);
        attached.off("operations.updated", schedule);
        attached.off("alerts.updated", schedule);
      }
    };
    const bind = () => {
      const socket = getSocket();
      if (socket === attached) return;
      unbind();
      attached = socket;
      setSocketState(socket?.connected ? "Connected" : "Disconnected");
      if (socket) {
        socket.on("connect", connected);
        socket.on("disconnect", disconnected);
        socket.on("operations.updated", schedule);
        socket.on("alerts.updated", schedule);
      }
    };
    bind();
    const timer = setInterval(bind, 2000);
    const billingChanged = () => void load();
    window.addEventListener("billing:changed", billingChanged);
    return () => {
      clearInterval(timer);
      clearTimeout(refreshTimer);
      window.removeEventListener("billing:changed", billingChanged);
      unbind();
    };
  }, [load]);

  const changeFilter = (key, value) => {
    setFilters((old) => ({
      ...old,
      [key]: value,
      ...(key === "organizationId" ? { siteId: "" } : {}),
    }));
    setOrgPage(1);
    setEquipmentPage(1);
  };

  const closeModal = () => {
    if (proofUrl) URL.revokeObjectURL(proofUrl);
    setProofUrl("");
    setProofType("");
    setModal("");
    setConfirmReview(false);
  };

  const openReview = async (row) => {
    setModal("review");
    setForm({
      row,
      decision: "APPROVE",
      verifiedAmount: row.claimed_amount,
      note: "",
    });
    setConfirmReview(false);
    setError("");
    try {
      const response = await billingApi.proof(row.id);
      setProofType(response.data.type);
      setProofUrl(URL.createObjectURL(response.data));
    } catch {
      setPartial("Proof preview is unavailable. Use Platform Billing to retry.");
    }
  };

  const review = async (event) => {
    event.preventDefault();
    if (form.decision === "APPROVE" && !confirmReview) {
      setConfirmReview(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await billingApi.review(form.row.id, {
        decision: form.decision,
        verifiedAmount: form.verifiedAmount,
        note: form.note,
      });
      closeModal();
      setNotice("Payment review saved.");
      window.dispatchEvent(new Event("billing:changed"));
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not review payment.");
    } finally {
      setBusy(false);
    }
  };

  const saveNew = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const action = modal;
    try {
      if (action === "create")
        await organizationsApi.create({
          name: form.name,
          contactEmail: form.contactEmail || undefined,
        });
      else
        await usersApi.create({
          name: form.name,
          email: form.email,
          organizationId: form.organizationId,
          equipmentIds: [],
        });
      closeModal();
      setNotice(action === "create" ? "Organization created." : "Controller invitation sent.");
      const result = await organizationsApi.list();
      setOrganizations(result.data);
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- Export (unchanged logic) ---------------- */
  const exportRows = () => {
    if (!data) return [];
    const rows = [
      ["ACTPulse Admin dashboard"],
      ["Section", tabs.find(([id]) => id === tab)?.[1]],
      ["Generated UTC", formatDate(data.generatedAt, "UTC")],
      ["Period UTC", `${formatDate(data.filters.from, "UTC")} to ${formatDate(data.filters.to, "UTC")}`],
      ["Reporting timezone", data.filters.timezone],
      ["Organization", organizations.find((o) => o.id === filters.organizationId)?.name || "All"],
      ["Site", sites.find((s) => s.id === filters.siteId)?.name || "All"],
      ["Currency", filters.currency || "All, separated"],
    ];
    const section = (title, headers, items) => {
      rows.push([], [title], headers, ...items);
    };
    if (tab === "overview") {
      section(
        "Current snapshot",
        ["Metric", "Count"],
        [
          ["Organizations", data.snapshot.organizations],
          ["Active paid", data.snapshot.states.ACTIVE],
          ["Trialing", data.snapshot.states.TRIALING],
          ["Grace period", data.snapshot.states.GRACE],
          ["Requiring subscription", data.snapshot.states.NONE + data.snapshot.states.EXPIRED + data.snapshot.states.SUSPENDED],
          ["Pending reviews", data.snapshot.pendingReviews],
          ["Unresolved alerts", data.snapshot.openAlerts],
        ]
      );
      section(
        "Money by currency",
        ["Currency", "Verified collected in period", "Current outstanding"],
        data.billing.money.map((r) => [r.currency, r.collected, r.outstanding])
      );
      section(
        "Subscription states",
        ["State", "Organizations"],
        Object.entries(data.snapshot.states).map(([state, count]) => [state, count])
      );
      section(
        "Organizations by plan",
        ["Plan", "Organizations"],
        data.customers.byPlan.map((r) => [r.plan, r.count])
      );
      section(
        "Equipment states",
        ["State", "Equipment"],
        [
          ["ON", data.snapshot.equipment.on],
          ["OFF", data.snapshot.equipment.off],
          ["UNKNOWN", data.snapshot.equipment.unknown],
        ]
      );
      section(
        "Invoice and verified payment trend",
        ["Day", "Currency", "Issued", "Collected"],
        data.billing.trend.map((r) => [r.day, r.currency, r.issued, r.collected])
      );
      section(
        "Priority: pending reviews",
        ["Organization", "Invoice", "Claimed", "Currency"],
        data.billing.paymentQueue.slice(0, 5).map((r) => [r.organization_name, r.invoice_number, r.claimed_amount, r.currency])
      );
      section(
        "Priority: access ending within 7 days",
        ["Organization", "State", "Access ends UTC"],
        data.customers.upcoming.map((r) => [r.name, r.subscription_status, formatDate(r.access_ends_at, "UTC")])
      );
      section(
        "Priority: overdue invoices",
        ["Organization", "Invoice", "Outstanding", "Currency"],
        data.billing.overdueInvoices.map((r) => [r.organization_name, r.invoice_number, r.outstanding, r.currency])
      );
      section(
        "Priority: critical alerts",
        ["Organization", "Equipment", "Message"],
        data.operations.alerts.criticalList.map((r) => [r.organization_name, r.equipment_name, r.message])
      );
      rows.push([], ["Methodology", data.definitions.snapshot], ["Collections", data.definitions.collected]);
    } else if (tab === "customers") {
      section("Current subscription snapshot", ["State", "Organizations"], Object.entries(data.snapshot.states).map(([state, count]) => [state, count]));
      section("Customer period", ["New organizations", "First paid", "Renewals", "Trials started"], [[data.customers.period?.new_organizations, data.customers.period?.first_paid, data.customers.period?.renewals, data.customers.period?.trials_started]]);
      section("Trial conversion", ["Cohort", "Converted", "Incomplete follow-up"], [[data.customers.trialConversion.cohort, data.customers.trialConversion.converted, data.customers.trialConversion.incompleteFollowUp]]);
      section("Organization growth", ["Day", "New organizations"], data.customers.growth.map((r) => [r.day, r.organizations]));
      section("Organizations by plan", ["Plan", "Organizations"], data.customers.byPlan.map((r) => [r.plan, r.count]));
      section("Organizations by billing cycle", ["Cycle", "Organizations"], data.customers.byCycle.map((r) => [r.cycle, r.count]));
      section("Upcoming access ends", ["Organization", "State", "Ends UTC"], data.customers.upcomingTimeline.map((r) => [r.organizationName, r.kind, formatDate(r.endsAt, "UTC")]));
      section(
        `Organizations · displayed page ${data.customers.organizations.page}`,
        ["Organization", "Administrative status", "Subscription status", "Plan", "Cycle", "Sites", "Equipment", "Controllers", "Outstanding by currency", "Pending reviews"],
        data.customers.organizations.items.map((o) => [o.name, o.administrative_status, o.subscription_status, o.plan_snapshot?.code || "", o.billing_cycle || "", o.sites, o.equipment, o.controllers, o.outstanding_by_currency?.map((v) => money(v.amount, v.currency)).join("; ") || "", o.pending_payments])
      );
      rows.push([], ["Methodology", data.definitions.trialConversion], ["Approaching limits", data.definitions.approachingLimits]);
    } else if (tab === "billing") {
      section(
        "Money by currency",
        ["Currency", "Issued in period", "Verified collected in period", "Approved submissions in period", "Rejected submissions in period", "Current outstanding", "Current overdue", "Pending submissions", "Pending claimed, unverified"],
        data.billing.money.map((r) => [r.currency, r.issued, r.collected, r.approved_count, r.rejected_count, r.outstanding, r.overdue, r.pending_count, r.pending_claimed])
      );
      section("Invoice and verified payment trend", ["Day", "Currency", "Issued", "Collected"], data.billing.trend.map((r) => [r.day, r.currency, r.issued, r.collected]));
      section("Verified collections by method", ["Currency", "Method", "Collected"], data.billing.methods.map((r) => [r.currency, r.method, r.collected]));
      section("Invoice status distribution", ["Currency", "Status", "Count"], data.billing.invoiceStates.map((r) => [r.currency, r.status, r.count]));
      section("Receivables ageing", ["Currency", "Bucket", "Outstanding"], data.billing.ageing.map((r) => [r.currency, r.bucket, r.amount]));
      section("Outstanding by organization", ["Organization", "Currency", "Outstanding"], data.billing.outstandingByOrganization.map((r) => [r.organizationName, r.currency, r.amount]));
      section(
        "Payment review queue · displayed",
        ["Organization", "Invoice", "Plan", "Cycle", "Claimed", "Currency", "Method", "Reference", "Submitted UTC", "Status"],
        data.billing.paymentQueue.map((r) => [r.organization_name, r.invoice_number, r.plan_snapshot?.name, r.billing_cycle, r.claimed_amount, r.currency, r.method, r.reference, formatDate(r.created_at, "UTC"), r.status])
      );
      rows.push([], ["Methodology", data.definitions.collected]);
    } else {
      const x = data.operations;
      section("Current equipment snapshot", ["Metric", "Value"], Object.entries(data.snapshot.equipment).map(([key, value]) => [key, value]));
      section("Observed period", ["Metric", "Value", "Unit"], Object.entries(x.period).map(([key, value]) => [key, value, key.toLowerCase().includes("hours") ? "equipment-hours" : key.toLowerCase().includes("coverage") ? "ratio" : "count"]));
      section("Daily observed durations", ["Day", "ON equipment-hours", "OFF equipment-hours", "Unknown equipment-hours", "Coverage ratio"], x.daily.map((r) => [r.day, r.onMs / 3600000, r.offMs / 3600000, r.unknownMs / 3600000, r.dataCoverage]));
      section(
        `Equipment · displayed page ${x.equipment.page}`,
        ["Equipment", "Organization", "Site", "State", "Connectivity", "ON equipment-hours", "OFF equipment-hours", "Unknown equipment-hours", "Coverage ratio"],
        x.equipment.items.map((r) => [r.name, r.organizationName, r.site.name, r.snapshot.state, r.snapshot.connectivity, r.onMs / 3600000, r.offMs / 3600000, r.unknownMs / 3600000, r.coverage])
      );
      section("Observed hours by site", ["Site", "ON", "OFF", "Unknown"], x.siteHours.map((r) => [r.site, r.onHours, r.offHours, r.unknownHours]));
      section("Fuel purchase trend", ["Day", "Currency", "Litres", "Cost"], x.fuel.trend.map((r) => [r.day, r.currency, r.litres, r.amount]));
      section("Fuel spending by location", ["Organization", "Site", "Currency", "Litres", "Cost"], x.fuelSpendingByLocation.map((r) => [r.organization_name, r.site_name, r.currency, r.litres, r.amount]));
      section("Fuel usage estimates", ["Purchased litres", "Apparent usage litres", "Estimated consumption litres"], [[x.fuel.purchasedLitres, x.fuel.apparentUsageLitres, x.fuel.estimatedLitres]]);
      section("Maintenance", ["Due soon", "Due", "Overdue", "Unable to determine", "Completed in period"], [[x.maintenance.dueSoon, x.maintenance.due, x.maintenance.overdue, x.maintenance.unableToDetermine, x.maintenance.completed]]);
      section("Alert groups", ["Type", "Severity", "Status", "Count"], x.alerts.groups.map((r) => [r.type, r.severity, r.status, r.count]));
      section("Upcoming maintenance", ["Equipment ID", "Plan", "State", "Next due UTC"], x.maintenance.upcoming.map((r) => [r.equipmentId, r.title, r.state, formatDate(r.nextDueAt, "UTC")]));
      section("Completed services in period", ["Organization", "Equipment", "Description", "Performed UTC", "Cost", "Currency"], x.recentServices.map((r) => [r.organization_name, r.equipment_name, r.description, formatDate(r.performed_at, "UTC"), r.cost, r.currency]));
      rows.push([], ["Methodology", data.definitions.period]);
    }
    return rows;
  };

  const exportDashboard = (event) => {
  event.preventDefault();

  const filename = `actpulse-admin-${tab}-${new Date()
    .toISOString()
    .slice(0, 10)}`;

  /* ---------------- CSV branch (unchanged) ---------------- */
  if (form.format !== "PDF") {
    const rows = exportRows();
    const csv =
      rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    closeModal();
    return;
  }

  /* ---------------- PDF branch (branded) ---------------- */
  if (!data) {
    closeModal();
    return;
  }

  try {
    /* ---------- Meta grid ---------- */
    const meta = [
      ["Section", tabs.find(([id]) => id === tab)?.[1] || "—"],
      ["Timezone", data.filters.timezone],
      [
        "Period from",
        new Date(data.filters.from).toISOString().slice(0, 19).replace("T", " "),
      ],
      [
        "Period to",
        new Date(data.filters.to).toISOString().slice(0, 19).replace("T", " "),
      ],
      [
        "Organization",
        organizations.find((o) => o.id === filters.organizationId)?.name ||
          "All organizations",
      ],
      [
        "Site",
        sites.find((s) => s.id === filters.siteId)?.name || "All sites",
      ],
      ["Currency", filters.currency || "All, separated"],
      [
        "Generated",
        new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC",
      ],
    ];

    const rpt = createReportDoc({
      title: `Admin Dashboard · ${tabs.find(([id]) => id === tab)?.[1] || ""}`,
      subtitle: `Generated from ACTPulse · ${data.filters.timezone}`,
      meta,
      timezone: data.filters.timezone,
    });

    /* ==================== OVERVIEW ==================== */
    if (tab === "overview") {
      /* Executive summary cues */
      rpt.sectionTitle("Executive summary");
      rpt.keyValueGrid(
        [
          ["Organizations", formatNumber(snapshot.organizations)],
          ["Active paid", formatNumber(snapshot.states.ACTIVE)],
          ["Trialing", formatNumber(snapshot.states.TRIALING)],
          ["Grace period", formatNumber(snapshot.states.GRACE)],
          [
            "Requiring subscription",
            formatNumber(
              snapshot.states.NONE +
                snapshot.states.EXPIRED +
                snapshot.states.SUSPENDED
            ),
          ],
          ["Pending reviews", formatNumber(snapshot.pendingReviews)],
          ["Unresolved alerts", formatNumber(snapshot.openAlerts)],
          [
            "Equipment monitored",
            formatNumber(snapshot.equipment.total),
          ],
        ],
        { cols: 4 }
      );

      /* Money by currency */
      if (data.billing.money?.length) {
        rpt.sectionTitle("Money by currency");
        rpt.table(
          ["Currency", "Verified collected (period)", "Outstanding (current)"],
          data.billing.money.map((r) => [
            r.currency,
            formatNumber(r.collected),
            formatNumber(r.outstanding),
          ])
        );

        /* Chart: invoiced vs collected per currency */
        const moneyChart = data.billing.money.map((r) => ({
          name: r.currency,
          value: Number(r.collected) || 0,
        }));
        rpt.sectionTitle("Verified collections by currency");
        rpt.barChart(moneyChart, {
          title: "Verified collected in period",
          formatValue: (v) => formatNumber(v),
        });
      }

      /* Subscription states chart */
      if (Object.keys(snapshot.states).length) {
        const stateChart = Object.entries(snapshot.states).map(
          ([state, count]) => ({
            name: titleCase(state),
            value: Number(count) || 0,
          })
        );
        rpt.sectionTitle("Subscription state distribution");
        rpt.barChart(stateChart, {
          title: "Organizations by lifecycle state",
          formatValue: (v) => formatNumber(v),
        });

        rpt.sectionTitle("Subscription states");
        rpt.table(
          ["State", "Organizations"],
          Object.entries(snapshot.states).map(([state, count]) => [
            titleCase(state),
            formatNumber(count),
          ])
        );
      }

      /* Equipment states */
      rpt.sectionTitle("Equipment states");
      rpt.table(
        ["State", "Equipment"],
        [
          ["ON", formatNumber(snapshot.equipment.on)],
          ["OFF", formatNumber(snapshot.equipment.off)],
          ["UNKNOWN", formatNumber(snapshot.equipment.unknown)],
        ]
      );

      /* Organizations by plan */
      if (data.customers.byPlan?.length) {
        rpt.sectionTitle("Organizations by plan");
        rpt.table(
          ["Plan", "Organizations"],
          data.customers.byPlan.map((r) => [
            r.plan,
            formatNumber(r.count),
          ])
        );
      }

      /* Invoice & payment trend */
      if (data.billing.trend?.length) {
        rpt.pageBreak();
        rpt.sectionTitle("Invoice and verified payment trend");
        const currencies = [
          ...new Set(data.billing.trend.map((r) => r.currency)),
        ];
        currencies.forEach((c) => {
          rpt.paragraph(`Currency ${c}`, { bold: true, size: 10, gap: 1 });
          rpt.table(
            ["Day", "Issued", "Collected"],
            data.billing.trend
              .filter((r) => r.currency === c)
              .map((r) => [
                r.day,
                formatNumber(r.issued),
                formatNumber(r.collected),
              ])
          );
        });
      }

      /* Priority lists */
      if (data.billing.paymentQueue?.length) {
        rpt.sectionTitle("Priority · payments awaiting review");
        rpt.table(
          ["Organization", "Invoice", "Claimed", "Currency"],
          data.billing.paymentQueue.slice(0, 10).map((r) => [
            r.organization_name,
            r.invoice_number,
            formatNumber(r.claimed_amount),
            r.currency,
          ])
        );
      }

      if (data.customers.upcoming?.length) {
        rpt.sectionTitle("Priority · access ending within 7 days");
        rpt.table(
          ["Organization", "State", "Access ends (UTC)"],
          data.customers.upcoming.map((r) => [
            r.name,
            titleCase(r.subscription_status),
            formatDate(r.access_ends_at, "UTC"),
          ])
        );
      }

      if (data.billing.overdueInvoices?.length) {
        rpt.sectionTitle("Priority · overdue invoices");
        rpt.table(
          ["Organization", "Invoice", "Outstanding", "Currency"],
          data.billing.overdueInvoices.map((r) => [
            r.organization_name,
            r.invoice_number,
            formatNumber(r.outstanding),
            r.currency,
          ])
        );
      }

      if (data.operations.alerts.criticalList?.length) {
        rpt.sectionTitle("Priority · critical alerts");
        rpt.table(
          ["Organization", "Equipment", "Message"],
          data.operations.alerts.criticalList.map((r) => [
            r.organization_name,
            r.equipment_name,
            r.message,
          ])
        );
      }

      rpt.finalize({
        methodology: `${data.definitions.snapshot} · ${data.definitions.collected}`,
        footnote:
          "Verified collections are approved payment allocations, not accounting revenue. Pending claimed amounts are unverified.",
      });
    }

    /* ==================== CUSTOMERS ==================== */
    else if (tab === "customers") {
      rpt.sectionTitle("Subscription snapshot");
      rpt.table(
        ["State", "Organizations"],
        Object.entries(snapshot.states).map(([state, count]) => [
          titleCase(state),
          formatNumber(count),
        ])
      );

      rpt.sectionTitle("Customer period");
      rpt.keyValueGrid(
        [
          [
            "New organizations",
            formatNumber(data.customers.period?.new_organizations),
          ],
          ["First paid", formatNumber(data.customers.period?.first_paid)],
          ["Renewals", formatNumber(data.customers.period?.renewals)],
          [
            "Trials started",
            formatNumber(data.customers.period?.trials_started),
          ],
        ],
        { cols: 4 }
      );

      rpt.sectionTitle("Trial conversion");
      rpt.keyValueGrid(
        [
          ["Cohort", formatNumber(data.customers.trialConversion.cohort)],
          [
            "Converted",
            formatNumber(data.customers.trialConversion.converted),
          ],
          [
            "Incomplete follow-up",
            formatNumber(
              data.customers.trialConversion.incompleteFollowUp
            ),
          ],
        ],
        { cols: 3 }
      );

      if (data.customers.growth?.length) {
        rpt.sectionTitle("Organization growth · period");
        rpt.barChart(
          data.customers.growth.map((r) => ({
            name: r.day,
            value: Number(r.organizations) || 0,
          })),
          {
            title: "New organizations per day",
            formatValue: (v) => formatNumber(v),
          }
        );
      }

      if (data.customers.byPlan?.length) {
        rpt.sectionTitle("Organizations by plan");
        rpt.table(
          ["Plan", "Organizations"],
          data.customers.byPlan.map((r) => [
            r.plan,
            formatNumber(r.count),
          ])
        );
      }

      if (data.customers.byCycle?.length) {
        rpt.sectionTitle("Organizations by billing cycle");
        rpt.table(
          ["Cycle", "Organizations"],
          data.customers.byCycle.map((r) => [
            r.cycle,
            formatNumber(r.count),
          ])
        );
      }

      if (data.customers.upcomingTimeline?.length) {
        rpt.pageBreak();
        rpt.sectionTitle("Upcoming access ends");
        rpt.table(
          ["Organization", "State", "Ends (UTC)"],
          data.customers.upcomingTimeline.map((r) => [
            r.organizationName,
            titleCase(r.kind),
            formatDate(r.endsAt, "UTC"),
          ])
        );
      }

      /* Organizations table (paginated) */
      rpt.sectionTitle(
        `Organizations · displayed page ${data.customers.organizations.page}`
      );
      rpt.table(
        [
          "Organization",
          "Status",
          "Plan",
          "Cycle",
          "Sites",
          "Equipment",
          "Controllers",
          "Pending",
        ],
        data.customers.organizations.items.map((o) => [
          o.name,
          `${titleCase(o.administrative_status)} / ${titleCase(o.subscription_status)}`,
          o.plan_snapshot?.code || "—",
          o.billing_cycle || "—",
          formatNumber(o.sites),
          formatNumber(o.equipment),
          formatNumber(o.controllers),
          formatNumber(o.pending_payments),
        ])
      );

      rpt.finalize({
        methodology: `${data.definitions.trialConversion} · ${data.definitions.approachingLimits}`,
      });
    }

    /* ==================== BILLING ==================== */
    else if (tab === "billing") {
      rpt.sectionTitle("Money by currency");
      rpt.table(
        [
          "Currency",
          "Issued",
          "Verified collected",
          "Approved",
          "Rejected",
          "Outstanding",
          "Overdue",
          "Pending",
          "Pending claimed",
        ],
        data.billing.money.map((r) => [
          r.currency,
          formatNumber(r.issued),
          formatNumber(r.collected),
          formatNumber(r.approved_count),
          formatNumber(r.rejected_count),
          formatNumber(r.outstanding),
          formatNumber(r.overdue),
          formatNumber(r.pending_count),
          formatNumber(r.pending_claimed),
        ])
      );

      /* Chart: issued vs collected per currency */
      if (data.billing.money?.length) {
        rpt.sectionTitle("Verified collections by currency");
        rpt.barChart(
          data.billing.money.map((r) => ({
            name: r.currency,
            value: Number(r.collected) || 0,
          })),
          {
            title: "Verified collected in period",
            formatValue: (v) => formatNumber(v),
          }
        );
      }

      if (data.billing.methods?.length) {
        rpt.sectionTitle("Verified collections by method");
        rpt.table(
          ["Currency", "Method", "Collected"],
          data.billing.methods.map((r) => [
            r.currency,
            titleCase(r.method),
            formatNumber(r.collected),
          ])
        );
      }

      if (data.billing.invoiceStates?.length) {
        rpt.sectionTitle("Invoice status distribution");
        rpt.table(
          ["Currency", "Status", "Count"],
          data.billing.invoiceStates.map((r) => [
            r.currency,
            titleCase(r.status),
            formatNumber(r.count),
          ])
        );
      }

      if (data.billing.ageing?.length) {
        rpt.sectionTitle("Receivables ageing");
        rpt.table(
          ["Currency", "Bucket", "Outstanding"],
          data.billing.ageing.map((r) => [
            r.currency,
            r.bucket,
            formatNumber(r.amount),
          ])
        );
      }

      if (data.billing.outstandingByOrganization?.length) {
        rpt.sectionTitle("Outstanding by organization");
        rpt.table(
          ["Organization", "Currency", "Outstanding"],
          data.billing.outstandingByOrganization.map((r) => [
            r.organizationName,
            r.currency,
            formatNumber(r.amount),
          ])
        );
      }

      if (data.billing.paymentQueue?.length) {
        rpt.pageBreak();
        rpt.sectionTitle(
          `Payment review queue · displayed ${data.billing.paymentQueue.length}`
        );
        rpt.table(
          [
            "Organization",
            "Invoice",
            "Plan",
            "Cycle",
            "Claimed",
            "Currency",
            "Method",
            "Reference",
            "Submitted (UTC)",
            "Status",
          ],
          data.billing.paymentQueue.map((r) => [
            r.organization_name,
            r.invoice_number,
            r.plan_snapshot?.name || "—",
            r.billing_cycle || "—",
            formatNumber(r.claimed_amount),
            r.currency,
            titleCase(r.method),
            r.reference,
            formatDate(r.created_at, "UTC"),
            titleCase(r.status),
          ])
        );
      }

      rpt.finalize({
        methodology: data.definitions.collected,
        footnote:
          "Pending claimed amounts are unverified. Verified collections reflect approved manual payment allocations only.",
      });
    }

    /* ==================== OPERATIONS ==================== */
    else {
      const x = data.operations;

      rpt.sectionTitle("Current equipment snapshot");
      rpt.table(
        ["Metric", "Value"],
        Object.entries(snapshot.equipment).map(([key, value]) => [
          titleCase(key),
          formatNumber(value),
        ])
      );

      rpt.sectionTitle("Observed period");
      rpt.table(
        ["Metric", "Value", "Unit"],
        Object.entries(x.period).map(([key, value]) => [
          titleCase(key),
          formatNumber(value),
          key.toLowerCase().includes("hours")
            ? "equipment-hours"
            : key.toLowerCase().includes("coverage")
              ? "ratio"
              : "count",
        ])
      );

      /* Chart: daily ON/OFF/Unknown */
      if (x.daily?.length) {
        rpt.sectionTitle("Daily observed durations");
        rpt.barChart(
          x.daily.map((r) => ({
            name: r.day,
            value: Number(r.onMs) / 3600000,
          })),
          {
            title: "ON equipment-hours per day",
            formatValue: (v) => `${formatNumber(v)} h`,
          }
        );

        rpt.table(
          [
            "Day",
            "ON (h)",
            "OFF (h)",
            "Unknown (h)",
            "Coverage",
          ],
          x.daily.map((r) => [
            r.day,
            formatNumber(r.onMs / 3600000),
            formatNumber(r.offMs / 3600000),
            formatNumber(r.unknownMs / 3600000),
            r.dataCoverage == null
              ? "—"
              : `${(r.dataCoverage * 100).toFixed(1)}%`,
          ])
        );
      }

      if (x.siteHours?.length) {
        rpt.sectionTitle("Observed hours by site");
        rpt.barChart(
          x.siteHours.map((r) => ({
            name: r.site,
            value: Number(r.onHours) || 0,
          })),
          {
            title: "ON hours by site",
            formatValue: (v) => `${formatNumber(v)} h`,
          }
        );
      }

      if (x.fuel?.trend?.length) {
        rpt.pageBreak();
        rpt.sectionTitle("Fuel purchase trend");
        rpt.table(
          ["Day", "Currency", "Litres", "Cost"],
          x.fuel.trend.map((r) => [
            r.day,
            r.currency,
            formatNumber(r.litres),
            formatNumber(r.amount),
          ])
        );
      }

      if (x.fuelSpendingByLocation?.length) {
        rpt.sectionTitle("Fuel spending by location");
        rpt.table(
          ["Organization", "Site", "Currency", "Litres", "Cost"],
          x.fuelSpendingByLocation.map((r) => [
            r.organization_name,
            r.site_name,
            r.currency,
            formatNumber(r.litres),
            formatNumber(r.amount),
          ])
        );
      }

      rpt.sectionTitle("Fuel usage estimates");
      rpt.keyValueGrid(
        [
          ["Purchased litres", formatNumber(x.fuel.purchasedLitres)],
          [
            "Apparent usage litres",
            formatNumber(x.fuel.apparentUsageLitres),
          ],
          [
            "Estimated consumption litres",
            formatNumber(x.fuel.estimatedLitres),
          ],
        ],
        { cols: 3 }
      );

      rpt.sectionTitle("Maintenance");
      rpt.keyValueGrid(
        [
          ["Due soon", formatNumber(x.maintenance.dueSoon)],
          ["Due", formatNumber(x.maintenance.due)],
          ["Overdue", formatNumber(x.maintenance.overdue)],
          [
            "Unable to determine",
            formatNumber(x.maintenance.unableToDetermine),
          ],
          [
            "Completed in period",
            formatNumber(x.maintenance.completed),
          ],
        ],
        { cols: 3 }
      );

      if (x.alerts.groups?.length) {
        rpt.sectionTitle("Alert groups");
        rpt.table(
          ["Type", "Severity", "Status", "Count"],
          x.alerts.groups.map((r) => [
            titleCase(r.type),
            titleCase(r.severity),
            titleCase(r.status),
            formatNumber(r.count),
          ])
        );
      }

      if (x.maintenance.upcoming?.length) {
        rpt.sectionTitle("Upcoming maintenance");
        rpt.table(
          ["Equipment ID", "Plan", "State", "Next due (UTC)"],
          x.maintenance.upcoming.map((r) => [
            r.equipmentId,
            r.title,
            titleCase(r.state),
            formatDate(r.nextDueAt, "UTC"),
          ])
        );
      }

      if (x.recentServices?.length) {
        rpt.pageBreak();
        rpt.sectionTitle("Completed services in period");
        rpt.table(
          [
            "Organization",
            "Equipment",
            "Description",
            "Performed (UTC)",
            "Cost",
            "Currency",
          ],
          x.recentServices.map((r) => [
            r.organization_name,
            r.equipment_name,
            r.description,
            formatDate(r.performed_at, "UTC"),
            formatNumber(r.cost),
            r.currency || "—",
          ])
        );
      }

      rpt.finalize({
        methodology: data.definitions.period,
        footnote:
          "ON / OFF describe the configured monitor input. Unknown time is never counted as OFF. Durations sum equipment-hours, not wall-clock hours.",
      });
    }

    rpt.doc.save(`${filename}.pdf`);
    closeModal();
  } catch (err) {
    setError(
      err?.message ||
        err?.response?.data?.message ||
        "Could not export dashboard PDF."
    );
  }
};

  const snapshot = data?.snapshot,
    customers = data?.customers,
    billing = data?.billing,
    operations = data?.operations;
  const financial = billing?.money || [];
  const states = snapshot
    ? Object.entries(snapshot.states).map(([state, count]) => ({ state, count }))
    : [];
  const equipmentStates = snapshot
    ? [
        ["ON", snapshot.equipment.on],
        ["OFF", snapshot.equipment.off],
        ["UNKNOWN", snapshot.equipment.unknown],
      ].map(([state, count]) => ({ state, count }))
    : [];
  const periodLabel = data
    ? `${formatDate(data.filters.from, "UTC")} – ${formatDate(data.filters.to, "UTC")} · ${data.filters.timezone}`
    : "";
  const socketTone =
    socketState === "Connected" ? "success" : socketState === "Disconnected" ? "danger" : "warning";

  return (
    <PageContainer
      title="Admin Dashboard"
      subtitle="Customer, subscription, billing and equipment statistics from live records"
    >
      <div className="space-y-5">
        {/* ============ FILTER BAR ============ */}
        <section className={`${card} overflow-hidden`} aria-label="Dashboard filters">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <Filter size={16} className="text-slate-400" />
            <h2 className={sectionTitle}>Filters</h2>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Date range</span>
              <select className={selectClass} value={filters.preset} onChange={(e) => changeFilter("preset", e.target.value)}>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {filters.preset === "custom" && (
              <>
                <Input label="From (browser local)" type="datetime-local" value={filters.from} onChange={(e) => changeFilter("from", e.target.value)} />
                <Input label="To (browser local)" type="datetime-local" value={filters.to} onChange={(e) => changeFilter("to", e.target.value)} />
              </>
            )}
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Organization</span>
              <select className={selectClass} value={filters.organizationId} onChange={(e) => changeFilter("organizationId", e.target.value)}>
                <option value="">All organizations</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Site (operations)</span>
              <select className={selectClass} value={filters.siteId} onChange={(e) => changeFilter("siteId", e.target.value)}>
                <option value="">All sites</option>
                {sites
                  .filter((s) => !filters.organizationId || s.organizationId === filters.organizationId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            </label>
            <Input label="Reporting timezone" value={filters.timezone} onChange={(e) => changeFilter("timezone", e.target.value)} />
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Financial currency</span>
              <select className={selectClass} value={filters.currency} onChange={(e) => changeFilter("currency", e.target.value)}>
                <option value="">All, separated</option>
                {currencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* ============ STATUS + ACTIONS ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${socketTone === "success" ? "bg-emerald-500" : socketTone === "danger" ? "bg-rose-500" : "bg-amber-500"}`} />
              {socketState}
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{data ? `Updated ${formatDate(data.generatedAt, "UTC")}` : "—"}</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} leftIcon={RefreshCw}>
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setForm({ format: "CSV" });
                setModal("export");
              }}
              disabled={!data}
              leftIcon={Download}
            >
              Export
            </Button>
          </div>
        </div>

        {/* ============ ALERTS ============ */}
        {notice && (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            {notice}
          </p>
        )}
        {partial && (
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            {partial}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {/* ============ TABS ============ */}
        <nav className={`${card} flex flex-wrap gap-1 p-1.5`} aria-label="Admin dashboard sections">
          {tabs.map(([id, name, Icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-[#064789] to-[#427aa1] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={15} />
                {name}
              </button>
            );
          })}
        </nav>

        {/* ============ CONTENT ============ */}
        {loading && !data ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Loading Admin statistics…</p>
            </div>
          </div>
        ) : (
          data && (
            <>
              {/* ==================== OVERVIEW ==================== */}
              {tab === "overview" && (
                <div className="space-y-5">
                  {/* Cue tiles */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <Cue title="Organizations" value={snapshot.organizations} to="/admin/organizations" icon={Building2} tone="brand" />
                    <Cue title="Active paid" value={snapshot.states.ACTIVE} to="/admin/platform-billing?tab=organizations" icon={BadgeDollarSign} tone="success" />
                    <Cue title="Trialing" value={snapshot.states.TRIALING} to="/admin/platform-billing?tab=organizations" icon={Activity} tone="brand" />
                    <Cue title="In grace period" value={snapshot.states.GRACE} to="/admin/platform-billing?tab=organizations" icon={CalendarClock} tone="warning" />
                    <Cue
                      title="Requiring subscription"
                      value={snapshot.states.NONE + snapshot.states.EXPIRED + snapshot.states.SUSPENDED}
                      note="No plan, expired or suspended"
                      to="/admin/platform-billing?tab=organizations"
                      icon={AlertTriangle}
                      tone="danger"
                    />
                    <Cue title="Pending reviews" value={snapshot.pendingReviews} to="/admin/platform-billing?tab=reviews" icon={FileText} tone="warning" />
                    <Cue title="Unresolved alerts" value={snapshot.openAlerts} note="Open and acknowledged" to="/admin/alerts" icon={Bell} tone="danger" />
                    {financial.map((r) => (
                      <Cue
                        key={`paid-${r.currency}`}
                        title={`Verified collected · ${r.currency}`}
                        value={money(r.collected, r.currency)}
                        note="Period · approved allocations"
                        to="/admin/platform-billing?tab=overview"
                        icon={Wallet}
                        tone="success"
                      />
                    ))}
                    {financial.map((r) => (
                      <Cue
                        key={`out-${r.currency}`}
                        title={`Invoice balance · ${r.currency}`}
                        value={money(r.outstanding, r.currency)}
                        note="Current outstanding"
                        to="/admin/platform-billing?tab=organizations"
                        icon={FileSpreadsheet}
                        tone="warning"
                      />
                    ))}
                  </div>

                  {!financial.length && (
                    <div className={cardPad}>
                      <Empty>No invoices or payment submissions match these filters.</Empty>
                    </div>
                  )}

                  {/* Charts row 1 — 2 columns */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <DonutCard
                      title="Subscription state · current"
                      subtitle="Organizations by lifecycle stage"
                      data={states.map((s, i) => ({
                        name: s.state,
                        value: s.count,
                        color: CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={300}
                      centerLabel={snapshot.organizations}
                    />
                    <DonutCard
                      title="Equipment state · current"
                      subtitle="ON, OFF and unknown monitors"
                      data={equipmentStates.map((s, i) => ({
                        name: s.state,
                        value: s.count,
                        color: [BRAND.primary, BRAND.secondary, "#94a3b8"][i] || CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={300}
                      centerLabel={snapshot.equipment.total}
                    />
                  </div>

                  {/* Charts row 2 — 2 columns */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <BarChartCard
                      title="Organizations by plan · current"
                      subtitle="Distribution across pricing tiers"
                      data={customers.byPlan}
                      xKey="plan"
                      series={[["count", "Organizations", BRAND.primary]]}
                      height={300}
                    />
                    <RadialCard
                      title="Verified collection rate"
                      subtitle="Approved vs pending claims"
                      value={
                        snapshot.pendingReviews + (financial[0]?.approved_count || 0) > 0
                          ? (Number(financial[0]?.approved_count || 0) /
                              (Number(financial[0]?.approved_count || 0) + Number(snapshot.pendingReviews))) *
                            100
                          : 0
                      }
                      max={100}
                      color={BRAND.secondary}
                      height={300}
                    />
                  </div>

                  {/* Trend charts — composed for each currency */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[...new Set(billing.trend.map((r) => r.currency))].map((c) => (
                      <ComposedChartCard
                        key={c}
                        title={`Invoice & payment trend · ${c}`}
                        subtitle="Issued bars vs collected line"
                        data={billing.trend
                          .filter((r) => r.currency === c)
                          .map((r) => ({
                            day: r.day,
                            issued: Number(r.issued),
                            collected: Number(r.collected),
                          }))}
                        xKey="day"
                        barSeries={[["issued", "Issued", BRAND.primary]]}
                        lineSeries={[["collected", "Collected", "#10b981"]]}
                        height={300}
                      />
                    ))}
                  </div>

                  {/* Priority lists */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <PriorityCard title="Payments awaiting review" icon={FileText} tone="warning">
                      {billing.paymentQueue.length ? (
                        billing.paymentQueue.slice(0, 5).map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
                            <div className="min-w-0 text-sm">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">{r.organization_name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {r.invoice_number} · {money(r.claimed_amount, r.currency)}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => void openReview(r)}>
                              Review
                            </Button>
                          </div>
                        ))
                      ) : (
                        <Empty>No payments await review.</Empty>
                      )}
                    </PriorityCard>

                    <PriorityCard title="Access ending within 7 days" icon={CalendarClock} tone="brand">
                      {customers.upcoming.length ? (
                        customers.upcoming.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={`${linkClass} truncate`} to={organizationUrl(r.id)}>{r.name}</Link>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                              {r.subscription_status} · {formatDate(r.access_ends_at, "UTC")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <Empty>No access periods ending within 7 days.</Empty>
                      )}
                    </PriorityCard>

                    <PriorityCard title="Overdue invoices" icon={FileSpreadsheet} tone="danger">
                      {billing.overdueInvoices.length ? (
                        billing.overdueInvoices.map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={`${linkClass} truncate`} to={organizationUrl(r.organization_id)}>
                              {r.organization_name} · {r.invoice_number}
                            </Link>
                            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                              {money(r.outstanding, r.currency)} · due {formatDate(r.due_at, "UTC")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <Empty>No overdue invoice balances.</Empty>
                      )}
                    </PriorityCard>

                    <PriorityCard title="Critical operational alerts" icon={AlertTriangle} tone="danger">
                      {operations.alerts.criticalList.length ? (
                        operations.alerts.criticalList.map((r) => (
                          <div key={r.id} className="border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={linkClass} to={`/admin/equipment/${r.equipment_id}`}>
                              {r.organization_name} · {r.equipment_name}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.message}</p>
                          </div>
                        ))
                      ) : (
                        <Empty>No unresolved critical alerts.</Empty>
                      )}
                    </PriorityCard>
                  </div>

                  {/* Quick actions */}
                  <section className={cardPad}>
                    <h3 className={sectionTitle}>Quick actions</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => { setForm({ name: "", contactEmail: "" }); setModal("create"); }}>Create Organization</Button>
                      <Button variant="outline" onClick={() => { setForm({ name: "", email: "", organizationId: "" }); setModal("invite"); }}>Invite Controller</Button>
                      <Button variant="outline" onClick={() => setTab("billing")}>Review Payments</Button>
                      <Button variant="outline" onClick={() => setTab("customers")}>Expiring Subscriptions</Button>
                      <Button variant="outline" onClick={() => { setForm({ format: "CSV" }); setModal("export"); }}>Export Dashboard Summary</Button>
                    </div>
                  </section>
                </div>
              )}

              {/* ==================== CUSTOMERS ==================== */}
              {tab === "customers" && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[
                      ["Organizations", snapshot.organizations, "brand"],
                      ["Active paid", snapshot.states.ACTIVE, "success"],
                      ["Trialing", snapshot.states.TRIALING, "brand"],
                      ["Grace period", snapshot.states.GRACE, "warning"],
                      ["Expired", snapshot.states.EXPIRED, "danger"],
                      ["Suspended", snapshot.states.SUSPENDED, "danger"],
                      ["No plan selected", snapshot.states.NONE, "neutral"],
                      ["Expiring within 7 days", customers.upcoming.length, "warning"],
                      ["Administratively inactive", snapshot.states.INACTIVE, "neutral"],
                      ["Approaching plan limit", snapshot.approachingLimits, "warning"],
                      ["New organizations · period", customers.period?.new_organizations, "brand"],
                      ["First paid activations · period", customers.period?.first_paid, "success"],
                      ["Renewals approved · period", customers.period?.renewals, "success"],
                      ["Trials started · period", customers.period?.trials_started, "brand"],
                    ].map(([title, value, tone]) => (
                      <Cue key={title} title={title} value={value} tone={tone} />
                    ))}
                  </div>

                  {/* Trial conversion + donuts */}
                  <div className="grid gap-4 lg:grid-cols-3">
                    <section className={cardPad}>
                      <h3 className={sectionTitle}>Trial conversion cohort</h3>
                      <p className="mt-2 text-3xl font-bold text-[#064789] dark:text-[#8fc7e8]">
                        {customers.trialConversion.converted} <span className="text-lg text-slate-400">of</span> {customers.trialConversion.cohort}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Trials started {periodLabel}. {customers.trialConversion.incompleteFollowUp} organizations have incomplete trial follow-up.
                      </p>
                    </section>
                    <DonutCard
                      title="Organizations by plan"
                      subtitle="Current distribution"
                      data={customers.byPlan.map((r, i) => ({
                        name: r.plan,
                        value: r.count,
                        color: CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={260}
                    />
                    <DonutCard
                      title="Billing cycles"
                      subtitle="Monthly vs annual"
                      data={customers.byCycle.map((r, i) => ({
                        name: r.cycle,
                        value: r.count,
                        color: [BRAND.primary, BRAND.secondary, "#10b981"][i] || CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={260}
                    />
                  </div>

                  {/* Growth area + lifecycle bar */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AreaChartCard
                      title="Organization growth · period"
                      subtitle="Cumulative new organizations"
                      data={customers.growth}
                      xKey="day"
                      series={[["organizations", "New organizations", BRAND.primary]]}
                      height={300}
                    />
                    <BarChartCard
                      title="Subscription lifecycle · current"
                      subtitle="Organizations per state"
                      data={states}
                      xKey="state"
                      series={[["count", "Organizations", BRAND.secondary]]}
                      height={300}
                    />
                  </div>

                  <section className={cardPad}>
                    <h3 className={sectionTitle}>Upcoming period ends · next 30 days</h3>
                    <div className="mt-3 space-y-1">
                      {customers.upcomingTimeline.length ? (
                        customers.upcomingTimeline.map((r) => (
                          <div key={r.organizationId} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={`${linkClass} truncate`} to={organizationUrl(r.organizationId)}>
                              {r.organizationName}
                            </Link>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {r.kind} · {formatDate(r.endsAt, "UTC")}
                            </span>
                          </div>
                        ))
                      ) : (
                        <Empty>No current periods end within 30 days.</Empty>
                      )}
                    </div>
                  </section>

                  <section className={cardPad}>
                    <h3 className={`${sectionTitle} mb-3`}>Organizations</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-[1000px] w-full text-left text-sm">
                        <thead>
                          <tr className={tableHead}>
                            {["Organization", "Admin / subscription", "Plan / cycle", "Access end UTC", "Usage / limits", "Outstanding", "Pending", "Action"].map((h) => (
                              <th key={h} className="p-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {customers.organizations.items.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                              <td className={`${tableCell} font-medium`}>{r.name}</td>
                              <td className={tableCell}>{r.administrative_status} / {r.subscription_status}</td>
                              <td className={tableCell}>{r.plan_snapshot?.code || "None"} / {r.billing_cycle || "—"}</td>
                              <td className={tableCell}>
                                {formatDate(r.access_ends_at, "UTC")}
                                {r.access_ends_at && (
                                  <span className="block text-xs text-slate-500">
                                    {Math.ceil((new Date(r.access_ends_at) - new Date()) / 86400000)} days remaining
                                  </span>
                                )}
                              </td>
                              <td className={tableCell}>
                                {r.sites}/{r.plan_snapshot?.siteLimit ?? "—"} sites · {r.equipment}/{r.plan_snapshot?.equipmentLimit ?? "—"} equipment · {r.controllers}/{r.plan_snapshot?.controllerLimit ?? "—"} Controllers
                              </td>
                              <td className={tableCell}>
                                {r.outstanding_by_currency?.length
                                  ? r.outstanding_by_currency.map((v) => (
                                      <span key={v.currency} className="block">{money(v.amount, v.currency)}</span>
                                    ))
                                  : "—"}
                              </td>
                              <td className={tableCell}>{r.pending_payments}</td>
                              <td className={tableCell}>
                                <Link className={`${linkClass} inline-flex items-center gap-1`} to={organizationUrl(r.id)}>
                                  View <ChevronRight size={12} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!customers.organizations.items.length && <Empty>No organizations match this filter.</Empty>}
                    <div className="mt-3">
                      <Pager page={customers.organizations.page} size={customers.organizations.pageSize} total={customers.organizations.total} onPage={setOrgPage} />
                    </div>
                  </section>
                </div>
              )}

              {/* ==================== BILLING ==================== */}
              {tab === "billing" && (
                <div className="space-y-5">
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                    Issued invoices and verified collections in this period may refer to different invoices. Pending claimed amounts are unverified.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <Cue title="Pending submissions" value={snapshot.pendingReviews} to="/admin/platform-billing?tab=reviews" icon={FileText} tone="warning" />
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-issued`} title={`Invoices issued · ${r.currency}`} value={money(r.issued, r.currency)} note="Period" icon={FileSpreadsheet} tone="brand" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-paid`} title={`Verified collected · ${r.currency}`} value={money(r.collected, r.currency)} note={`${r.approved_count} approved submissions`} icon={Wallet} tone="success" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-approved-count`} title={`Approved submissions · ${r.currency}`} value={r.approved_count} note="Period" icon={BadgeDollarSign} tone="success" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-rejected`} title={`Rejected submissions · ${r.currency}`} value={r.rejected_count} note="Period" icon={AlertTriangle} tone="danger" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-outstanding`} title={`Outstanding · ${r.currency}`} value={money(r.outstanding, r.currency)} note="Current" icon={FileSpreadsheet} tone="warning" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-overdue`} title={`Overdue · ${r.currency}`} value={money(r.overdue, r.currency)} note="Current" icon={AlertTriangle} tone="danger" />
                    ))}
                    {financial.map((r) => (
                      <Cue key={`${r.currency}-pending`} title={`Pending claimed · ${r.currency}`} value={money(r.pending_claimed, r.currency)} note="Unverified" icon={CalendarClock} tone="warning" />
                    ))}
                  </div>

                  {!financial.length && (
                    <div className={cardPad}>
                      <Empty>No invoices or payment submissions match these filters.</Empty>
                    </div>
                  )}

                  {/* Row 1: Composed trend + Donut invoice status */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[...new Set(billing.trend.map((r) => r.currency))].map((c) => (
                      <ComposedChartCard
                        key={c}
                        title={`Invoice issuance & verified payments · ${c}`}
                        subtitle="Issued bars vs collected line"
                        data={billing.trend
                          .filter((r) => r.currency === c)
                          .map((r) => ({
                            day: r.day,
                            issued: Number(r.issued),
                            collected: Number(r.collected),
                          }))}
                        xKey="day"
                        barSeries={[["issued", "Issued", BRAND.primary]]}
                        lineSeries={[["collected", "Collected", "#10b981"]]}
                        height={300}
                      />
                    ))}
                    <DonutCard
                      title="Invoice status distribution"
                      subtitle="Current invoices by state"
                      data={billing.invoiceStates.map((r, i) => ({
                        name: `${r.status} · ${r.currency}`,
                        value: r.count,
                        color: CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={300}
                      centerLabel={billing.invoiceStates.reduce((s, r) => s + r.count, 0)}
                    />
                  </div>

                  {/* Row 2: Bar for methods + Area for ageing */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[...new Set(billing.methods.map((r) => r.currency))].map((c) => (
                      <BarChartCard
                        key={`method-${c}`}
                        title={`Verified collections by method · ${c}`}
                        subtitle="Which payment channels bring money in"
                        data={billing.methods
                          .filter((r) => r.currency === c)
                          .map((r) => ({
                            method: label(r.method),
                            collected: Number(r.collected),
                          }))}
                        xKey="method"
                        series={[["collected", "Collected", BRAND.secondary]]}
                        height={300}
                      />
                    ))}
                    {[...new Set(billing.ageing.map((r) => r.currency))].map((c) => (
                      <AreaChartCard
                        key={`age-${c}`}
                        title={`Receivables ageing · ${c}`}
                        subtitle="Outstanding amounts across ageing buckets"
                        data={billing.ageing
                          .filter((r) => r.currency === c)
                          .map((r) => ({
                            bucket: r.bucket,
                            amount: Number(r.amount),
                          }))}
                        xKey="bucket"
                        series={[["amount", "Outstanding", "#f59e0b"]]}
                        height={300}
                      />
                    ))}
                  </div>

                  <section className={cardPad}>
                    <h3 className={`${sectionTitle} mb-3`}>Payment review queue</h3>
                    {billing.paymentQueue.length ? (
                      <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                          <table className="min-w-[900px] w-full text-left text-sm">
                            <thead>
                              <tr className={tableHead}>
                                {["Organization", "Invoice / plan", "Claimed", "Method / reference", "Submitted UTC", "Status", "Action"].map((h) => (
                                  <th key={h} className="p-3">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {billing.paymentQueue.map((r) => (
                                <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                                  <td className={tableCell}>
                                    <Link className={linkClass} to={organizationUrl(r.organization_id)}>{r.organization_name}</Link>
                                  </td>
                                  <td className={tableCell}>{r.invoice_number} · {r.plan_snapshot?.name} / {r.billing_cycle}</td>
                                  <td className={`${tableCell} font-medium`}>{money(r.claimed_amount, r.currency)}</td>
                                  <td className={tableCell}>{label(r.method)} · {r.reference}</td>
                                  <td className={tableCell}>{formatDate(r.created_at, "UTC")}</td>
                                  <td className={tableCell}>{label(r.status)}</td>
                                  <td className={tableCell}>
                                    <Button variant="outline" size="sm" onClick={() => void openReview(r)}>Review</Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3">
                          <Link className={`${linkClass} inline-flex items-center gap-1 text-sm`} to="/admin/platform-billing?tab=reviews">
                            View full review queue <ChevronRight size={12} />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <Empty>No payments await review.</Empty>
                    )}
                  </section>

                  <section className={cardPad}>
                    <h3 className={`${sectionTitle} mb-3`}>Outstanding balances by organization · current</h3>
                    {billing.outstandingByOrganization.length ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-[520px] w-full text-left text-sm">
                          <thead>
                            <tr className={tableHead}>
                              <th className="p-3">Organization</th>
                              <th className="p-3">Currency</th>
                              <th className="p-3">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {billing.outstandingByOrganization.map((r) => (
                              <tr key={`${r.organizationId}-${r.currency}`} className="border-t border-slate-100 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                                <td className={tableCell}>
                                  <Link className={linkClass} to={organizationUrl(r.organizationId)}>{r.organizationName}</Link>
                                </td>
                                <td className={tableCell}>{r.currency}</td>
                                <td className={`${tableCell} font-medium`}>{money(r.amount, r.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty>No unpaid balances match these filters.</Empty>
                    )}
                  </section>
                </div>
              )}

              {/* ==================== OPERATIONS ==================== */}
              {tab === "operations" && (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[
                      ["Monitored equipment", snapshot.equipment.total, "brand", Server],
                      ["Generators", snapshot.equipment.generators, "brand", Cpu],
                      ["UPS units", snapshot.equipment.ups, "brand", Cpu],
                      ["Known ON", snapshot.equipment.on, "success", Activity],
                      ["Known OFF", snapshot.equipment.off, "neutral", Activity],
                      ["Unknown state", snapshot.equipment.unknown, "warning", AlertTriangle],
                      ["Online monitors", snapshot.equipment.online, "success", Activity],
                      ["Offline monitors", snapshot.equipment.offline, "danger", AlertTriangle],
                      ["Never connected", snapshot.equipment.neverConnected, "neutral", Cpu],
                      ["Engine running · period", `${Number(operations.period.engineRunningEquipmentHours).toFixed(2)} eq-hrs`, "brand", Activity],
                      ["Output powered · period", `${Number(operations.period.outputPoweredEquipmentHours).toFixed(2)} eq-hrs`, "brand", Activity],
                      ["Known OFF · period", `${Number(operations.period.knownOffEquipmentHours).toFixed(2)} eq-hrs`, "neutral", Activity],
                      ["Unknown · period", `${Number(operations.period.unknownEquipmentHours).toFixed(2)} eq-hrs`, "warning", AlertTriangle],
                      ["Coverage (duration-weighted)", percentage(operations.period.dataCoverage), "brand", TrendingUp],
                      ["Completed ON sessions · period", operations.period.completedObservedOnSessions, "success", Activity],
                    ].map(([title, value, tone, Icon]) => (
                      <Cue key={title} title={title} value={value} tone={tone} icon={Icon} />
                    ))}
                  </div>

                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                    ON/OFF describe the configured monitor input. Unknown is separate from confirmed OFF. Durations sum equipment-hours, not wall-clock hours.
                  </p>

                  {/* Coverage radial + connectivity donut */}
                  <div className="grid gap-4 lg:grid-cols-3">
                    <RadialCard
                      title="Duration-weighted coverage"
                      subtitle="Monitoring uptime"
                      value={
                        operations.period.dataCoverage == null
                          ? 0
                          : Number(operations.period.dataCoverage) * 100
                      }
                      max={100}
                      color={BRAND.primary}
                      height={280}
                    />
                    <DonutCard
                      title="Monitor connectivity"
                      subtitle="Online, offline, never connected"
                      data={[
                        { name: "Online", value: snapshot.equipment.online, color: "#10b981" },
                        { name: "Offline", value: snapshot.equipment.offline, color: "#ef4444" },
                        { name: "Never connected", value: snapshot.equipment.neverConnected, color: "#94a3b8" },
                      ]}
                      height={280}
                      centerLabel={snapshot.equipment.total}
                    />
                    <DonutCard
                      title="Current equipment state"
                      subtitle="ON / OFF / Unknown"
                      data={equipmentStates.map((s, i) => ({
                        name: s.state,
                        value: s.count,
                        color: [BRAND.primary, BRAND.secondary, "#94a3b8"][i] || CHART_PALETTE[i % CHART_PALETTE.length],
                      }))}
                      height={280}
                      centerLabel={snapshot.equipment.total}
                    />
                  </div>

                  {/* Daily trend — area */}
                  <AreaChartCard
                    title="Daily ON / OFF / unknown equipment-hours"
                    subtitle="Observed durations across the selected period"
                    data={operations.daily.map((r) => ({
                      day: r.day,
                      ON: r.onMs / 3600000,
                      OFF: r.offMs / 3600000,
                      Unknown: r.unknownMs / 3600000,
                    }))}
                    xKey="day"
                    series={[
                      ["ON", "ON", BRAND.primary],
                      ["OFF", "OFF", BRAND.secondary],
                      ["Unknown", "Unknown", "#94a3b8"],
                    ]}
                    height={340}
                  />

                  {/* Coverage line + site bar */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <LineChartCard
                      title="Daily monitoring coverage"
                      subtitle="Data coverage percentage per day"
                      data={operations.daily.map((r) => ({
                        day: r.day,
                        coverage: r.dataCoverage == null ? 0 : Number(r.dataCoverage) * 100,
                      }))}
                      xKey="day"
                      series={[["coverage", "Coverage %", "#10b981"]]}
                      height={300}
                    />
                    <BarChartCard
                      title="Observed hours by site"
                      subtitle="ON / OFF / unknown across sites"
                      data={operations.siteHours}
                      xKey="site"
                      series={[
                        ["onHours", "ON hours", BRAND.primary],
                        ["offHours", "OFF hours", BRAND.secondary],
                        ["unknownHours", "Unknown hours", "#94a3b8"],
                      ]}
                      height={300}
                    />
                  </div>

                  {/* Top equipment + alerts groups */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <BarChartCard
                      title="Top equipment by observed ON hours"
                      subtitle="Equipment ranked by usage"
                      data={operations.equipmentHours}
                      xKey="equipment"
                      series={[["onHours", "ON hours", BRAND.primary]]}
                      height={300}
                    />
                    <BarChartCard
                      title="Unresolved alerts by type, severity, status"
                      subtitle="Grouped operational alerts"
                      data={operations.alerts.groups
                        .filter((r) => r.status !== "RESOLVED")
                        .map((r) => ({
                          group: `${label(r.type)} · ${label(r.severity)} · ${label(r.status)}`,
                          count: r.count,
                        }))}
                      xKey="group"
                      series={[["count", "Alerts", "#ef4444"]]}
                      height={300}
                    />
                  </div>

                  {/* Fuel charts */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[...new Set(operations.fuelSpendingByLocation.map((r) => r.currency))].map((c) => (
                      <BarChartCard
                        key={`fuel-site-${c}`}
                        title={`Fuel spending by site · ${c}`}
                        subtitle="Cost across locations"
                        data={operations.fuelSpendingByLocation
                          .filter((r) => r.currency === c)
                          .map((r) => ({
                            site: r.site_name,
                            amount: Number(r.amount),
                          }))}
                        xKey="site"
                        series={[["amount", "Purchase cost", BRAND.primary]]}
                        height={300}
                      />
                    ))}
                    {[...new Set(operations.fuel.trend.map((r) => r.currency))]
                      .filter((c) => !filters.currency || c === filters.currency)
                      .map((c) => (
                        <AreaChartCard
                          key={`fuel-qty-${c}`}
                          title={`Fuel purchase quantity · ${c}`}
                          subtitle="Litres purchased per day"
                          data={operations.fuel.trend
                            .filter((r) => r.currency === c)
                            .map((r) => ({
                              day: r.day,
                              litres: Number(r.litres),
                            }))}
                          xKey="day"
                          series={[["litres", "Purchased litres", BRAND.secondary]]}
                          height={300}
                        />
                      ))}
                    {[...new Set(operations.fuel.trend.map((r) => r.currency))]
                      .filter((c) => !filters.currency || c === filters.currency)
                      .map((c) => (
                        <ComposedChartCard
                          key={`fuel-cost-${c}`}
                          title={`Fuel purchase cost · ${c}`}
                          subtitle="Daily cost trend"
                          data={operations.fuel.trend
                            .filter((r) => r.currency === c)
                            .map((r) => ({
                              day: r.day,
                              amount: Number(r.amount),
                            }))}
                          xKey="day"
                          barSeries={[["amount", "Purchase cost", BRAND.primary]]}
                          lineSeries={[]}
                          height={300}
                        />
                      ))}
                  </div>

                  <section className={cardPad}>
                    <h3 className={`${sectionTitle} mb-3`}>Equipment operations</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="min-w-[1120px] w-full text-left text-sm">
                        <thead>
                          <tr className={tableHead}>
                            {["Organization / site / equipment", "Type / definition", "Current state / observation", "Connectivity / last contact", "Period ON / OFF / unknown", "Coverage", "Open alerts", "Action"].map((h) => (
                              <th key={h} className="p-3">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {operations.equipment.items.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40">
                              <td className={`${tableCell} font-medium`}>{r.organizationName} · {r.site.name} · {r.name}</td>
                              <td className={tableCell}>{r.type} · {label(r.monitoringDefinition)}</td>
                              <td className={tableCell}>{r.snapshot.state} · {formatDate(r.snapshot.lastConfirmedAt, "UTC")}</td>
                              <td className={tableCell}>{r.snapshot.connectivity} · {formatDate(r.snapshot.lastSeenAt, "UTC")}</td>
                              <td className={tableCell}>{hour(r.onMs)} / {hour(r.offMs)} / {hour(r.unknownMs)}</td>
                              <td className={tableCell}>{percentage(r.coverage)}</td>
                              <td className={tableCell}>{r.openAlertCount}</td>
                              <td className={tableCell}>
                                <Link className={`${linkClass} inline-flex items-center gap-1`} to={`/admin/equipment/${r.id}`}>
                                  View <ChevronRight size={12} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!operations.equipment.items.length && <Empty>No active equipment matches these filters.</Empty>}
                    <div className="mt-3">
                      <Pager page={operations.equipment.page} size={operations.equipment.pageSize} total={operations.equipment.total} onPage={setEquipmentPage} />
                    </div>
                  </section>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <section className={cardPad}>
                      <h3 className={`${sectionTitle} mb-3`}>Fuel</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Purchased</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.fuel.purchasedLitres} L</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Apparent usage</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.fuel.apparentUsageLitres} L</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Estimated consumption</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.fuel.estimatedLitres} L</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Draft reconciliations</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.fuel.draftReconciliations} · {operations.fuel.flaggedReconciliations} flagged</dd></div>
                        {operations.fuel.costs.map((r) => (
                          <div key={r.currency} className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Cost · {r.currency}</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{money(r.amount, r.currency)}</dd></div>
                        ))}
                      </dl>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Apparent and estimated usage are separate methods.</p>
                      <Link className={`${linkClass} mt-2 inline-flex items-center gap-1 text-sm`} to="/admin/fuel">View fuel <ChevronRight size={12} /></Link>
                    </section>

                    <section className={cardPad}>
                      <h3 className={`${sectionTitle} mb-3`}>Maintenance</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Due soon</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.maintenance.dueSoon}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Due</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.maintenance.due}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Overdue</dt><dd className="font-medium text-rose-600 dark:text-rose-400">{operations.maintenance.overdue}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Completed · period</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{operations.maintenance.completed}</dd></div>
                        {operations.maintenance.costs.map((r) => (
                          <div key={r.currency} className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Cost · {r.currency}</dt><dd className="font-medium text-slate-800 dark:text-slate-100">{money(r.amount, r.currency)}</dd></div>
                        ))}
                      </dl>
                      <Link className={`${linkClass} mt-2 inline-flex items-center gap-1 text-sm`} to="/admin/maintenance">View maintenance <ChevronRight size={12} /></Link>
                    </section>

                    <section className={cardPad}>
                      <h3 className={`${sectionTitle} mb-3`}>Alerts</h3>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Open</dt><dd className="font-medium text-rose-600 dark:text-rose-400">{operations.alerts.open}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Acknowledged</dt><dd className="font-medium text-amber-600 dark:text-amber-400">{operations.alerts.acknowledged}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Critical unresolved</dt><dd className="font-medium text-rose-600 dark:text-rose-400">{operations.alerts.critical}</dd></div>
                        <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">Resolved · period</dt><dd className="font-medium text-emerald-600 dark:text-emerald-400">{operations.alerts.resolved_period}</dd></div>
                      </dl>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Acknowledgement and resolution are separate states.</p>
                      <Link className={`${linkClass} mt-2 inline-flex items-center gap-1 text-sm`} to="/admin/alerts">View alerts <ChevronRight size={12} /></Link>
                    </section>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className={cardPad}>
                      <h3 className={`${sectionTitle} mb-3`}>Upcoming maintenance</h3>
                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Unable to determine due date: {operations.maintenance.unableToDetermine}</p>
                      {operations.maintenance.upcoming.length ? (
                        operations.maintenance.upcoming.map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={`${linkClass} truncate`} to={`/admin/equipment/${r.equipmentId}`}>{r.title}</Link>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{label(r.state)} · {formatDate(r.nextDueAt, "UTC")}</span>
                          </div>
                        ))
                      ) : (
                        <Empty>No maintenance plans are due soon or overdue.</Empty>
                      )}
                    </section>

                    <section className={cardPad}>
                      <h3 className={`${sectionTitle} mb-3`}>Recent completed services · period</h3>
                      {operations.recentServices.length ? (
                        operations.recentServices.map((r) => (
                          <div key={r.id} className="border-b border-slate-100 py-2.5 text-sm last:border-0 dark:border-slate-800">
                            <Link className={linkClass} to={`/admin/equipment/${r.equipment_id}`}>
                              {r.organization_name} · {r.equipment_name}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {r.description} · {formatDate(r.performed_at, "UTC")}
                              {r.currency && r.cost != null ? ` · ${money(r.cost, r.currency)}` : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <Empty>No service records in this period.</Empty>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {/* ==================== RECENT ACTIVITY ==================== */}
              <section className={cardPad}>
                <h3 className={`${sectionTitle} mb-3`}>Recent authorized activity</h3>
                {!data.activity.length && !operations.activity.length ? (
                  <Empty>No activity in the selected period.</Empty>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {data.activity.map((r) => (
                      <article key={r.id} className="rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:border-[#427aa1]/40 dark:border-slate-700">
                        <strong className="text-slate-800 dark:text-slate-100">{label(r.kind)}</strong>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{r.organization_name || "Platform"} · {r.actor_name || "System"}</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(r.occurred_at, "UTC")}</p>
                        {r.organization_id && (
                          <Link className={`${linkClass} mt-1 inline-flex items-center gap-1 text-xs`} to={organizationUrl(r.organization_id)}>
                            View organization <ChevronRight size={11} />
                          </Link>
                        )}
                      </article>
                    ))}
                    {operations.activity.slice(0, 6).map((r) => (
                      <article key={`op-${r.id}`} className="rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:border-[#427aa1]/40 dark:border-slate-700">
                        <strong className="text-slate-800 dark:text-slate-100">{r.equipmentName} · {label(r.status)}</strong>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(r.at, "UTC")}</p>
                        <Link className={`${linkClass} mt-1 inline-flex items-center gap-1 text-xs`} to={`/admin/equipment/${r.equipmentId}`}>
                          View equipment <ChevronRight size={11} />
                        </Link>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )
        )}

        {/* ==================== MODALS ==================== */}
        <ActionModal open={modal === "review"} title="Review Payment" onClose={closeModal} size="xl">
          <form onSubmit={review} className="space-y-3 text-sm">
            <p><strong>{form.row?.organization_name}</strong> · {form.row?.invoice_number} · {form.row?.plan_snapshot?.name} / {form.row?.billing_cycle}</p>
            <p>Invoice total {money(form.row?.total, form.row?.currency)} · outstanding {money(form.row?.outstanding, form.row?.currency)}</p>
            <p>Claimed {money(form.row?.claimed_amount, form.row?.currency)} · {label(form.row?.method)} · reference {form.row?.reference} · submitted {formatDate(form.row?.created_at, "UTC")}</p>
            {form.row?.duplicate_warning && (
              <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Possible duplicate reference or proof. Verify funds independently.
              </p>
            )}
            {proofUrl && (
              <div className="max-h-72 overflow-hidden rounded-xl border dark:border-slate-700">
                {proofType?.startsWith("image/") ? (
                  <img src={proofUrl} alt="Uploaded payment proof" className="max-h-72 w-full object-contain" />
                ) : (
                  <iframe title="Uploaded payment proof" src={proofUrl} className="h-72 w-full" />
                )}
              </div>
            )}
            <label className="block">
              Decision
              <select
                className={selectClass}
                value={form.decision || "APPROVE"}
                onChange={(e) => { setForm({ ...form, decision: e.target.value }); setConfirmReview(false); }}
              >
                <option value="APPROVE">Approve verified amount</option>
                <option value="REJECT">Reject</option>
              </select>
            </label>
            {form.decision === "APPROVE" && (
              <Input
                required
                label="Verified amount"
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.verifiedAmount || ""}
                onChange={(e) => { setForm({ ...form, verifiedAmount: e.target.value }); setConfirmReview(false); }}
              />
            )}
            <Input
              required
              label={form.decision === "REJECT" ? "Rejection reason" : "Review note"}
              value={form.note || ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            {confirmReview && (
              <p className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/30">
                Confirm you independently verified the funds and amount. Full invoice coverage activates or extends the subscription.
              </p>
            )}
            <Button type="submit" loading={busy}>
              {form.decision === "APPROVE" && !confirmReview
                ? "Continue to Confirmation"
                : form.decision === "APPROVE"
                  ? "Confirm Approval"
                  : "Reject Payment"}
            </Button>
          </form>
        </ActionModal>

        <ActionModal open={modal === "create" || modal === "invite"} title={modal === "create" ? "Create Organization" : "Invite Controller"} onClose={closeModal}>
          <form onSubmit={saveNew} className="space-y-3">
            <Input required label="Name" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {modal === "create" ? (
              <Input label="Contact email" type="email" value={form.contactEmail || ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            ) : (
              <>
                <Input required label="Controller email" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label className="block text-sm">
                  Organization
                  <select required className={selectClass} value={form.organizationId || ""} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
                    <option value="">Select organization</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500">Equipment can be assigned from the Controllers page after invitation.</p>
              </>
            )}
            <Button type="submit" loading={busy}>
              {modal === "create" ? "Create Organization" : "Send Invitation"}
            </Button>
          </form>
        </ActionModal>

        <ActionModal open={modal === "export"} title="Export Dashboard Summary" onClose={closeModal}>
          <form onSubmit={exportDashboard} className="space-y-3 text-sm">
            <p>Exports the displayed {tabs.find(([id]) => id === tab)?.[1]} section with filters, values and methodology notes.</p>
            <label className="block">
              Format
              <select className={selectClass} value={form.format || "CSV"} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                <option value="CSV">CSV</option>
                <option value="PDF">PDF</option>
              </select>
            </label>
            <Button type="submit">Download {form.format || "CSV"}</Button>
          </form>
        </ActionModal>
      </div>
    </PageContainer>
  );
}