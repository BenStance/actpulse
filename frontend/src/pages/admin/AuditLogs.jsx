// src/pages/admin/AuditLogs.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  User,
  Users,
  XCircle,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import { billingApi, organizationsApi } from "../../api/actPulse.Api";
import { formatDate } from "../../utils/formatDate";
import {
  createReportDoc,
  formatNumber,
  titleCase,
} from "../../utils/pdfReport";

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

/* ------------------------------------------------------------------ */
/*  Human-readable label helpers                                      */
/* ------------------------------------------------------------------ */
const humanize = (value) =>
  String(value ?? "—")
    .replaceAll("_", " ")
    .replaceAll(".", " · ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function outcomeStyle(outcome) {
  const o = String(outcome || "").toUpperCase();
  if (o.includes("SUCCESS") || o === "OK")
    return {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
      icon: CheckCircle2,
    };
  if (o.includes("FAIL") || o.includes("ERROR") || o.includes("DENIED"))
    return {
      pill: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
      icon: XCircle,
    };
  if (o.includes("WARN"))
    return {
      pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
      icon: AlertCircle,
    };
  return {
    pill: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    icon: Activity,
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
/*  Change diff renderer — turns before/after into a readable table   */
/* ------------------------------------------------------------------ */
function ChangeDiff({ before, after }) {
  const keys = useMemo(() => {
    const set = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);
    return [...set].sort();
  }, [before, after]);

  if (!keys.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No field changes recorded for this event.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className={tableHead}>
            <th className="w-1/4 p-3">Field</th>
            <th className="w-[37.5%] p-3">Before</th>
            <th className="w-[37.5%] p-3">After</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const b = before?.[key];
            const a = after?.[key];
            const changed = JSON.stringify(b) !== JSON.stringify(a);
            const render = (v) => {
              if (v === undefined || v === null || v === "") return "—";
              if (typeof v === "boolean") return v ? "Yes" : "No";
              if (typeof v === "object") return JSON.stringify(v);
              return String(v);
            };
            return (
              <tr
                key={key}
                className={`border-t border-slate-100 dark:border-slate-800 ${
                  changed ? "bg-amber-50/40 dark:bg-amber-500/5" : ""
                }`}
              >
                <td className="p-3 align-top font-medium text-slate-700 dark:text-slate-200">
                  {humanize(key)}
                </td>
                <td className="p-3 align-top">
                  <span
                    className={
                      changed
                        ? "rounded-md bg-rose-50 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {render(b)}
                  </span>
                </td>
                <td className="p-3 align-top">
                  <span
                    className={
                      changed
                        ? "rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "text-slate-500 dark:text-slate-400"
                    }
                  >
                    {render(a)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail modal body                                                 */
/* ------------------------------------------------------------------ */
function DetailGrid({ label, value, icon: Icon }) {
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
/*  AuditLogs                                                         */
/* ================================================================== */
export default function AuditLogs() {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDirty, setExportDirty] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: "CSV",
    scope: "current", // "current" | "all"
  });

  const [filters, setFilters] = useState({
    organizationId: "",
    actorId: "",
    action: "",
    entityType: "",
    from: "",
    to: "",
    page: 1,
    pageSize: 20,
  });

  const [organizations, setOrganizations] = useState([]);
  const [actors, setActors] = useState([]);
  const [actionOptions, setActionOptions] = useState([]);
  const [entityOptions, setEntityOptions] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);

  /* ---------------- Bootstrap lookups ---------------- */
  useEffect(() => {
    organizationsApi
      .list()
      .then(({ data }) => setOrganizations(data || []))
      .catch(() => undefined);

    // Try to fetch actors and distinct action/entity values.
    // Falls back to deriving them from the first page of audit data.
    Promise.allSettled([
      // If you have these endpoints, wire them here:
      // usersApi.list({ roles: ["ADMIN", "CONTROLLER"] }),
      // auditApi.actions(),
      // auditApi.entityTypes(),
    ]).then(() => {
      // no-op — the fallback derivation happens in load()
    });
  }, []);

  /* ---------------- Load page ---------------- */
  const params = useMemo(
    () => ({
      ...filters,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
      // Ensure newest first
      sort: "occurred_at",
      order: "desc",
    }),
    [filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await billingApi.audit(params);
      // Defensive sort: newest first, regardless of API response order
      const rows = [...(data.items || [])].sort(
        (a, b) => new Date(b.occurred_at) - new Date(a.occurred_at),
      );
      setItems(rows);
      setTotal(data.total ?? data.totalCount ?? data.count ?? rows.length);

      // Derive filter options from the visible page if not yet populated
      if (!actionOptions.length) {
        setActionOptions(
          [...new Set(rows.map((r) => r.action).filter(Boolean))].sort(),
        );
      }
      if (!entityOptions.length) {
        setEntityOptions(
          [...new Set(rows.map((r) => r.entity_type).filter(Boolean))].sort(),
        );
      }
      if (!actors.length) {
        const map = new Map();
        rows.forEach((r) => {
          const id = r.actor_id || r.actor_name || r.actor_role;
          if (!id) return;
          if (!map.has(id)) {
            map.set(id, {
              id,
              name: r.actor_name || r.actor_role || "System",
              role: r.actor_role,
            });
          }
        });
        setActors([...map.values()]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [params, actionOptions.length, entityOptions.length, actors.length]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const update = (key, value) =>
    setFilters((old) => ({
      ...old,
      [key]: value,
      // Reset page whenever a filter (not pagination) changes
      ...(["page", "pageSize"].includes(key) ? {} : { page: 1 }),
    }));

  const resetFilters = () =>
    setFilters({
      organizationId: "",
      actorId: "",
      action: "",
      entityType: "",
      from: "",
      to: "",
      page: 1,
      pageSize: filters.pageSize,
    });

  /* ---------------- Export ---------------- */
  /* ------------------------------------------------------------------ */
  /*  Fetch rows for export                                             */
  /* ------------------------------------------------------------------ */
  const fetchAllRows = async () => {
    const rows = [];
    for (let p = 1; p <= 10; p += 1) {
      const { data } = await billingApi.audit({
        ...params,
        page: p,
        pageSize: 100,
      });
      const chunk = data.items || [];
      rows.push(...chunk);
      if (chunk.length < 100) break;
    }
    return rows;
  };

  /* ------------------------------------------------------------------ */
  /*  CSV export — metadata block + methodology + detail                */
  /* ------------------------------------------------------------------ */
  const escapeCsv = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number")
      return Number.isFinite(value) ? String(value) : "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const text =
      value instanceof Date
        ? value.toISOString()
        : typeof value === "string"
          ? value
          : JSON.stringify(value) || "";
    const neutral = /^[=+@-]/.test(text.trimStart()) ? `'${text}` : text;
    const needsQuotes = /[",\r\n\t]/.test(neutral) || /^\s|\s$/.test(neutral);
    return needsQuotes ? `"${neutral.replaceAll('"', '""')}"` : neutral;
  };

  const AUDIT_CSV_COLUMNS = 14;
  const rowCsv = (cells = []) => {
    const normalized = cells.slice(0, AUDIT_CSV_COLUMNS);
    while (normalized.length < AUDIT_CSV_COLUMNS) normalized.push("");
    return normalized.map(escapeCsv).join(",");
  };

  const exportCsv = (rows) => {
    const lines = [];

    /* Metadata block */
    lines.push(rowCsv(["ACTPulse Audit Log"]));
    lines.push(rowCsv(["Report information"]));
    lines.push(rowCsv(["Field", "Value"]));
    lines.push(rowCsv(["Generated (UTC)", new Date().toISOString()]));
    lines.push(
      rowCsv([
        "Scope",
        exportOptions.scope === "all"
          ? `All matching (${rows.length} rows)`
          : `Current page (${rows.length} rows)`,
      ]),
    );
    lines.push(
      rowCsv([
        "Organization",
        organizations.find((o) => o.id === filters.organizationId)?.name ||
          "All organizations",
      ]),
    );
    lines.push(
      rowCsv([
        "Actor",
        actors.find((a) => a.id === filters.actorId)?.name || "All actors",
      ]),
    );
    lines.push(
      rowCsv([
        "Action",
        filters.action ? humanize(filters.action) : "All actions",
      ]),
    );
    lines.push(
      rowCsv([
        "Entity type",
        filters.entityType ? humanize(filters.entityType) : "All entities",
      ]),
    );
    lines.push(rowCsv(["From (UTC)", params.from || "All dates"]));
    lines.push(rowCsv(["To (UTC)", params.to || "All dates"]));
    lines.push(rowCsv(["Total rows", rows.length]));
    lines.push(rowCsv());

    /* Methodology */
    lines.push(rowCsv(["Methodology"]));
    lines.push(
      rowCsv([
        "Audit events record administrative, security and financial changes. Times are stored and reported in UTC. Field changes summarise before/after values where captured.",
      ]),
    );
    lines.push(rowCsv());

    /* Detail table */
    const columns = [
      ["Event ID", "id"],
      ["Occurred At (UTC)", "occurred_at"],
      ["Organization", "organization_name"],
      ["Actor", "actor_name"],
      ["Actor Role", "actor_role"],
      ["Actor ID", "actor_user_id"],
      ["Action", "action"],
      ["Entity Type", "entity_type"],
      ["Entity ID", "entity_id"],
      ["Outcome", "outcome"],
      ["Reason", "reason"],
      ["Correlation ID", "correlation_id"],
      ["Before Changes", "before_changes"],
      ["After Changes", "after_changes"],
    ];
    lines.push(rowCsv(["Audit event details"]));
    lines.push(rowCsv(columns.map(([label]) => label)));
    [...rows]
      .sort((left, right) =>
        String(right.occurred_at || "").localeCompare(
          String(left.occurred_at || ""),
        ),
      )
      .forEach((auditRow) =>
        lines.push(
          rowCsv(
            columns.map(([, key]) =>
              key === "occurred_at" && auditRow[key]
                ? new Date(auditRow[key]).toISOString()
                : auditRow[key],
            ),
          ),
        ),
      );

    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `actpulse-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ------------------------------------------------------------------ */
  /*  PDF export — branded, uses the shared pdfReport.js design         */
  /* ------------------------------------------------------------------ */
  const exportPdf = (rows) => {
    const meta = [
      [
        "Organization",
        organizations.find((o) => o.id === filters.organizationId)?.name ||
          "All organizations",
      ],
      [
        "Actor",
        actors.find((a) => a.id === filters.actorId)?.name || "All actors",
      ],
      ["Action", filters.action ? humanize(filters.action) : "All actions"],
      [
        "Entity type",
        filters.entityType ? humanize(filters.entityType) : "All entities",
      ],
      ["From (UTC)", filters.from || "—"],
      ["To (UTC)", filters.to || "—"],
      ["Total rows", formatNumber(rows.length)],
      [
        "Scope",
        exportOptions.scope === "all" ? "All matching" : "Current filters",
      ],
    ];

    const rpt = createReportDoc({
      title: "Audit Log",
      subtitle: `${rows.length} events`,
      meta,
      timezone: "UTC",
    });

    /* ---------- Summary metrics ---------- */
    rpt.sectionTitle("Executive summary");

    const outcomes = rows.reduce((acc, r) => {
      const key = String(r.outcome || "UNKNOWN").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const actions = rows.reduce((acc, r) => {
      const key = String(r.action || "UNKNOWN");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const entityTypes = rows.reduce((acc, r) => {
      const key = String(r.entity_type || "UNKNOWN");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topActions = Object.entries(actions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    rpt.keyValueGrid(
      [
        ["Total events", formatNumber(rows.length)],
        ["Unique actions", formatNumber(Object.keys(actions).length)],
        ["Unique entities", formatNumber(Object.keys(entityTypes).length)],
        [
          "Top action",
          topActions[0]
            ? `${humanize(topActions[0][0])} (${topActions[0][1]})`
            : "—",
        ],
      ],
      { cols: 4 },
    );

    /* ---------- Outcome distribution chart ---------- */
    const outcomeChart = Object.entries(outcomes).map(([k, v]) => ({
      name: titleCase(k),
      value: Number(v) || 0,
    }));
    if (outcomeChart.length) {
      rpt.sectionTitle("Outcome distribution");
      rpt.barChart(outcomeChart, {
        title: "Events by outcome",
        formatValue: (v) => formatNumber(v),
      });

      rpt.sectionTitle("Outcomes");
      rpt.table(
        ["Outcome", "Events"],
        Object.entries(outcomes).map(([k, v]) => [
          titleCase(k),
          formatNumber(v),
        ]),
      );
    }

    /* ---------- Action distribution chart ---------- */
    const actionChart = Object.entries(actions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([k, v]) => ({
        name: humanize(k).slice(0, 20),
        value: Number(v) || 0,
      }));
    if (actionChart.length) {
      rpt.sectionTitle("Action distribution · top 12");
      rpt.barChart(actionChart, {
        title: "Events by action",
        formatValue: (v) => formatNumber(v),
      });
    }

    /* ---------- Entity distribution ---------- */
    if (Object.keys(entityTypes).length) {
      rpt.sectionTitle("Events by entity type");
      rpt.table(
        ["Entity type", "Events"],
        Object.entries(entityTypes).map(([k, v]) => [
          humanize(k),
          formatNumber(v),
        ]),
      );
    }

    /* ---------- Detailed log ---------- */
    rpt.pageBreak();
    rpt.sectionTitle(`Detailed log (${rows.length} rows)`);

    rpt.table(
      [
        "When (UTC)",
        "Organization",
        "Actor",
        "Action",
        "Entity",
        "Outcome",
        "Reason",
      ],
      rows.map((row) => [
        formatDate(row.occurred_at, "UTC"),
        row.organization_name || "Platform",
        row.actor_name || row.actor_role || "System",
        humanize(row.action),
        `${humanize(row.entity_type)}${
          row.entity_id ? ` · ${row.entity_id}` : ""
        }`,
        humanize(row.outcome),
        row.reason || "—",
      ]),
    );

    /* ---------- Methodology + footnote ---------- */
    rpt.finalize({
      methodology:
        "Audit events record administrative, security and financial changes. Times are stored and reported in UTC. Field changes summarise before/after values where captured.",
      footnote:
        "This log is generated from immutable audit records. Field-level before/after values are available per event in the Audit Logs workspace.",
    });

    rpt.doc.save(`actpulse-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ------------------------------------------------------------------ */
  /*  Export dispatcher — reads the modal options                       */
  /* ------------------------------------------------------------------ */
  const submitExport = async (event) => {
    event.preventDefault();
    setExporting(true);
    setError("");
    try {
      const rows = exportOptions.scope === "all" ? await fetchAllRows() : items;

      if (exportOptions.format === "PDF") {
        exportPdf(rows);
      } else {
        exportCsv(rows);
      }

      setExportOpen(false);
      setExportDirty(false);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not export audit logs.",
      );
    } finally {
      setExporting(false);
    }
  };
  /* ---------------- Pagination math ---------------- */
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const fromIndex = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const toIndex = Math.min(filters.page * filters.pageSize, total);

  const goTo = (page) =>
    setFilters((old) => ({
      ...old,
      page: Math.max(1, Math.min(totalPages, page)),
    }));

  return (
    <PageContainer
      title="Audit Logs"
      subtitle="Administrative, security and financial changes"
    >
      <div className="space-y-4">
        {/* ============ FILTER BAR ============ */}
        <section className={card} aria-label="Audit filters">
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

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Organization
              </span>
              <select
                className={selectClass}
                value={filters.organizationId}
                onChange={(e) => update("organizationId", e.target.value)}
              >
                <option value="">All organizations</option>
                {organizations.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Actor dropdown */}
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Actor
              </span>
              <select
                className={selectClass}
                value={filters.actorId}
                onChange={(e) => update("actorId", e.target.value)}
              >
                <option value="">All actors</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.role ? ` · ${humanize(a.role)}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {/* Action dropdown */}
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Action
              </span>
              <select
                className={selectClass}
                value={filters.action}
                onChange={(e) => update("action", e.target.value)}
              >
                <option value="">All actions</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>
                    {humanize(a)}
                  </option>
                ))}
              </select>
            </label>

            {/* Entity type dropdown */}
            <label className="text-sm">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Entity type
              </span>
              <select
                className={selectClass}
                value={filters.entityType}
                onChange={(e) => update("entityType", e.target.value)}
              >
                <option value="">All entities</option>
                {entityOptions.map((e) => (
                  <option key={e} value={e}>
                    {humanize(e)}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="From"
              type="datetime-local"
              value={filters.from}
              onChange={(e) => update("from", e.target.value)}
            />
            <Input
              label="To"
              type="datetime-local"
              value={filters.to}
              onChange={(e) => update("to", e.target.value)}
            />
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
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Rows per page
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                value={filters.pageSize}
                onChange={(e) => update("pageSize", Number(e.target.value))}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExportOpen(true);
                setExportDirty(false);
              }}
              disabled={loading || items.length === 0}
              leftIcon={Download}
            >
              Export CSV
            </Button>
          </div>
        </div>

        {/* ============ ERROR ============ */}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {/* ============ TABLE ============ */}
        {loading ? (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading audit logs…
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div
            className={`${cardPad} flex flex-col items-center justify-center py-16 text-center`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
              <History size={22} />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No audit events match these filters
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Try adjusting the date range or clearing some filters.
            </p>
          </div>
        ) : (
          <section className={card}>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead>
                  <tr className={tableHead}>
                    <th className="p-3">When (UTC)</th>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Outcome</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const o = outcomeStyle(row.outcome);
                    const OutcomeIcon = o.icon;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        <td className={tableCell}>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800 dark:text-slate-100">
                              {formatDate(row.occurred_at, "UTC")}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {new Date(row.occurred_at).toLocaleTimeString(
                                [],
                                {
                                  hour12: false,
                                },
                              )}
                            </span>
                          </div>
                        </td>
                        <td className={tableCell}>
                          {row.organization_name ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={14} className="text-slate-400" />
                              {row.organization_name}
                            </span>
                          ) : (
                            <span className="text-slate-400">Platform</span>
                          )}
                        </td>
                        <td className={tableCell}>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-[10px] font-bold text-white">
                              {initials(row.actor_name || row.actor_role)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {row.actor_name || row.actor_role || "System"}
                              </p>
                              {row.actor_role && row.actor_name && (
                                <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                                  {humanize(row.actor_role)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={tableCell}>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {humanize(row.action)}
                          </span>
                        </td>
                        <td className={tableCell}>
                          <div className="text-slate-700 dark:text-slate-200">
                            {humanize(row.entity_type)}
                          </div>
                          {row.entity_id && (
                            <div className="truncate text-xs text-slate-400 dark:text-slate-500">
                              {row.entity_id}
                            </div>
                          )}
                        </td>
                        <td className={tableCell}>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${o.pill}`}
                          >
                            <OutcomeIcon size={12} />
                            {humanize(row.outcome)}
                          </span>
                        </td>
                        <td className={`${tableCell} text-right`}>
                          <button
                            type="button"
                            onClick={() => setDetail(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                          >
                            <Eye size={13} />
                            View
                          </button>
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
                  {filters.page}
                </strong>{" "}
                of {totalPages} · {total} records
              </span>
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
          </section>
        )}
        {/* ============ EXPORT MODAL ============ */}
        <ActionModal
          open={exportOpen}
          title="Export Audit Log"
          dirty={exportDirty}
          onClose={() => setExportOpen(false)}
          size="md"
        >
          <form onSubmit={submitExport} className="space-y-4 text-sm">
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
              <FileSpreadsheet
                size={18}
                className="mt-0.5 shrink-0 text-[#064789] dark:text-[#8fc7e8]"
              />
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <p>
                  <strong className="text-slate-700 dark:text-slate-200">
                    {items.length}
                  </strong>{" "}
                  events currently loaded. Rows per page: {filters.pageSize}.
                </p>
                <p className="mt-0.5">
                  Choose "All matching" to fetch every page (up to 1,000 rows).
                </p>
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Format
              </span>
              <select
                className={selectClass}
                value={exportOptions.format}
                onChange={(e) => {
                  setExportOptions({
                    ...exportOptions,
                    format: e.target.value,
                  });
                  setExportDirty(true);
                }}
              >
                <option value="CSV">CSV</option>
                <option value="PDF">PDF</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Scope
              </span>
              <select
                className={selectClass}
                value={exportOptions.scope}
                onChange={(e) => {
                  setExportOptions({
                    ...exportOptions,
                    scope: e.target.value,
                  });
                  setExportDirty(true);
                }}
              >
                <option value="current">
                  Current page ({items.length} rows)
                </option>
                <option value="all">
                  All matching results (up to 1,000 rows)
                </option>
              </select>
            </label>

            {exportOptions.format === "PDF" &&
              exportOptions.scope === "all" && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                  Large PDF exports are paginated automatically. Tables repeat
                  headers across pages.
                </p>
              )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={() => setExportOpen(false)}
                disabled={exporting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={exporting}
                leftIcon={
                  exportOptions.format === "PDF" ? FileText : FileSpreadsheet
                }
              >
                Generate / Download
              </Button>
            </div>
          </form>
        </ActionModal>

        {/* ============ DETAIL MODAL ============ */}
        <ActionModal
          open={!!detail}
          title="Audit Event Details"
          onClose={() => setDetail(null)}
          size="xl"
        >
          {detail && (
            <div className="space-y-5 text-sm">
              {/* Header band */}
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 to-[#427aa1]/5 p-4 dark:border-slate-700 dark:from-[#064789]/15 dark:to-[#427aa1]/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Action
                  </p>
                  <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                    {humanize(detail.action)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(detail.occurred_at, "UTC")} ·{" "}
                    {new Date(detail.occurred_at).toLocaleTimeString([], {
                      hour12: false,
                    })}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    outcomeStyle(detail.outcome).pill
                  }`}
                >
                  {(() => {
                    const Icon = outcomeStyle(detail.outcome).icon;
                    return <Icon size={12} />;
                  })()}
                  {humanize(detail.outcome)}
                </span>
              </div>

              {/* Metadata grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailGrid
                  label="Organization"
                  value={detail.organization_name || "Platform"}
                  icon={Users}
                />
                <DetailGrid
                  label="Actor"
                  value={`${detail.actor_name || detail.actor_role || "System"}${
                    detail.actor_role && detail.actor_name
                      ? ` · ${humanize(detail.actor_role)}`
                      : ""
                  }`}
                  icon={User}
                />
                <DetailGrid
                  label="Entity"
                  value={`${humanize(detail.entity_type)}${
                    detail.entity_id ? ` · ${detail.entity_id}` : ""
                  }`}
                  icon={FileText}
                />
                <DetailGrid
                  label="Recorded at (UTC)"
                  value={formatDate(detail.occurred_at, "UTC")}
                  icon={Clock}
                />
                <DetailGrid
                  label="Outcome"
                  value={humanize(detail.outcome)}
                  icon={Activity}
                />
                <DetailGrid
                  label="Reason"
                  value={detail.reason || "Not provided"}
                  icon={FileText}
                />
              </div>

              {/* Change diff */}
              <div>
                <h4 className={`${sectionTitle} mb-2`}>Field changes</h4>
                <ChangeDiff
                  before={detail.before_changes}
                  after={detail.after_changes}
                />
              </div>

              {/* Footer meta */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                Event ID: <span className="font-mono">{detail.id || "—"}</span>
              </div>
            </div>
          )}
        </ActionModal>
      </div>
    </PageContainer>
  );
}
