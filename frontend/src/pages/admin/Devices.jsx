// src/pages/admin/Devices.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Cpu,
  Eye,
  Filter,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  Server,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import {
  deviceApi,
  equipmentApi,
  organizationsApi,
  sitesApi,
} from "../../api/actPulse.Api";
import { formatDate } from "../../utils/formatDate";

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

const blank = {
  organizationId: "",
  siteId: "",
  equipmentId: "",
  name: "",
  deviceIdentifier: "",
  hardwareModel: "",
  firmwareVersion: "",
  heartbeatIntervalSeconds: 30,
  offlineTimeoutSeconds: 120,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function lifecycleStyle(state) {
  const s = String(state || "").toUpperCase();
  if (s === "ACTIVE")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30";
  if (s === "DISABLED")
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
  if (s === "RETIRED")
    return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700";
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

function humanize(v) {
  return String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ================================================================== */
/*  Devices                                                           */
/* ================================================================== */
export default function Devices() {
  /* ---------- lookups ---------- */
  const [organizations, setOrganizations] = useState([]);
  const [sites, setSites] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* ---------- filters ---------- */
  const [filters, setFilters] = useState({
    search: "",
    organizationId: "",
    siteId: "",
    equipmentId: "",
    lifecycle: "",
    connectivity: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  /* ---------- modal state ---------- */
  const [modal, setModal] = useState("");
  const [form, setForm] = useState(blank);
  const [selected, setSelected] = useState(null);
  const [keyInfo, setKeyInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ---------- load ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await deviceApi.list();
      setRows(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load monitors."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    Promise.all([
      organizationsApi.list(),
      sitesApi.list({ active: "all" }),
      equipmentApi.list({ active: "all" }),
    ])
      .then(([orgs, siteRows, equipmentRows]) => {
        setOrganizations(orgs.data || []);
        setSites(siteRows.data || []);
        setEquipment(equipmentRows.data || []);
      })
      .catch(() => setError("Could not load provisioning options."));
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------- live filter (client-side, memoized) ---------- */
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filters.organizationId && row.organizationId !== filters.organizationId) return false;
      if (filters.siteId && row.equipment?.site?.id !== filters.siteId) return false;
      if (filters.equipmentId && row.equipmentId !== filters.equipmentId) return false;
      if (filters.lifecycle && row.lifecycleState !== filters.lifecycle) return false;
      if (filters.connectivity && row.connectivity !== filters.connectivity) return false;
      if (
        q &&
        !`${row.name} ${row.deviceIdentifier} ${row.equipment?.name || ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [rows, filters]);

  /* ---------- pagination ---------- */
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, total);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const goTo = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  /* ---------- modal openers ---------- */
  const openForm = (row, action) => {
    setSelected(row);
    setForm(
      row
        ? {
            ...blank,
            name: row.name,
            deviceIdentifier: action === "replace" ? "" : row.deviceIdentifier,
            hardwareModel: row.hardwareModel || "",
            firmwareVersion: row.firmwareVersion || "",
            heartbeatIntervalSeconds: row.heartbeatIntervalSeconds,
            offlineTimeoutSeconds: row.offlineTimeoutSeconds,
          }
        : {
            ...blank,
            organizationId: filters.organizationId,
            siteId: filters.siteId,
            equipmentId: filters.equipmentId,
          }
    );
    setModal(action);
    setModalError("");
  };

  const closeModal = () => {
    if (busy) return;
    setModal("");
    setKeyInfo(null);
    setModalError("");
  };

  /* ---------- mutations ---------- */
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setModalError("");
    setNotice("");
    try {
      if (modal === "edit") {
        await deviceApi.update(selected.id, {
          name: form.name,
          hardwareModel: form.hardwareModel,
          firmwareVersion: form.firmwareVersion,
          heartbeatIntervalSeconds: Number(form.heartbeatIntervalSeconds),
          offlineTimeoutSeconds: Number(form.offlineTimeoutSeconds),
        });
        setModal("");
        setNotice("Monitor updated.");
      } else {
        const payload = {
          ...form,
          heartbeatIntervalSeconds: Number(form.heartbeatIntervalSeconds),
          offlineTimeoutSeconds: Number(form.offlineTimeoutSeconds),
        };
        const { data } =
          modal === "replace"
            ? await deviceApi.replace(selected.id, payload)
            : await deviceApi.create(payload);
        setKeyInfo(data);
        setModal("key");
        setNotice("Monitor provisioned. Copy its key now.");
      }
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not save monitor."
      );
    } finally {
      setBusy(false);
    }
  };

  const changeState = async (row, action) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deviceApi[action](row.id);
      await load();
      setNotice(`Monitor ${action}d.`);
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not change monitor state."
      );
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (row) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await deviceApi.rotateKey(row.id);
      setKeyInfo(data);
      setModal("key");
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not rotate the key."
      );
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = (row, action) => {
    setSelected(row);
    setModal(`confirm-${action}`);
    setModalError("");
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="IoT Monitors"
      subtitle="Provision, connect, replace and manage monitoring hardware"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Monitor filters">
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
                  equipmentId: "",
                  lifecycle: "",
                  connectivity: "",
                })
              }
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Reset
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
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
                    placeholder="Name, identifier, equipment…"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </label>
            </div>

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
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
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
                  })
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
                Equipment
              </span>
              <select
                className={selectClass}
                value={filters.equipmentId}
                onChange={(e) =>
                  setFilters({ ...filters, equipmentId: e.target.value })
                }
              >
                <option value="">All</option>
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
                Lifecycle
              </span>
              <select
                className={selectClass}
                value={filters.lifecycle}
                onChange={(e) =>
                  setFilters({ ...filters, lifecycle: e.target.value })
                }
              >
                <option value="">All</option>
                {["ACTIVE", "DISABLED", "RETIRED", "UNPROVISIONED"].map(
                  (state) => (
                    <option key={state}>{state}</option>
                  )
                )}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Connectivity
              </span>
              <select
                className={selectClass}
                value={filters.connectivity}
                onChange={(e) =>
                  setFilters({ ...filters, connectivity: e.target.value })
                }
              >
                <option value="">All</option>
                {["ONLINE", "OFFLINE", "NEVER_CONNECTED"].map((state) => (
                  <option key={state}>{state}</option>
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
            <Button
              size="sm"
              onClick={() => openForm(null, "create")}
              leftIcon={Plus}
            >
              Register Monitor
            </Button>
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
                Loading monitors…
              </p>
            </div>
          </div>
        ) : pageItems.length === 0 ? (
          <div
            className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Server size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {rows.length === 0
                ? "No monitors registered yet"
                : "No monitors match these filters"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {rows.length === 0
                ? "Register a monitor after creating a site and equipment profile."
                : "Try clearing some filters."}
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => openForm(null, "create")}
              leftIcon={Plus}
            >
              Register Monitor
            </Button>
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1150px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">Monitor</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Lifecycle</th>
                    <th className="p-3">Connectivity</th>
                    <th className="p-3">Observation</th>
                    <th className="p-3">Last contact</th>
                    <th className="p-3">Timing</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((row) => {
                    const c = connectivityStyle(row.connectivity);
                    const ConnectIcon = c.icon;
                    const isRetired = row.lifecycleState === "RETIRED";
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#064789] dark:text-[#8fc7e8]">
                              {row.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {row.deviceIdentifier}
                            </p>
                            {(row.hardwareModel || row.firmwareVersion) && (
                              <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                                {row.hardwareModel || "—"} · fw{" "}
                                {row.firmwareVersion || "—"}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className={tableCell}>
                          <div className="min-w-0">
                            <p className="truncate text-slate-700 dark:text-slate-200">
                              {row.equipment?.name || "Unbound"}
                            </p>
                            <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              <MapPin size={11} className="text-slate-400" />
                              {row.equipment?.site?.name || "No site"}
                            </p>
                          </div>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${lifecycleStyle(
                              row.lifecycleState
                            )}`}
                          >
                            {humanize(row.lifecycleState)}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.pill}`}
                          >
                            <ConnectIcon size={12} />
                            {humanize(row.connectivity)}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5">
                            <Activity size={14} className="text-slate-400" />
                            {row.currentStatus || "—"}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {row.lastSeenAt
                              ? formatDate(row.lastSeenAt, "UTC")
                              : "Never"}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <p>♥ {row.heartbeatIntervalSeconds}s</p>
                            <p>⚡ offline after {row.offlineTimeoutSeconds}s</p>
                          </div>
                        </td>
                        <td className={`${tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {row.equipmentId && (
                              <Link
                                to={`/admin/equipment/${row.equipmentId}`}
                                title="View equipment"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                              >
                                <Eye size={13} />
                                Equipment
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => openForm(row, "edit")}
                              title="Edit"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                            {!isRetired && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => rotate(row)}
                                  disabled={busy}
                                  title="Rotate key"
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                >
                                  <KeyRound size={13} />
                                  Rotate
                                </button>
                                {row.lifecycleState === "ACTIVE" ? (
                                  <button
                                    type="button"
                                    onClick={() => openConfirm(row, "disable")}
                                    disabled={busy}
                                    title="Disable"
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    <Power size={13} />
                                    Disable
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openConfirm(row, "activate")}
                                    disabled={busy}
                                    title="Activate"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  >
                                    <RotateCcw size={13} />
                                    Activate
                                  </button>
                                )}
                                {row.equipmentId && (
                                  <button
                                    type="button"
                                    onClick={() => openForm(row, "replace")}
                                    disabled={busy}
                                    title="Replace"
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    <Repeat size={13} />
                                    Replace
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openConfirm(row, "retire")}
                                  disabled={busy}
                                  title="Retire"
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                >
                                  <Ban size={13} />
                                  Retire
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

            {/* ============ PAGER ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {page}
                </strong>{" "}
                of {totalPages} · {total} Monitors
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

        {/* ============ FORM MODAL (create/edit/replace) ============ */}
        <Modal
          open={["create", "edit", "replace"].includes(modal)}
          onClose={closeModal}
          title={
            modal === "replace"
              ? "Replace Monitor"
              : modal === "edit"
                ? "Edit Monitor"
                : "Register Monitor"
          }
          size="lg"
        >
          <form onSubmit={save} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {modal === "replace" && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                The old monitor will be retired. Equipment history and
                Controller assignments remain intact.
              </p>
            )}

            {modal === "create" && (
              <>
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
                        equipmentId: "",
                      })
                    }
                  >
                    <option value="">Select active organization</option>
                    {organizations
                      .filter((org) => org.isActive)
                      .map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Site
                  </span>
                  <select
                    required
                    className={selectClass}
                    value={form.siteId}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        siteId: e.target.value,
                        equipmentId: "",
                      })
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

                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Equipment
                  </span>
                  <select
                    required
                    className={selectClass}
                    value={form.equipmentId}
                    onChange={(e) =>
                      setForm({ ...form, equipmentId: e.target.value })
                    }
                  >
                    <option value="">Select equipment without a monitor</option>
                    {equipment
                      .filter(
                        (row) =>
                          row.isActive &&
                          row.organizationId === form.organizationId &&
                          row.siteId === form.siteId &&
                          !rows.some((d) => d.equipmentId === row.id)
                      )
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}

            <Input
              label="Monitor name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              icon={Cpu}
            />

            {modal !== "edit" && (
              <Input
                label="Unique device identifier"
                required
                value={form.deviceIdentifier}
                onChange={(e) =>
                  setForm({ ...form, deviceIdentifier: e.target.value })
                }
                icon={Server}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Hardware model"
                value={form.hardwareModel}
                onChange={(e) =>
                  setForm({ ...form, hardwareModel: e.target.value })
                }
              />
              <Input
                label="Firmware version"
                value={form.firmwareVersion}
                onChange={(e) =>
                  setForm({ ...form, firmwareVersion: e.target.value })
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Heartbeat interval (seconds)"
                type="number"
                min="10"
                max="3600"
                value={form.heartbeatIntervalSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    heartbeatIntervalSeconds: e.target.value,
                  })
                }
              />
              <Input
                label="Offline timeout (seconds)"
                type="number"
                min="30"
                max="86400"
                value={form.offlineTimeoutSeconds}
                onChange={(e) =>
                  setForm({
                    ...form,
                    offlineTimeoutSeconds: e.target.value,
                  })
                }
              />
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
              <Button
                variant="outline"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save Monitor
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ ONE-TIME KEY MODAL ============ */}
        <Modal
          open={modal === "key"}
          onClose={closeModal}
          title="One-time API Key"
          size="lg"
        >
          {keyInfo && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <p className="text-amber-900 dark:text-amber-200">
                  Copy this key into the monitor firmware configuration now. It
                  is shown only once and cannot be retrieved later.
                </p>
              </div>

              <div className="relative">
                <code className="block break-all rounded-xl border border-slate-200 bg-slate-50 p-3 pr-12 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  {keyInfo.apiKey}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(keyInfo.apiKey || "")
                  }
                  title="Copy key"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <Copy size={14} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className={sectionTitle}>Authorization header</p>
                  <p className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-200">
                    ApiKey &lt;key&gt;
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className={sectionTitle}>Timing</p>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                    Heartbeat every {keyInfo.provisioning?.heartbeatIntervalSeconds}s
                    · offline after {keyInfo.provisioning?.offlineTimeoutSeconds}s
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className={sectionTitle}>Status endpoint</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                    {keyInfo.provisioning?.endpoint}
                  </p>
                  <p className={`${sectionTitle} mt-3`}>Heartbeat endpoint</p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                    {keyInfo.provisioning?.heartbeatEndpoint}
                  </p>
                </div>
              </div>

              <p className="text-xs text-amber-700 dark:text-amber-300">
                If this was a rotation or replacement, the previous firmware key
                is invalid immediately. Use HTTPS outside local development.
              </p>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                <Button
                  onClick={() =>
                    navigator.clipboard.writeText(keyInfo.apiKey || "")
                  }
                  leftIcon={Copy}
                >
                  Copy Key
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ CONFIRM STATE MODALS ============ */}
        {["disable", "activate", "retire"].map((action) => {
          const isDanger = action === "retire" || action === "disable";
          const Icon =
            action === "retire" ? Ban : action === "disable" ? Power : RotateCcw;
          const title =
            action === "retire"
              ? "Retire Monitor"
              : action === "disable"
                ? "Disable Monitor"
                : "Activate Monitor";
          const consequence =
            action === "retire"
              ? "Its binding will close and it cannot be reactivated."
              : action === "disable"
                ? "It will stop accepting status and heartbeats."
                : "It will accept data again.";
          return (
            <Modal
              key={action}
              open={modal === `confirm-${action}`}
              onClose={closeModal}
              title={title}
              size="sm"
            >
              {selected && (
                <div className="space-y-4 text-sm">
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isDanger
                          ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {title} "{selected.name}"?
                      </p>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">
                        {consequence}
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
                    <Button
                      variant="outline"
                      onClick={closeModal}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={isDanger ? "danger" : "success"}
                      onClick={() => {
                        const target = selected;
                        closeModal();
                        void changeState(target, action);
                      }}
                      loading={busy}
                      leftIcon={Icon}
                    >
                      {action === "retire"
                        ? "Retire"
                        : action === "disable"
                          ? "Disable"
                          : "Activate"}
                    </Button>
                  </div>
                </div>
              )}
            </Modal>
          );
        })}
      </div>
    </PageContainer>
  );
}