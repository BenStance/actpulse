// src/pages/shared/MonitoringDashboard.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  Droplets,
  Filter,
  Gauge,
  MapPin,
  Power,
  Radio,
  RefreshCw,
  TrendingUp,
  Wallet,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import {
  dashboardApi,
  equipmentApi,
  organizationsApi,
  sitesApi,
} from "../../api/actPulse.Api";
import DashboardQuickActions from "./DashboardQuickActions";
import { connectSocket } from "../../components/realtime/socket";
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

const CHART_PALETTE = [
  "#064789",
  "#427aa1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

const hours = (ms) => (ms == null ? "—" : (Number(ms) / 3600000).toFixed(2));

/* ------------------------------------------------------------------ */
/*  Chart theme                                                       */
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
    },
  };
}

function ChartShell({ title, subtitle, children, height = 280 }) {
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
  danger: {
    ring: "ring-rose-500/20",
    bg: "from-rose-500/5 to-rose-500/0 dark:from-rose-500/10 dark:to-transparent",
    value: "text-rose-600 dark:text-rose-400",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
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
/*  MonitoringDashboard                                               */
/* ================================================================== */
export default function MonitoringDashboard() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const admin = user?.role === "Admin" || user?.role === "ADMIN";
  const base = admin ? "/admin" : "/controller";

  const [filters, setFilters] = useState({
    organizationId: "",
    siteId: "",
    type: "",
    equipmentId: "",
    preset: "7d",
    timezone: "Africa/Dar_es_Salaam",
    from: "",
    to: "",
  });

  const [equipmentOptions, setEquipmentOptions] = useState([]);
  const [sites, setSites] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [socketState, setSocketState] = useState("Disconnected");

  const { darkMode } = useChartTheme();

  const dateLabel = (value, dateOnly = false) =>
    formatDate(value, filters.timezone, dateOnly);

  /* ---------------- lookups ---------------- */
  useEffect(() => {
    sitesApi
      .list({ active: "all" })
      .then(({ data: rows }) => setSites(rows || []))
      .catch(() => undefined);
    equipmentApi
      .list({ active: "all" })
      .then(({ data: rows }) => setEquipmentOptions(rows || []))
      .catch(() => undefined);
    if (admin) {
      organizationsApi
        .list()
        .then(({ data: rows }) => setOrganizations(rows || []))
        .catch(() => undefined);
    }
  }, [admin]);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    if (filters.preset === "custom" && (!filters.from || !filters.to)) return;
    setLoading(true);
    setError("");
    try {
      const params = {
        ...filters,
        from:
          filters.preset === "custom"
            ? new Date(filters.from).toISOString()
            : undefined,
        to:
          filters.preset === "custom"
            ? new Date(filters.to).toISOString()
            : undefined,
      };
      const { data: result } = await dashboardApi.overview(params);
      setData(result);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load monitoring snapshot."
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const socket = connectSocket(token);
    if (!socket) return undefined;
    const initialTimer = setTimeout(
      () => setSocketState(socket.connected ? "Connected" : "Reconnecting"),
      0
    );
    const connected = () => {
      setSocketState("Connected");
      void load();
    };
    const disconnected = () => setSocketState("Disconnected");
    const reconnecting = () => setSocketState("Reconnecting");
    const refreshed = () => void load();

    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    socket.on("equipment.state.updated", refreshed);
    socket.on("monitor.connection.updated", refreshed);
    socket.on("operations.updated", refreshed);
    socket.on("alerts.updated", refreshed);
    socket.io.on("reconnect_attempt", reconnecting);

    return () => {
      clearTimeout(initialTimer);
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
      socket.off("equipment.state.updated", refreshed);
      socket.off("monitor.connection.updated", refreshed);
      socket.off("operations.updated", refreshed);
      socket.off("alerts.updated", refreshed);
      socket.io.off("reconnect_attempt", reconnecting);
    };
  }, [token, load]);

  /* ---------------- derived ---------------- */
  const summary = data?.summary;
  const operational = data?.operational;

  const chart = useMemo(
    () =>
      data?.daily?.map((day) => ({
        day: day.day,
        ON: day.onMs / 3600000,
        OFF: day.offMs / 3600000,
        Unknown: day.unknownMs / 3600000,
      })) || [],
    [data]
  );

  const statePie = summary
    ? [
        { name: "Known ON", value: summary.knownOn, color: "#10b981" },
        { name: "Known OFF", value: summary.knownOff, color: "#94a3b8" },
        { name: "Unknown", value: summary.unknownState, color: "#f59e0b" },
      ]
    : [];

  const connectionPie = summary
    ? [
        { name: "Online", value: summary.onlineMonitors, color: "#10b981" },
        { name: "Offline", value: summary.offlineMonitors, color: "#ef4444" },
        {
          name: "Never connected",
          value: summary.neverConnectedMonitors,
          color: "#94a3b8",
        },
      ]
    : [];

  const fuelPoints = useMemo(
    () =>
      data?.fuelSeries?.map((row) => ({
        x: new Date(row.at).getTime(),
        y: Number(row.level_litres),
        source: row.source,
      })) || [],
    [data]
  );

  const refillPoints = useMemo(
    () =>
      data?.refillMarkers?.map((row) => ({
        x: new Date(row.at).getTime(),
        y: 0,
        source: "Refill marker",
      })) || [],
    [data]
  );

  const usageChart = operational
    ? [
        {
          name: "Period totals",
          Apparent: Number(operational.apparentUsageLitres),
          Estimated: Number(operational.estimatedLitres),
        },
      ]
    : [];

  const costDays = [...new Set(data?.costTrend?.map((row) => row.day) || [])];
  const costChart = costDays.map((day) => ({
    day,
    ...Object.fromEntries(
      (data?.costTrend || [])
        .filter((row) => row.day === day)
        .map((row) => [row.currency, Number(row.amount)])
    ),
  }));

  const axisColor = darkMode ? "#94a3b8" : "#64748b";
  const gridColor = darkMode ? "#1e293b" : "#eef2f7";
  const tooltipStyle = {
    backgroundColor: darkMode ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.98)",
    border: `1px solid ${darkMode ? "#334155" : "#e2e8f0"}`,
    borderRadius: "0.75rem",
    fontSize: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  };
  const labelStyle = {
    color: darkMode ? "#f8fafc" : "#0f172a",
    fontWeight: 600,
  };

  const socketTone =
    socketState === "Connected"
      ? "success"
      : socketState === "Disconnected"
        ? "danger"
        : "warning";

  /* ================================================================ */
  return (
    <PageContainer
      title={admin ? "Admin Dashboard" : "Controller Dashboard"}
      subtitle="Observed equipment state, connectivity and measured duration"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Dashboard filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              leftIcon={RefreshCw}
            >
              Refresh
            </Button>
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
                  <option value="">All organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
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
                  const site = sites.find((row) => row.id === e.target.value);
                  setFilters({
                    ...filters,
                    siteId: e.target.value,
                    equipmentId: "",
                    timezone: site?.timezone || filters.timezone,
                  });
                }}
              >
                <option value="">All sites</option>
                {sites
                  .filter(
                    (site) =>
                      !filters.organizationId ||
                      site.organizationId === filters.organizationId
                  )
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
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
                <option value="">All</option>
                <option value="GENERATOR">Generator</option>
                <option value="UPS">UPS</option>
                <option value="UNSPECIFIED">Needs classification</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Equipment
              </span>
              <select
                className={selectClass}
                value={filters.equipmentId}
                onChange={(e) =>
                  setFilters({ ...filters, equipmentId: e.target.value })
                }
              >
                <option value="">All accessible</option>
                {equipmentOptions
                  .filter(
                    (row) =>
                      (!filters.siteId || row.siteId === filters.siteId) &&
                      (!filters.organizationId ||
                        row.organizationId === filters.organizationId) &&
                      (!filters.type || row.type === filters.type)
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

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Reporting timezone
              </span>
              <input
                className={selectClass}
                value={filters.timezone}
                onChange={(e) =>
                  setFilters({ ...filters, timezone: e.target.value })
                }
              />
            </label>

            {filters.preset === "custom" && (
              <>
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    From
                  </span>
                  <input
                    type="datetime-local"
                    className={selectClass}
                    value={filters.from}
                    onChange={(e) =>
                      setFilters({ ...filters, from: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    To
                  </span>
                  <input
                    type="datetime-local"
                    className={selectClass}
                    value={filters.to}
                    onChange={(e) =>
                      setFilters({ ...filters, to: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </div>
        </section>

        {/* ============ QUICK ACTIONS ============ */}
        <DashboardQuickActions
          equipment={data?.comparison || []}
          filters={filters}
          onSaved={load}
        />

        {/* ============ STATUS BAR ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                socketTone === "success"
                  ? "bg-emerald-500"
                  : socketTone === "danger"
                    ? "bg-rose-500"
                    : "bg-amber-500"
              }`}
            />
            WebSocket: {socketState}
          </span>
          {data && (
            <span className="truncate">
              UTC window {dateLabel(data.period.from)} –{" "}
              {dateLabel(data.period.to)} · calendar {data.period.timezone}
            </span>
          )}
        </div>

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
        {loading && !data ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading monitoring data…
              </p>
            </div>
          </div>
        ) : (
          data && (
            <>
              {/* ============ PRIMARY CUES ============ */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Cue
                  title="Equipment"
                  value={summary.totalEquipment}
                  icon={Cpu}
                  tone="brand"
                />
                <Cue
                  title="Known ON"
                  value={summary.knownOn}
                  icon={Power}
                  tone="success"
                />
                <Cue
                  title="Known OFF"
                  value={summary.knownOff}
                  icon={Power}
                  tone="neutral"
                />
                <Cue
                  title="Unknown state"
                  value={summary.unknownState}
                  icon={AlertTriangle}
                  tone="warning"
                />
                <Cue
                  title="Online monitors"
                  value={summary.onlineMonitors}
                  icon={Wifi}
                  tone="success"
                />
                <Cue
                  title="Offline monitors"
                  value={summary.offlineMonitors}
                  icon={WifiOff}
                  tone="danger"
                />
                <Cue
                  title="Never connected"
                  value={summary.neverConnectedMonitors}
                  icon={WifiOff}
                  tone="neutral"
                />
                <Cue
                  title="ON equipment-hours"
                  value={summary.onEquipmentHours.toFixed(2)}
                  icon={Zap}
                  tone="brand"
                />
                <Cue
                  title="Unknown equipment-hours"
                  value={summary.unknownEquipmentHours.toFixed(2)}
                  icon={AlertTriangle}
                  tone="warning"
                />
                <Cue
                  title="Data coverage"
                  value={
                    summary.dataCoverage == null
                      ? "—"
                      : `${(summary.dataCoverage * 100).toFixed(1)}%`
                  }
                  icon={Gauge}
                  tone="brand"
                />
              </div>

              {/* ============ OPERATIONAL CUES ============ */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Cue
                  title="Organizations"
                  value={operational.organizations}
                  icon={MapPin}
                  tone="brand"
                />
                <Cue
                  title="Sites"
                  value={operational.sites}
                  icon={MapPin}
                  tone="brand"
                />
                <Cue
                  title="Purchased fuel"
                  value={`${operational.purchasedLitres} L`}
                  icon={Droplets}
                  tone="success"
                />
                <Cue
                  title="Finalized apparent usage"
                  value={`${operational.apparentUsageLitres} L`}
                  icon={Droplets}
                  tone="neutral"
                />
                <Cue
                  title="Estimated consumption"
                  value={`${operational.estimatedLitres} L`}
                  icon={TrendingUp}
                  tone="brand"
                />
                <Cue
                  title="Maintenance due"
                  value={operational.maintenanceDue}
                  icon={CalendarClock}
                  tone="warning"
                />
                <Cue
                  title="Maintenance overdue"
                  value={operational.maintenanceOverdue}
                  icon={AlertOctagon}
                  tone="danger"
                />
                <Cue
                  title="Open alerts"
                  value={operational.openAlerts}
                  icon={Bell}
                  tone="danger"
                />
              </div>

              {/* ============ SPENDING ============ */}
              {operational?.spendingByCurrency?.length > 0 && (
                <section className={cardPad}>
                  <header className="mb-3 flex items-center gap-2">
                    <Wallet size={16} className="text-slate-400" />
                    <h2 className={sectionTitle}>
                      Recorded fuel purchases by currency
                    </h2>
                  </header>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {operational.spendingByCurrency.map((row, i) => (
                      <div
                        key={row.currency}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <p className={sectionTitle}>{row.currency}</p>
                        <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                          {row.amount}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {row.litres} L
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ============ DISCLAIMER ============ */}
              <p className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                <Activity size={14} className="mt-0.5 shrink-0" />
                ON/OFF describe the configured input, not equipment
                availability. Unknown time is excluded from ON share and never
                counted as OFF.
              </p>

              {/* ============ OBSERVED DURATION ============ */}
              <section className={cardPad}>
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Daily ON / OFF / unknown hours
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Stacked durations per calendar day
                    </p>
                  </div>
                  <BarChart3 size={16} className="text-slate-400" />
                </header>
                {chart.length === 0 ? (
                  <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No daily durations in this period.
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chart}
                        margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          stroke={gridColor}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: axisColor }}
                          axisLine={{ stroke: gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={labelStyle}
                          formatter={(value) => `${Number(value).toFixed(2)} h`}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: axisColor }}
                          iconType="circle"
                        />
                        <Bar dataKey="ON" stackId="a" fill="#10b981" />
                        <Bar dataKey="OFF" stackId="a" fill="#94a3b8" />
                        <Bar
                          dataKey="Unknown"
                          stackId="a"
                          fill="#f59e0b"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* ============ STATE + CONNECTIVITY DONUTS ============ */}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className={cardPad}>
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Current observation
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Known ON / OFF / unknown state
                      </p>
                    </div>
                    <Power size={16} className="text-slate-400" />
                  </header>
                  {statePie.every((p) => !p.value) ? (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No state data.
                    </div>
                  ) : (
                    <div className="relative h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statePie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="58%"
                            outerRadius="85%"
                            paddingAngle={3}
                            cornerRadius={6}
                            stroke="none"
                          >
                            {statePie.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            labelStyle={labelStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                          {summary.totalEquipment}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          equipment
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {statePie.map((item) => (
                      <span
                        key={item.name}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name} · {item.value}
                      </span>
                    ))}
                  </div>
                </section>

                <section className={cardPad}>
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Monitor connectivity
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Online, offline and never connected
                      </p>
                    </div>
                    <Radio size={16} className="text-slate-400" />
                  </header>
                  {connectionPie.every((p) => !p.value) ? (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No connectivity data.
                    </div>
                  ) : (
                    <div className="relative h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={connectionPie}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="58%"
                            outerRadius="85%"
                            paddingAngle={3}
                            cornerRadius={6}
                            stroke="none"
                          >
                            {connectionPie.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            labelStyle={labelStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                          {summary.onlineMonitors +
                            summary.offlineMonitors +
                            summary.neverConnectedMonitors}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          monitors
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {connectionPie.map((item) => (
                      <span
                        key={item.name}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name} · {item.value}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              {/* ============ FUEL LEVELS + USAGE ============ */}
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartShell
                  title="Recorded fuel levels & refill times"
                  subtitle="Discrete readings; gaps are not interpolated. Refill markers at capacity."
                  height={280}
                >
                  {fuelPoints.length === 0 && refillPoints.length === 0 ? (
                    <EmptyChart message="No readings or refills in this period." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                        <CartesianGrid
                          stroke={gridColor}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="x"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v) => dateLabel(v, true)}
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={{ stroke: gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          dataKey="y"
                          type="number"
                          unit=" L"
                          tick={{ fontSize: 10, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={labelStyle}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: axisColor }}
                          iconType="circle"
                        />
                        <Scatter
                          data={fuelPoints}
                          fill="#064789"
                          name="Reading"
                        />
                        <Scatter
                          data={refillPoints}
                          fill="#f97316"
                          name="Refill"
                          shape="diamond"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </ChartShell>

                <ChartShell
                  title="Apparent vs estimated fuel usage"
                  subtitle="Apparent usage uses finalized reconciliations; estimated uses configured rates on observed hours. Separate methods."
                  height={280}
                >
                  {usageChart.length === 0 ? (
                    <EmptyChart message="No usage data in this period." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={usageChart}
                        margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          stroke={gridColor}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: axisColor }}
                          axisLine={{ stroke: gridColor }}
                          tickLine={false}
                        />
                        <YAxis
                          unit=" L"
                          tick={{ fontSize: 11, fill: axisColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          labelStyle={labelStyle}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, color: axisColor }}
                          iconType="circle"
                        />
                        <Bar
                          dataKey="Apparent"
                          fill="#064789"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={70}
                        />
                        <Bar
                          dataKey="Estimated"
                          fill="#427aa1"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={70}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartShell>
              </div>

              {/* ============ COST TREND ============ */}
              <ChartShell
                title="Recorded purchase cost trend"
                subtitle="Amounts are grouped by currency; currencies are never added together."
                height={320}
              >
                {costChart.length === 0 ? (
                  <EmptyChart message="No purchase cost data in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={costChart}
                      margin={{ top: 5, right: 8, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        stroke={gridColor}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={labelStyle}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: axisColor }}
                        iconType="circle"
                      />
                      {(operational?.spendingByCurrency || []).map(
                        (row, index) => (
                          <Bar
                            key={row.currency}
                            dataKey={row.currency}
                            fill={
                              CHART_PALETTE[index % CHART_PALETTE.length]
                            }
                            radius={[6, 6, 0, 0]}
                            maxBarSize={42}
                          />
                        )
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartShell>

              {/* ============ RECENT EVENTS ============ */}
              <section className={cardPad}>
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Recent events
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Latest observations and monitor connectivity changes
                    </p>
                  </div>
                  <Activity size={16} className="text-slate-400" />
                </header>
                {data.activity.length === 0 ? (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No events in this period.
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {data.activity.map((item) => {
                      const isObs = item.type === "OBSERVATION";
                      const isOp = item.type === "OPERATION";
                      const Icon = isObs ? Zap : isOp ? Activity : Radio;
                      const tone = isObs
                        ? item.status === "ON"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        : isOp
                          ? "bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]"
                          : item.status === "ONLINE"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
                          >
                            <Icon size={14} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {item.equipmentName} ·{" "}
                              {isObs
                                ? `${item.status} ${item.kind.toLowerCase()}`
                                : isOp
                                  ? `${item.status.replaceAll("_", " ").toLowerCase()} · ${item.kind.toLowerCase()}`
                                  : `monitor ${item.status.toLowerCase()}`}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {dateLabel(item.at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ============ EQUIPMENT COMPARISON ============ */}
              <section className={card}>
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Equipment comparison
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {data.comparison.length}
                    </span>
                  </div>
                </header>

                {data.comparison.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Cpu size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No assigned equipment matches these filters
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1200px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Equipment / site</th>
                          <th className="p-3">Current / monitor</th>
                          <th className="p-3">Observed ON h</th>
                          <th className="p-3">Coverage</th>
                          <th className="p-3">Latest fuel level</th>
                          <th className="p-3">Purchased</th>
                          <th className="p-3">Apparent usage</th>
                          <th className="p-3">Maintenance</th>
                          <th className="p-3">Open alerts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.comparison.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className={tableCell}>
                              <div className="min-w-0">
                                <Link
                                  to={`${base}/equipment/${row.id}`}
                                  className="truncate font-medium text-[#064789] underline-offset-2 hover:underline dark:text-[#8fc7e8]"
                                >
                                  {row.name}
                                </Link>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.site.name} · {row.type}
                                </p>
                              </div>
                            </td>
                            <td className={tableCell}>
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    row.snapshot.state === "ON"
                                      ? "bg-emerald-500"
                                      : row.snapshot.state === "OFF"
                                        ? "bg-slate-400"
                                        : "bg-amber-500"
                                  }`}
                                />
                                {row.snapshot.state} / {row.snapshot.connectivity}
                              </span>
                            </td>
                            <td className={tableCell}>{hours(row.onMs)}</td>
                            <td className={tableCell}>
                              {row.coverage == null
                                ? "—"
                                : `${(row.coverage * 100).toFixed(1)}%`}
                            </td>
                            <td className={tableCell}>
                              {row.latestFuelReading
                                ? `${row.latestFuelReading.level_litres} L · ${row.latestFuelReading.source} · ${dateLabel(row.latestFuelReading.observed_at)}`
                                : "—"}
                            </td>
                            <td className={tableCell}>
                              {row.type === "GENERATOR"
                                ? `${row.purchasedLitres || "0"} L`
                                : "—"}
                            </td>
                            <td className={tableCell}>
                              {row.apparentUsageLitres == null
                                ? "—"
                                : `${row.apparentUsageLitres} L`}
                            </td>
                            <td className={tableCell}>
                              {row.maintenanceStatus || "—"}
                            </td>
                            <td className={tableCell}>
                              {row.openAlertCount || 0}
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