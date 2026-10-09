// src/pages/shared/Equipment.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cpu,
  Eye,
  Filter,
  Fuel,
  Gauge,
  Info,
  MapPin,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Search,
  UserCog,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
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
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import {
  equipmentApi,
  organizationsApi,
  sitesApi,
  usersApi,
} from "../../api/actPulse.Api";
import { getSocket } from "../../components/realtime/socket";
import { useAuthStore } from "../../store/auth.store";
import { useThemeContext } from "../../context/ThemeContext";

/* ------------------------------------------------------------------ */
/*  Style tokens                                                      */
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

const empty = {
  organizationId: "",
  siteId: "",
  type: "GENERATOR",
  monitoringDefinition: "OUTPUT_POWER_PRESENT",
  name: "",
  assetTag: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  installationDate: "",
  description: "",
  ratedCapacityKva: "",
  fuelType: "",
  tankCapacityLitres: "",
  openingRunningHours: "",
  openingHoursAt: "",
  serviceIntervalHours: "",
  ratedCapacityKw: "",
  batteryCapacityAh: "",
  nominalBatteryVoltage: "",
  batteryNotes: "",
};

const numeric = [
  "ratedCapacityKva",
  "tankCapacityLitres",
  "openingRunningHours",
  "serviceIntervalHours",
  "ratedCapacityKw",
  "batteryCapacityAh",
  "nominalBatteryVoltage",
];

const definitionText = {
  OUTPUT_POWER_PRESENT: "Output power present",
  ENGINE_RUNNING: "Engine running",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const hours = (ms) => (ms == null ? "—" : (ms / 3600000).toFixed(2));

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
      icon: Wifi,
    };
  if (s === "OFFLINE")
    return {
      pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
      icon: WifiOff,
    };
  return {
    pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    icon: WifiOff,
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

/* ================================================================== */
/*  Equipment (list + detail)                                         */
/* ================================================================== */
export default function Equipment() {
  const user = useAuthStore((state) => state.user);
  const admin = user?.role === "Admin" || user?.role === "ADMIN";
  const base = admin ? "/admin" : "/controller";
  const navigate = useNavigate();
  const { darkMode } = useThemeContext();

  /* ---------- list state ---------- */
  const [rows, setRows] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [sites, setSites] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    organizationId: "",
    siteId: "",
    type: "",
    active: "true",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* ---------- modal state ---------- */
  const [modal, setModal] = useState("");
  const [form, setForm] = useState(empty);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ---------- assignment state ---------- */
  const [controllers, setControllers] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");

  /* ---------- detail state (for the View modal) ---------- */
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPreset, setDetailPreset] = useState("7d");
  const [detailFrom, setDetailFrom] = useState("");
  const [detailTo, setDetailTo] = useState("");
  const [detailEvents, setDetailEvents] = useState(null);
  const [detailEventsPage, setDetailEventsPage] = useState(1);
  const organizationNames = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  );
  /* ---------- lookups ---------- */
  useEffect(() => {
    sitesApi
      .list({ active: "all" })
      .then(({ data }) => setSites(data || []))
      .catch(() => setError("Could not load sites."));
    if (admin) {
      organizationsApi
        .list()
        .then(({ data }) => setOrganizations(Array.isArray(data) ? data : data?.items || []))
        .catch(() => setError("Could not load organizations."));
    }
  }, [admin]);

  /* ---------- list load ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await equipmentApi.list({
        search: filters.search || undefined,
        organizationId: filters.organizationId || undefined,
        siteId: filters.siteId || undefined,
        type: filters.type || undefined,
        active: filters.active,
      });
      setRows(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load equipment."
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  /* ---------- pagination ---------- */
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const fromIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toIndex = Math.min(currentPage * pageSize, total);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const goTo = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  /* ---------- modal openers ---------- */
  const openCreate = () => {
    setSelected(null);
    setForm({
      ...empty,
      organizationId: filters.organizationId,
      siteId: filters.siteId,
    });
    setModalError("");
    setModal("form");
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      ...empty,
      ...row,
      siteId: row.siteId,
      openingHoursAt: row.openingHoursAt
        ? new Date(row.openingHoursAt).toISOString().slice(0, 16)
        : "",
      installationDate: row.installationDate || "",
    });
    setModalError("");
    setModal("form");
  };

  const openArchive = (row) => {
    setSelected(row);
    setModalError("");
    setModal("archive");
  };

  const openActivate = (row) => {
    setSelected(row);
    setModalError("");
    setModal("activate");
  };

  const closeModal = () => {
    if (busy) return;
    setModal("");
    setModalError("");
    setControllers([]);
    setAssigned([]);
    setAssignmentSearch("");
  };

  /* ---------- view modal: load full detail ---------- */
  const loadDetail = useCallback(
    async (id, opts = {}) => {
      const preset = opts.preset ?? detailPreset;
      const from = opts.from ?? detailFrom;
      const to = opts.to ?? detailTo;
      const eventsPage = opts.eventsPage ?? detailEventsPage;
      setDetailLoading(true);
      setModalError("");
      try {
        const params =
          preset === "custom"
            ? {
                from: new Date(from).toISOString(),
                to: new Date(to).toISOString(),
              }
            : { preset };
        const { data } = await equipmentApi.detail(id, params);
        setDetail(data);
        const eventResponse = await equipmentApi.events(id, {
          from: data.metrics.period.from,
          to: data.metrics.period.to,
          timezone: data.metrics.timezone,
          page: eventsPage,
          pageSize: 20,
        });
        setDetailEvents(eventResponse.data);
      } catch (err) {
        setModalError(
          err?.response?.data?.message ||
            "Could not load equipment details."
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [detailPreset, detailFrom, detailTo, detailEventsPage]
  );

  const openView = (row) => {
    setSelected(row);
    setDetail(null);
    setDetailEvents(null);
    setDetailPreset("7d");
    setDetailFrom("");
    setDetailTo("");
    setDetailEventsPage(1);
    setModalError("");
    setModal("view");
    void loadDetail(row.id, {
      preset: "7d",
      eventsPage: 1,
    });
  };

  /* ---------- view modal: realtime refresh ---------- */
  useEffect(() => {
    if (modal !== "view" || !selected?.id) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const refresh = (payload) => {
      if (payload?.equipmentId === selected.id) {
        void loadDetail(selected.id);
      }
    };
    socket.on("equipment.state.updated", refresh);
    socket.on("monitor.connection.updated", refresh);
    socket.on("connect", refresh);
    return () => {
      socket.off("equipment.state.updated", refresh);
      socket.off("monitor.connection.updated", refresh);
      socket.off("connect", refresh);
    };
  }, [modal, selected?.id, loadDetail]);

  /* ---------- view modal: react to preset/date changes ---------- */
  useEffect(() => {
    if (modal !== "view" || !selected?.id) return undefined;
    if (detailPreset === "custom" && (!detailFrom || !detailTo)) return undefined;
    const t = setTimeout(() => {
      void loadDetail(selected.id, {
        preset: detailPreset,
        from: detailFrom,
        to: detailTo,
        eventsPage: 1,
      });
      setDetailEventsPage(1);
    }, 0);
    return () => clearTimeout(t);
  }, [detailPreset, detailFrom, detailTo, modal, selected?.id, loadDetail]);

  /* ---------- save ---------- */
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setModalError("");
    setNotice("");
    try {
      const payload = Object.fromEntries(
        Object.keys(empty).map((key) => [key, form[key]])
      );
      numeric.forEach((key) => {
        if (payload[key] === "" || payload[key] === null) delete payload[key];
        else payload[key] = Number(payload[key]);
      });
      if (!payload.openingHoursAt) delete payload.openingHoursAt;
      else payload.openingHoursAt = new Date(payload.openingHoursAt).toISOString();
      if (!payload.installationDate) delete payload.installationDate;

      if (selected) {
        delete payload.organizationId;
        await equipmentApi.update(selected.id, payload);
        setNotice("Equipment profile updated.");
      } else {
        await equipmentApi.create(payload);
        setNotice("Equipment profile created.");
      }
      setModal("");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not save equipment."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------- archive / activate ---------- */
  const confirmArchive = async () => {
    setBusy(true);
    setModalError("");
    try {
      await equipmentApi.archive(selected.id);
      setModal("");
      setNotice("Equipment archived.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not archive equipment."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmActivate = async () => {
    setBusy(true);
    setModalError("");
    try {
      await equipmentApi.activate(selected.id);
      setModal("");
      setNotice("Equipment activated.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not activate equipment."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------- assignments ---------- */
  const openAssign = async (row) => {
    setSelected(row);
    setModal("assign");
    setModalError("");
    setControllers([]);
    setAssigned([]);
    setAssignmentSearch("");
    try {
      const { data } = await usersApi.list({
        organizationId: row.organizationId,
        pageSize: 100,
      });
      const items = data?.items || [];
      setControllers(items);
      setAssigned(
        items
          .filter((u) => u.equipmentIds?.includes(row.id))
          .map((u) => u.id)
      );
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not load Controllers."
      );
    }
  };

  const saveAssignments = async () => {
    setBusy(true);
    setModalError("");
    try {
      await equipmentApi.assignControllers(selected.id, assigned);
      setNotice("Controller access updated. Existing sessions were refreshed.");
      setModal("");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not save assignments."
      );
    } finally {
      setBusy(false);
    }
  };

  const filteredControllers = useMemo(() => {
    if (!assignmentSearch.trim()) return controllers;
    const q = assignmentSearch.toLowerCase();
    return controllers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [controllers, assignmentSearch]);

  /* ---------- detail-derived data ---------- */
  const metrics = detail?.metrics;
  const snapshot = detail?.snapshot;
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
    detail?.monitoringDefinition === "ENGINE_RUNNING"
      ? "Observed engine hours"
      : "Observed output-powered hours";
  const specs =
    detail &&
    [
      ["Asset tag", detail.assetTag],
      ["Manufacturer", detail.manufacturer],
      ["Model", detail.model],
      ["Serial number", detail.serialNumber],
      ["Installed", detail.installationDate],
      ["Rated kVA", detail.ratedCapacityKva],
      ["Fuel type (configured)", detail.fuelType],
      ["Tank capacity (configured litres)", detail.tankCapacityLitres],
      ["Rated kW", detail.ratedCapacityKw],
      ["Battery capacity (Ah)", detail.batteryCapacityAh],
      ["Nominal battery voltage", detail.nominalBatteryVoltage],
      ["Battery notes", detail.batteryNotes],
    ].filter(([, v]) => v != null && v !== "");

  const axisColor = darkMode ? "#94a3b8" : "#64748b";
  const gridColor = darkMode ? "#1e293b" : "#eef2f7";

  /* ================================================================ */
  return (
    <PageContainer
      title="Equipment"
      subtitle={
        admin
          ? "Generator and UPS profiles, independent of their IoT monitors"
          : "Generators and UPS systems assigned to your account"
      }
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Equipment filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  search: "",
                  organizationId: "",
                  siteId: "",
                  type: "",
                  active: "true",
                })
              }
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
                    placeholder="Name, tag, serial, model…"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </label>
            </div>

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
                onChange={(e) =>
                  setFilters({ ...filters, siteId: e.target.value })
                }
              >
                <option value="">All</option>
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
                <option value="">All types</option>
                <option value="GENERATOR">Generator</option>
                <option value="UPS">UPS</option>
                <option value="UNSPECIFIED">Needs classification</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                className={selectClass}
                value={filters.active}
                onChange={(e) =>
                  setFilters({ ...filters, active: e.target.value })
                }
              >
                <option value="true">Active</option>
                <option value="false">Archived</option>
                <option value="all">All</option>
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
              <Button size="sm" onClick={openCreate} leftIcon={Plus}>
                Add Equipment
              </Button>
            )}
          </div>
        </div>

        {/* ============ MESSAGES ============ */}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            {notice}
          </p>
        )}

        {/* ============ TABLE ============ */}
        {loading ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading equipment…
              </p>
            </div>
          </div>
        ) : pageItems.length === 0 ? (
          <div
            className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Gauge size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {rows.length === 0
                ? "No equipment yet"
                : "No equipment matches these filters"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {rows.length === 0
                ? admin
                  ? "Create a site first, then add equipment."
                  : "Ask an Admin to assign equipment to your account."
                : "Try adjusting the search or filters."}
            </p>
            {admin && (
              <Button
                size="sm"
                className="mt-4"
                onClick={openCreate}
                leftIcon={Plus}
              >
                Add Equipment
              </Button>
            )}
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">Equipment</th>
                    {admin && <th className="p-3">Organization</th>}
                    <th className="p-3">Site</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">State</th>
                    <th className="p-3">Monitor</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const s = stateStyle(row.snapshot?.state);
                    const c = connectivityStyle(row.snapshot?.connectivity);
                    const ConnectIcon = c.icon;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-xs font-bold text-white">
                              {initials(row.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {row.name}
                              </p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {row.assetTag || row.serialNumber || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        {admin && (
                          <td className={tableCell}>
                            <span className="truncate">
                              {organizationNames.get(row.organizationId) ||
                                row.organization?.name ||
                                row.organizationName ||
                                "—"}
                            </span>
                          </td>
                        )}
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin size={12} className="text-slate-400" />
                            <span className="truncate">
                              {row.site?.name || "—"}
                            </span>
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${typePill(
                              row.type
                            )}`}
                          >
                            {row.type === "UNSPECIFIED"
                              ? "Needs classification"
                              : row.type}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.pill}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${s.dot}`}
                            />
                            {s.label}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.pill}`}
                          >
                            <ConnectIcon size={12} />
                            {row.snapshot?.connectivity
                              ? String(row.snapshot.connectivity)
                                  .replace("_", " ")
                                  .toLowerCase()
                              : "unknown"}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                              row.isActive
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                : "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                            }`}
                          >
                            {row.isActive ? "Active" : "Archived"}
                          </span>
                        </td>
                        <td className={`${tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openView(row)}
                              title="View details"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            <Link
                              to={`${base}/equipment/${row.id}`}
                              title="Open equipment"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Gauge size={13} />
                              Open
                            </Link>
                            {admin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  title="Edit"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <Pencil size={13} />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void openAssign(row)}
                                  title="Assign controllers"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <UserCog size={13} />
                                  Controllers
                                </button>
                                {row.isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => openArchive(row)}
                                    title="Archive"
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                  >
                                    <Archive size={13} />
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openActivate(row)}
                                    title="Activate"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  >
                                    <ArchiveRestore size={13} />
                                    Activate
                                  </button>
                                )}
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

            {/* ============ PAGER ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {currentPage}
                </strong>{" "}
                of {totalPages} · {total} Equipment
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
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="First page"
                  >
                    <ChevronsLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => goTo(totalPages)}
                    disabled={currentPage >= totalPages}
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

        {/* ============ CREATE / EDIT MODAL ============ */}
        <Modal
          open={modal === "form"}
          onClose={closeModal}
          title={selected ? "Edit Equipment" : "Add Equipment"}
          size="xl"
        >
          <form
            onSubmit={save}
            className="max-h-[72vh] space-y-4 overflow-y-auto pr-1"
          >
            {!selected && (
              <label className="block text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Organization
                </span>
                <select
                  required
                  className={selectClass}
                  value={form.organizationId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      organizationId: e.target.value,
                      siteId: "",
                    })
                  }
                >
                  <option value="">Select organization</option>
                  {organizations
                    .filter((org) => org.isActive)
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Site
              </span>
              <select
                required
                className={selectClass}
                value={form.siteId}
                onChange={(e) =>
                  setForm({ ...form, siteId: e.target.value })
                }
              >
                <option value="">Select active site</option>
                {sites
                  .filter(
                    (site) =>
                      site.isActive &&
                      site.organizationId === form.organizationId
                  )
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
              </select>
            </label>

            <Input
              label="Equipment name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              icon={Gauge}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Type
                </span>
                <select
                  className={selectClass}
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value,
                      monitoringDefinition:
                        e.target.value === "UPS"
                          ? "OUTPUT_POWER_PRESENT"
                          : form.monitoringDefinition,
                    })
                  }
                >
                  <option value="GENERATOR">Generator</option>
                  <option value="UPS">UPS</option>
                  {selected?.type === "UNSPECIFIED" && (
                    <option value="UNSPECIFIED">Needs classification</option>
                  )}
                </select>
              </label>

              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Input measures
                </span>
                <select
                  className={selectClass}
                  value={form.monitoringDefinition || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monitoringDefinition: e.target.value,
                    })
                  }
                >
                  <option value="">Select definition</option>
                  <option value="OUTPUT_POWER_PRESENT">
                    Output power present
                  </option>
                  {form.type === "GENERATOR" && (
                    <option value="ENGINE_RUNNING">Engine running</option>
                  )}
                </select>
              </label>
            </div>

            {form.type === "GENERATOR" && (
              <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                Use "Engine running" only when the physical input confirms
                engine operation. Output voltage alone measures powered output
                time.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Asset tag"
                value={form.assetTag || ""}
                onChange={(e) =>
                  setForm({ ...form, assetTag: e.target.value })
                }
              />
              <Input
                label="Serial number"
                value={form.serialNumber || ""}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Manufacturer"
                value={form.manufacturer || ""}
                onChange={(e) =>
                  setForm({ ...form, manufacturer: e.target.value })
                }
              />
              <Input
                label="Model"
                value={form.model || ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Rated capacity (kVA)"
                type="number"
                min="0"
                step="any"
                value={form.ratedCapacityKva ?? ""}
                onChange={(e) =>
                  setForm({ ...form, ratedCapacityKva: e.target.value })
                }
              />
              <Input
                label="Installation date"
                type="date"
                value={form.installationDate || ""}
                onChange={(e) =>
                  setForm({ ...form, installationDate: e.target.value })
                }
              />
            </div>

            {form.type === "GENERATOR" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Fuel type (configuration)"
                    value={form.fuelType || ""}
                    onChange={(e) =>
                      setForm({ ...form, fuelType: e.target.value })
                    }
                    icon={Fuel}
                  />
                  <Input
                    label="Tank capacity (litres, configuration)"
                    type="number"
                    min="0"
                    step="any"
                    value={form.tankCapacityLitres ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tankCapacityLitres: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Opening meter hours"
                    type="number"
                    min="0"
                    step="any"
                    value={form.openingRunningHours ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        openingRunningHours: e.target.value,
                      })
                    }
                  />
                  <Input
                    label="Opening meter timestamp"
                    type="datetime-local"
                    value={form.openingHoursAt || ""}
                    onChange={(e) =>
                      setForm({ ...form, openingHoursAt: e.target.value })
                    }
                  />
                </div>
                <Input
                  label="Service interval (hours, configuration)"
                  type="number"
                  min="0"
                  step="any"
                  value={form.serviceIntervalHours ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serviceIntervalHours: e.target.value,
                    })
                  }
                />
              </>
            )}

            {form.type === "UPS" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Rated capacity (kW)"
                    type="number"
                    min="0"
                    step="any"
                    value={form.ratedCapacityKw ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, ratedCapacityKw: e.target.value })
                    }
                  />
                  <Input
                    label="Battery capacity (Ah)"
                    type="number"
                    min="0"
                    step="any"
                    value={form.batteryCapacityAh ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        batteryCapacityAh: e.target.value,
                      })
                    }
                  />
                </div>
                <Input
                  label="Nominal battery voltage"
                  type="number"
                  min="0"
                  step="any"
                  value={form.nominalBatteryVoltage ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nominalBatteryVoltage: e.target.value,
                    })
                  }
                />
                <Input
                  label="Battery notes"
                  value={form.batteryNotes || ""}
                  onChange={(e) =>
                    setForm({ ...form, batteryNotes: e.target.value })
                  }
                />
              </>
            )}

            <Input
              label="Description"
              value={form.description || ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />

            {modalError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                {modalError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {selected ? "Save Changes" : "Add Equipment"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ VIEW MODAL (full detail) ============ */}
        <Modal
          open={modal === "view"}
          onClose={closeModal}
          title="Equipment Profile"
          size="full"
        >
          {detailLoading && !detail ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading equipment profile…
                </p>
              </div>
            </div>
          ) : !detail ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Could not load equipment details.
            </p>
          ) : (
            <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
              {/* ------- Header ------- */}
              <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 to-[#427aa1]/5 p-4 dark:border-slate-700 dark:from-[#064789]/15 dark:to-[#427aa1]/10">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-lg font-bold text-white">
                  {initials(detail.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {detail.type === "UNSPECIFIED"
                      ? "Needs classification"
                      : detail.type}
                  </p>
                  <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                    {detail.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {detail.site?.name || "Site"} ·{" "}
                    {definitionText[detail.monitoringDefinition] ||
                      "Needs classification"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
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
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
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
                  {!detail.isActive && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      Archived
                    </span>
                  )}
                </div>
              </div>

              {/* ------- Disclaimer banners ------- */}
              {detail.type === "UNSPECIFIED" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  This migrated profile needs Admin classification before its
                  input meaning can be stated.
                </p>
              )}
              {!detail.isActive && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Archived equipment. Its linked monitor cannot submit new
                  observations; history remains available.
                </p>
              )}

              {/* ------- Period selector ------- */}
              <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4 dark:border-slate-700 dark:bg-slate-800/40">
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Period
                  </span>
                  <select
                    className={selectClass}
                    value={detailPreset}
                    onChange={(e) => {
                      setDetailPreset(e.target.value);
                      setDetailEventsPage(1);
                    }}
                  >
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {detailPreset === "custom" && (
                  <>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        From
                      </span>
                      <input
                        type="datetime-local"
                        className={selectClass}
                        value={detailFrom}
                        onChange={(e) => {
                          setDetailFrom(e.target.value);
                          setDetailEventsPage(1);
                        }}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        To
                      </span>
                      <input
                        type="datetime-local"
                        className={selectClass}
                        value={detailTo}
                        onChange={(e) => {
                          setDetailTo(e.target.value);
                          setDetailEventsPage(1);
                        }}
                      />
                    </label>
                  </>
                )}
                {metrics && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-4">
                    UTC: {new Date(metrics.period.from).toLocaleString()} –{" "}
                    {new Date(metrics.period.to).toLocaleString()} · Calendar:{" "}
                    {metrics.timezone}
                  </div>
                )}
              </div>

              {/* ------- Snapshot cards ------- */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Current state", snapshot?.state, Power],
                  ["Confidence", snapshot?.confidence, CheckCircle2],
                  ["Monitor", snapshot?.connectivity, Cpu],
                  [durationLabel, hours(metrics?.onMs), Zap],
                  ["OFF hours", hours(metrics?.offMs), Power],
                  ["Unknown hours", hours(metrics?.unknownMs), Info],
                  [
                    "Coverage",
                    metrics?.dataCoverage == null
                      ? "—"
                      : `${(metrics.dataCoverage * 100).toFixed(1)}%`,
                    BarChart3,
                  ],
                  [
                    "Eligible monitoring hours",
                    hours(metrics?.eligibleMs),
                    Clock,
                  ],
                ].map(([title, value, Icon]) => (
                  <div key={title} className={cardPad}>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Icon size={12} />
                      {title}
                    </div>
                    <p className="mt-1 truncate text-xl font-bold text-slate-800 dark:text-slate-100">
                      {value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>

              {/* ------- Last known ------- */}
              {snapshot?.lastKnownStatus &&
                snapshot?.state === "UNKNOWN" && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    Last known {snapshot.lastKnownStatus} — monitor{" "}
                    {String(snapshot.connectivity || "").toLowerCase()} — last
                    confirmed{" "}
                    {snapshot.lastConfirmedAt
                      ? new Date(snapshot.lastConfirmedAt).toLocaleString()
                      : "—"}
                  </p>
                )}

              {/* ------- Chart + Specs ------- */}
              <div className="grid gap-4 lg:grid-cols-2">
                <section className={cardPad}>
                  <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Daily observed duration
                  </h3>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    ON, OFF and unknown hours stacked per day.
                  </p>
                  {chart.length === 0 ? (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
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
                            }}
                            formatter={(v) => `${Number(v).toFixed(2)} h`}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11, color: axisColor }}
                            iconType="circle"
                          />
                          <Bar
                            dataKey="ON"
                            stackId="a"
                            fill="#10b981"
                            radius={[0, 0, 0, 0]}
                          />
                          <Bar
                            dataKey="OFF"
                            stackId="a"
                            fill="#f97316"
                            radius={[0, 0, 0, 0]}
                          />
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

                <section className={cardPad}>
                  <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Profile and monitor
                  </h3>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {specs.map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-lg border border-slate-100 p-2 dark:border-slate-800"
                      >
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {k}
                        </dt>
                        <dd className="truncate text-slate-800 dark:text-slate-100">
                          {String(v)}
                        </dd>
                      </div>
                    ))}
                    <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Monitor
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.monitor?.name || "No current monitor"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Last contact
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.lastSeenAt
                          ? new Date(snapshot.lastSeenAt).toLocaleString()
                          : "Never connected"}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Last confirmed
                      </dt>
                      <dd className="truncate text-slate-800 dark:text-slate-100">
                        {snapshot?.lastConfirmedAt
                          ? new Date(snapshot.lastConfirmedAt).toLocaleString()
                          : "None"}
                      </dd>
                    </div>
                  </dl>
                  {detail.description && (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      {detail.description}
                    </p>
                  )}
                  {detail.runningBaseline && (
                    <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                      Opening meter: {detail.runningBaseline.openingHours} h at{" "}
                      {new Date(
                        detail.runningBaseline.openingAt
                      ).toLocaleString()}
                      . Observed since baseline:{" "}
                      {detail.runningBaseline.observedEngineHours.toFixed(2)} h.
                      Tracked cumulative:{" "}
                      {detail.runningBaseline.trackedCumulativeHours.toFixed(2)}{" "}
                      h
                      {detail.runningBaseline.incomplete
                        ? " (incomplete: unknown gaps)"
                        : ""}
                      .
                    </p>
                  )}
                </section>
              </div>

              {/* ------- Sessions ------- */}
              <section className={cardPad}>
                <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Observed ON sessions
                </h3>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  OFF completes a session. A freshness gap interrupts it; no
                  operation is assumed during unknown time.
                </p>
                {!metrics?.sessions?.length ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No observed ON sessions in this period.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {metrics.sessions.slice(0, 50).map((session, index) => (
                      <div
                        key={`${session.start}-${index}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800"
                      >
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {new Date(session.start).toLocaleString()}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {hours(session.durationMs)} hours
                          </p>
                        </div>
                        <div className="flex gap-2">
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

              {/* ------- Events ------- */}
              <section className={cardPad}>
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Events
                </h3>
                {!detailEvents?.items?.length ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No observations or connectivity events in this period.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailEvents.items.map((event) => (
                      <div
                        key={event.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800"
                      >
                        <span className="text-slate-700 dark:text-slate-200">
                          {event.type === "OBSERVATION"
                            ? `${event.status} ${String(event.kind || "").toLowerCase()}`
                            : `Monitor ${String(event.status || "").toLowerCase()}`}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(event.at).toLocaleString()} ·{" "}
                          {String(event.deviceId || "").slice(0, 8)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Page {detailEventsPage} of{" "}
                    {Math.max(
                      1,
                      Math.ceil((detailEvents?.total || 0) / 20)
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={detailEventsPage === 1}
                      onClick={() => {
                        const next = detailEventsPage - 1;
                        setDetailEventsPage(next);
                        void loadDetail(selected.id, {
                          eventsPage: next,
                        });
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        !detailEvents ||
                        detailEventsPage * 20 >= (detailEvents.total || 0)
                      }
                      onClick={() => {
                        const next = detailEventsPage + 1;
                        setDetailEventsPage(next);
                        void loadDetail(selected.id, {
                          eventsPage: next,
                        });
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </section>

              {/* ------- Footer actions ------- */}
              {modalError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {modalError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    closeModal();
                    navigate(`${base}/equipment/${detail.id}`);
                  }}
                  leftIcon={Gauge}
                >
                  Open Equipment
                </Button>
                {admin && (
                  <Button
                    onClick={() => {
                      closeModal();
                      openEdit(detail);
                    }}
                    leftIcon={Pencil}
                  >
                    Edit Equipment
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ============ ASSIGN MODAL ============ */}
        <Modal
          open={modal === "assign"}
          onClose={closeModal}
          title={`Controllers for ${selected?.name || "equipment"}`}
          size="lg"
        >
          <div className="space-y-4 text-sm">
            <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              Assignments stay with this equipment if its monitor is replaced.
            </p>

            {controllers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No Controllers in this organization.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search controllers…"
                      value={assignmentSearch}
                      onChange={(e) => setAssignmentSearch(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAssigned(
                        filteredControllers.every((c) =>
                          assigned.includes(c.id)
                        )
                          ? assigned.filter(
                              (id) =>
                                !filteredControllers.some((c) => c.id === id)
                            )
                          : [
                              ...new Set([
                                ...assigned,
                                ...filteredControllers.map((c) => c.id),
                              ]),
                            ]
                      )
                    }
                    className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-300 dark:hover:text-[#8fc7e8]"
                  >
                    {filteredControllers.length > 0 &&
                    filteredControllers.every((c) => assigned.includes(c.id))
                      ? "Clear all"
                      : "Select all"}
                  </button>
                </div>

                <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {filteredControllers.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-400">
                      No matches for "{assignmentSearch}".
                    </p>
                  ) : (
                    filteredControllers.map((c) => {
                      const checked = assigned.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 text-sm transition-colors ${
                            checked
                              ? "bg-[#064789]/5 dark:bg-[#427aa1]/10"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAssigned(
                                checked
                                  ? assigned.filter((id) => id !== c.id)
                                  : [...assigned, c.id]
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                          />
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-[10px] font-bold text-white">
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                              {c.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {c.email}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {assigned.length} of {controllers.length} controllers
                  selected
                </p>
              </>
            )}

            {modalError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                {modalError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={saveAssignments}
                loading={busy}
                leftIcon={Users}
              >
                Save Assignments
              </Button>
            </div>
          </div>
        </Modal>

        {/* ============ ARCHIVE MODAL ============ */}
        <Modal
          open={modal === "archive"}
          onClose={closeModal}
          title="Archive Equipment"
          size="sm"
        >
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                  <Archive size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Archive {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Archiving stops new observations from its linked monitor
                    while preserving history.
                  </p>
                </div>
              </div>
              {modalError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {modalError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeModal} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={confirmArchive}
                  loading={busy}
                  leftIcon={Archive}
                >
                  Archive
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ ACTIVATE MODAL ============ */}
        <Modal
          open={modal === "activate"}
          onClose={closeModal}
          title="Activate Equipment"
          size="sm"
        >
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <ArchiveRestore size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Activate {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Its linked monitor will resume accepting observations.
                  </p>
                </div>
              </div>
              {modalError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {modalError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeModal} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={confirmActivate}
                  loading={busy}
                  leftIcon={ArchiveRestore}
                >
                  Activate
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageContainer>
  );
}
