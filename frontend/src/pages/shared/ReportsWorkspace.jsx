// src/pages/shared/ReportsWorkspace.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import {
  equipmentApi,
  operationalReportsApi,
  organizationsApi,
  sitesApi,
} from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";
import { useSubscriptionStore } from "../../store/subscription.store";
import { formatDate } from "../../utils/formatDate";
import {
  createReportDoc,
  formatNumber,
  titleCase,
} from "../../utils/pdfReport";

const types = [
  ["fleet", "Site / Fleet Summary"],
  ["equipment", "Equipment Operations"],
  ["fuel", "Fuel Readings & Refills"],
  ["reconciliation", "Fuel Reconciliation"],
  ["costs", "Fuel & Service Costs"],
  ["maintenance", "Maintenance"],
  ["alerts", "Alerts & Events"],
];

const panel =
  "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900";
const select =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const display = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

export default function ReportsWorkspace() {
  const [searchParams] = useSearchParams();
  const admin = useAuthStore((state) => state.user?.role === "Admin");
  const pdfIncluded = useSubscriptionStore(
    (state) => state.status?.plan?.features?.pdf_export === true
  );
  const advancedIncluded = useSubscriptionStore(
    (state) => state.status?.plan?.features?.advanced_reports === true
  );
  const fleetIncluded = useSubscriptionStore(
    (state) => state.status?.plan?.features?.fleet_analytics === true
  );

  const [filters, setFilters] = useState({
    type:
      searchParams.get("equipmentId") || !admin ? "equipment" : "fleet",
    organizationId: "",
    siteId: searchParams.get("siteId") || "",
    equipmentId: searchParams.get("equipmentId") || "",
    equipmentType: "",
    preset: "30d",
    from: "",
    to: "",
    timezone: searchParams.get("timezone") || "Africa/Dar_es_Salaam",
    page: 1,
    pageSize: 25,
  });

  const dateLabel = (value) => formatDate(value, filters.timezone);

  const [organizations, setOrganizations] = useState([]);
  const [sites, setSites] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: "CSV",
    summary: true,
    detail: true,
  });
  const [exportDirty, setExportDirty] = useState(false);

  useEffect(() => {
    const requests = [
      sitesApi.list({ active: "all" }),
      equipmentApi.list({ active: "all" }),
    ];
    if (admin) requests.push(organizationsApi.list());
    Promise.all(requests)
      .then(([s, e, o]) => {
        setSites(s.data || []);
        setEquipment(e.data || []);
        if (o) setOrganizations(o.data || []);
      })
      .catch(() => setError("Could not load report filters."));
  }, [admin]);

  const params = useMemo(
    () => ({
      ...filters,
      from:
        filters.preset === "custom" && filters.from
          ? new Date(filters.from).toISOString()
          : undefined,
      to:
        filters.preset === "custom" && filters.to
          ? new Date(filters.to).toISOString()
          : undefined,
      organizationId: admin ? filters.organizationId || undefined : undefined,
    }),
    [filters, admin]
  );

  const load = useCallback(async () => {
    if (filters.preset === "custom" && (!filters.from || !filters.to)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await operationalReportsApi.report(params);
      setReport(data);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load report.");
    } finally {
      setLoading(false);
    }
  }, [filters, params]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const update = (key, value) =>
    setFilters((old) => ({ ...old, [key]: value, page: 1 }));

  const chartData =
    report?.items?.slice(0, 12).map((row) => ({
      name: row.equipment || row.kind,
      value:
        Number(row.onMs ?? row.quantity ?? row.amount ?? 0) /
        (row.onMs == null ? 1 : 3600000),
    })) || [];

  const summary = report?.summary || {};

  const reportName =
    types.find(([id]) => id === filters.type)?.[1] || "Report";

  /* ================================================================ */
  /*  Export                                                          */
  /* ================================================================ */
  const exportReport = async (event) => {
    event.preventDefault();
    setExporting(true);
    setError("");
    try {
      if (exportOptions.format === "CSV") {
        const { data } = await operationalReportsApi.csv(params);
        const url = URL.createObjectURL(data);
        const link = document.createElement("a");
        link.href = url;
        link.download = `actpulse-${filters.type}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        if (report?.total > 500)
          throw new Error("PDF is limited to 500 rows; narrow the filters.");

        const pages = Math.ceil((report?.total || 0) / 100);
        const items = [];
        for (let page = 1; page <= Math.max(1, pages); page += 1) {
          const { data } = await operationalReportsApi.report({
            ...params,
            format: "pdf",
            page,
            pageSize: 100,
          });
          items.push(...data.items);
        }

        const meta = [
          ["Timezone", report.period.timezone],
          [
            "Period from",
            new Date(report.period.from)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
          ],
          [
            "Period to",
            new Date(report.period.to)
              .toISOString()
              .slice(0, 19)
              .replace("T", " "),
          ],
          [
            "Scope",
            `${report.scope?.equipmentCount || 0} equipment · ${
              report.scope?.siteId || "All accessible sites"
            }`,
          ],
        ];
        if (admin && filters.organizationId) {
          const org = organizations.find(
            (o) => o.id === filters.organizationId
          );
          meta.push(["Organization", org?.name || filters.organizationId]);
        }
        if (filters.siteId) {
          const site = sites.find((s) => s.id === filters.siteId);
          meta.push(["Site", site?.name || filters.siteId]);
        }

        const rpt = createReportDoc({
          title: reportName,
          subtitle: `${items.length} records · Generated from ACTPulse`,
          meta,
          timezone: report.period.timezone,
        });

        /* Executive summary */
        if (exportOptions.summary) {
          rpt.sectionTitle("Executive summary");
          const summaryEntries = Object.entries(summary)
            .filter(([, value]) => typeof value !== "object")
            .map(([key, value]) => [titleCase(key), formatNumber(value)]);
          if (summaryEntries.length) {
            rpt.keyValueGrid(summaryEntries, { cols: 4 });
          }
          if (summary.byCurrency?.length) {
            rpt.spacer(2);
            rpt.paragraph("Totals by currency", { bold: true, size: 10 });
            rpt.table(
              ["Currency", "Amount", "Quantity"],
              summary.byCurrency.map((row) => [
                row.currency || "—",
                formatNumber(row.amount),
                formatNumber(row.quantity),
              ])
            );
          }
        }

        /* Chart */
        if (chartData.length) {
          rpt.sectionTitle("Selected records overview");
          rpt.barChart(chartData, {
            title: "Top 12 records by value",
            formatValue: (v) =>
              filters.type === "costs"
                ? formatNumber(v)
                : `${formatNumber(v)}${
                    filters.type === "fleet" ||
                    filters.type === "equipment"
                      ? " h"
                      : " L"
                  }`,
          });
        }

        /* Detail table */
        if (exportOptions.detail && items.length) {
          rpt.pageBreak();
          rpt.sectionTitle(`Detailed breakdown (${items.length} rows)`);
          const keys = Object.keys(items[0]).slice(0, 8);
          const head = keys.map((k) => titleCase(k));
          const body = items.map((row) =>
            keys.map((key) => {
              const v = row[key];
              if (key === "at" || key.endsWith("_at")) {
                try {
                  return formatDate(v, report.period.timezone);
                } catch {
                  return display(v);
                }
              }
              return display(v);
            })
          );
          rpt.table(head, body);
        }

        /* Finalize */
        rpt.finalize({
          methodology: report.methodology,
          footnote:
            "Fuel purchases are not consumption expense. Estimates are not sensor measurements. Missing observations are never counted as OFF.",
        });

        rpt.doc.save(`actpulse-${filters.type}.pdf`);
      }

      setExportOpen(false);
      setExportDirty(false);
    } catch (err) {
      setError(
        err?.message ||
          err?.response?.data?.message ||
          "Could not export report."
      );
    } finally {
      setExporting(false);
    }
  };

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <PageContainer
      title="Reports"
      subtitle="Scoped operations, fuel, maintenance and alert analytics"
    >
      <div className="space-y-5">
        <div className={`${panel} grid gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
          <label className="text-sm">
            Report type
            <select
              className={select}
              value={filters.type}
              onChange={(e) => update("type", e.target.value)}
            >
              {types
                .filter(
                  ([id]) =>
                    admin ||
                    id === "equipment" ||
                    id === "fuel" ||
                    (id === "fleet" ? fleetIncluded : advancedIncluded)
                )
                .map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
            </select>
          </label>

          {admin && (
            <label className="text-sm">
              Organization
              <select
                className={select}
                value={filters.organizationId}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    organizationId: e.target.value,
                    siteId: "",
                    equipmentId: "",
                    page: 1,
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
            Site
            <select
              className={select}
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
            Equipment
            <select
              className={select}
              value={filters.equipmentId}
              onChange={(e) => update("equipmentId", e.target.value)}
            >
              <option value="">All accessible equipment</option>
              {equipment
                .filter(
                  (row) =>
                    (!filters.siteId || row.siteId === filters.siteId) &&
                    (!filters.organizationId ||
                      row.organizationId === filters.organizationId)
                )
                .map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm">
            Equipment type
            <select
              className={select}
              value={filters.equipmentType}
              onChange={(e) => update("equipmentType", e.target.value)}
            >
              <option value="">All types</option>
              <option value="GENERATOR">Generator</option>
              <option value="UPS">UPS</option>
            </select>
          </label>

          <label className="text-sm">
            Period
            <select
              className={select}
              value={filters.preset}
              onChange={(e) => update("preset", e.target.value)}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <Input
            label="Reporting timezone"
            value={filters.timezone}
            onChange={(e) => update("timezone", e.target.value)}
          />

          {filters.preset === "custom" && (
            <>
              <Input
                type="datetime-local"
                label="From"
                value={filters.from}
                onChange={(e) => update("from", e.target.value)}
              />
              <Input
                type="datetime-local"
                label="To"
                value={filters.to}
                onChange={(e) => update("to", e.target.value)}
              />
            </>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {report
              ? `${dateLabel(report.period.from)} – ${dateLabel(report.period.to)} · ${report.period.timezone}`
              : "Select filters"}
          </p>
          <Button
            onClick={() => {
              setExportOpen(true);
              setExportDirty(false);
            }}
            disabled={!report || loading}
          >
            Export Report
          </Button>
        </div>

        {loading ? (
          <p>Loading report…</p>
        ) : !report || report.total === 0 ? (
          <div className={panel}>
            No data for this report and period. Missing observations are never
            counted as OFF.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(summary)
                .filter(([, value]) => typeof value !== "object")
                .map(([key, value]) => (
                  <div key={key} className={panel}>
                    <p className="text-xs text-slate-500">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <strong className="text-lg text-[#064789] dark:text-[#8fc7e8]">
                      {display(value)}
                    </strong>
                  </div>
                ))}
            </div>

            {summary.byCurrency?.length > 0 && (
              <div className={panel}>
                <h2 className="font-semibold">Totals by currency</h2>
                {summary.byCurrency.map((row) => (
                  <p key={row.currency || "none"} className="text-sm">
                    {row.currency || "No currency"} · {row.amount} amount ·{" "}
                    {row.quantity} quantity
                  </p>
                ))}
              </div>
            )}

            <div className={`${panel} h-64`}>
              <h2 className="font-semibold">Selected records overview</h2>
              <ResponsiveContainer
                initialDimension={{ width: 300, height: 224 }}
                width="100%"
                height="85%"
              >
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#427aa1" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={panel}>
              <h2 className="mb-2 font-semibold">Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="min-w-[700px] w-full text-left text-sm">
                  <thead>
                    <tr>
                      {Object.keys(report.items[0] || {})
                        .slice(0, 8)
                        .map((key) => (
                          <th key={key} className="p-2 capitalize">
                            {key.replaceAll("_", " ")}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.items.map((row, index) => (
                      <tr
                        key={`${row.equipmentId || row.equipment_id || "row"}-${row.at || index}-${index}`}
                        className="border-t dark:border-slate-700"
                      >
                        {Object.keys(report.items[0] || {})
                          .slice(0, 8)
                          .map((key) => (
                            <td key={key} className="p-2 align-top">
                              {key === "at"
                                ? dateLabel(row[key])
                                : display(row[key])}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  disabled={filters.page <= 1}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page - 1 })
                  }
                >
                  Previous
                </Button>
                <span>
                  Page {filters.page} /{" "}
                  {Math.ceil(report.total / filters.pageSize)}
                </span>
                <Button
                  variant="outline"
                  disabled={filters.page * filters.pageSize >= report.total}
                  onClick={() =>
                    setFilters({ ...filters, page: filters.page + 1 })
                  }
                >
                  Next
                </Button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              {report.methodology} Fuel purchases are not consumption expense.
              Estimates are not sensor measurements.
            </p>
          </>
        )}

        <ActionModal
          open={exportOpen}
          title="Export Report"
          dirty={exportDirty}
          onClose={() => setExportOpen(false)}
        >
          <form onSubmit={exportReport} className="space-y-3 text-sm">
            <p>
              <strong>{reportName}</strong>
            </p>
            <p>
              Current period:{" "}
              {report &&
                `${dateLabel(report.period.from)} – ${dateLabel(report.period.to)}`}{" "}
              · {filters.timezone}
            </p>
            <p>
              Scope: {report?.scope?.equipmentCount || 0} accessible equipment
            </p>

            <label className="block">
              Format
              <select
                className={select}
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
                {(admin || pdfIncluded) && <option value="PDF">PDF</option>}
              </select>
            </label>

            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={exportOptions.summary}
                onChange={(e) => {
                  setExportOptions({
                    ...exportOptions,
                    summary: e.target.checked,
                  });
                  setExportDirty(true);
                }}
              />
              Include summary
            </label>

            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={exportOptions.detail}
                onChange={(e) => {
                  setExportOptions({
                    ...exportOptions,
                    detail: e.target.checked,
                  });
                  setExportDirty(true);
                }}
              />
              Include detailed table
            </label>

            <p className="text-xs text-slate-500">
              CSV always includes both sections from the authorized backend
              export. PDF uses the same report endpoint and current filters.
            </p>

            <div className="flex gap-2">
              <Button type="submit" loading={exporting}>
                Generate / Download
              </Button>
            </div>
          </form>
        </ActionModal>
      </div>
    </PageContainer>
  );
}