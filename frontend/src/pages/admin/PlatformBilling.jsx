// src/pages/admin/PlatformBilling.jsx
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
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  FileText,
  Filter,
  KeyRound,
  Layers,
  Pause,
  PlayCircle,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
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
  organizationsApi,
  subscriptionApi,
} from "../../api/actPulse.Api";
import { formatDate } from "../../utils/formatDate";
import { useThemeContext } from "../../context/ThemeContext";
import BillingWorkspace from "../shared/BillingWorkspace";

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

const featureLabels = {
  live_monitoring: "Live monitoring",
  fuel_records: "Fuel records",
  fuel_estimates: "Fuel estimates",
  fuel_costs_reconciliation: "Fuel costs & reconciliation",
  maintenance: "Maintenance",
  advanced_reports: "Advanced reports",
  pdf_export: "PDF export",
  fleet_analytics: "Fleet analytics",
};

const emptyPlan = {
  code: "",
  name: "",
  description: "",
  monthlyPrice: "",
  quarterlyPrice: "",
  annualPrice: "",
  currency: "TZS",
  siteLimit: 1,
  equipmentLimit: 1,
  controllerLimit: 1,
  displayOrder: 10,
  features: { live_monitoring: true },
  isActive: true,
  allowExistingRenewals: false,
  reason: "",
};

const TABS = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "plans", label: "Subscription Plans", icon: Layers },
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "reviews", label: "Payment Review", icon: Receipt },
  { id: "instructions", label: "Payment Instructions", icon: Banknote },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
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

/* --- 1. Bar --- */
function BarChartCard({ title, subtitle, data, xKey, series, height = 280 }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) =>
    series.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues)
    return (
      <ChartShell title={title} subtitle={subtitle} height={height}>
        <EmptyChart />
      </ChartShell>
    );
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
          <Tooltip contentStyle={t.tooltipStyle} labelStyle={t.labelStyle} />
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

/* --- 2. Area --- */
function AreaChartCard({ title, subtitle, data, xKey, series, height = 280 }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) =>
    series.some(([key]) => Number(row[key]) !== 0)
  );
  if (!hasValues)
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
              <linearGradient key={key} id={`area-${key}`} x1="0" y1="0" x2="0" y2="1">
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

/* --- 3. Composed (bar + line) --- */
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
  if (!hasValues)
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

/* --- 4. Donut --- */
function DonutChartCard({ title, subtitle, data, centerLabel, height = 280 }) {
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

/* --- 5. Radial --- */
function RadialChartCard({
  title,
  subtitle,
  value,
  max = 100,
  color = "#064789",
  unit = "%",
  height = 280,
}) {
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
/*  KPI tile                                                          */
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

function Cue({ title, value, note, tone = "brand", icon: Icon, to }) {
  const t = TILE_TONES[tone] || TILE_TONES.brand;
  const inner = (
    <>
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
    </>
  );
  const base = `relative block overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${t.bg} p-4 shadow-sm ring-1 ring-inset ${t.ring} transition-all duration-200 dark:border-slate-700`;
  return <div className={base}>{inner}</div>;
}

/* ================================================================== */
/*  PlatformBilling                                                   */
/* ================================================================== */
export default function PlatformBilling() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "overview");
  const [orgId, setOrgId] = useState(searchParams.get("organizationId") || "");
  const [organizations, setOrganizations] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [instructions, setInstructions] = useState([]);
  const [status, setStatus] = useState(null);
  const [statsFrom, setStatsFrom] = useState("");
  const [statsTo, setStatsTo] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("");
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reviewStatus, setReviewStatus] = useState("PENDING_REVIEW");

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const period = {
        from: statsFrom
          ? new Date(`${statsFrom}T00:00:00`).toISOString()
          : undefined,
        to: statsTo
          ? new Date(
              new Date(`${statsTo}T00:00:00`).getTime() + 86400000
            ).toISOString()
          : undefined,
      };
      const [o, s, p, r, i] = await Promise.all([
        organizationsApi.list(),
        billingApi.stats(period),
        billingApi.plans(),
        billingApi.reviews({ status: reviewStatus, page, pageSize }),
        billingApi.adminInstructions(),
      ]);
      setOrganizations(o.data || []);
      setStats(s.data);
      setPlans(p.data || []);
      setReviews(r.data || []);
      setInstructions(i.data || []);
      if (orgId) {
        const response = await subscriptionApi.status(orgId);
        setStatus(response.data);
      } else setStatus(null);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load platform billing."
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, page, pageSize, reviewStatus, statsFrom, statsTo]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- modal openers ---------------- */
  const open = (kind, row) => {
    setAction(kind);
    setDirty(false);
    setError("");
    if (kind === "plan")
      setForm(
        row
          ? {
              id: row.id,
              code: row.code,
              name: row.name,
              description: row.description || "",
              monthlyPrice: row.monthly_price,
              quarterlyPrice: row.quarterly_price,
              annualPrice: row.annual_price,
              currency: row.currency,
              siteLimit: row.site_limit,
              equipmentLimit: row.equipment_limit,
              controllerLimit: row.controller_limit,
              displayOrder: row.display_order,
              features: row.features,
              isActive: row.is_active,
              allowExistingRenewals: row.allow_existing_renewals,
              reason: "",
            }
          : { ...emptyPlan }
      );
    else if (kind === "instruction")
      setForm(
        row
          ? {
              id: row.id,
              method: row.method,
              accountName: row.account_name,
              provider: row.provider,
              accountNumber: row.account_number,
              referenceInstructions: row.reference_instructions || "",
              currency: row.currency,
              isActive: row.is_active,
              reason: "",
            }
          : {
              method: "BANK_TRANSFER",
              accountName: "",
              provider: "",
              accountNumber: "",
              referenceInstructions: "",
              currency: "TZS",
              isActive: true,
              reason: "",
            }
      );
    else if (kind === "review")
      setForm({
        id: row.id,
        decision: "APPROVE",
        verifiedAmount: row.claimed_amount,
        note: "",
        row,
      });
    else setForm({ reason: "", suspend: kind === "suspend" });
  };

  const change = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
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
    try {
      if (action === "plan") await billingApi.savePlan(form, form.id);
      else if (action === "instruction")
        await billingApi.saveInstruction(form, form.id);
      else if (action === "review")
        await billingApi.review(form.id, {
          decision: form.decision,
          verifiedAmount: form.verifiedAmount,
          note: form.note,
        });
      else if (action === "suspend")
        await subscriptionApi.suspend(orgId, form.reason);
      else if (action === "restore")
        await subscriptionApi.restore(orgId, form.reason);
      setNotice("Change saved.");
      window.dispatchEvent(new Event("billing:changed"));
      setAction("");
      setDirty(false);
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not save change."
      );
    } finally {
      setBusy(false);
    }
  };

  const proof = async (id) => {
    try {
      const response = await billingApi.proof(id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `actpulse-proof-${id}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not download proof."
      );
    }
  };

  /* ---------------- derived chart data ---------------- */
  const stateChart = useMemo(
    () =>
      stats
        ? ["trialing", "active", "grace", "expired", "suspended"].map(
            (key) => ({
              state: humanize(key),
              count: Number(stats.states?.[key] || 0),
            })
          )
        : [],
    [stats]
  );

  const planChart = useMemo(
    () =>
      (stats?.byPlan || []).map((row) => ({
        plan: row.code,
        count: Number(row.organizations || 0),
      })),
    [stats]
  );

  const collectionRate = useMemo(() => {
    if (!stats?.money?.length) return 0;
    const invoiced = stats.money.reduce(
      (s, r) => s + Number(r.invoiced || 0),
      0
    );
    const collected = stats.money.reduce(
      (s, r) => s + Number(r.collected || 0),
      0
    );
    return invoiced ? (collected / invoiced) * 100 : 0;
  }, [stats]);

  const totalPages = Math.max(
    1,
    Math.ceil(reviews.length / pageSize)
  );
  const goTo = (p) =>
    setPage(Math.max(1, Math.min(totalPages, p)));

  /* ================================================================ */
  return (
    <PageContainer
      title="Platform Billing"
      subtitle="Subscription plans, organization status, payment review and verified collections"
    >
      <div className="space-y-4">
        {/* ============ TABS ============ */}
        <nav
          className={`${card} flex flex-wrap gap-1 p-1.5`}
          aria-label="Platform billing sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`
                  group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all
                  ${
                    active
                      ? "bg-gradient-to-r from-[#064789] to-[#427aa1] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }
                `}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </nav>

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

        {/* ============ LOADING ============ */}
        {loading && !stats ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading platform billing…
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ==================== OVERVIEW ==================== */}
            {tab === "overview" && stats && (
              <>
                {/* KPI cues */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <Cue
                    title="Organizations"
                    value={stats.organizations}
                    icon={Building2}
                    tone="brand"
                  />
                  <Cue
                    title="Active paid"
                    value={stats.states?.active}
                    icon={BadgeDollarSign}
                    tone="success"
                  />
                  <Cue
                    title="Trialing"
                    value={stats.states?.trialing}
                    icon={CalendarClock}
                    tone="brand"
                  />
                  <Cue
                    title="Grace period"
                    value={stats.states?.grace}
                    icon={CalendarClock}
                    tone="warning"
                  />
                  <Cue
                    title="Expired"
                    value={stats.states?.expired}
                    icon={AlertTriangle}
                    tone="danger"
                  />
                  <Cue
                    title="Suspended"
                    value={stats.states?.suspended}
                    icon={Pause}
                    tone="danger"
                  />
                  <Cue
                    title="Trials expiring soon"
                    value={stats.states?.trials_expiring_soon}
                    icon={CalendarClock}
                    tone="warning"
                  />
                  <Cue
                    title="Pending reviews"
                    value={stats.pendingReviews}
                    icon={Receipt}
                    tone="warning"
                  />
                  <Cue
                    title="Trial conversion cohort"
                    value={`${stats.trialConversion?.converted || 0}/${stats.trialConversion?.cohort || 0}`}
                    note="Converted / total cohort"
                    icon={TrendingUp}
                    tone="brand"
                  />
                </div>

                {/* Period filter */}
                <section className={cardPad}>
                  <header className="mb-3 flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <h2 className={sectionTitle}>Reporting period</h2>
                  </header>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="From (browser local date)"
                      type="date"
                      value={statsFrom}
                      onChange={(e) => setStatsFrom(e.target.value)}
                    />
                    <Input
                      label="Through (browser local date)"
                      type="date"
                      value={statsTo}
                      onChange={(e) => setStatsTo(e.target.value)}
                    />
                  </div>
                </section>

                {/* Charts row 1 */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <BarChartCard
                    title="Subscription states"
                    subtitle="Organizations per lifecycle state"
                    data={stateChart}
                    xKey="state"
                    series={[["count", "Organizations", "#064789"]]}
                    height={300}
                  />
                  <DonutChartCard
                    title="Organizations by plan"
                    subtitle="Distribution across active plans"
                    data={planChart.map((r, i) => ({
                      name: r.plan,
                      value: r.count,
                      color: CHART_PALETTE[i % CHART_PALETTE.length],
                    }))}
                    centerLabel={stats.organizations}
                    height={300}
                  />
                </div>

                {/* Charts row 2 — per currency money */}
                {stats.money?.map((row) => (
                  <div key={row.currency} className="grid gap-4 lg:grid-cols-2">
                    <ComposedChartCard
                      title={`Invoiced & verified collections · ${row.currency}`}
                      subtitle="Invoiced bars vs collected line"
                      data={[
                        {
                          period: "Selected period",
                          invoiced: Number(row.invoiced || 0),
                          collected: Number(row.collected || 0),
                          outstanding: Number(row.outstanding || 0),
                          overdue: Number(row.overdue || 0),
                        },
                      ]}
                      xKey="period"
                      barSeries={[
                        ["invoiced", "Invoiced", "#064789"],
                        ["collected", "Collected", "#10b981"],
                      ]}
                      lineSeries={[
                        ["outstanding", "Outstanding", "#f59e0b"],
                      ]}
                      height={300}
                    />
                    <RadialChartCard
                      title={`Collection rate · ${row.currency}`}
                      subtitle="Verified collections vs invoices"
                      value={
                        Number(row.invoiced || 0) > 0
                          ? (Number(row.collected || 0) /
                              Number(row.invoiced || 0)) *
                            100
                          : 0
                      }
                      max={100}
                      color="#064789"
                      height={300}
                    />
                  </div>
                ))}

                {/* Verified collections trend */}
                {[...new Set((stats.verifiedByDay || []).map((r) => r.currency))].map(
                  (currency) => (
                    <AreaChartCard
                      key={currency}
                      title={`Verified collections by day · ${currency}`}
                      subtitle="Approved payment allocations over time"
                      data={stats.verifiedByDay
                        .filter((row) => row.currency === currency)
                        .map((row) => ({
                          day: String(row.day).slice(0, 10),
                          collected: Number(row.collected),
                        }))}
                      xKey="day"
                      series={[["collected", "Collected", "#064789"]]}
                      height={300}
                    />
                  )
                )}

                {/* Upcoming expiries */}
                <LineChartLineCard
                  title="Upcoming subscription expiries · next 30 days"
                  data={(stats.upcomingExpiries || []).map((row) => ({
                    day: String(row.day).slice(0, 10),
                    organizations: Number(row.organizations),
                    kind: row.kind,
                  }))}
                />
              </>
            )}

            {/* ==================== PLANS ==================== */}
            {tab === "plans" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {plans.length} plan{plans.length !== 1 ? "s" : ""}
                  </div>
                  <Button
                    onClick={() => open("plan")}
                    leftIcon={Plus}
                  >
                    Create Plan
                  </Button>
                </div>

                {!plans.length ? (
                  <div
                    className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Layers size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No subscription plans yet
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Create a plan to start selling subscriptions.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {plans.map((row) => (
                      <article
                        key={row.id}
                        className={`${cardPad} relative overflow-hidden`}
                      >
                        <span
                          className={`absolute inset-x-0 top-0 h-1 ${
                            row.is_active
                              ? "bg-gradient-to-r from-[#064789] to-[#427aa1]"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        />
                        <div className="flex items-start justify-between gap-3 pt-1">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                              {row.name}
                            </p>
                            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                              {row.code}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                              row.is_active
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                            }`}
                          >
                            {row.is_active ? "Active" : "Archived"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">
                              Monthly
                            </p>
                            <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
                              {row.currency} {row.monthly_price}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">
                              Quarterly
                            </p>
                            <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
                              {row.currency} {row.quarterly_price}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">
                              Annual
                            </p>
                            <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
                              {row.currency} {row.annual_price}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 font-semibold text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                            <Building2 size={11} />
                            {row.site_limit} sites
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 font-semibold text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                            <Layers size={11} />
                            {row.equipment_limit} equipment
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 font-semibold text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                            <Users size={11} />
                            {row.controller_limit} controllers
                          </span>
                        </div>

                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(row.features || {})
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                              <li
                                key={key}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {featureLabels[key] || key}
                              </li>
                            ))}
                        </ul>

                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={Edit3}
                            onClick={() => open("plan", row)}
                          >
                            Edit Plan
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ==================== ORGANIZATIONS ==================== */}
            {tab === "organizations" && (
              <>
                <section className={cardPad}>
                  <header className="mb-3 flex items-center gap-2">
                    <Building2 size={16} className="text-slate-400" />
                    <h2 className={sectionTitle}>Select organization</h2>
                  </header>
                  <label className="block max-w-md text-sm">
                    <select
                      className={selectClass}
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                    >
                      <option value="">Select organization</option>
                      {organizations.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                {orgId && status && (
                  <>
                    <section className={cardPad}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {status.organizationName}
                          </h2>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            State:{" "}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {humanize(status.state)}
                            </strong>{" "}
                            · Plan:{" "}
                            <strong className="text-slate-700 dark:text-slate-200">
                              {status.plan?.name || "None"}
                            </strong>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            Trial ends {formatDate(status.trialEndsAt, "UTC")}{" "}
                            · Paid ends {formatDate(status.paidEndAt, "UTC")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {status.state === "SUSPENDED" ? (
                            <Button
                              onClick={() => open("restore")}
                              leftIcon={PlayCircle}
                            >
                              Restore Access
                            </Button>
                          ) : (
                            status.state !== "NONE" && (
                              <Button
                                variant="danger"
                                onClick={() => open("suspend")}
                                leftIcon={Pause}
                              >
                                Suspend Access
                              </Button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Usage grid */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                          <p className={sectionTitle}>Sites</p>
                          <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                            {status.usage?.sites || 0}
                            <span className="text-sm font-normal text-slate-400">
                              {" / "}
                              {status.plan?.siteLimit ?? "—"}
                            </span>
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                          <p className={sectionTitle}>Equipment</p>
                          <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                            {status.usage?.equipment || 0}
                            <span className="text-sm font-normal text-slate-400">
                              {" / "}
                              {status.plan?.equipmentLimit ?? "—"}
                            </span>
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                          <p className={sectionTitle}>Controllers</p>
                          <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                            {status.usage?.controllers || 0}
                            <span className="text-sm font-normal text-slate-400">
                              {" / "}
                              {status.plan?.controllerLimit ?? "—"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </section>

                    <BillingWorkspace organizationId={orgId} embedded />
                  </>
                )}
              </>
            )}

            {/* ==================== REVIEWS ==================== */}
            {tab === "reviews" && (
              <section className={card}>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Payment review queue
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {reviews.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      Status
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        value={reviewStatus}
                        onChange={(e) => {
                          setReviewStatus(e.target.value);
                          setPage(1);
                        }}
                      >
                        {[
                          "PENDING_REVIEW",
                          "APPROVED",
                          "REJECTED",
                          "ALL",
                        ].map((value) => (
                          <option key={value} value={value}>
                            {humanize(value)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void load()}
                      disabled={loading}
                      leftIcon={RefreshCw}
                    >
                      Refresh
                    </Button>
                  </div>
                </header>

                {!reviews.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Receipt size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No submissions in this view
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1000px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Organization / Invoice</th>
                          <th className="p-3">Claimed</th>
                          <th className="p-3">Method / Reference</th>
                          <th className="p-3">Submitted</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviews.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className={tableCell}>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                  {row.organization_name}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.invoice_number}
                                </p>
                              </div>
                            </td>
                            <td className={`${tableCell} font-medium`}>
                              {row.currency} {row.claimed_amount}
                            </td>
                            <td className={tableCell}>
                              <div className="min-w-0">
                                <p className="truncate">
                                  {humanize(row.method)}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.reference}
                                </p>
                              </div>
                            </td>
                            <td className={tableCell}>
                              {formatDate(row.created_at, "UTC")}
                            </td>
                            <td className={tableCell}>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                                  row.status === "PENDING_REVIEW"
                                    ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
                                    : row.status === "APPROVED"
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                      : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                                }`}
                              >
                                {humanize(row.status)}
                              </span>
                              {row.duplicate_warning && (
                                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle size={10} />
                                  Possible duplicate
                                </p>
                              )}
                            </td>
                            <td className={`${tableCell} text-right`}>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void proof(row.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <Download size={12} />
                                  Proof
                                </button>
                                {row.status === "PENDING_REVIEW" && (
                                  <button
                                    type="button"
                                    onClick={() => open("review", row)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#064789] to-[#427aa1] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                                  >
                                    <CheckCircle2 size={12} />
                                    Review
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pager */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {page}
                    </strong>{" "}
                    of {totalPages} · {reviews.length} submissions
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
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        aria-label="Next page"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(totalPages)}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        aria-label="Last page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ==================== INSTRUCTIONS ==================== */}
            {tab === "instructions" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {instructions.length} instruction
                    {instructions.length !== 1 ? "s" : ""}
                  </div>
                  <Button
                    onClick={() => open("instruction")}
                    leftIcon={Plus}
                  >
                    Configure Payment Instructions
                  </Button>
                </div>

                {!instructions.length ? (
                  <div
                    className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
                  >
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Banknote size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Payment instructions not configured
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Add bank transfer or mobile money details.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {instructions.map((row) => (
                      <article
                        key={row.id}
                        className={`${cardPad} relative overflow-hidden`}
                      >
                        <span
                          className={`absolute inset-x-0 top-0 h-1 ${
                            row.is_active
                              ? "bg-gradient-to-r from-[#064789] to-[#427aa1]"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        />
                        <div className="flex items-start justify-between gap-3 pt-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {humanize(row.method)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {row.provider} · {row.currency}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                              row.is_active
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                            }`}
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <dl className="mt-3 space-y-1.5 text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-xs text-slate-500 dark:text-slate-400">
                              Account name
                            </dt>
                            <dd className="truncate font-medium text-slate-800 dark:text-slate-100">
                              {row.account_name}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-xs text-slate-500 dark:text-slate-400">
                              Account / payment number
                            </dt>
                            <dd className="truncate font-mono text-xs text-slate-800 dark:text-slate-100">
                              {row.account_number}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={Edit3}
                            onClick={() => open("instruction", row)}
                          >
                            Edit
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ==================== ACTION MODAL ==================== */}
        <ActionModal
          open={!!action}
          title={
            {
              plan: "Edit Plan",
              instruction: "Configure Payment Instructions",
              review: "Review Payment",
              suspend: "Suspend Subscription",
              restore: "Restore Subscription",
            }[action] || ""
          }
          dirty={dirty}
          onClose={close}
          size="lg"
        >
          <form onSubmit={save} className="space-y-4 text-sm">
            {action === "plan" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    required
                    label="Stable code"
                    value={form.code || ""}
                    onChange={(e) =>
                      change("code", e.target.value.toUpperCase())
                    }
                  />
                  <Input
                    required
                    label="Plan name"
                    value={form.name || ""}
                    onChange={(e) => change("name", e.target.value)}
                  />
                  <Input
                    label="Description"
                    value={form.description || ""}
                    onChange={(e) => change("description", e.target.value)}
                  />
                  <Input
                    required
                    label="Currency"
                    value={form.currency || ""}
                    onChange={(e) =>
                      change("currency", e.target.value.toUpperCase())
                    }
                  />
                  {[
                    ["monthlyPrice", "Monthly price"],
                    ["quarterlyPrice", "Quarterly price"],
                    ["annualPrice", "Annual price"],
                    ["siteLimit", "Site limit"],
                    ["equipmentLimit", "Equipment limit"],
                    ["controllerLimit", "Controller limit"],
                    ["displayOrder", "Display order"],
                  ].map(([key, label]) => (
                    <Input
                      key={key}
                      required
                      type="number"
                      min="0"
                      step={key.includes("Price") ? "0.0001" : "1"}
                      label={label}
                      value={form[key] ?? ""}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(featureLabels).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.features?.[key] === true}
                        onChange={(e) =>
                          change("features", {
                            ...form.features,
                            [key]: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={form.isActive === true}
                      onChange={(e) => change("isActive", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span className="text-sm">
                      Active for new purchases
                    </span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={form.allowExistingRenewals === true}
                      onChange={(e) =>
                        change("allowExistingRenewals", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span className="text-sm">
                      Allow archived-plan renewals
                    </span>
                  </label>
                </div>
                <Input
                  required
                  label="Change reason"
                  value={form.reason || ""}
                  onChange={(e) => change("reason", e.target.value)}
                />
              </>
            )}

            {action === "instruction" && (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Method
                  </span>
                  <select
                    className={selectClass}
                    value={form.method || "BANK_TRANSFER"}
                    onChange={(e) => change("method", e.target.value)}
                  >
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="MOBILE_MONEY">Mobile money</option>
                  </select>
                </label>
                {[
                  ["accountName", "Account / business name"],
                  ["provider", "Bank / provider"],
                  ["accountNumber", "Account / payment number"],
                  ["referenceInstructions", "Reference instructions"],
                  ["currency", "Currency"],
                ].map(([key, label]) => (
                  <Input
                    key={key}
                    required={key !== "referenceInstructions"}
                    label={label}
                    value={form[key] || ""}
                    onChange={(e) =>
                      change(
                        key,
                        key === "currency"
                          ? e.target.value.toUpperCase()
                          : e.target.value
                      )
                    }
                  />
                ))}
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive === true}
                    onChange={(e) => change("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </>
            )}

            {action === "review" && (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Claimed: {form.row?.currency} {form.row?.claimed_amount}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Info size={12} />
                    Verify funds independently. The proof alone does not
                    confirm payment.
                  </p>
                </div>
                {form.row?.duplicate_warning && (
                  <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={12} />
                    Possible duplicate submission.
                  </p>
                )}
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Decision
                  </span>
                  <select
                    className={selectClass}
                    value={form.decision}
                    onChange={(e) => change("decision", e.target.value)}
                  >
                    <option value="APPROVE">Approve verified amount</option>
                    <option value="REJECT">Reject</option>
                  </select>
                </label>
                {form.decision === "APPROVE" && (
                  <Input
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    label="Verified amount"
                    value={form.verifiedAmount || ""}
                    onChange={(e) =>
                      change("verifiedAmount", e.target.value)
                    }
                  />
                )}
              </>
            )}

            {(action === "suspend" || action === "restore") && (
              <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                {action === "suspend" ? (
                  <>
                    <Pause
                      size={18}
                      className="mt-0.5 shrink-0 text-rose-500"
                    />
                    <p className="text-slate-700 dark:text-slate-200">
                      Operational access stops immediately. Device observations
                      continue.
                    </p>
                  </>
                ) : (
                  <>
                    <PlayCircle
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-500"
                    />
                    <p className="text-slate-700 dark:text-slate-200">
                      Access resumes only if the original trial or paid period
                      is still valid.
                    </p>
                  </>
                )}
              </div>
            )}

            <Input
              required
              label={
                action === "review" ? "Review / rejection note" : "Reason"
              }
              value={
                action === "review"
                  ? form.note || ""
                  : form.reason || ""
              }
              onChange={(e) =>
                change(
                  action === "review" ? "note" : "reason",
                  e.target.value
                )
              }
            />

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
              <Button type="submit" loading={busy}>
                {action === "review"
                  ? "Approve / Reject Payment"
                  : "Save Change"}
              </Button>
            </div>
          </form>
        </ActionModal>
      </div>
    </PageContainer>
  );
}

/* ------------------------------------------------------------------ */
/*  Extra chart variant: Line chart for expiries                      */
/* ------------------------------------------------------------------ */
function LineChartLineCard({ title, data }) {
  const t = useChartTheme();
  const hasValues = data?.some((row) => Number(row.organizations) !== 0);
  if (!hasValues) {
    return (
      <ChartShell title={title} height={300}>
        <EmptyChart message="No upcoming expiries in this window." />
      </ChartShell>
    );
  }
  return (
    <ChartShell
      title={title}
      subtitle="Organizations whose access ends within the next 30 days"
      height={300}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={t.gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="day"
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
          <Line
            type="monotone"
            dataKey="organizations"
            name="Organizations"
            stroke="#064789"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}