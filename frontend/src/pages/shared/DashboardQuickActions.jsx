// src/pages/shared/DashboardQuickActions.jsx
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Wrench,
  Zap,
} from "lucide-react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import {
  fuelApi,
  maintenanceApi,
  operationalReportsApi,
} from "../../api/actPulse.Api";
import {
  createReportDoc,
  formatNumber,
  titleCase,
} from "../../utils/pdfReport";

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const REPORT_TYPES = [
  ["fleet", "Site / Fleet Summary"],
  ["equipment", "Equipment Operations"],
  ["fuel", "Fuel Readings & Refills"],
  ["reconciliation", "Fuel Reconciliation"],
  ["costs", "Fuel & Service Costs"],
  ["maintenance", "Maintenance"],
  ["alerts", "Alerts & Events"],
];

const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const display = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function DashboardQuickActions({
  equipment = [],
  filters = {},
  onSaved,
}) {
  const [action, setAction] = useState("");
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const generators = useMemo(
    () => equipment.filter((row) => row.type === "GENERATOR"),
    [equipment]
  );

  /* ---------------- open / close ---------------- */
  const open = (kind) => {
    const initial =
      equipment.find((row) => row.type === "GENERATOR") || equipment[0];
    setAction(kind);
    setForm({
      equipmentId: initial?.id || "",
      observedAt: localNow(),
      occurredAt: localNow(),
      performedAt: localNow(),
      type: "fleet",
      format: "CSV",
    });
    setDirty(false);
    setError("");
    setNotice("");
  };

  const close = () => {
    if (busy) return;
    setAction("");
    setDirty(false);
  };

  const change = (key, value) => {
    setForm((old) => ({ ...old, [key]: value }));
    setDirty(true);
  };

  /* ---------------- save ---------------- */
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (action === "reading") {
        await fuelApi.reading(form.equipmentId, {
          observedAt: new Date(form.observedAt).toISOString(),
          levelLitres: form.levelLitres,
          method: form.method,
          notes: form.notes,
        });
      } else if (action === "refill") {
        await fuelApi.refill(form.equipmentId, {
          occurredAt: new Date(form.occurredAt).toISOString(),
          quantityLitres: form.quantityLitres,
          unitPrice: form.unitPrice || undefined,
          currency: form.unitPrice ? form.currency || "TZS" : undefined,
          additionalCost: form.unitPrice
            ? form.additionalCost || "0"
            : undefined,
          supplier: form.supplier,
        });
      } else if (action === "service") {
        await maintenanceApi.service({
          equipmentId: form.equipmentId,
          performedAt: new Date(form.performedAt).toISOString(),
          description: form.description,
          technician: form.technician,
          meterHours: form.meterHours,
        });
      } else if (action === "export") {
        const params = {
          ...filters,
          type: form.type,
          from:
            filters.preset === "custom" && filters.from
              ? new Date(filters.from).toISOString()
              : undefined,
          to:
            filters.preset === "custom" && filters.to
              ? new Date(filters.to).toISOString()
              : undefined,
        };

        if (form.format === "CSV") {
          const { data } = await operationalReportsApi.csv(params);
          const url = URL.createObjectURL(data);
          const link = document.createElement("a");
          link.href = url;
          link.download = `actpulse-${form.type}.csv`;
          link.click();
          URL.revokeObjectURL(url);
        } else {
          const { data } = await operationalReportsApi.report({
            ...params,
            page: 1,
            pageSize: 100,
          });

          if (data.total > 100)
            throw new Error(
              "Quick PDF is limited to 100 rows. Use Reports to narrow the scope."
            );

          const reportName =
            REPORT_TYPES.find(([id]) => id === form.type)?.[1] || "Report";

          /* ---------- Meta grid ---------- */
          const meta = [
            ["Timezone", data.period.timezone],
            [
              "Period from",
              new Date(data.period.from)
                .toISOString()
                .slice(0, 19)
                .replace("T", " "),
            ],
            [
              "Period to",
              new Date(data.period.to)
                .toISOString()
                .slice(0, 19)
                .replace("T", " "),
            ],
            [
              "Scope",
              `${data.scope?.equipmentCount || 0} equipment · ${
                data.scope?.siteId || "All accessible sites"
              }`,
            ],
          ];

          const rpt = createReportDoc({
            title: reportName,
            subtitle: `${data.items.length} records · Quick export`,
            meta,
            timezone: data.period.timezone,
          });

          /* ---------- Summary ---------- */
          const summaryEntries = Object.entries(data.summary || {})
            .filter(([, v]) => typeof v !== "object")
            .map(([key, value]) => [titleCase(key), formatNumber(value)]);

          if (summaryEntries.length) {
            rpt.sectionTitle("Executive summary");
            rpt.keyValueGrid(summaryEntries, { cols: 4 });
          }

          if (data.summary?.byCurrency?.length) {
            rpt.spacer(2);
            rpt.paragraph("Totals by currency", { bold: true, size: 10 });
            rpt.table(
              ["Currency", "Amount", "Quantity"],
              data.summary.byCurrency.map((row) => [
                row.currency || "—",
                formatNumber(row.amount),
                formatNumber(row.quantity),
              ])
            );
          }

          /* ---------- Chart ---------- */
          const chartData = data.items.slice(0, 12).map((row) => ({
            name: row.equipment || row.kind,
            value:
              Number(row.onMs ?? row.quantity ?? row.amount ?? 0) /
              (row.onMs == null ? 1 : 3600000),
          }));

          if (chartData.length) {
            rpt.sectionTitle("Selected records overview");
            rpt.barChart(chartData, {
              title: "Top 12 records by value",
              formatValue: (v) =>
                form.type === "costs"
                  ? formatNumber(v)
                  : `${formatNumber(v)}${
                      form.type === "fleet" || form.type === "equipment"
                        ? " h"
                        : " L"
                    }`,
            });
          }

          /* ---------- Table ---------- */
          if (data.items.length) {
            rpt.pageBreak();
            rpt.sectionTitle(`Detailed breakdown (${data.items.length} rows)`);
            const keys = Object.keys(data.items[0]).slice(0, 8);
            const head = keys.map((k) => titleCase(k));
            const body = data.items.map((row) =>
              keys.map((key) => display(row[key]))
            );
            rpt.table(head, body);
          }

          /* ---------- Finalize ---------- */
          rpt.finalize({
            methodology: data.methodology,
            footnote:
              "Fuel purchases are not consumption expense. Estimates are not sensor measurements. Missing observations are never counted as OFF.",
          });

          rpt.doc.save(`actpulse-${form.type}.pdf`);
        }
      }

      setNotice("Action completed.");
      close();
      onSaved?.();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Action failed."
      );
    } finally {
      setBusy(false);
    }
  };

  /* ================================================================ */
  return (
    <>
      {/* ============ QUICK ACTIONS BAR ============ */}
      <div className="flex flex-wrap items-center gap-2">
        {generators.length > 0 && (
          <>
            <Button onClick={() => open("reading")} leftIcon={Gauge}>
              Add Reading
            </Button>
            <Button
              variant="outline"
              onClick={() => open("refill")}
              leftIcon={Droplets}
            >
              Record Refill
            </Button>
          </>
        )}
        <Button
          variant="outline"
          disabled={!equipment.length}
          onClick={() => open("service")}
          leftIcon={Wrench}
        >
          Record Service
        </Button>
        <Button
          variant="outline"
          onClick={() => open("export")}
          leftIcon={Download}
        >
          Export Report
        </Button>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <CheckCircle2 size={14} />
          {notice}
        </p>
      )}

      {/* ============ MODAL ============ */}
      <ActionModal
        open={!!action}
        title={
          {
            reading: "Add Fuel Reading",
            refill: "Record Refill",
            service: "Record Completed Service",
            export: "Export Report",
          }[action] || ""
        }
        dirty={dirty}
        onClose={close}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4 text-sm">
          <p className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            {action === "export" ? (
              <>
                <FileText size={14} className="mt-0.5 shrink-0" />
                The current dashboard filters will be used to generate this
                export.
              </>
            ) : (
              <>
                <Zap size={14} className="mt-0.5 shrink-0" />
                Manually recorded operational data. Recorded by you.
              </>
            )}
          </p>

          {action !== "export" && (
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
                {(action === "service" ? equipment : generators).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* ---------- Reading ---------- */}
          {action === "reading" && (
            <>
              <Input
                required
                type="datetime-local"
                label="Reading time"
                value={form.observedAt || ""}
                onChange={(e) => change("observedAt", e.target.value)}
              />
              <Input
                required
                type="number"
                min="0"
                step="0.001"
                label="Fuel level (L)"
                value={form.levelLitres || ""}
                onChange={(e) => change("levelLitres", e.target.value)}
              />
              <Input
                label="Method"
                value={form.method || ""}
                onChange={(e) => change("method", e.target.value)}
              />
              <Input
                label="Notes"
                value={form.notes || ""}
                onChange={(e) => change("notes", e.target.value)}
              />
            </>
          )}

          {/* ---------- Refill ---------- */}
          {action === "refill" && (
            <>
              <Input
                required
                type="datetime-local"
                label="Refill time"
                value={form.occurredAt || ""}
                onChange={(e) => change("occurredAt", e.target.value)}
              />
              <Input
                required
                type="number"
                min="0.001"
                step="0.001"
                label="Quantity (L)"
                value={form.quantityLitres || ""}
                onChange={(e) => change("quantityLitres", e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Unit price per litre"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.unitPrice || ""}
                  onChange={(e) => change("unitPrice", e.target.value)}
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
                label="Additional costs"
                type="number"
                min="0"
                step="0.0001"
                value={form.additionalCost || ""}
                onChange={(e) => change("additionalCost", e.target.value)}
              />
              <Input
                label="Supplier"
                value={form.supplier || ""}
                onChange={(e) => change("supplier", e.target.value)}
              />
            </>
          )}

          {/* ---------- Service ---------- */}
          {action === "service" && (
            <>
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
                label="Technician / provider"
                value={form.technician || ""}
                onChange={(e) => change("technician", e.target.value)}
              />
              <Input
                label="Physical meter hours (optional)"
                type="number"
                min="0"
                step="0.001"
                value={form.meterHours || ""}
                onChange={(e) => change("meterHours", e.target.value)}
              />
            </>
          )}

          {/* ---------- Export ---------- */}
          {action === "export" && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Report type
                </span>
                <select
                  className={selectClass}
                  value={form.type}
                  onChange={(e) => change("type", e.target.value)}
                >
                  {REPORT_TYPES.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Format
                </span>
                <select
                  className={selectClass}
                  value={form.format}
                  onChange={(e) => change("format", e.target.value)}
                >
                  <option value="CSV">CSV</option>
                  <option value="PDF">PDF</option>
                </select>
              </label>

              <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
                <CalendarClock size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p>
                    Selected period:{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {filters.preset}
                    </strong>
                  </p>
                  <p>
                    Timezone:{" "}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {filters.timezone}
                    </strong>
                  </p>
                </div>
              </div>

              {form.format === "PDF" && (
                <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  PDF is limited to 100 rows. Use Reports for larger exports.
                </p>
              )}
            </>
          )}

          {/* ---------- Error ---------- */}
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              <AlertTriangle size={14} />
              {error}
            </p>
          )}

          {/* ---------- Footer ---------- */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              leftIcon={
                action === "export"
                  ? form.format === "PDF"
                    ? FileText
                    : FileSpreadsheet
                  : undefined
              }
            >
              {action === "export" ? "Generate / Download" : "Save"}
            </Button>
          </div>
        </form>
      </ActionModal>
    </>
  );
}