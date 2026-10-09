// src/pages/admin/Organizations.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cpu,
  Eye,
  Filter,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  User as UserIcon,
  Users,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import { organizationsApi } from "../../api/actPulse.Api";
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
const emptyForm = { name: "", contactEmail: "", contactPhone: "" };

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function initials(name) {
  if (!name) return "?";
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function statusStyle(isActive) {
  return isActive
    ? {
        pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
        dot: "bg-emerald-500",
        label: "Active",
      }
    : {
        pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        dot: "bg-slate-400",
        label: "Inactive",
      };
}

function DetailRow({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
        {value || "—"}
      </p>
    </div>
  );
}

/* ================================================================== */
/*  Organizations                                                     */
/* ================================================================== */
export default function Organizations() {
  /* ---------- list state ---------- */
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------- modal state ---------- */
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ---------- load ---------- */
  const load = useCallback(
    async (opts = {}) => {
      const useSearch = opts.search ?? search;
      setLoading(true);
      setError("");
      try {
        const { data } = await organizationsApi.list(
          useSearch ? { search: useSearch } : undefined
        );
        setItems(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Could not load organizations."
        );
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await organizationsApi.list();
        if (active) setItems(Array.isArray(data) ? data : data?.items || []);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message || "Could not load organizations."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ---------- live search (debounced) ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      void load({ search });
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /* ---------- filter + pagination (client-side) ---------- */
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "inactive" && item.isActive) return false;
      return true;
    });
  }, [items, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, total);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const goTo = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  /* ---------- modal openers ---------- */
  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setModalError("");
    setModal("form");
  };
  const openEdit = (item) => {
    setSelected(item);
    setForm({
      name: item.name || "",
      contactEmail: item.contactEmail || "",
      contactPhone: item.contactPhone || "",
    });
    setModalError("");
    setModal("form");
  };
  const openDetails = async (item) => {
    setSelected(item);
    setDetails(null);
    setModalError("");
    setDetailsLoading(true);
    setModal("details");
    try {
      const { data } = await organizationsApi.getById(item.id);
      setDetails(data);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not load organization details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };
  const openToggle = (item) => {
    setSelected(item);
    setModalError("");
    setModal(item.isActive ? "deactivate" : "activate");
  };

  const closeModal = () => {
    if (busy) return;
    setModal("");
    setModalError("");
    setDetails(null);
  };

  /* ---------- mutations ---------- */
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setModalError("");
    const payload = { name: form.name.trim() };
    if (form.contactEmail.trim()) payload.contactEmail = form.contactEmail.trim();
    if (form.contactPhone.trim()) payload.contactPhone = form.contactPhone.trim();
    try {
      if (selected) await organizationsApi.update(selected.id, payload);
      else await organizationsApi.create(payload);
      setModal("");
      setSuccess(selected ? "Organization updated." : "Organization created.");
      await load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not save organization."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    setBusy(true);
    setModalError("");
    try {
      if (selected.isActive) await organizationsApi.deactivate(selected.id);
      else await organizationsApi.activate(selected.id);
      setModal("");
      setSuccess(
        `Organization ${selected.isActive ? "deactivated" : "activated"}.`
      );
      await load();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message ||
          "Could not change organization status."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="Organizations"
      subtitle="Customer accounts and data boundaries"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Organization filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setPage(1);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Reset
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    placeholder="Name, email, phone…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
            <Button size="sm" onClick={openCreate} leftIcon={Plus}>
              Add Organization
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
        {success && (
          <p
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          >
            {success}
          </p>
        )}

        {/* ============ TABLE ============ */}
        {loading ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading organizations…
              </p>
            </div>
          </div>
        ) : pageItems.length === 0 ? (
          <div
            className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Building2 size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {search || statusFilter
                ? "No organizations match your filters"
                : "No organizations found"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {search || statusFilter
                ? "Try adjusting the search or status filter."
                : "Create one to invite Controllers and register devices."}
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={openCreate}
              leftIcon={Plus}
            >
              Add Organization
            </Button>
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Controllers</th>
                    <th className="p-3">Devices</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => {
                    const s = statusStyle(item.isActive);
                    return (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-xs font-bold text-white">
                              {initials(item.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {item.name}
                              </p>
                              {item.contactEmail && (
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {item.contactEmail}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={tableCell}>
                          <div className="space-y-0.5 text-xs">
                            {item.contactEmail ? (
                              <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Mail size={12} className="text-slate-400" />
                                <span className="truncate">
                                  {item.contactEmail}
                                </span>
                              </p>
                            ) : null}
                            {item.contactPhone ? (
                              <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                <Phone size={12} className="text-slate-400" />
                                {item.contactPhone}
                              </p>
                            ) : null}
                            {!item.contactEmail && !item.contactPhone && (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
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
                          <span className="inline-flex items-center gap-1.5">
                            <Users size={14} className="text-slate-400" />
                            {item.controllerCount ?? 0}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5">
                            <Cpu size={14} className="text-slate-400" />
                            {item.deviceCount ?? 0}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {item.createdAt
                              ? formatDate(item.createdAt, "UTC")
                              : "—"}
                          </span>
                        </td>
                        <td className={`${tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDetails(item)}
                              title="View details"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              title="Edit"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                            {item.isActive ? (
                              <button
                                type="button"
                                onClick={() => openToggle(item)}
                                title="Deactivate"
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                              >
                                <Ban size={13} />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openToggle(item)}
                                title="Activate"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              >
                                <RotateCcw size={13} />
                                Activate
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

            {/* ============ PAGER ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page{" "}
                <strong className="text-slate-700 dark:text-slate-200">
                  {page}
                </strong>{" "}
                of {totalPages} · {total} Organizations
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

        {/* ============ FORM MODAL (create/edit) ============ */}
        <Modal
          open={modal === "form"}
          onClose={closeModal}
          title={selected ? "Edit Organization" : "Add Organization"}
          size="lg"
        >
          <form onSubmit={save} className="space-y-4">
            <Input
              label="Organization name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              icon={Building2}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact email (optional)"
                type="email"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
                icon={Mail}
              />
              <Input
                label="Contact phone (optional)"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
                icon={Phone}
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
                {selected ? "Save Changes" : "Create Organization"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ DETAILS MODAL ============ */}
        <Modal
          open={modal === "details"}
          onClose={closeModal}
          title="Organization Details"
          size="xl"
        >
          {detailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading details…
                </p>
              </div>
            </div>
          ) : !details ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Could not load details.
            </p>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Header */}
              <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 to-[#427aa1]/5 p-4 dark:border-slate-700 dark:from-[#064789]/15 dark:to-[#427aa1]/10">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-lg font-bold text-white">
                  {initials(details.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Organization
                  </p>
                  <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                    {details.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {details.contactEmail || "No contact email"}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    statusStyle(details.isActive).pill
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      statusStyle(details.isActive).dot
                    }`}
                  />
                  {statusStyle(details.isActive).label}
                </span>
              </div>

              {/* Meta grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailRow
                  label="Contact email"
                  value={details.contactEmail}
                  icon={Mail}
                />
                <DetailRow
                  label="Contact phone"
                  value={details.contactPhone}
                  icon={Phone}
                />
                <DetailRow
                  label="Created"
                  value={
                    details.createdAt
                      ? formatDate(details.createdAt, "UTC")
                      : "—"
                  }
                  icon={Clock}
                />
                <DetailRow
                  label="Controllers"
                  value={`${details.controllerCount ?? 0}`}
                  icon={Users}
                />
                <DetailRow
                  label="Devices"
                  value={`${details.deviceCount ?? 0}`}
                  icon={Cpu}
                />
                <DetailRow
                  label="Sites"
                  value={`${details.siteCount ?? details.sites?.length ?? 0}`}
                  icon={Building2}
                />
              </div>

              {/* Controllers */}
              <div>
                <p className={`${sectionTitle} mb-2`}>
                  Controllers ({details.controllerCount ?? 0})
                </p>
                {details.controllers?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {details.controllers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-[10px] font-bold text-white">
                          {initials(user.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No Controllers yet.
                  </p>
                )}
              </div>

              {/* Devices */}
              <div>
                <p className={`${sectionTitle} mb-2`}>
                  Devices ({details.deviceCount ?? 0})
                </p>
                {details.devices?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {details.devices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                          <Cpu size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {device.name}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {device.location || device.site?.name || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No devices yet.
                  </p>
                )}
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
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    closeModal();
                    openEdit(details);
                  }}
                  leftIcon={Pencil}
                >
                  Edit Organization
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ DEACTIVATE MODAL ============ */}
        <Modal
          open={modal === "deactivate"}
          onClose={closeModal}
          title="Deactivate Organization"
          size="sm"
        >
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                  <Ban size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Deactivate {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Controllers will lose access and its devices will stop
                    reporting. Historical data remains intact and can be
                    reactivated later.
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
                  onClick={confirmToggle}
                  loading={busy}
                  leftIcon={Ban}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ ACTIVATE MODAL ============ */}
        <Modal
          open={modal === "activate"}
          onClose={closeModal}
          title="Activate Organization"
          size="sm"
        >
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Activate {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Controllers will regain access and devices will resume
                    reporting.
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
                  onClick={confirmToggle}
                  loading={busy}
                  leftIcon={RotateCcw}
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