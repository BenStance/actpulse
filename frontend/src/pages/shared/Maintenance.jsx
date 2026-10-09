// src/pages/shared/Maintenance.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cog,
  Edit3,
  FileText,
  Filter,
  Gauge,
  Info,
  PencilLine,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import {
  equipmentApi,
  maintenanceApi,
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

const TABS = [
  { id: "calendar", label: "Upcoming Calendar", icon: Calendar },
  { id: "plans", label: "Maintenance Plans", icon: Wrench },
  { id: "services", label: "Completed Services", icon: FileText },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const localDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const localNow = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const humanize = (v) =>
  String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function planStatusStyle(state) {
  const s = String(state || "").toUpperCase();
  if (s === "OVERDUE")
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30";
  if (s === "DUE")
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  if (s === "DUE_SOON")
    return "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30";
  if (s === "SCHEDULED")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
}

function daysUntil(date) {
  if (!date) return null;
  const diff = Math.ceil(
    (new Date(date).getTime() - Date.now()) / 86400000
  );
  return diff;
}

/* ================================================================== */
/*  Maintenance                                                       */
/* ================================================================== */
export default function Maintenance({ equipmentId: fixedEquipmentId }) {
  const [searchParams] = useSearchParams();
  const initialEquipmentId =
    fixedEquipmentId || searchParams.get("equipmentId") || "";
  const admin = useAuthStore(
    (state) => state.user?.role === "Admin" || state.user?.role === "ADMIN"
  );
  const userId = useAuthStore((state) => state.user?.id);

  const [tab, setTab] = useState("calendar");
  const [equipment, setEquipment] = useState([]);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    equipmentId: initialEquipmentId,
    siteId: "",
    status: "",
    search: "",
    page: 1,
    pageSize: 20,
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState("");
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  /* ---------------- lookups ---------------- */
  useEffect(() => {
    Promise.all([
      equipmentApi.list({ active: "all" }),
      sitesApi.list({ active: "all" }),
    ])
      .then(([e, s]) => {
        setEquipment(e.data || []);
        setSites(s.data || []);
      })
      .catch(() => setError("Could not load equipment."));
  }, []);

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: result } = await maintenanceApi.list({
        equipmentId: filters.equipmentId || undefined,
        siteId: filters.siteId || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
      setData(result);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load maintenance."
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
    socket.on("operations.updated", refresh);
    return () => socket.off("operations.updated", refresh);
  }, [load]);

  /* ---------------- derived ---------------- */
  const upcoming = useMemo(
    () =>
      (data?.plans || [])
        .filter((plan) => plan.status.nextDueAt)
        .sort(
          (a, b) =>
            new Date(a.status.nextDueAt) - new Date(b.status.nextDueAt)
        ),
    [data]
  );

  const plans = useMemo(
    () =>
      (data?.plans || []).filter((plan) => {
        if (!filters.search) return true;
        const q = filters.search.toLowerCase();
        const eq = equipment.find((e) => e.id === plan.equipment_id);
        return (
          plan.title?.toLowerCase().includes(q) ||
          eq?.name?.toLowerCase().includes(q)
        );
      }),
    [data, filters.search, equipment]
  );

  const services = data?.services || [];
  const totalServices = data?.totalServices ?? services.length;

  /* ---------------- actions ---------------- */
  const open = (kind, initial = {}) => {
    setAction(kind);
    setForm({
      performedAt: localNow(),
      referenceServiceAt: localNow(),
      trigger: "CALENDAR",
      equipmentId: filters.equipmentId || equipment[0]?.id || "",
      ...initial,
    });
    setDirty(false);
    setError("");
  };

  const openServiceForEquipment = (equipmentId) =>
    open("service", { equipmentId });

  const correct = (row) =>
    open("correctService", {
      id: row.id,
      equipmentId: row.equipment_id,
      performedAt: localDate(row.performed_at),
      description: row.description,
      completedChecklist: row.completed_checklist,
      technician: row.technician,
      meterHours: row.meter_hours,
      cost: row.cost,
      currency: row.currency,
      reference: row.reference,
      notes: row.notes,
      correctionReason: "",
    });

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
      const payload = { ...form };
      for (const key of ["performedAt", "referenceServiceAt"]) {
        if (payload[key]) payload[key] = new Date(payload[key]).toISOString();
      }
      if (action === "plan") await maintenanceApi.plan(payload);
      else if (action === "editPlan")
        await maintenanceApi.updatePlan(form.id, payload);
      else if (action === "service") await maintenanceApi.service(payload);
      else if (action === "void")
        await maintenanceApi.voidService(form.id, form.reason);
      else if (action === "correctService")
        await maintenanceApi.correctService(form.id, payload);
      close();
      setNotice("Maintenance record saved.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not save maintenance."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- pagination ---------------- */
  const totalPages = Math.max(
    1,
    Math.ceil(totalServices / filters.pageSize)
  );
  const fromIndex =
    totalServices === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const toIndex = Math.min(filters.page * filters.pageSize, totalServices);

  const goTo = (p) =>
    setFilters((old) => ({
      ...old,
      page: Math.max(1, Math.min(totalPages, p)),
    }));

  /* ================================================================ */
  return (
    <PageContainer
      title="Maintenance"
      subtitle="Scheduled plans and manually recorded service history"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        {!fixedEquipmentId && (
          <section className={card} aria-label="Maintenance filters">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <h2 className={sectionTitle}>Filters</h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    equipmentId: "",
                    siteId: "",
                    status: "",
                    search: "",
                    page: 1,
                    pageSize: filters.pageSize,
                  })
                }
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Reset
              </button>
            </header>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
                      placeholder="Plan title or equipment…"
                      value={filters.search}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          search: e.target.value,
                          page: 1,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </label>
              </div>

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
                  <option value="">All accessible equipment</option>
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

              <label className="text-sm sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Plan status
                </span>
                <select
                  className={selectClass}
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      status: e.target.value,
                      page: 1,
                    })
                  }
                >
                  <option value="">All</option>
                  {[
                    "SCHEDULED",
                    "DUE_SOON",
                    "DUE",
                    "OVERDUE",
                    "UNABLE_TO_DETERMINE",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {/* ============ TOOLBAR ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? "Loading…"
              : totalServices === 0
                ? "No records"
                : `Showing ${fromIndex}–${toIndex} of ${totalServices} services`}
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
                onClick={() => open("plan")}
                leftIcon={CalendarClock}
              >
                Schedule Maintenance
              </Button>
            )}
            <Button
              size="sm"
              variant={admin ? "outline" : "primary"}
              onClick={() => open("service")}
              leftIcon={Wrench}
            >
              Record Completed Service
            </Button>
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

        {/* ============ KPI TILES ============ */}
        {data && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cardPad}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={sectionTitle}>Due soon</p>
                  <p className="mt-1.5 text-2xl font-bold text-[#064789] dark:text-[#8fc7e8]">
                    {data.upcoming || 0}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                  <CalendarClock size={18} />
                </div>
              </div>
            </div>
            <div className={cardPad}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={sectionTitle}>Overdue</p>
                  <p className="mt-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {data.overdue || 0}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={18} />
                </div>
              </div>
            </div>
            <div className={cardPad}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={sectionTitle}>Plans in view</p>
                  <p className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {data.total || 0}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300">
                  <Cog size={18} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ TABS ============ */}
        <nav
          className={`${card} flex flex-wrap gap-1 p-1.5`}
          aria-label="Maintenance sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const count =
              id === "calendar"
                ? upcoming.length
                : id === "plans"
                  ? plans.length
                  : totalServices;
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
          })}
        </nav>

        {/* ============ TAB CONTENT ============ */}
        {loading && !data ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading maintenance…
              </p>
            </div>
          </div>
        ) : (
          data && (
            <>
              {/* ---------- CALENDAR TAB ---------- */}
              {tab === "calendar" && (
                <section className={card}>
                  <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400" />
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Upcoming maintenance
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {upcoming.length}
                      </span>
                    </div>
                  </header>

                  {!upcoming.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <Calendar size={22} />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        No dated maintenance in this view
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Scheduled plans with a next-due date will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[900px] w-full text-left text-sm">
                        <thead>
                          <tr className={tableHead}>
                            <th className="p-3">Due in</th>
                            <th className="p-3">Plan</th>
                            <th className="p-3">Equipment</th>
                            <th className="p-3">Next due (UTC)</th>
                            <th className="p-3">Trigger</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcoming.map((plan) => {
                            const eq = equipment.find(
                              (e) => e.id === plan.equipment_id
                            );
                            const st = plan.status.state;
                            const days = daysUntil(plan.status.nextDueAt);
                            return (
                              <tr
                                key={plan.id}
                                className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                              >
                                <td className={tableCell}>
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                                      days == null
                                        ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                        : days < 0
                                          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                          : days <= 7
                                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                            : "bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]"
                                    }`}
                                  >
                                    {days == null
                                      ? "—"
                                      : days < 0
                                        ? `${Math.abs(days)}d overdue`
                                        : days === 0
                                          ? "Today"
                                          : `${days}d`}
                                  </span>
                                </td>
                                <td className={`${tableCell} font-medium`}>
                                  {plan.title}
                                </td>
                                <td className={tableCell}>
                                  {eq?.name || plan.equipment_id}
                                </td>
                                <td className={tableCell}>
                                  {plan.status.nextDueAt
                                    ? formatDate(plan.status.nextDueAt, "UTC")
                                    : "—"}
                                </td>
                                <td className={tableCell}>
                                  {humanize(plan.trigger_type)}
                                </td>
                                <td className={tableCell}>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${planStatusStyle(
                                      st
                                    )}`}
                                  >
                                    {humanize(st)}
                                  </span>
                                </td>
                                <td className={`${tableCell} text-right`}>
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openServiceForEquipment(
                                          plan.equipment_id
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                    >
                                      <Wrench size={12} />
                                      Record
                                    </button>
                                    {admin && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          open("editPlan", {
                                            id: plan.id,
                                            title: plan.title,
                                            description:
                                              plan.description || "",
                                            checklist: plan.checklist || "",
                                            isActive: plan.is_active,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                      >
                                        <PencilLine size={12} />
                                        Edit
                                      </button>
                                    )}
                                  </div>
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

              {/* ---------- PLANS TAB ---------- */}
              {tab === "plans" && (
                <section className={card}>
                  <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Wrench size={16} className="text-slate-400" />
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Maintenance plans
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {plans.length}
                      </span>
                    </div>
                  </header>

                  {!plans.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <Wrench size={22} />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        No plans match these filters
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Schedule maintenance to create a plan.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[1000px] w-full text-left text-sm">
                        <thead>
                          <tr className={tableHead}>
                            <th className="p-3">Plan</th>
                            <th className="p-3">Equipment</th>
                            <th className="p-3">Trigger</th>
                            <th className="p-3">Next due (UTC)</th>
                            <th className="p-3">Hours remaining</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plans.map((plan) => {
                            const eq = equipment.find(
                              (row) => row.id === plan.equipment_id
                            );
                            const st = plan.status.state;
                            return (
                              <tr
                                key={plan.id}
                                className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                              >
                                <td className={`${tableCell} font-medium`}>
                                  <p className="truncate">{plan.title}</p>
                                  {plan.status.warning && (
                                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                      <Info size={10} />
                                      {plan.status.warning}
                                    </p>
                                  )}
                                </td>
                                <td className={tableCell}>
                                  {eq?.name || plan.equipment_id}
                                </td>
                                <td className={tableCell}>
                                  {humanize(plan.trigger_type)}
                                </td>
                                <td className={tableCell}>
                                  {plan.status.nextDueAt
                                    ? formatDate(plan.status.nextDueAt, "UTC")
                                    : "—"}
                                </td>
                                <td className={tableCell}>
                                  {plan.status.hoursRemaining == null
                                    ? "—"
                                    : `${plan.status.hoursRemaining.toFixed(2)} h`}
                                  {plan.status.hourBasis && (
                                    <span className="ml-1 text-[11px] text-slate-400">
                                      · {plan.status.hourBasis}
                                    </span>
                                  )}
                                </td>
                                <td className={tableCell}>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${planStatusStyle(
                                      st
                                    )}`}
                                  >
                                    {humanize(st)}
                                  </span>
                                </td>
                                <td className={`${tableCell} text-right`}>
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openServiceForEquipment(
                                          plan.equipment_id
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                    >
                                      <Wrench size={12} />
                                      Record
                                    </button>
                                    {admin && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          open("editPlan", {
                                            id: plan.id,
                                            title: plan.title,
                                            description:
                                              plan.description || "",
                                            checklist: plan.checklist || "",
                                            isActive: plan.is_active,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                      >
                                        <PencilLine size={12} />
                                        Edit
                                      </button>
                                    )}
                                  </div>
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

              {/* ---------- SERVICES TAB ---------- */}
              {tab === "services" && (
                <section className={card}>
                  <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-slate-400" />
                      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Completed services
                      </h2>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {totalServices}
                      </span>
                    </div>
                  </header>

                  {!services.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <FileText size={22} />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        No completed service records
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Use "Record Completed Service" to add one.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full text-left text-sm">
                          <thead>
                            <tr className={tableHead}>
                              <th className="p-3">Performed</th>
                              <th className="p-3">Equipment</th>
                              <th className="p-3">Description</th>
                              <th className="p-3">Physical meter</th>
                              <th className="p-3">Cost</th>
                              <th className="p-3">Source</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {services.map((row) => {
                              const eq = equipment.find(
                                (item) => item.id === row.equipment_id
                              );
                              const canEdit =
                                (admin || row.recorded_by === userId) &&
                                !row.resets_plan_baseline;
                              return (
                                <tr
                                  key={row.id}
                                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                                >
                                  <td className={tableCell}>
                                    {formatDate(row.performed_at, "UTC")}
                                  </td>
                                  <td className={tableCell}>
                                    {eq?.name || row.equipment_id}
                                  </td>
                                  <td className={tableCell}>
                                    <span className="line-clamp-2">
                                      {row.description}
                                    </span>
                                  </td>
                                  <td className={tableCell}>
                                    {row.meter_hours ?? "—"}
                                  </td>
                                  <td className={tableCell}>
                                    {row.currency
                                      ? `${row.currency} ${row.cost}`
                                      : "—"}
                                  </td>
                                  <td className={tableCell}>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                                      Manual
                                    </span>
                                  </td>
                                  <td className={`${tableCell} text-right`}>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                      {canEdit && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => correct(row)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                          >
                                            <Edit3 size={12} />
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              open("void", { id: row.id })
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                          >
                                            <Trash2 size={12} />
                                            Void
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pager */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Page{" "}
                          <strong className="text-slate-700 dark:text-slate-200">
                            {filters.page}
                          </strong>{" "}
                          of {totalPages} · {totalServices} services
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
                    </>
                  )}
                </section>
              )}
            </>
          )
        )}

        {/* ============ ACTION MODAL ============ */}
        <ActionModal
          open={!!action}
          title={
            {
              plan: "Schedule Maintenance",
              editPlan: "Edit Maintenance Plan",
              service: "Record Completed Service",
              void: "Void Service Record",
              correctService: "Correct Service Record",
            }[action] || ""
          }
          dirty={dirty}
          onClose={close}
        >
          <form onSubmit={save} className="space-y-4 text-sm">
            {(action === "plan" || action === "service") && (
              <label className="block">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Equipment
                </span>
                <select
                  required
                  className={selectClass}
                  value={form.equipmentId || ""}
                  onChange={(e) => change("equipmentId", e.target.value)}
                >
                  <option value="">Select equipment</option>
                  {equipment.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.type}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {action === "plan" && (
              <>
                <Input
                  required
                  label="Plan title"
                  value={form.title || ""}
                  onChange={(e) => change("title", e.target.value)}
                />
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Trigger
                  </span>
                  <select
                    className={selectClass}
                    value={form.trigger}
                    onChange={(e) => change("trigger", e.target.value)}
                  >
                    <option value="CALENDAR">Calendar</option>
                    <option value="HOURS">Observed hours</option>
                    <option value="BOTH">Either threshold</option>
                  </select>
                </label>
                {form.trigger !== "HOURS" && (
                  <Input
                    required
                    label="Interval (days)"
                    type="number"
                    min="1"
                    value={form.intervalDays || ""}
                    onChange={(e) => change("intervalDays", e.target.value)}
                  />
                )}
                {form.trigger !== "CALENDAR" && (
                  <Input
                    required
                    label="Interval (observed hours)"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={form.intervalHours || ""}
                    onChange={(e) => change("intervalHours", e.target.value)}
                  />
                )}
                <Input
                  required
                  type="datetime-local"
                  label="Reference service date"
                  value={form.referenceServiceAt || ""}
                  onChange={(e) =>
                    change("referenceServiceAt", e.target.value)
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Reminder days"
                    type="number"
                    min="0"
                    value={form.reminderDays ?? 7}
                    onChange={(e) => change("reminderDays", e.target.value)}
                  />
                  <Input
                    label="Reminder hours"
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.reminderHours ?? 10}
                    onChange={(e) => change("reminderHours", e.target.value)}
                  />
                </div>
                <Input
                  label="Description"
                  value={form.description || ""}
                  onChange={(e) => change("description", e.target.value)}
                />
                <Input
                  label="Checklist"
                  value={form.checklist || ""}
                  onChange={(e) => change("checklist", e.target.value)}
                />
                <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Unknown monitoring time makes hour scheduling uncertain until
                  a confirmed threshold is reached.
                </p>
              </>
            )}

            {action === "editPlan" && (
              <>
                <Input
                  required
                  label="Plan title"
                  value={form.title || ""}
                  onChange={(e) => change("title", e.target.value)}
                />
                <Input
                  label="Description"
                  value={form.description || ""}
                  onChange={(e) => change("description", e.target.value)}
                />
                <Input
                  label="Checklist"
                  value={form.checklist || ""}
                  onChange={(e) => change("checklist", e.target.value)}
                />
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive === true}
                    onChange={(e) => change("isActive", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <Input
                  required
                  label="Change reason"
                  value={form.reason || ""}
                  onChange={(e) => change("reason", e.target.value)}
                />
              </>
            )}

            {(action === "service" || action === "correctService") && (
              <>
                {action === "service" && (
                  <label className="block">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Plan to reset (optional)
                    </span>
                    <select
                      className={selectClass}
                      value={form.planId || ""}
                      onChange={(e) => change("planId", e.target.value)}
                    >
                      <option value="">No plan</option>
                      {(data?.plans || [])
                        .filter(
                          (plan) => plan.equipment_id === form.equipmentId
                        )
                        .map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.title}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <Input
                  required
                  type="datetime-local"
                  label="Performed at"
                  value={form.performedAt || ""}
                  onChange={(e) => change("performedAt", e.target.value)}
                />
                <Input
                  required
                  label="Service description"
                  value={form.description || ""}
                  onChange={(e) => change("description", e.target.value)}
                />
                <Input
                  label="Completed checklist"
                  value={form.completedChecklist || ""}
                  onChange={(e) =>
                    change("completedChecklist", e.target.value)
                  }
                />
                <Input
                  label="Technician / provider"
                  value={form.technician || ""}
                  onChange={(e) => change("technician", e.target.value)}
                />
                <Input
                  label="Physical meter hours (if read)"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.meterHours || ""}
                  onChange={(e) => change("meterHours", e.target.value)}
                />
                {action === "service" && (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={form.resetsPlanBaseline === true}
                      onChange={(e) =>
                        change("resetsPlanBaseline", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                    />
                    <span className="text-sm">
                      Reset only this plan's baseline
                    </span>
                  </label>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Service cost"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={form.cost || ""}
                    onChange={(e) => change("cost", e.target.value)}
                  />
                  <Input
                    label="Currency"
                    value={form.currency || "TZS"}
                    onChange={(e) =>
                      change("currency", e.target.value.toUpperCase())
                    }
                  />
                </div>
                <Input
                  label="Reference"
                  value={form.reference || ""}
                  onChange={(e) => change("reference", e.target.value)}
                />
                <Input
                  label="Notes"
                  value={form.notes || ""}
                  onChange={(e) => change("notes", e.target.value)}
                />
                <p className="flex gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <Info size={12} className="mt-0.5 shrink-0" />A physical
                  meter reading remains separate from monitoring-derived hours.
                </p>
              </>
            )}

            {action === "correctService" && (
              <Input
                required
                label="Correction reason"
                value={form.correctionReason || ""}
                onChange={(e) => change("correctionReason", e.target.value)}
              />
            )}

            {action === "void" && (
              <Input
                required
                label="Correction reason"
                value={form.reason || ""}
                onChange={(e) => change("reason", e.target.value)}
              />
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
                Save
              </Button>
            </div>
          </form>
        </ActionModal>
      </div>
    </PageContainer>
  );
}