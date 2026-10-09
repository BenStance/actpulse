// src/pages/shared/Alerts.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cpu,
  Eye,
  Filter,
  Gauge,
  Info,
  Power,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Wrench,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import {
  alertsApi,
  equipmentApi,
  organizationsApi,
  sitesApi,
} from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";
import { getSocket } from "../../components/realtime/socket";
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

const RULE_TYPES = [
  "MONITOR_OFFLINE",
  "LOW_FUEL",
  "STALE_FUEL",
  "MAINTENANCE_DUE",
  "RECONCILIATION_VARIANCE",
];

const TABS = [
  { id: "active", label: "Active Alerts", icon: Bell },
  { id: "rules", label: "Configured Rules", icon: Settings, adminOnly: true },
  { id: "history", label: "Alert History", icon: Clock },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const humanize = (v) =>
  String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function severityStyle(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "CRITICAL")
    return {
      pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
      icon: AlertOctagon,
      dot: "bg-rose-500",
    };
  if (s === "WARNING")
    return {
      pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
      icon: AlertTriangle,
      dot: "bg-amber-500",
    };
  return {
    pill: "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30",
    icon: Info,
    dot: "bg-[#064789] dark:bg-[#427aa1]",
  };
}

function statusStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OPEN")
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30";
  if (s === "ACKNOWLEDGED")
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
}

function typeIcon(type) {
  const t = String(type || "").toUpperCase();
  if (t.includes("OFFLINE")) return Power;
  if (t.includes("FUEL")) return Gauge;
  if (t.includes("MAINTENANCE")) return Wrench;
  if (t.includes("RECONCILIATION")) return AlertCircle;
  return BellRing;
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="max-w-[65%] break-words text-right text-sm font-medium text-slate-800 dark:text-slate-100">
        {value || "—"}
      </span>
    </div>
  );
}

/* ================================================================== */
/*  Alerts                                                            */
/* ================================================================== */
export default function Alerts() {
  const admin = useAuthStore(
    (state) =>
      state.user?.role === "Admin" || state.user?.role === "ADMIN"
  );
  const base = admin ? "/admin" : "/controller";

  const [tab, setTab] = useState("active");
  const [filters, setFilters] = useState({
    status: "",
    severity: "",
    siteId: "",
    equipmentId: "",
    search: "",
    page: 1,
    pageSize: 20,
  });
  const [equipment, setEquipment] = useState([]);
  const [sites, setSites] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [data, setData] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState("");
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  /* ---------------- lookups ---------------- */
  useEffect(() => {
    const requests = [
      equipmentApi.list({ active: "all" }),
      sitesApi.list({ active: "all" }),
    ];
    if (admin) requests.push(organizationsApi.list());
    Promise.all(requests)
      .then(([e, s, o]) => {
        setEquipment(e.data || []);
        setSites(s.data || []);
        if (o) setOrganizations(o.data || []);
      })
      .catch(() => setError("Could not load alert filters."));
  }, [admin]);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [alerts, configured] = await Promise.all([
        alertsApi.list({
          status: filters.status || undefined,
          severity: filters.severity || undefined,
          siteId: filters.siteId || undefined,
          equipmentId: filters.equipmentId || undefined,
          search: filters.search || undefined,
          page: filters.page,
          pageSize: filters.pageSize,
        }),
        admin ? alertsApi.rules() : Promise.resolve({ data: [] }),
      ]);
      setData(alerts.data);
      setRules(configured.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load alerts.");
    } finally {
      setLoading(false);
    }
  }, [filters, admin]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- realtime ---------------- */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = () => void load();
    socket.on("alerts.updated", refresh);
    return () => socket.off("alerts.updated", refresh);
  }, [load]);

  /* ---------------- derived ---------------- */
  const items = data?.items || [];

  const activeItems = useMemo(
    () => items.filter((a) => a.status !== "RESOLVED"),
    [items]
  );
  const resolvedItems = useMemo(
    () => items.filter((a) => a.status === "RESOLVED"),
    [items]
  );

  const counts = useMemo(() => {
    const open = data?.open ?? 0;
    const critical = items.filter(
      (a) => a.severity === "CRITICAL" && a.status !== "RESOLVED"
    ).length;
    const warning = items.filter(
      (a) => a.severity === "WARNING" && a.status !== "RESOLVED"
    ).length;
    const resolved = resolvedItems.length;
    return { open, critical, warning, resolved };
  }, [data, items, resolvedItems]);

  /* ---------------- pagination ---------------- */
  const total = data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const fromIndex =
    total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const toIndex = Math.min(filters.page * filters.pageSize, total);

  const goTo = (p) =>
    setFilters((old) => ({
      ...old,
      page: Math.max(1, Math.min(totalPages, p)),
    }));

  const resetFilters = () =>
    setFilters({
      status: "",
      severity: "",
      siteId: "",
      equipmentId: "",
      search: "",
      page: 1,
      pageSize: filters.pageSize,
    });

  /* ---------------- actions ---------------- */
  const openModal = (kind, initial = {}) => {
    setAction(kind);
    setForm({
      severity: "WARNING",
      type: "MONITOR_OFFLINE",
      freshnessMinutes: 1440,
      debounceMinutes: 0,
      enabled: true,
      inApp: true,
      ...initial,
    });
    setDirty(false);
    setError("");
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
    setNotice("");
    try {
      if (action === "ack") await alertsApi.acknowledge(form.id, form.note);
      else if (form.id) await alertsApi.updateRule(form.id, form);
      else await alertsApi.createRule(form);
      close();
      setNotice("Alert updated.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update alert.");
    } finally {
      setBusy(false);
    }
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="Alerts"
      subtitle="Condition-based alerts and in-app notifications"
    >
      <div className="space-y-4">
        {/* ============ KPI TILES ============ */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cardPad}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionTitle}>Open & acknowledged</p>
                <p className="mt-1.5 text-2xl font-bold text-[#064789] dark:text-[#8fc7e8]">
                  {data?.open ?? "—"}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                <Bell size={18} />
              </div>
            </div>
          </div>
          <div className={cardPad}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionTitle}>Critical</p>
                <p className="mt-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {counts.critical}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertOctagon size={18} />
              </div>
            </div>
          </div>
          <div className={cardPad}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionTitle}>Warning</p>
                <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {counts.warning}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle size={18} />
              </div>
            </div>
          </div>
          <div className={cardPad}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={sectionTitle}>Resolved in view</p>
                <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {counts.resolved}
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Alert filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Reset
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="sm:col-span-2">
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Search
                </span>
                <div className="relative mt-1">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Message, equipment…"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value, page: 1 })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </label>
            </div>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                className={selectClass}
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value, page: 1 })
                }
              >
                <option value="">All</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Severity
              </span>
              <select
                className={selectClass}
                value={filters.severity}
                onChange={(e) =>
                  setFilters({ ...filters, severity: e.target.value, page: 1 })
                }
              >
                <option value="">All</option>
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Site
              </span>
              <select
                className={selectClass}
                value={filters.siteId}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    siteId: e.target.value,
                    equipmentId: "",
                    page: 1,
                  })
                }
              >
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Equipment
              </span>
              <select
                className={selectClass}
                value={filters.equipmentId}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    equipmentId: e.target.value,
                    page: 1,
                  })
                }
              >
                <option value="">All equipment</option>
                {equipment
                  .filter(
                    (row) => !filters.siteId || row.siteId === filters.siteId
                  )
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </section>

        {/* ============ TOOLBAR ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? "Loading…"
              : total === 0
                ? "No records"
                : `Showing ${fromIndex}–${toIndex} of ${total}`}
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
            {admin && (
              <Button
                size="sm"
                onClick={() => {
                  setTab("rules");
                  openModal("rule");
                }}
                leftIcon={Settings}
              >
                Configure Alert Rule
              </Button>
            )}
          </div>
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
        {notice && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            <CheckCircle2 size={16} />
            {notice}
          </p>
        )}

        {/* ============ TABS ============ */}
        <nav
          className={`${card} flex flex-wrap gap-1 p-1.5`}
          aria-label="Alert sections"
        >
          {TABS.filter((t) => !t.adminOnly || admin).map(
            ({ id, label, icon: Icon }) => {
              const active = tab === id;
              const count =
                id === "active"
                  ? activeItems.length
                  : id === "rules"
                    ? rules.length
                    : resolvedItems.length;
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
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </nav>

        {/* ============ TAB CONTENT ============ */}
        {loading && !data ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading alerts…
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ---------- ACTIVE ALERTS TAB (TABLE) ---------- */}
            {tab === "active" && (
              <section className={card}>
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Active alerts
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {activeItems.length}
                    </span>
                  </div>
                </header>

                {activeItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Bell size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No active alerts
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Everything is resolved or acknowledged — nice work.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Alert</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Severity</th>
                          <th className="p-3">Equipment</th>
                          <th className="p-3">Triggered</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeItems.map((alert) => {
                          const sv = severityStyle(alert.severity);
                          const SevIcon = sv.icon;
                          const TypeIcon = typeIcon(alert.type);
                          return (
                            <tr
                              key={alert.id}
                              className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <td className={`${tableCell} font-medium`}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${sv.pill}`}
                                  >
                                    <TypeIcon size={13} />
                                  </span>
                                  <span className="line-clamp-2">
                                    {alert.message}
                                  </span>
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                  <Radio size={11} className="text-slate-400" />
                                  {humanize(alert.type)}
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${sv.pill}`}
                                >
                                  <SevIcon size={11} />
                                  {humanize(alert.severity)}
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                  <Cpu size={11} className="text-slate-400" />
                                  <span className="truncate">
                                    {alert.equipment_name}
                                  </span>
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <Clock size={11} className="text-slate-400" />
                                  {formatDate(alert.triggered_at, "UTC")}
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${statusStyle(
                                    alert.status
                                  )}`}
                                >
                                  {humanize(alert.status)}
                                </span>
                              </td>
                              <td className={`${tableCell} text-right`}>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openModal("detail", alert)
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Eye size={12} />
                                    Details
                                  </button>
                                  {alert.status === "OPEN" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openModal("ack", {
                                          id: alert.id,
                                          message: alert.message,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#064789] to-[#427aa1] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                                    >
                                      <CheckCircle2 size={12} />
                                      Ack
                                    </button>
                                  )}
                                  <Link
                                    to={`${base}/equipment/${alert.equipment_id}`}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Gauge size={12} />
                                    Equipment
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pager */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {filters.page}
                    </strong>{" "}
                    of {totalPages} · {total} alerts
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      Rows
                      <select
                        value={filters.pageSize}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            pageSize: Number(e.target.value),
                            page: 1,
                          })
                        }
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
                        disabled={filters.page <= 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        aria-label="First page"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(filters.page - 1)}
                        disabled={filters.page <= 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        aria-label="Previous page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(filters.page + 1)}
                        disabled={filters.page >= totalPages}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                        aria-label="Next page"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(totalPages)}
                        disabled={filters.page >= totalPages}
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

            {/* ---------- CONFIGURED RULES TAB ---------- */}
            {tab === "rules" && admin && (
              <section className={card}>
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Settings size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Configured rules
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {rules.length}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openModal("rule")}
                    leftIcon={Settings}
                  >
                    Configure Alert Rule
                  </Button>
                </header>

                {!rules.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Settings size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No alert rules configured yet
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Create a rule to start receiving alerts.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Condition</th>
                          <th className="p-3">Severity</th>
                          <th className="p-3">Threshold</th>
                          <th className="p-3">Freshness</th>
                          <th className="p-3">Debounce</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((rule) => {
                          const sv = severityStyle(rule.severity);
                          const SevIcon = sv.icon;
                          const RuleIcon = typeIcon(rule.type);
                          return (
                            <tr
                              key={rule.id}
                              className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <td className={tableCell}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${sv.pill}`}
                                  >
                                    <RuleIcon size={13} />
                                  </span>
                                  <span className="font-medium">
                                    {humanize(rule.type)}
                                  </span>
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${sv.pill}`}
                                >
                                  <SevIcon size={11} />
                                  {humanize(rule.severity)}
                                </span>
                              </td>
                              <td className={tableCell}>
                                {rule.threshold ?? "—"}
                              </td>
                              <td className={tableCell}>
                                {rule.freshness_minutes != null
                                  ? `${rule.freshness_minutes} min`
                                  : "—"}
                              </td>
                              <td className={tableCell}>
                                {rule.debounce_minutes != null
                                  ? `${rule.debounce_minutes} min`
                                  : "—"}
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                                    rule.enabled
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                      : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      rule.enabled
                                        ? "bg-emerald-500"
                                        : "bg-slate-400"
                                    }`}
                                  />
                                  {rule.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </td>
                              <td className={`${tableCell} text-right`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openModal("rule", {
                                      id: rule.id,
                                      organizationId:
                                        rule.organization_id || "",
                                      equipmentId: rule.equipment_id || "",
                                      type: rule.type,
                                      severity: rule.severity,
                                      threshold: rule.threshold || "",
                                      freshnessMinutes:
                                        rule.freshness_minutes || 1440,
                                      debounceMinutes:
                                        rule.debounce_minutes || 0,
                                      enabled: rule.enabled,
                                      inApp: rule.in_app,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* ---------- HISTORY TAB ---------- */}
            {tab === "history" && (
              <section className={card}>
                <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Resolved alerts
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {resolvedItems.length}
                    </span>
                  </div>
                </header>

                {resolvedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <Clock size={22} />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      No resolved alerts in this view
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Resolved alerts appear here for reference.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Message</th>
                          <th className="p-3">Severity</th>
                          <th className="p-3">Equipment</th>
                          <th className="p-3">Triggered</th>
                          <th className="p-3">Resolved</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedItems.map((alert) => {
                          const sv = severityStyle(alert.severity);
                          const SevIcon = sv.icon;
                          const TypeIcon = typeIcon(alert.type);
                          return (
                            <tr
                              key={alert.id}
                              className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <td className={`${tableCell} font-medium`}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset ${sv.pill}`}
                                  >
                                    <TypeIcon size={13} />
                                  </span>
                                  <span className="truncate">
                                    {alert.message}
                                  </span>
                                </span>
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${sv.pill}`}
                                >
                                  <SevIcon size={11} />
                                  {humanize(alert.severity)}
                                </span>
                              </td>
                              <td className={tableCell}>
                                {alert.equipment_name}
                              </td>
                              <td className={tableCell}>
                                {formatDate(alert.triggered_at, "UTC")}
                              </td>
                              <td className={tableCell}>
                                {alert.resolved_at
                                  ? formatDate(alert.resolved_at, "UTC")
                                  : "—"}
                              </td>
                              <td className={`${tableCell} text-right`}>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openModal("detail", alert)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Eye size={12} />
                                    Details
                                  </button>
                                  <Link
                                    to={`${base}/equipment/${alert.equipment_id}`}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Gauge size={12} />
                                    Equipment
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pager */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {filters.page}
                    </strong>{" "}
                    of {totalPages} · {total} alerts
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      Rows
                      <select
                        value={filters.pageSize}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            pageSize: Number(e.target.value),
                            page: 1,
                          })
                        }
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
                        disabled={filters.page <= 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(filters.page - 1)}
                        disabled={filters.page <= 1}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(filters.page + 1)}
                        disabled={filters.page >= totalPages}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(totalPages)}
                        disabled={filters.page >= totalPages}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* ============ ACTION MODAL ============ */}
        <ActionModal
          open={!!action}
          title={
            action === "ack"
              ? "Acknowledge Alert"
              : action === "rule"
                ? "Configure Alert Rule"
                : "Alert Details"
          }
          dirty={dirty}
          onClose={close}
          size={action === "detail" ? "md" : "lg"}
        >
          {action === "detail" ? (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                    severityStyle(form.severity).pill
                  }`}
                >
                  {(() => {
                    const I = severityStyle(form.severity).icon;
                    return <I size={18} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {form.message}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {humanize(form.type)} · {humanize(form.severity)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                <DetailRow label="Status" value={humanize(form.status)} />
                <DetailRow
                  label="Triggered"
                  value={
                    form.triggered_at
                      ? formatDate(form.triggered_at, "UTC")
                      : "—"
                  }
                />
                <DetailRow label="Equipment" value={form.equipment_name} />
                {form.acknowledged_at && (
                  <DetailRow
                    label="Acknowledged"
                    value={formatDate(form.acknowledged_at, "UTC")}
                  />
                )}
                {form.acknowledged_by_name && (
                  <DetailRow
                    label="Acknowledged by"
                    value={form.acknowledged_by_name}
                  />
                )}
                {form.resolved_at && (
                  <DetailRow
                    label="Resolved"
                    value={formatDate(form.resolved_at, "UTC")}
                  />
                )}
                {form.note && <DetailRow label="Note" value={form.note} />}
              </div>

              {form.context && Object.keys(form.context).length > 0 && (
                <div>
                  <p className={`${sectionTitle} mb-2`}>Context</p>
                  <div className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                    {Object.entries(form.context).map(([k, v]) => (
                      <DetailRow
                        key={k}
                        label={humanize(k)}
                        value={
                          typeof v === "object" ? JSON.stringify(v) : String(v)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={close}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4 text-sm">
              {action === "ack" && (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {form.message}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <Info size={12} />
                      Acknowledgement means you have seen this alert; the
                      underlying condition remains active.
                    </p>
                  </div>
                  <Input
                    label="Note (optional)"
                    value={form.note || ""}
                    onChange={(e) => change("note", e.target.value)}
                  />
                </>
              )}

              {action === "rule" && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Organization
                    </span>
                    <select
                      required={!form.equipmentId}
                      className={selectClass}
                      value={form.organizationId || ""}
                      onChange={(e) =>
                        change("organizationId", e.target.value)
                      }
                    >
                      <option value="">Select organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Equipment (optional)
                    </span>
                    <select
                      className={selectClass}
                      value={form.equipmentId || ""}
                      onChange={(e) => change("equipmentId", e.target.value)}
                    >
                      <option value="">All organization equipment</option>
                      {equipment
                        .filter(
                          (row) =>
                            !form.organizationId ||
                            row.organizationId === form.organizationId
                        )
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Condition
                      </span>
                      <select
                        className={selectClass}
                        value={form.type}
                        onChange={(e) => change("type", e.target.value)}
                      >
                        {RULE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {humanize(type)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Severity
                      </span>
                      <select
                        className={selectClass}
                        value={form.severity}
                        onChange={(e) => change("severity", e.target.value)}
                      >
                        <option value="INFO">Info</option>
                        <option value="WARNING">Warning</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                  </div>

                  {["LOW_FUEL", "RECONCILIATION_VARIANCE"].includes(
                    form.type
                  ) && (
                    <Input
                      required
                      type="number"
                      min="0"
                      step="0.001"
                      label={
                        form.type === "LOW_FUEL"
                          ? "Low fuel threshold (L)"
                          : "Variance threshold (L)"
                      }
                      value={form.threshold || ""}
                      onChange={(e) => change("threshold", e.target.value)}
                    />
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="number"
                      min="1"
                      label="Freshness (minutes)"
                      value={form.freshnessMinutes}
                      onChange={(e) =>
                        change("freshnessMinutes", e.target.value)
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      label="Debounce (minutes)"
                      value={form.debounceMinutes}
                      onChange={(e) =>
                        change("debounceMinutes", e.target.value)
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={form.enabled === true}
                        onChange={(e) => change("enabled", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span>Enabled</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={form.inApp === true}
                        onChange={(e) => change("inApp", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                      />
                      <span>In-app notifications</span>
                    </label>
                  </div>

                  <Input
                    required
                    label="Change reason"
                    value={form.reason || ""}
                    onChange={(e) => change("reason", e.target.value)}
                  />

                  <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    Alerts use fresh evidence. Generator OFF alone never
                    triggers an alert.
                  </p>
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
                <Button type="submit" loading={busy}>
                  {action === "ack" ? "Acknowledge" : "Save Rule"}
                </Button>
              </div>
            </form>
          )}
        </ActionModal>
      </div>
    </PageContainer>
  );
}