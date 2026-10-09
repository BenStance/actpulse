// src/pages/shared/Sites.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Cpu,
  Eye,
  Filter,
  Globe,
  MapPin,
  MapPinned,
  Navigation,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User as UserIcon,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import { organizationsApi, sitesApi } from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";
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

const empty = {
  organizationId: "",
  name: "",
  siteCode: "",
  description: "",
  address: "",
  cityRegion: "",
  timezone: "Africa/Dar_es_Salaam",
  latitude: "",
  longitude: "",
  contactName: "",
  contactPhone: "",
};

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
        label: "Archived",
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
/*  Sites                                                             */
/* ================================================================== */
export default function Sites() {
  const user = useAuthStore((state) => state.user);
  const admin = user?.role === "Admin" || user?.role === "ADMIN";
  const base = admin ? "/admin" : "/controller";
  const navigate = useNavigate();
  const { id: siteId } = useParams();

  /* ---------- list state ---------- */
  const [sites, setSites] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    organizationId: "",
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
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ---------- load ---------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await sitesApi.list({
        search: filters.search || undefined,
        organizationId: filters.organizationId || undefined,
        active: filters.active,
      });
      setSites(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load sites.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /* ---------- initial + filter-driven load (debounced for search) ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (admin) {
      organizationsApi
        .list()
        .then(({ data }) => setOrganizations(Array.isArray(data) ? data : data?.items || []))
        .catch(() => setError("Could not load organizations."));
    }
  }, [admin]);

  /* ---------- pagination (client-side) ---------- */
  const total = sites.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const fromIndex = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toIndex = Math.min(currentPage * pageSize, total);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sites.slice(start, start + pageSize);
  }, [sites, currentPage, pageSize]);
  const organizationNames = useMemo(
    () => new Map(organizations.map((organization) => [organization.id, organization.name])),
    [organizations]
  );

  const goTo = (p) => setPage(Math.max(1, Math.min(totalPages, p)));

  /* ---------- modal openers ---------- */
  const openCreate = () => {
    setSelected(null);
    setForm({ ...empty, organizationId: filters.organizationId });
    setModalError("");
    setModal("form");
  };

  const openEdit = (site) => {
    setSelected(site);
    setForm({
      ...empty,
      ...site,
      latitude: site.latitude ?? "",
      longitude: site.longitude ?? "",
    });
    setModalError("");
    setModal("form");
  };

  const openView = useCallback((site) => {
    setSelected(site);
    setDetails(site);
    setModalError("");
    setModal("view");

    setDetailsLoading(true);
    sitesApi
      .detail(site.id)
      .then(({ data }) => setDetails(data))
      .catch(() => undefined)
      .finally(() => setDetailsLoading(false));
  }, []);

  useEffect(() => {
    if (!siteId) return undefined;
    const timer = setTimeout(() => openView({ id: siteId }), 0);
    return () => clearTimeout(timer);
  }, [siteId, openView]);

  const openArchive = (site) => {
    setSelected(site);
    setModalError("");
    setModal("archive");
  };

  const openReactivate = (site) => {
    setSelected(site);
    setModalError("");
    setModal("reactivate");
  };

  const closeModal = () => {
    if (busy) return;
    setModal("");
    setModalError("");
    setDetails(null);
    if (siteId) navigate(`${base}/sites`, { replace: true });
  };

  /* ---------- mutations ---------- */
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setModalError("");
    setNotice("");
    try {
      const payload = Object.fromEntries(
        Object.keys(empty).map((key) => [key, form[key]])
      );
      payload.latitude =
        form.latitude === "" || form.latitude === null
          ? undefined
          : Number(form.latitude);
      payload.longitude =
        form.longitude === "" || form.longitude === null
          ? undefined
          : Number(form.longitude);

      if (selected) {
        delete payload.organizationId;
        await sitesApi.update(selected.id, payload);
      } else {
        await sitesApi.create(payload);
      }
      setModal("");
      setNotice(selected ? "Site updated." : "Site created.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not save site."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmArchive = async () => {
    setBusy(true);
    setModalError("");
    try {
      await sitesApi.deactivate(selected.id);
      setModal("");
      setNotice("Site archived.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not archive site."
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmReactivate = async () => {
    setBusy(true);
    setModalError("");
    try {
      await sitesApi.activate(selected.id);
      setModal("");
      setNotice("Site reactivated.");
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Could not reactivate site."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="Sites"
      subtitle={
        admin
          ? "Customer locations and their equipment"
          : "Locations containing your assigned equipment"
      }
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="Site filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setFilters({ search: "", organizationId: "", active: "true" })
              }
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
                    placeholder="Name, code, city, address…"
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
                    setFilters({ ...filters, organizationId: e.target.value })
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
                Create Site
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
                Loading sites…
              </p>
            </div>
          </div>
        ) : pageItems.length === 0 ? (
          <div
            className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <MapPinned size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {sites.length === 0
                ? "No sites yet"
                : "No sites match these filters"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {sites.length === 0
                ? admin
                  ? "Create a site to start registering equipment and monitors."
                  : "Your organization hasn't registered any sites yet."
                : "Try adjusting the search or status filter."}
            </p>
            {admin && (
              <Button
                size="sm"
                className="mt-4"
                onClick={openCreate}
                leftIcon={Plus}
              >
                Create Site
              </Button>
            )}
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">Site</th>
                    {admin && <th className="p-3">Organization</th>}
                    <th className="p-3">Location</th>
                    <th className="p-3">Timezone</th>
                    <th className="p-3">Equipment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((site) => {
                    const s = statusStyle(site.isActive);
                    return (
                      <tr
                        key={site.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-xs font-bold text-white">
                              {initials(site.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {site.name}
                              </p>
                              {site.siteCode && (
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {site.siteCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        {admin && (
                          <td className={tableCell}>
                            <div className="flex items-center gap-1.5">
                              <Building2
                                size={14}
                                className="text-slate-400"
                              />
                              <span className="truncate">
                                {organizationNames.get(site.organizationId) ||
                                  site.organization?.name ||
                                  site.organizationName ||
                                  "—"}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className={tableCell}>
                          <div className="min-w-0">
                            <p className="truncate text-slate-700 dark:text-slate-200">
                              {site.cityRegion || "—"}
                            </p>
                            {site.address && (
                              <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                <MapPin size={11} className="text-slate-400" />
                                {site.address}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                            <Clock size={12} className="text-slate-400" />
                            {site.timezone || "—"}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5">
                            <Cpu size={14} className="text-slate-400" />
                            {site.equipmentCount ?? 0}
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
                        <td className={`${tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openView(site)}
                              title="View details"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            {admin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEdit(site)}
                                  title="Edit"
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <Pencil size={13} />
                                  Edit
                                </button>
                                {site.isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => openArchive(site)}
                                    title="Archive"
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                  >
                                    <Archive size={13} />
                                    Archive
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openReactivate(site)}
                                    title="Reactivate"
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                  >
                                    <ArchiveRestore size={13} />
                                    Reactivate
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
                of {totalPages} · {total} Sites
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
          title={selected ? "Edit Site" : "Create Site"}
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
                    setForm({ ...form, organizationId: e.target.value })
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Site name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                icon={MapPinned}
              />
              <Input
                label="Site code (optional)"
                value={form.siteCode || ""}
                onChange={(e) =>
                  setForm({ ...form, siteCode: e.target.value })
                }
              />
              <Input
                label="Timezone (IANA name)"
                required
                value={form.timezone}
                onChange={(e) =>
                  setForm({ ...form, timezone: e.target.value })
                }
                icon={Globe}
              />
              <Input
                label="City or region"
                value={form.cityRegion || ""}
                onChange={(e) =>
                  setForm({ ...form, cityRegion: e.target.value })
                }
                icon={MapPin}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Address"
                  value={form.address || ""}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <Input
                label="Latitude"
                type="number"
                min="-90"
                max="90"
                step="any"
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: e.target.value })
                }
                icon={Navigation}
              />
              <Input
                label="Longitude"
                type="number"
                min="-180"
                max="180"
                step="any"
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: e.target.value })
                }
                icon={Navigation}
              />
              <Input
                label="Contact name"
                value={form.contactName || ""}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
                icon={UserIcon}
              />
              <Input
                label="Contact phone"
                value={form.contactPhone || ""}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
                icon={Phone}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Description"
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
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
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {selected ? "Save Changes" : "Create Site"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ VIEW MODAL ============ */}
        <Modal
          open={modal === "view"}
          onClose={closeModal}
          title="Site Details"
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
                    Site
                  </p>
                  <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                    {details.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {details.siteCode ? `${details.siteCode} · ` : ""}
                    {organizationNames.get(details.organizationId) ||
                      details.organization?.name ||
                      details.organizationName ||
                      "—"}
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
                  label="City / Region"
                  value={details.cityRegion}
                  icon={MapPin}
                />
                <DetailRow
                  label="Timezone"
                  value={details.timezone}
                  icon={Globe}
                />
                <DetailRow
                  label="Equipment"
                  value={`${details.equipmentCount ?? 0}`}
                  icon={Cpu}
                />
                <DetailRow
                  label="Contact name"
                  value={details.contactName}
                  icon={UserIcon}
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
                  icon={Calendar}
                />
                {details.address && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <DetailRow
                      label="Address"
                      value={details.address}
                      icon={MapPin}
                    />
                  </div>
                )}
                {details.latitude != null && details.longitude != null && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <DetailRow
                      label="Coordinates"
                      value={`${details.latitude}, ${details.longitude}`}
                      icon={Navigation}
                    />
                  </div>
                )}
                {details.description && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Clock size={12} />
                        Description
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
                        {details.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Map preview if coordinates present */}
              {details.latitude != null && details.longitude != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${details.latitude}&mlon=${details.longitude}#map=15/${details.latitude}/${details.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition-colors hover:border-[#427aa1] dark:border-slate-700 dark:bg-slate-800/40"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <MapPinned size={16} className="text-[#064789] dark:text-[#8fc7e8]" />
                    View on OpenStreetMap
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {details.latitude}, {details.longitude}
                  </span>
                </a>
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
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                {admin && (
                  <Button
                    onClick={() => {
                      closeModal();
                      openEdit(details);
                    }}
                    leftIcon={Pencil}
                  >
                    Edit Site
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ============ ARCHIVE MODAL ============ */}
        <Modal
          open={modal === "archive"}
          onClose={closeModal}
          title="Archive Site"
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
                    Existing monitoring and history will continue. The site
                    will be hidden from active views until reactivated.
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
                  Archive Site
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ REACTIVATE MODAL ============ */}
        <Modal
          open={modal === "reactivate"}
          onClose={closeModal}
          title="Reactivate Site"
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
                    Reactivate {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    The site will reappear in active views and any linked
                    equipment will resume normal visibility.
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
                  onClick={confirmReactivate}
                  loading={busy}
                  leftIcon={ArchiveRestore}
                >
                  Reactivate
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </PageContainer>
  );
}
