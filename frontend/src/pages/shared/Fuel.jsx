// src/pages/shared/Fuel.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Droplets,
  Edit3,
  Filter,
  Fuel as FuelIcon,
  Gauge,
  Info,
  Plus,
  RefreshCw,
  Scale,
  Settings,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import { equipmentApi, fuelApi, sitesApi } from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";
import { getSocket } from "../../components/realtime/socket";
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

const PAGE_SIZES = [10, 20, 50, 100];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const localDate = (value) => {
  if (!value) return undefined;
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const humanize = (v) =>
  String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function directionStyle(direction) {
  const d = String(direction || "").toUpperCase();
  if (d === "ADDITION")
    return {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
      icon: ArrowUpCircle,
    };
  return {
    pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
    icon: ArrowDownCircle,
  };
}

function reconciliationStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "FINALIZED")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
  if (s === "DRAFT")
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

/* ================================================================== */
/*  Fuel                                                              */
/* ================================================================== */
export default function Fuel({ equipmentId: fixedEquipmentId }) {
  const [searchParams] = useSearchParams();
  const initialEquipmentId =
    fixedEquipmentId || searchParams.get("equipmentId") || "";
  const admin = useAuthStore((state) => state.user?.role === "Admin" || state.user?.role === "ADMIN");
  const userId = useAuthStore((state) => state.user?.id);
  const { darkMode } = useThemeContext();

  const [equipment, setEquipment] = useState([]);
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [equipmentId, setEquipmentId] = useState(initialEquipmentId);
  const [period, setPeriod] = useState({
    preset: "30d",
    from: "",
    to: "",
    timezone: "Africa/Dar_es_Salaam",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState("");
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  const labelDate = (value) => formatDate(value, period.timezone);

  const generators = useMemo(
    () =>
      equipment.filter(
        (row) => row.type === "GENERATOR" && (!siteId || row.siteId === siteId)
      ),
    [equipment, siteId]
  );

  /* ---------------- lookups ---------------- */
  useEffect(() => {
    Promise.all([
      equipmentApi.list({ active: "all", type: "GENERATOR" }),
      sitesApi.list({ active: "all" }),
    ])
      .then(([a, b]) => {
        setEquipment(a.data || []);
        setSites(b.data || []);
        if (!initialEquipmentId && a.data?.length) {
          setEquipmentId((current) => current || a.data[0].id);
        }
      })
      .catch(() => setError("Could not load generator choices."));
  }, [initialEquipmentId]);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    if (
      !equipmentId ||
      (period.preset === "custom" && (!period.from || !period.to))
    ) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = {
        preset: period.preset,
        timezone: period.timezone,
        from:
          period.preset === "custom"
            ? new Date(period.from).toISOString()
            : undefined,
        to:
          period.preset === "custom"
            ? new Date(period.to).toISOString()
            : undefined,
        page,
        pageSize,
      };
      const { data: result } = await fuelApi.overview(equipmentId, params);
      setData(result);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load fuel records."
      );
    } finally {
      setLoading(false);
    }
  }, [equipmentId, period, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = (event) => {
      if (event?.equipmentId === equipmentId) void load();
    };
    socket.on("operations.updated", refresh);
    return () => socket.off("operations.updated", refresh);
  }, [equipmentId, load]);

  /* ---------------- actions ---------------- */
  const open = (kind, initial = {}) => {
    setAction(kind);
    setForm({
      occurredAt: localNow(),
      observedAt: localNow(),
      effectiveFrom: localNow(),
      ...initial,
    });
    setDirty(false);
    setError("");
  };

  const correct = (kind, row) =>
    open("correct", {
      kind,
      id: row.id,
      observedAt: localDate(row.observed_at),
      occurredAt: localDate(row.occurred_at),
      levelLitres: row.level_litres,
      quantityLitres: row.quantity_litres,
      direction: row.direction,
      reason: row.reason,
      method: row.method,
      notes: row.notes,
      supplier: row.supplier,
      reference: row.reference,
      currency: row.currency,
      unitPrice: row.unit_price,
      additionalCost: row.additional_cost,
      correctionReason: "",
    });

  const change = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const close = () => {
    setAction("");
    setDirty(false);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...form };
      for (const key of [
        "observedAt",
        "occurredAt",
        "effectiveFrom",
        "effectiveTo",
      ]) {
        if (payload[key]) payload[key] = new Date(payload[key]).toISOString();
      }
      if (action === "reading") await fuelApi.reading(equipmentId, payload);
      else if (action === "refill") await fuelApi.refill(equipmentId, payload);
      else if (action === "adjustment")
        await fuelApi.adjustment(equipmentId, payload);
      else if (action === "estimate")
        await fuelApi.estimate(equipmentId, payload);
      else if (action === "tank") await fuelApi.configureTank(equipmentId, payload);
      else if (action === "reconcile")
        await fuelApi.reconcile(equipmentId, payload);
      else if (action === "finalize")
        await fuelApi.finalize(form.id, form.note);
      else if (action === "void")
        await fuelApi.voidRecord(form.kind, form.id, form.reason);
      else if (action === "correct")
        await fuelApi.correctRecord(form.kind, form.id, payload);
      close();
      setNotice("Fuel record saved.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not save fuel record."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- derived ---------------- */
  const readings = (data?.readings || []).filter((row) => !row.voided_at);

  // Chronologically sorted for the connected line
  const readingLineData = useMemo(
    () =>
      [...readings]
        .sort(
          (a, b) =>
            new Date(a.observed_at).getTime() -
            new Date(b.observed_at).getTime()
        )
        .map((row) => ({
          x: new Date(row.observed_at).getTime(),
          y: Number(row.level_litres),
          source: row.source,
          time: row.observed_at,
        })),
    [readings]
  );

  const refillPoints = useMemo(
    () =>
      (data?.refills || [])
        .filter((row) => !row.voided_at)
        .map((row) => ({
          x: new Date(row.occurred_at).getTime(),
          y: Number(data?.tank?.capacity_litres || 0),
          source: "Refill marker",
          time: row.occurred_at,
          quantity: row.quantity_litres,
        })),
    [data]
  );

  const axisColor = darkMode ? "#94a3b8" : "#64748b";
  const gridColor = darkMode ? "#1e293b" : "#eef2f7";

  /* ================================================================ */
  return (
    <PageContainer
      title="Fuel"
      subtitle="Manually recorded tank observations, purchases and labelled estimates"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        {!fixedEquipmentId && (
          <section className={card} aria-label="Fuel filters">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <h2 className={sectionTitle}>Filters</h2>
              </div>
            </header>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Site
                </span>
                <select
                  className={selectClass}
                  value={siteId}
                  onChange={(e) => {
                    setSiteId(e.target.value);
                    setEquipmentId("");
                  }}
                >
                  <option value="">All accessible sites</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Generator
                </span>
                <select
                  className={selectClass}
                  value={equipmentId}
                  onChange={(e) => {
                    setEquipmentId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Select generator</option>
                  {generators.map((row) => (
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
                  value={period.preset}
                  onChange={(e) =>
                    setPeriod({ ...period, preset: e.target.value })
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
                value={period.timezone}
                onChange={(e) =>
                  setPeriod({ ...period, timezone: e.target.value })
                }
              />

              {period.preset === "custom" && (
                <>
                  <Input
                    label="From"
                    type="datetime-local"
                    value={period.from}
                    onChange={(e) =>
                      setPeriod({ ...period, from: e.target.value })
                    }
                  />
                  <Input
                    label="To"
                    type="datetime-local"
                    value={period.to}
                    onChange={(e) =>
                      setPeriod({ ...period, to: e.target.value })
                    }
                  />
                </>
              )}
            </div>
          </section>
        )}

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
        {notice && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}

        {/* ============ EMPTY / LOADING ============ */}
        {!equipmentId ? (
          <div className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <FuelIcon size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Select a generator
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Choose a generator above to view its fuel records.
            </p>
          </div>
        ) : loading ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading fuel records…
              </p>
            </div>
          </div>
        ) : !data?.tank ? (
          <div className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/10">
              <Droplets size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {data?.message || "No dedicated tank configured."}
            </p>
            {admin && (
              <Button className="mt-4" onClick={() => open("tank")} leftIcon={Plus}>
                Configure Tank
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* ============ ACTION BAR ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">
                  {data.equipment?.name ||
                    equipment.find((row) => row.id === equipmentId)?.name}
                </span>
                {data.tank?.name ? ` · ${data.tank.name}` : ""} ·{" "}
                {data.tank?.capacity_litres} L capacity
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
                <Button size="sm" onClick={() => open("reading")} leftIcon={Gauge}>
                  Add Reading
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => open("refill")}
                  leftIcon={Droplets}
                >
                  Record Refill
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => open("adjustment")}
                  leftIcon={Scale}
                >
                  Adjustment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => open("reconcile")}
                  leftIcon={Calculator}
                >
                  Reconciliation
                </Button>
                {admin && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => open("estimate")}
                      leftIcon={TrendingDown}
                    >
                      Estimate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        open("tank", {
                          name: data.tank.name,
                          capacityLitres: data.tank.capacity_litres,
                        })
                      }
                      leftIcon={Settings}
                    >
                      Edit Tank
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* ============ KPI TILES ============ */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Latest recorded level</p>
                    <p className="mt-1.5 truncate text-2xl font-bold text-[#064789] dark:text-[#8fc7e8]">
                      {data.latestReading
                        ? `${data.latestReading.level_litres} L`
                        : "No reading"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {data.latestReading
                        ? `${labelDate(data.latestReading.observed_at)} · ${data.latestReading.source}`
                        : "Not live measured"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                    <Gauge size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Purchased / refilled</p>
                    <p className="mt-1.5 truncate text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {data.totals.purchasedLitres} L
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      Recorded in selected period
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Droplets size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Estimated consumption</p>
                    <p className="mt-1.5 truncate text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {data.estimate.estimatedLitres} L
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {data.estimate.limitation}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300">
                    <TrendingDown size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Spending</p>
                    {data.totals.spendingByCurrency.length ? (
                      <div className="mt-1.5 space-y-0.5">
                        {data.totals.spendingByCurrency.map((row) => (
                          <p
                            key={row.currency}
                            className="truncate text-lg font-bold text-slate-800 dark:text-slate-100"
                          >
                            {row.currency} {row.amount}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-2xl font-bold text-slate-400">—</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      By currency
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                    <Wallet size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* ============ LINE + SCATTER CHART ============ */}
            <section className={cardPad}>
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Fuel level trend & refill markers
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Connected line follows recorded readings in time order.
                    Refill markers sit at tank capacity.
                  </p>
                </div>
                <BarChart3 size={16} className="text-slate-400" />
              </header>

              {readingLineData.length === 0 && refillPoints.length === 0 ? (
                <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No readings or refills in this period.
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={readingLineData}
                      margin={{ top: 10, right: 12, bottom: 8, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="fuelLineFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#064789"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#064789"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke={gridColor}
                        strokeDasharray="3 3"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="x"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) =>
                          formatDate(v, period.timezone, true)
                        }
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={false}
                        minTickGap={28}
                      />

                      <YAxis
                        type="number"
                        dataKey="y"
                        unit=" L"
                        tick={{ fontSize: 10, fill: axisColor }}
                        axisLine={false}
                        tickLine={false}
                        domain={[
                          0,
                          (dataMax) =>
                            Math.max(
                              dataMax,
                              Number(data?.tank?.capacity_litres || 0)
                            ),
                        ]}
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
                        labelFormatter={(v) =>
                          new Date(v).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        }
                        formatter={(value, name, props) => {
                          if (name === "Recorded level")
                            return [`${value} L`, "Recorded level"];
                          if (name === "Refill marker")
                            return [
                              `${props.payload?.quantity ?? ""} L refill`,
                              "Refill",
                            ];
                          return [value, name];
                        }}
                      />

                      <Legend
                        wrapperStyle={{ fontSize: 11, color: axisColor }}
                        iconType="circle"
                      />

                      {/* Soft gradient under the line */}
                      <Area
                        type="monotone"
                        dataKey="y"
                        stroke="none"
                        fill="url(#fuelLineFill)"
                        isAnimationActive={false}
                        legendType="none"
                        tooltipType="none"
                      />

                      {/* The interactive connected line */}
                      <Line
                        type="monotone"
                        dataKey="y"
                        name="Recorded level"
                        stroke="#064789"
                        strokeWidth={2.5}
                        dot={{
                          r: 4,
                          strokeWidth: 2,
                          fill: "#064789",
                          stroke: darkMode ? "#0f172a" : "#ffffff",
                        }}
                        activeDot={{
                          r: 6,
                          strokeWidth: 2,
                          fill: "#064789",
                          stroke: darkMode ? "#0f172a" : "#ffffff",
                        }}
                        isAnimationActive
                        animationDuration={700}
                      />

                      {/* Refill markers */}
                      <Scatter
                        name="Refill marker"
                        data={refillPoints}
                        fill="#f97316"
                        shape="diamond"
                        legendType="diamond"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* ============ READINGS + REFILLS ============ */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={cardPad}>
                <header className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Gauge size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Readings
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {data.readings.length} record
                    {data.readings.length !== 1 ? "s" : ""}
                  </span>
                </header>

                {!data.readings.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                    <Gauge
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No readings for this period.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {data.readings.map((row) => {
                      const canEdit =
                        !row.voided_at &&
                        row.source === "MANUAL" &&
                        (admin || row.recorded_by === userId);
                      return (
                        <div
                          key={row.id}
                          className="rounded-xl border border-slate-100 p-3 text-sm transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-100">
                                {row.level_litres} L
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {labelDate(row.observed_at)} · {row.source}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {row.voided_at && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  Voided
                                </span>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => correct("readings", row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Edit3 size={11} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      open("void", {
                                        id: row.id,
                                        kind: "readings",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                  >
                                    <Trash2 size={11} />
                                    Void
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {row.method || "Method not specified"} ·{" "}
                            {row.notes || "No notes"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={cardPad}>
                <header className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Droplets size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Refills
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {data.refills.length} record
                    {data.refills.length !== 1 ? "s" : ""}
                  </span>
                </header>

                {!data.refills.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                    <Droplets
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No refills for this period.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {data.refills.map((row) => {
                      const canEdit =
                        !row.voided_at &&
                        (admin || row.recorded_by === userId);
                      return (
                        <div
                          key={row.id}
                          className="rounded-xl border border-slate-100 p-3 text-sm transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-100">
                                {row.quantity_litres} L
                                {row.currency && (
                                  <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
                                    {row.currency} {row.total_amount}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {labelDate(row.occurred_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {row.voided_at && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  Voided
                                </span>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => correct("refills", row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Edit3 size={11} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      open("void", {
                                        id: row.id,
                                        kind: "refills",
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                  >
                                    <Trash2 size={11} />
                                    Void
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {row.supplier || "Supplier not specified"} ·{" "}
                            {row.reference || "No reference"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* ============ ADJUSTMENTS + RECONCILIATIONS ============ */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className={cardPad}>
                <header className="mb-3 flex items-center gap-2">
                  <Scale size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Adjustments
                  </h2>
                </header>

                {!data.adjustments.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                    <Scale
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No adjustments recorded.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.adjustments.map((row) => {
                      const ds = directionStyle(row.direction);
                      const DIcon = ds.icon;
                      const canEdit =
                        !row.voided_at &&
                        (admin || row.recorded_by === userId);
                      return (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${ds.pill}`}
                            >
                              <DIcon size={14} />
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 dark:text-slate-100">
                                {row.quantity_litres} L
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {row.reason} · {labelDate(row.occurred_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {row.voided_at && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                Voided
                              </span>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => correct("adjustments", row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <Edit3 size={11} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    open("void", {
                                      id: row.id,
                                      kind: "adjustments",
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                >
                                  <Trash2 size={11} />
                                  Void
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className={cardPad}>
                <header className="mb-3 flex items-center gap-2">
                  <Calculator size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Reconciliations
                  </h2>
                </header>

                {!data.reconciliations.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-slate-700">
                    <Calculator
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No drafts or finalized periods.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.reconciliations.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${reconciliationStyle(
                                  row.status
                                )}`}
                              >
                                {humanize(row.status)}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Apparent {row.apparent_usage_litres} L ·
                                Variance {row.variance_litres ?? "—"} L
                              </p>
                            </div>
                            {row.review_flag && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={11} />
                                {row.review_flag}
                              </p>
                            )}
                          </div>
                          {admin && row.status === "DRAFT" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => open("finalize", { id: row.id })}
                            >
                              Review / Finalize
                            </Button>
                          )}
                        </div>
                        <p className="mt-2 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                          Opening {row.opening_litres} + refill{" "}
                          {row.refill_litres} + additions {row.addition_litres} −
                          removals {row.removal_litres} − closing{" "}
                          {row.closing_litres}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* ============ PAGINATION ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {page}
                </strong>{" "}
                · {data.counts?.readings || 0} readings ·{" "}
                {data.counts?.refills || 0} refills
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
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="First page"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(page + 1)}
                    disabled={
                      Math.max(
                        Number(data.counts?.readings || 0),
                        Number(data.counts?.refills || 0)
                      ) <=
                      page * pageSize
                    }
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxPage = Math.max(
                        1,
                        Math.ceil(
                          Math.max(
                            Number(data.counts?.readings || 0),
                            Number(data.counts?.refills || 0)
                          ) / pageSize
                        )
                      );
                      setPage(maxPage);
                    }}
                    disabled={
                      Math.max(
                        Number(data.counts?.readings || 0),
                        Number(data.counts?.refills || 0)
                      ) <=
                      page * pageSize
                    }
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="Last page"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============ ACTION MODAL ============ */}
        <ActionModal
          open={!!action}
          title={
            {
              reading: "Add Fuel Reading",
              refill: "Record Refill",
              adjustment: "Record Fuel Adjustment",
              estimate: "Configure Consumption Estimate",
              tank: "Configure Dedicated Tank",
              reconcile: "Draft Fuel Reconciliation",
              finalize: "Review and Finalize",
              void: "Void Operational Record",
              correct: "Correct Operational Record",
            }[action] || ""
          }
          dirty={dirty}
          onClose={close}
          size="lg"
        >
          <form onSubmit={save} className="space-y-4 text-sm">
            <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              Generator:{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {equipment.find((row) => row.id === equipmentId)?.name ||
                  data?.equipment?.name}
              </strong>{" "}
              ·{" "}
              {action === "estimate"
                ? "Estimated configuration"
                : "Manually recorded"}
            </p>

            {action === "tank" && (
              <>
                <Input
                  label="Tank name"
                  value={form.name || ""}
                  onChange={(e) => change("name", e.target.value)}
                />
                <Input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  label="Capacity (L)"
                  value={form.capacityLitres || ""}
                  onChange={(e) => change("capacityLitres", e.target.value)}
                />
                <Input
                  label="Change reason"
                  value={form.reason || ""}
                  onChange={(e) => change("reason", e.target.value)}
                />
              </>
            )}

            {(action === "reading" ||
              (action === "correct" && form.kind === "readings")) && (
              <>
                <Input
                  required
                  type="datetime-local"
                  label="Reading time"
                  value={form.observedAt || ""}
                  onChange={(e) => change("observedAt", e.target.value)}
                />
                <Input
                  required
                  type="number"
                  min="0"
                  max={data?.tank?.capacity_litres}
                  step="0.001"
                  label="Fuel level (L)"
                  value={form.levelLitres || ""}
                  onChange={(e) => change("levelLitres", e.target.value)}
                />
                <Input
                  label="Measurement method"
                  value={form.method || ""}
                  onChange={(e) => change("method", e.target.value)}
                />
                <Input
                  label="Notes"
                  value={form.notes || ""}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </>
            )}

            {(action === "refill" ||
              (action === "correct" && form.kind === "refills")) && (
              <>
                <Input
                  required
                  type="datetime-local"
                  label="Refill time"
                  value={form.occurredAt || ""}
                  onChange={(e) => change("occurredAt", e.target.value)}
                />
                <Input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  label="Quantity (L)"
                  value={form.quantityLitres || ""}
                  onChange={(e) => change("quantityLitres", e.target.value)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Unit price per litre"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.unitPrice || ""}
                    onChange={(e) => change("unitPrice", e.target.value)}
                  />
                  <Input
                    label="Currency (ISO code)"
                    value={form.currency || "TZS"}
                    onChange={(e) =>
                      change("currency", e.target.value.toUpperCase())
                    }
                  />
                </div>
                <Input
                  label="Additional costs"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.additionalCost || ""}
                  onChange={(e) => change("additionalCost", e.target.value)}
                />
                <Input
                  label="Supplier"
                  value={form.supplier || ""}
                  onChange={(e) => change("supplier", e.target.value)}
                />
                <Input
                  label="Receipt / reference"
                  value={form.reference || ""}
                  onChange={(e) => change("reference", e.target.value)}
                />
                <Input
                  label="Notes"
                  value={form.notes || ""}
                  onChange={(e) => change("notes", e.target.value)}
                />
                <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Purchase cost is quantity × unit price plus additional cost.
                  A refill does not create a tank reading.
                </p>
              </>
            )}

            {(action === "adjustment" ||
              (action === "correct" && form.kind === "adjustments")) && (
              <>
                <Input
                  required
                  type="datetime-local"
                  label="Adjustment time"
                  value={form.occurredAt || ""}
                  onChange={(e) => change("occurredAt", e.target.value)}
                />
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Direction
                  </span>
                  <select
                    className={selectClass}
                    value={form.direction || "ADDITION"}
                    onChange={(e) => change("direction", e.target.value)}
                  >
                    <option value="ADDITION">Addition</option>
                    <option value="REMOVAL">Removal</option>
                  </select>
                </label>
                <Input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  label="Quantity (L)"
                  value={form.quantityLitres || ""}
                  onChange={(e) => change("quantityLitres", e.target.value)}
                />
                <Input
                  required
                  label="Reason"
                  value={form.reason || ""}
                  onChange={(e) => change("reason", e.target.value)}
                />
                <Input
                  label="Reference"
                  value={form.reference || ""}
                  onChange={(e) => change("reference", e.target.value)}
                />
              </>
            )}

            {action === "estimate" && (
              <>
                <Input
                  required
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  label="Estimated litres per observed hour"
                  value={form.litresPerHour || ""}
                  onChange={(e) => change("litresPerHour", e.target.value)}
                />
                <Input
                  required
                  type="datetime-local"
                  label="Effective from"
                  value={form.effectiveFrom || ""}
                  onChange={(e) => change("effectiveFrom", e.target.value)}
                />
                <Input
                  type="datetime-local"
                  label="Effective to (optional)"
                  value={form.effectiveTo || ""}
                  onChange={(e) => change("effectiveTo", e.target.value)}
                />
                <Input
                  required
                  label="Basis / methodology"
                  value={form.basis || ""}
                  onChange={(e) => change("basis", e.target.value)}
                />
                <p className="flex gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  This is a fixed-rate estimate. Unknown monitoring time
                  contributes no estimated fuel.
                </p>
              </>
            )}

            {action === "reconcile" && (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Opening reading
                  </span>
                  <select
                    required
                    className={selectClass}
                    value={form.openingReadingId || ""}
                    onChange={(e) =>
                      change("openingReadingId", e.target.value)
                    }
                  >
                    <option value="">Select reading</option>
                    {readings.map((row) => (
                      <option key={row.id} value={row.id}>
                        {labelDate(row.observed_at)} · {row.level_litres} L
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Closing reading
                  </span>
                  <select
                    required
                    className={selectClass}
                    value={form.closingReadingId || ""}
                    onChange={(e) =>
                      change("closingReadingId", e.target.value)
                    }
                  >
                    <option value="">Select reading</option>
                    {readings.map((row) => (
                      <option key={row.id} value={row.id}>
                        {labelDate(row.observed_at)} · {row.level_litres} L
                      </option>
                    ))}
                  </select>
                </label>
                <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Movements after opening and before closing are included.
                  Apparent usage can be negative and will be flagged for
                  review.
                </p>
              </>
            )}

            {action === "finalize" && (
              <>
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                  Finalization confirms review and freezes this period's source
                  records.
                </p>
                <Input
                  required
                  label="Review note"
                  value={form.note || ""}
                  onChange={(e) => change("note", e.target.value)}
                />
              </>
            )}

            {action === "correct" && (
              <Input
                required
                label="Correction reason"
                value={form.correctionReason || ""}
                onChange={(e) =>
                  change("correctionReason", e.target.value)
                }
              />
            )}

            {action === "void" && (
              <>
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                  The original record remains in history and will be marked
                  void.
                </p>
                <Input
                  required
                  label="Correction reason"
                  value={form.reason || ""}
                  onChange={(e) => change("reason", e.target.value)}
                />
              </>
            )}

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                <AlertTriangle size={14} />
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={busy}
                variant={action === "void" ? "danger" : "primary"}
              >
                {action === "void"
                  ? "Void Record"
                  : action === "correct"
                    ? "Save Correction"
                    : action === "finalize"
                      ? "Finalize"
                      : "Save"}
              </Button>
            </div>
          </form>
        </ActionModal>
      </div>
    </PageContainer>
  );
}