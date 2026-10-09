// src/pages/admin/Users.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Building2,
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
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  User as UserIcon,
  UserCheck,
  UserPlus,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import {
  equipmentApi,
  organizationsApi,
  usersApi,
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

const initialInvite = {
  name: "",
  email: "",
  phone: "",
  organizationId: "",
  equipmentIds: [],
};

const initialEdit = {
  name: "",
  email: "",
  phone: "",
  role: "",
  organizationId: "",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function statusOf(user) {
  if (!user.isActive) return "Inactive";
  return user.isActivated ? "Active" : "Pending invitation";
}

function statusStyle(user) {
  if (!user.isActive)
    return {
      pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
      dot: "bg-slate-400",
    };
  if (!user.isActivated)
    return {
      pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
      dot: "bg-amber-500",
    };
  return {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  };
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

/* ------------------------------------------------------------------ */
/*  Detail row primitives                                             */
/* ------------------------------------------------------------------ */
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

  /* ---------- selectable equipment list ---------- */
function EquipmentPicker({ ids, setIds, availableEquipment, filteredEquipment, assignmentSearch, setAssignmentSearch }) {
    const toggle = (id) =>
      setIds((old) =>
        old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
      );
    const allSelected =
      filteredEquipment.length > 0 &&
      filteredEquipment.every((d) => ids.includes(d.id));

    if (!availableEquipment.length) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No equipment in this organization yet.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search equipment…"
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              setIds(allSelected ? [] : filteredEquipment.map((d) => d.id))
            }
            className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-600 hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-300 dark:hover:text-[#8fc7e8]"
          >
            {allSelected ? "Clear all" : "Select all"}
          </button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
          {filteredEquipment.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-400">
              No matches for "{assignmentSearch}".
            </p>
          ) : (
            filteredEquipment.map((device) => {
              const checked = ids.includes(device.id);
              return (
                <label
                  key={device.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg p-2.5 text-sm transition-colors ${
                    checked
                      ? "bg-[#064789]/5 dark:bg-[#427aa1]/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(device.id)}
                    className="h-4 w-4 rounded border-slate-300 text-[#064789] focus:ring-[#427aa1] dark:border-slate-600 dark:bg-slate-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {device.name}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {device.site?.name || device.type || "No site"}
                    </p>
                  </div>
                  <Cpu size={14} className="shrink-0 text-slate-400" />
                </label>
              );
            })
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {ids.length} of {availableEquipment.length} equipment selected
        </p>
      </div>
    );
}

/* ================================================================== */
/*  Users (Controllers)                                               */
/* ================================================================== */
export default function Users() {
  /* ---------- list state ---------- */
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------- modal state ---------- */
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [invite, setInvite] = useState(initialInvite);
  const [edit, setEdit] = useState(initialEdit);
  const [assignedIds, setAssignedIds] = useState([]);
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");

  /* ---------- data loading ---------- */
  const load = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, orgsRes, equipmentRes] = await Promise.all([
        usersApi.list({
          search: search || undefined,
          organizationId: organizationId || undefined,
          status: statusFilter || undefined,
          page: nextPage,
          pageSize: nextPageSize,
        }),
        organizationsApi.list(),
        equipmentApi.list({ active: "all" }),
      ]);
      setUsers(usersRes.data.items || []);
      setTotal(
        usersRes.data.total ?? usersRes.data.totalCount ?? usersRes.data.items?.length ?? 0
      );
      setPage(usersRes.data.page ?? nextPage);
      setOrganizations(orgsRes.data || []);
      setEquipment(equipmentRes.data || []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load Controllers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [usersRes, orgsRes, equipmentRes] = await Promise.all([
          usersApi.list({ page: 1, pageSize: 20 }),
          organizationsApi.list(),
          equipmentApi.list({ active: "all" }),
        ]);
        if (!active) return;
        setUsers(usersRes.data.items || []);
        setTotal(
          usersRes.data.total ??
            usersRes.data.totalCount ??
            usersRes.data.items?.length ??
            0
        );
        setOrganizations(orgsRes.data || []);
        setEquipment(equipmentRes.data || []);
      } catch (err) {
        if (active)
          setError(
            err?.response?.data?.message || "Could not load Controllers."
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const applySearch = () => {
    setSearch(searchInput);
    setPage(1);
    void load(1, pageSize);
  };

  /* ---------- modal openers ---------- */
  const openInvite = () => {
    setInvite(initialInvite);
    setSelected(null);
    setModalError("");
    setModal("invite");
  };
  const openView = (user) => {
    setSelected(user);
    setModalError("");
    setModal("view");
  };
  const openEdit = (user) => {
    setSelected(user);
    setEdit({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "CONTROLLER",
      organizationId: user.organization?.id || user.organizationId || "",
    });
    setModalError("");
    setModal("edit");
  };
  const openAssign = (user) => {
    setSelected(user);
    setAssignedIds(user.equipmentIds || user.equipment?.map((e) => e.id) || []);
    setAssignmentSearch("");
    setModalError("");
    setModal("assign");
  };
  const openDeactivate = (user) => {
    setSelected(user);
    setModalError("");
    setModal("deactivate");
  };
  const openReactivate = (user) => {
    setSelected(user);
    setModalError("");
    setModal("reactivate");
  };

  const closeModal = () => {
    if (busy) return;
    setModal("");
    setModalError("");
  };

  /* ---------- mutations ---------- */
  const act = async (action, message) => {
    setBusy(true);
    setModalError("");
    try {
      await action();
      setModal("");
      setSuccess(message);
      await load(page, pageSize);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setModalError(
        err?.response?.data?.message || "Action failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const submitInvite = (event) => {
    event.preventDefault();
    void act(() => usersApi.create(invite), "Invitation sent.");
  };
  const submitEdit = (event) => {
    event.preventDefault();
    void act(
      () =>
        usersApi.update(selected.id, {
          name: edit.name.trim(),
          email: edit.email.trim(),
          phone: edit.phone?.trim() || undefined,
          role: edit.role,
          organizationId: edit.organizationId,
        }),
      "Controller updated."
    );
  };
  const submitAssignments = () => {
    void act(
      () => usersApi.assignDevices(selected.id, { equipmentIds: assignedIds }),
      "Assignments updated."
    );
  };
  const confirmDeactivate = () => {
    void act(
      () => usersApi.remove(selected.id),
      `Controller deactivated.`
    );
  };
  const confirmReactivate = () => {
    void act(
      () => usersApi.reactivate(selected.id),
      `Controller reactivated.`
    );
  };

  /* ---------- derived ---------- */
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIndex =
    total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIndex = Math.min(page * pageSize, total);

  const goTo = (p) => {
    const next = Math.max(1, Math.min(totalPages, p));
    if (next !== page) void load(next, pageSize);
  };

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
    void load(1, size);
  };

  /* ---------- equipment for current scope ---------- */
  const availableEquipment = useMemo(() => {
    const orgId =
      modal === "invite"
        ? invite.organizationId
        : modal === "edit"
          ? edit.organizationId
          : selected?.organization?.id || selected?.organizationId;
    return equipment.filter((d) => !orgId || d.organizationId === orgId);
  }, [equipment, modal, invite.organizationId, edit.organizationId, selected]);

  const filteredEquipment = useMemo(() => {
    if (!assignmentSearch.trim()) return availableEquipment;
    const q = assignmentSearch.toLowerCase();
    return availableEquipment.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.site?.name?.toLowerCase().includes(q) ||
        d.type?.toLowerCase().includes(q)
    );
  }, [availableEquipment, assignmentSearch]);

  /* ================================================================ */
  return (
    <PageContainer
      title="Controllers"
      subtitle="Invite, manage and assign customer accounts"
    >
      <div className="space-y-4">
        {/* ============ FILTERS ============ */}
        <section className={card} aria-label="User filters">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <h2 className={sectionTitle}>Filters</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setOrganizationId("");
                setStatusFilter("");
                setPage(1);
                void load(1, pageSize);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Reset
            </button>
          </header>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
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
                    placeholder="Name, email…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySearch()}
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
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All organizations</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
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
                <option value="pending">Pending invitation</option>
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
              onClick={applySearch}
              disabled={loading}
              leftIcon={Search}
            >
              Search
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load(page, pageSize)}
              disabled={loading}
              leftIcon={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openInvite}
              leftIcon={UserPlus}
            >
              Invite Controller
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
                Loading Controllers…
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <UserIcon size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No Controllers found
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Create an organization, then invite a Controller.
            </p>
            <Button size="sm" className="mt-4" onClick={openInvite} leftIcon={UserPlus}>
              Invite Controller
            </Button>
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1000px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">Controller</th>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Assigned equipment</th>
                    <th className="p-3">Last active</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const s = statusStyle(user);
                    const equipmentCount =
                      user.equipment?.length ?? user.equipmentIds?.length ?? 0;
                    return (
                      <tr
                        key={user.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-xs font-bold text-white">
                              {initials(user.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {user.name}
                              </p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={tableCell}>
                          <div className="flex items-center gap-1.5">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="truncate">
                              {user.organization?.name || "—"}
                            </span>
                          </div>
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.pill}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {statusOf(user)}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                            <Cpu size={14} className="text-slate-400" />
                            {equipmentCount}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {user.lastActiveAt
                              ? formatDate(user.lastActiveAt, "UTC")
                              : "—"}
                          </span>
                        </td>
                        <td className={`${tableCell} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openView(user)}
                              title="View details"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              title="Edit"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openAssign(user)}
                              title="Assign equipment"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                            >
                              <Cpu size={13} />
                              Assign
                            </button>
                            {user.isActive ? (
                              <button
                                type="button"
                                onClick={() => openDeactivate(user)}
                                title="Deactivate"
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30"
                              >
                                <Ban size={13} />
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openReactivate(user)}
                                title="Reactivate"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              >
                                <RotateCcw size={13} />
                                Reactivate
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
                of {totalPages} · {total} Controllers
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  Rows
                  <select
                    value={pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
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

        {/* ============ INVITE MODAL ============ */}
        <Modal
          open={modal === "invite"}
          onClose={closeModal}
          title="Invite Controller"
          size="lg"
        >
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                required
                icon={UserIcon}
              />
              <Input
                label="Email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                required
                icon={Mail}
              />
              <Input
                label="Phone (optional)"
                value={invite.phone}
                onChange={(e) => setInvite({ ...invite, phone: e.target.value })}
                icon={Phone}
              />
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Organization
                </span>
                <select
                  required
                  className={selectClass}
                  value={invite.organizationId}
                  onChange={(e) =>
                    setInvite({
                      ...invite,
                      organizationId: e.target.value,
                      equipmentIds: [],
                    })
                  }
                >
                  <option value="">Select an active organization</option>
                  {organizations
                    .filter((org) => org.isActive)
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div>
              <p className={`${sectionTitle} mb-2`}>
                Assigned equipment (optional)
              </p>
              <EquipmentPicker
                ids={invite.equipmentIds}
                availableEquipment={availableEquipment}
                filteredEquipment={filteredEquipment}
                assignmentSearch={assignmentSearch}
                setAssignmentSearch={setAssignmentSearch}
                setIds={(equipmentIds) => setInvite({ ...invite, equipmentIds })}
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
              <Button variant="outline" type="button" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} leftIcon={UserPlus}>
                Send Invitation
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ VIEW MODAL ============ */}
        <Modal
          open={modal === "view"}
          onClose={closeModal}
          title="Controller Details"
          size="xl"
        >
          {selected && (
            <div className="space-y-5 text-sm">
              {/* Header */}
              <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 to-[#427aa1]/5 p-4 dark:border-slate-700 dark:from-[#064789]/15 dark:to-[#427aa1]/10">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-lg font-bold text-white">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Controller
                  </p>
                  <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                    {selected.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {selected.email}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    statusStyle(selected).pill
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      statusStyle(selected).dot
                    }`}
                  />
                  {statusOf(selected)}
                </span>
              </div>

              {/* Detail grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailRow
                  label="Organization"
                  value={selected.organization?.name}
                  icon={Building2}
                />
                <DetailRow label="Role" value={selected.role} icon={ShieldCheck} />
                <DetailRow label="Phone" value={selected.phone} icon={Phone} />
                <DetailRow
                  label="Assigned equipment"
                  value={`${selected.equipment?.length ?? selected.equipmentIds?.length ?? 0} devices`}
                  icon={Cpu}
                />
                <DetailRow
                  label="Invited"
                  value={
                    selected.createdAt
                      ? formatDate(selected.createdAt, "UTC")
                      : "—"
                  }
                  icon={Clock}
                />
                <DetailRow
                  label="Last active"
                  value={
                    selected.lastActiveAt
                      ? formatDate(selected.lastActiveAt, "UTC")
                      : "Never"
                  }
                  icon={Clock}
                />
              </div>

              {/* Assigned equipment list */}
              <div>
                <p className={`${sectionTitle} mb-2`}>Assigned equipment</p>
                {selected.equipment?.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.equipment.map((device) => (
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
                            {device.site?.name || device.type || "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    No equipment assigned yet.
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeModal}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    closeModal();
                    openEdit(selected);
                  }}
                  leftIcon={Pencil}
                >
                  Edit Controller
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ EDIT MODAL ============ */}
        <Modal
          open={modal === "edit"}
          onClose={closeModal}
          title="Edit Controller"
          size="lg"
        >
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                required
                icon={UserIcon}
              />
              <Input
                label="Email"
                type="email"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                required
                icon={Mail}
              />
              <Input
                label="Phone (optional)"
                value={edit.phone}
                onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                icon={Phone}
              />
              <label className="text-sm">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Role
                </span>
                <select
                  className={selectClass}
                  value={edit.role}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                >
                  <option value="CONTROLLER">Controller</option>
                  <option value="ADMIN">Administrator</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Organization
                  </span>
                  <select
                    className={selectClass}
                    value={edit.organizationId}
                    onChange={(e) =>
                      setEdit({ ...edit, organizationId: e.target.value })
                    }
                  >
                    <option value="">No organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              Changing the organization may affect equipment assignments. You
              can re-assign equipment from the Assignments action afterward.
            </p>

            {modalError && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                {modalError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" type="button" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>

        {/* ============ ASSIGN MODAL ============ */}
        <Modal
          open={modal === "assign"}
          onClose={closeModal}
          title="Assign Equipment"
          size="lg"
        >
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-xs font-bold text-white">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {selected.name}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {selected.organization?.name || "No organization"}
                  </p>
                </div>
              </div>

              <EquipmentPicker ids={assignedIds} setIds={setAssignedIds} availableEquipment={availableEquipment} filteredEquipment={filteredEquipment} assignmentSearch={assignmentSearch} setAssignmentSearch={setAssignmentSearch} />

              {modalError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {modalError}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" onClick={closeModal} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitAssignments}
                  loading={busy}
                  leftIcon={UserCheck}
                >
                  Save Assignments
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ DEACTIVATE MODAL ============ */}
        <Modal
          open={modal === "deactivate"}
          onClose={closeModal}
          title="Deactivate Controller"
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
                    They will not be able to sign in. Assigned equipment
                    remains linked and can be reassigned later.
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
                  onClick={confirmDeactivate}
                  loading={busy}
                  leftIcon={Ban}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* ============ REACTIVATE MODAL ============ */}
        <Modal
          open={modal === "reactivate"}
          onClose={closeModal}
          title="Reactivate Controller"
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
                    Reactivate {selected.name}?
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    They will regain access to the workspace. If they were
                    never activated, you may need to resend the invitation.
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
                  leftIcon={RotateCcw}
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
