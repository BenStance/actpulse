// src/pages/shared/EquipmentDetails.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BatteryCharging,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  FileBarChart,
  Fuel,
  Gauge,
  History,
  Info,
  Info as InfoIcon,
  MapPin,
  Power,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  Timer,
  Wrench,
  Zap,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import { equipmentApi } from "../../api/actPulse.Api";
import { getSocket } from "../../components/realtime/socket";
import { useAuthStore } from "../../store/auth.store";
import { useThemeContext } from "../../context/ThemeContext";
import { formatDate } from "../../utils/formatDate";

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900";
const cardPad = `${card} p-5`;
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const hours = (ms) => (ms == null ? "—" : (ms / 3600000).toFixed(2));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function stateStyle(state) {
  const s = String(state || "").toUpperCase();
  if (s === "ON")
    return {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
      dot: "bg-emerald-500",
      label: "ON",
    };
  if (s === "OFF")
    return {
      pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      dot: "bg-slate-400",
      label: "OFF",
    };
  return {
    pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    dot: "bg-amber-500",
    label: "UNKNOWN",
  };
}

function connectivityStyle(state) {
  const s = String(state || "").toUpperCase();
  if (s === "ONLINE")
    return {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
      icon: Radio,
    };
  if (s === "OFFLINE")
    return {
      pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
      icon: ShieldAlert,
    };
  return {
    pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    icon: ShieldAlert,
  };
}

function typePill(type) {
  if (type === "GENERATOR")
    return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30";
  if (type === "UPS")
    return "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30";
  return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

const DEFINITION_TEXT = {
  OUTPUT_POWER_PRESENT: "Output power present",
  ENGINE_RUNNING: "Engine running",
};

/* ================================================================== */
/*  EquipmentDetails                                                  */
/* ================================================================== */
export default function EquipmentDetails() {
  const { id } = useParams();
  const admin = useAuthStore((state) => state.user?.role === "Admin" || state.user?.role === "ADMIN");
  const base = admin ? "/admin" : "/controller";
  const { darkMode } = useThemeContext();

  const [record, setRecord] = useState(null);
  const [preset, setPreset] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [events, setEvents] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /* ---------------- load ---------------- */
  const load = useCallback(
    async (opts = {}) => {
      const p = opts.preset ?? preset;
      const f = opts.from ?? from;
      const t = opts.to ?? to;
      const evPage = opts.page ?? page;
      setLoading(true);
      setError("");
      try {
        const params =
          p === "custom"
            ? {
                from: new Date(f).toISOString(),
                to: new Date(t).toISOString(),
              }
            : { preset: p };
        const { data } = await equipmentApi.detail(id, params);
        setRecord(data);
        const eventResponse = await equipmentApi.events(id, {
          from: data.metrics.period.from,
          to: data.metrics.period.to,
          timezone: data.metrics.timezone,
          page: evPage,
          pageSize: 20,
        });
        setEvents(eventResponse.data);
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            "Could not load equipment details."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, preset, from, to, page]
  );

  /* ---------------- initial + preset changes ---------------- */
  useEffect(() => {
    if (preset === "custom" && (!from || !to)) return undefined;
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, preset, from, to]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = (payload) => {
      if (payload?.equipmentId === id) void load();
    };
    socket.on("equipment.state.updated", refresh);
    socket.on("monitor.connection.updated", refresh);
    socket.on("connect", refresh);
    return () => {
      socket.off("equipment.state.updated", refresh);
      socket.off("monitor.connection.updated", refresh);
      socket.off("connect", refresh);
    };
  }, [id, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load();
  };

  /* ---------------- derived ---------------- */
  const metrics = record?.metrics;
  const snapshot = record?.snapshot;

  const chart = useMemo(
    () =>
      metrics?.daily.map((day) => ({
        day: day.day,
        ON: day.onMs / 3600000,
        OFF: day.offMs / 3600000,
        Unknown: day.unknownMs / 3600000,
      })) || [],
    [metrics]
  );

  const durationLabel =
    record?.monitoringDefinition === "ENGINE_RUNNING"
      ? "Observed engine hours"
      : "Observed output-powered hours";

  const specs = useMemo(
    () =>
      record
        ? [
            ["Asset tag", record.assetTag],
            ["Manufacturer", record.manufacturer],
            ["Model", record.model],
            ["Serial number", record.serialNumber],
            ["Installed", record.installationDate],
            ["Rated kVA", record.ratedCapacityKva],
            ["Fuel type (configured)", record.fuelType],
            ["Tank capacity (configured litres)", record.tankCapacityLitres],
            ["Rated kW", record.ratedCapacityKw],
            ["Battery capacity (Ah)", record.batteryCapacityAh],
            ["Nominal battery voltage", record.nominalBatteryVoltage],
            ["Battery notes", record.batteryNotes],
          ].filter(([, v]) => v != null && v !== "")
        : [],
    [record]
  );

  const axisColor = darkMode ? "#94a3b8" : "#64748b";
  const gridColor = darkMode ? "#1e293b" : "#eef2f7";

  const totalEventsPages = Math.max(
    1,
    Math.ceil((events?.total || 0) / 20)
  );

  /* ---------------- KPI tiles ---------------- */
  const kpis = useMemo(
    () =>
      record
        ? [
            {
              title: "Current state",
              value: snapshot?.state ?? "—",
              icon: Power,
              tone: stateStyle(snapshot?.state).pill,
            },
            {
              title: "Confidence",
              value: snapshot?.confidence ?? "—",
              icon: CheckCircle2,
              tone:
                "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30",
            },
            {
              title: "Monitor",
              value: String(snapshot?.connectivity || "—")
                .replace("_", " ")
                .toLowerCase(),
              icon: Radio,
              tone: connectivityStyle(snapshot?.connectivity).pill,
            },
            {
              title: durationLabel,
              value: hours(metrics?.onMs),
              icon: Zap,
              tone: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
            },
            {
              title: "OFF hours",
              value: hours(metrics?.offMs),
              icon: Timer,
              tone: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
            },
            {
              title: "Unknown hours",
              value: hours(metrics?.unknownMs),
              icon: Info,
              tone: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
            },
            {
              title: "Coverage",
              value:
                metrics?.dataCoverage == null
                  ? "—"
                  : `${(metrics.dataCoverage * 100).toFixed(1)}%`,
              icon: BarChart3,
              tone: "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30",
            },
            {
              title: "Eligible monitoring hours",
              value: hours(metrics?.eligibleMs),
              icon: Clock,
              tone: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
            },
          ]
        : [],
    [record, snapshot, metrics, durationLabel]
  );

  /* ================================================================ */
  return (
    <PageContainer
      title={record?.name || "Equipment"}
      subtitle={
        record
          ? `${record.type} · ${record.site?.name || "Site"} · input: ${
              DEFINITION_TEXT[record.monitoringDefinition] ||
              "Needs classification"
            }`
          : "Monitoring profile"
      }
    >
      <div className="space-y-5">
        {/* ============ BREADCRUMB + LINKS ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <Link
              to={`${base}/equipment`}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#064789] transition-colors hover:bg-[#064789]/5 dark:text-[#8fc7e8] dark:hover:bg-[#427aa1]/10"
            >
              <ArrowLeft size={14} />
              All equipment
            </Link>
            {record?.site && (
              <>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <Link
                  to={`${base}/sites/${record.site.id}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[#064789] transition-colors hover:bg-[#064789]/5 dark:text-[#8fc7e8] dark:hover:bg-[#427aa1]/10"
                >
                  <MapPin size={14} />
                  {record.site.name}
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {record?.type === "GENERATOR" && (
              <Link
                to={`${base}/fuel?equipmentId=${id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
              >
                <Fuel size={13} />
                Fuel
              </Link>
            )}
            <Link
              to={`${base}/maintenance?equipmentId=${id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
            >
              <Wrench size={13} />
              Maintenance
            </Link>
            <Link
              to={`${base}/reports?equipmentId=${id}&siteId=${
                record?.siteId || ""
              }&timezone=${encodeURIComponent(record?.site?.timezone || "")}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
            >
              <FileBarChart size={13} />
              Reports
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              leftIcon={RefreshCw}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* ============ HERO HEADER ============ */}
        {record && (
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 via-white to-[#427aa1]/5 p-5 shadow-sm dark:border-slate-700 dark:from-[#064789]/15 dark:via-slate-900 dark:to-[#427aa1]/10">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-xl font-bold text-white shadow-md">
                {initials(record.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${typePill(
                      record.type
                    )}`}
                  >
                    {record.type === "UNSPECIFIED"
                      ? "Needs classification"
                      : record.type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                      stateStyle(snapshot?.state).pill
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        stateStyle(snapshot?.state).dot
                      }`}
                    />
                    {stateStyle(snapshot?.state).label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                      connectivityStyle(snapshot?.connectivity).pill
                    }`}
                  >
                    {(() => {
                      const I = connectivityStyle(snapshot?.connectivity).icon;
                      return <I size={12} />;
                    })()}
                    {String(snapshot?.connectivity || "")
                      .replace("_", " ")
                      .toLowerCase()}
                  </span>
                  {!record.isActive && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      Archived
                    </span>
                  )}
                </div>
                <h1 className="mt-2 truncate text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {record.name}
                </h1>
                <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                  {record.site?.name || "Site"} ·{" "}
                  {DEFINITION_TEXT[record.monitoringDefinition] ||
                    "Needs classification"}
                  {record.assetTag ? ` · ${record.assetTag}` : ""}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ============ DISCLAIMERS ============ */}
        {record?.type === "UNSPECIFIED" && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              This migrated profile needs Admin classification before its input
              meaning can be stated.
            </p>
          </div>
        )}
        {record && !record.isActive && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <Archive size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Archived equipment. Its linked monitor cannot submit new
              observations; history remains available.
            </p>
          </div>
        )}

        {/* ============ PERIOD SELECTOR ============ */}
        <section className={`${cardPad} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <label className="text-sm">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Period
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                setPage(1);
              }}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  From
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  To
                </span>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
          {metrics && (
            <div className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-1">
              <p className="font-medium">UTC window</p>
              <p className="mt-0.5 truncate">
                {new Date(metrics.period.from).toLocaleString()} –{" "}
                {new Date(metrics.period.to).toLocaleString()}
              </p>
              <p className="mt-0.5">
                Calendar: <strong>{metrics.timezone}</strong>
              </p>
            </div>
          )}
        </section>

        {/* ============ ERROR ============ */}
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
        {loading && !record ? (
          <div className={`${cardPad} flex items-center justify-center py-20`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading equipment profile…
              </p>
            </div>
          </div>
        ) : (
          record && (
            <>
              {/* ============ KPI TILES ============ */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {kpis.map((k) => (
                  <div
                    key={k.title}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {k.title}
                        </p>
                        <p className="mt-1.5 truncate text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {k.value}
                        </p>
                      </div>
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${k.tone}`}
                      >
                        <k.icon size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ============ LAST KNOWN BANNER ============ */}
              {snapshot?.lastKnownStatus &&
                snapshot?.state === "UNKNOWN" && (
                  <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                    <Info
                      size={18}
                      className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                    />
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Last known{" "}
                      <strong>{snapshot.lastKnownStatus}</strong> — monitor{" "}
                      {String(snapshot.connectivity || "").toLowerCase()} — last
                      confirmed{" "}
                      {snapshot.lastConfirmedAt
                        ? new Date(snapshot.lastConfirmedAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                )}

              {/* ============ CHART + PROFILE ============ */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Chart */}
                <section className={cardPad}>
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Daily observed duration
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        ON, OFF and unknown hours stacked per day
                      </p>
                    </div>
                    <BarChart3
                      size={16}
                      className="text-slate-400"
                    />
                  </header>
                  {chart.length === 0 ? (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No observations for this period.
                    </div>
                  ) : (
                    <div className="h-72">
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
                            contentStyle={{
                              backgroundColor: darkMode
                                ? "rgba(15,23,42,0.96)"
                                : "rgba(255,255,255,0.98)",
                              border: `1px solid ${
                                darkMode ? "#334155" : "#e2e8f0"
                              }`,
                              borderRadius: "0.75rem",
                              fontSize: 12,
                              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                            }}
                            labelStyle={{
                              color: darkMode ? "#f8fafc" : "#0f172a",
                              fontWeight: 600,
                            }}
                            formatter={(v) => `${Number(v).toFixed(2)} h`}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11, color: axisColor }}
                            iconType="circle"
                          />
                          <Bar dataKey="ON" stackId="a" fill="#10b981" />
                          <Bar dataKey="OFF" stackId="a" fill="#f97316" />
                          <Bar
                            dataKey="Unknown"
                            stackId="a"
                            fill="#94a3b8"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>

                {/* Profile specs */}
                <section className={cardPad}>
                  <header className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Profile and monitor
                    </h2>
                    <Settings size={16} className="text-slate-400" />
                  </header>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {specs.map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800"
                      >
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {k}
                        </dt>
                        <dd className="truncate text-slate-800 dark:text-slate-100">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                    <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Monitor
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.monitor?.name || "No current monitor"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Last contact
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.lastSeenAt
                          ? new Date(snapshot.lastSeenAt).toLocaleString()
                          : "Never connected"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Last confirmed observation
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.lastConfirmedAt
                          ? new Date(snapshot.lastConfirmedAt).toLocaleString()
                          : "None"}
                      </dd>
                    </div>
                  </dl>

                  {record.description && (
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                      {record.description}
                    </p>
                  )}

                  {record.runningBaseline && (
                    <div className="mt-3 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/30">
                      <Gauge
                        size={18}
                        className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                      />
                      <div className="text-sm text-blue-900 dark:text-blue-200">
                        <p>
                          Opening meter:{" "}
                          <strong>
                            {record.runningBaseline.openingHours} h
                          </strong>{" "}
                          at{" "}
                          {new Date(
                            record.runningBaseline.openingAt
                          ).toLocaleString()}
                          .
                        </p>
                        <p className="mt-1">
                          Observed since baseline:{" "}
                          <strong>
                            {record.runningBaseline.observedEngineHours.toFixed(
                              2
                            )}{" "}
                            h
                          </strong>
                          .
                        </p>
                        <p className="mt-1">
                          Tracked cumulative:{" "}
                          <strong>
                            {record.runningBaseline.trackedCumulativeHours.toFixed(
                              2
                            )}{" "}
                            h
                          </strong>
                          {record.runningBaseline.incomplete
                            ? " (incomplete: unknown gaps)"
                            : ""}
                          .
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* ============ SESSIONS ============ */}
              <section className={cardPad}>
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Observed ON sessions
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      OFF completes a session. A freshness gap interrupts it;
                      no operation is assumed during unknown time.
                    </p>
                  </div>
                  <History size={16} className="text-slate-400" />
                </header>

                {!metrics?.sessions?.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <Activity
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No observed ON sessions in this period.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {metrics.sessions.slice(0, 50).map((session, index) => (
                      <div
                        key={`${session.start}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {new Date(session.start).toLocaleString()}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock size={11} />
                            {hours(session.durationMs)} hours
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {String(session.status || "").toLowerCase()}
                          </span>
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                            {String(session.dataQuality || "").toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ============ EVENTS ============ */}
              <section className={cardPad}>
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Events
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Observations and monitor connectivity changes in this
                      period.
                    </p>
                  </div>
                  <Activity size={16} className="text-slate-400" />
                </header>

                {!events?.items?.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <Activity
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No observations or connectivity events in this period.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.items.map((event) => {
                      const isObs = event.type === "OBSERVATION";
                      const Icon = isObs ? Power : Radio;
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
                                  ? `${event.status} ${String(
                                      event.kind || ""
                                    ).toLowerCase()}`
                                  : `Monitor ${String(
                                      event.status || ""
                                    ).toLowerCase()}`}
                              </p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {new Date(event.at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {String(event.deviceId || "").slice(0, 8)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page <strong>{page}</strong> of {totalEventsPages} ·{" "}
                    {events?.total || 0} events
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      leftIcon={ChevronLeft}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!events || page * 20 >= events.total}
                      onClick={() => setPage(page + 1)}
                      rightIcon={ChevronRight}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )
        )}
      </div>
    </PageContainer>
  );
}