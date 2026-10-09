// src/pages/shared/BillingWorkspace.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Upload,
  Wallet,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import ActionModal from "../../components/common/ActionModal";
import { billingApi } from "../../api/actPulse.Api";
import { formatDate } from "../../utils/formatDate";
import {
  createReportDoc,
  formatNumber,
  titleCase,
} from "../../utils/pdfReport";

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

const money = (amount, currency) =>
  `${currency || ""} ${formatNumber(amount ?? 0)}`.trim();

const humanize = (v) =>
  String(v ?? "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ */
/*  Invoice PDF — uses the shared brand design system                 */
/* ------------------------------------------------------------------ */
function invoicePdf(invoice) {
  const meta = [
    ["Invoice number", invoice.invoice_number],
    ["Organization", invoice.organization_name],
    ["Issued (UTC)", formatDate(invoice.issued_at, "UTC")],
    ["Due (UTC)", formatDate(invoice.due_at, "UTC")],
    ["Plan", invoice.plan_snapshot?.name || "—"],
    ["Billing cycle", humanize(invoice.billing_cycle)],
    ["Status", humanize(invoice.status)],
    ["Currency", invoice.currency],
  ];

  const rpt = createReportDoc({
    title: "Subscription Invoice",
    subtitle: `${invoice.invoice_number} · ${invoice.organization_name}`,
    meta,
    timezone: "UTC",
  });

  /* ---------- Line items ---------- */
  rpt.sectionTitle("Invoice items");
  const items = invoice.items || [];
  rpt.table(
    ["Description", "Quantity", "Unit price", "Total"],
    items.map((item) => [
      item.description || "—",
      formatNumber(item.quantity ?? 1),
      money(item.unit_price, invoice.currency),
      money(item.total, invoice.currency),
    ])
  );

  /* ---------- Totals ---------- */
  rpt.sectionTitle("Amount summary");
  rpt.keyValueGrid(
    [
      ["Total", money(invoice.total, invoice.currency)],
      ["Allocated", money(invoice.allocated, invoice.currency)],
      ["Outstanding", money(invoice.outstanding, invoice.currency)],
      ["Currency", invoice.currency],
    ],
    { cols: 2 }
  );

  /* ---------- Payment instructions snapshot ---------- */
  const instructions = invoice.instruction_snapshot || [];
  rpt.sectionTitle("Payment instructions at issue date");
  if (!instructions.length) {
    rpt.paragraph(
      "Payment instructions were not configured when this invoice was issued. Contact ACTPulse before transferring funds.",
      { color: [245, 158, 11], size: 9 }
    );
  } else {
    instructions.forEach((item, index) => {
      rpt.paragraph(
        `Method ${index + 1}: ${humanize(item.method)} · ${item.provider || "—"}`,
        { bold: true, size: 10, gap: 1 }
      );
      rpt.paragraph(
        `Account: ${item.account_name || "—"} · ${item.account_number || "—"} · ${item.currency || ""}`,
        { size: 9, color: [100, 116, 139], gap: 1 }
      );
      if (item.reference_instructions) {
        rpt.paragraph(`Reference: ${item.reference_instructions}`, {
          size: 9,
          color: [100, 116, 139],
          gap: 3,
        });
      }
    });
  }

  rpt.finalize({
    footnote:
      "Ordinary billing invoice. No tax treatment is stated. Verified allocations appear as payment submissions are approved.",
  });

  rpt.doc.save(`${invoice.invoice_number}.pdf`);
}

/* ------------------------------------------------------------------ */
/*  Receipt PDF — uses the shared brand design system                 */
/* ------------------------------------------------------------------ */
function receiptPdf(payment, invoice) {
  const meta = [
    ["Receipt ID", payment.id],
    ["Organization", invoice.organization_name],
    ["Invoice number", invoice.invoice_number],
    ["Currency", payment.currency],
    ["Verified amount", money(payment.verified_amount, payment.currency)],
    ["Reference", payment.reference || "—"],
    ["Approved (UTC)", formatDate(payment.reviewed_at, "UTC")],
    ["Plan", invoice.plan_snapshot?.name || "—"],
  ];

  const rpt = createReportDoc({
    title: "Verified Payment Receipt",
    subtitle: `${payment.id} · ${invoice.organization_name}`,
    meta,
    timezone: "UTC",
  });

  rpt.sectionTitle("Payment summary");
  rpt.keyValueGrid(
    [
      ["Invoice", invoice.invoice_number],
      ["Plan", invoice.plan_snapshot?.name || "—"],
      ["Billing cycle", humanize(invoice.billing_cycle)],
      ["Invoice total", money(invoice.total, invoice.currency)],
      ["Verified amount", money(payment.verified_amount, payment.currency)],
      ["Reference", payment.reference || "—"],
      ["Approved (UTC)", formatDate(payment.reviewed_at, "UTC")],
      ["Method", humanize(payment.method || "—")],
    ],
    { cols: 2 }
  );

  rpt.sectionTitle("Verified allocations");
  rpt.paragraph(
    "This receipt records an approved manual payment allocation. It is not a tax invoice.",
    { size: 9, color: [100, 116, 139] }
  );

  rpt.finalize({
    footnote:
      "Acknowledgement of a verified manual payment allocation. Keep for your records.",
  });

  rpt.doc.save(`actpulse-receipt-${payment.id}.pdf`);
}

/* ================================================================== */
/*  BillingWorkspace                                                  */
/* ================================================================== */
export default function BillingWorkspace({
  organizationId,
  embedded = false,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState("");
  const [selected, setSelected] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  const [history, setHistory] = useState({});
  const [historyFilters, setHistoryFilters] = useState({
    invoices: { page: 1, pageSize: 10, search: "", status: "", from: "", to: "" },
    payments: { page: 1, pageSize: 10, search: "", status: "", from: "", to: "" },
    periods: { page: 1, pageSize: 10, search: "", status: "", from: "", to: "" },
  });

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const kinds = ["invoices", "payments", "periods"];
      const [response, ...lists] = await Promise.all([
        organizationId
          ? billingApi.organization(organizationId)
          : billingApi.me(),
        ...kinds.map((kind) => {
          const filter = historyFilters[kind];
          return billingApi.history(kind, {
            ...filter,
            organizationId: organizationId || undefined,
            from: filter.from
              ? new Date(`${filter.from}T00:00:00`).toISOString()
              : undefined,
            to: filter.to
              ? new Date(
                  new Date(`${filter.to}T00:00:00`).getTime() + 86400000
                ).toISOString()
              : undefined,
          });
        }),
      ]);
      setData(response.data);
      setHistory(
        Object.fromEntries(kinds.map((kind, index) => [kind, lists[index].data]))
      );
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not load billing."
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, historyFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("billing:changed", refresh);
    return () => window.removeEventListener("billing:changed", refresh);
  }, [load]);

  /* ---------------- modal openers ---------------- */
  const open = async (kind, row) => {
    setSelected(row);
    setAction(kind);
    setDirty(false);
    setError("");
    if (kind === "invoice" || kind === "receipt") {
      try {
        const response = await billingApi.invoice(
          kind === "invoice" ? row.id : row.invoice_id
        );
        setInvoice(response.data);
      } catch (err) {
        setError(
          err?.response?.data?.message || "Could not load invoice."
        );
      }
    } else {
      setForm({
        method: "BANK_TRANSFER",
        currency: row.currency,
        claimedAmount: row.outstanding,
        claimedPaidAt: new Date().toISOString().slice(0, 16),
        reference: "",
        proof: null,
      });
    }
  };

  const closeModal = () => {
    if (busy) return;
    setAction("");
    setDirty(false);
  };

  /* ---------------- mutations ---------------- */
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("method", form.method);
      payload.append("currency", form.currency);
      payload.append("claimedAmount", form.claimedAmount);
      payload.append("claimedPaidAt", new Date(form.claimedPaidAt).toISOString());
      payload.append("reference", form.reference);
      payload.append("proof", form.proof);
      await billingApi.submitProof(selected.id, payload);
      setNotice("Payment proof submitted for Admin review.");
      setAction("");
      setDirty(false);
      await load();
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(
        err?.response?.data?.message || "Could not submit proof."
      );
    } finally {
      setBusy(false);
    }
  };

  const proof = async (id) => {
    try {
      const response = await billingApi.proof(id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `actpulse-proof-${id}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err?.response?.data?.message || "Proof unavailable.");
    }
  };

  const updateHistory = (kind, key, value) =>
    setHistoryFilters((old) => ({
      ...old,
      [kind]: {
        ...old[kind],
        [key]: value,
        page: key === "page" ? value : 1,
      },
    }));

  /* ---------------- reusable subcomponents ---------------- */
  const HistoryControls = ({ kind, statuses }) => {
    const filter = historyFilters[kind];
    const total = history[kind]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));
    return (
      <div className="mb-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
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
                  placeholder="Invoice, reference…"
                  value={filter.search}
                  onChange={(e) => updateHistory(kind, "search", e.target.value)}
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
              value={filter.status}
              onChange={(e) => updateHistory(kind, "status", e.target.value)}
            >
              <option value="">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="From (local date)"
            type="date"
            value={filter.from}
            onChange={(e) => updateHistory(kind, "from", e.target.value)}
          />
          <Input
            label="Through (local date)"
            type="date"
            value={filter.to}
            onChange={(e) => updateHistory(kind, "to", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page{" "}
            <strong className="text-slate-700 dark:text-slate-200">
              {filter.page}
            </strong>{" "}
            of {totalPages} · {total} records
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              Rows
              <select
                value={filter.pageSize}
                onChange={(e) =>
                  updateHistory(kind, "pageSize", Number(e.target.value))
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
                onClick={() => updateHistory(kind, "page", 1)}
                disabled={filter.page <= 1}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                aria-label="First page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateHistory(kind, "page", filter.page - 1)
                }
                disabled={filter.page <= 1}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateHistory(kind, "page", filter.page + 1)
                }
                disabled={filter.page >= totalPages}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => updateHistory(kind, "page", totalPages)}
                disabled={filter.page >= totalPages}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-[#427aa1] hover:text-[#064789] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
                aria-label="Last page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- body ---------------- */
  const body = (
    <div className="space-y-4">
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

      {/* ============ LOADING ============ */}
      {loading && !data ? (
        <div className={`${cardPad} flex items-center justify-center py-16`}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading billing…
            </p>
          </div>
        </div>
      ) : (
        data && (
          <>
            {/* ============ KPI TILES ============ */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Organization</p>
                    <p className="mt-1.5 truncate text-lg font-bold text-[#064789] dark:text-[#8fc7e8]">
                      {data.organizationName}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                    <Building2 size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Subscription</p>
                    <p className="mt-1.5 truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                      {humanize(data.state)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {data.plan?.name || "No plan selected"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Wallet size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Trial ends (UTC)</p>
                    <p className="mt-1.5 truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                      {formatDate(data.trialEndsAt, "UTC")}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <CalendarClock size={18} />
                  </div>
                </div>
              </div>

              <div className={cardPad}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={sectionTitle}>Paid period ends (UTC)</p>
                    <p className="mt-1.5 truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                      {formatDate(data.paidEndAt, "UTC")}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                    <CalendarClock size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* ============ PAYMENT INSTRUCTIONS ============ */}
            <section className={cardPad}>
              <header className="mb-3 flex items-center gap-2">
                <Wallet size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Payment instructions
                </h2>
              </header>

              {!data.instructions?.length ? (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <AlertTriangle
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                  />
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    Payment instructions not configured. Contact ACTPulse
                    before transferring funds.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.instructions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <Receipt size={12} />
                        {humanize(item.method)}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {item.provider}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                        {item.account_name} · {item.account_number}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center rounded-full bg-[#064789]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                          {item.currency}
                        </span>
                        {item.reference_instructions && (
                          <span className="truncate">
                            {item.reference_instructions}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ============ INVOICES ============ */}
            <section className={card}>
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Invoices
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {history.invoices?.total ?? 0} records
                </span>
              </header>

              <div className="p-4">
                <HistoryControls
                  kind="invoices"
                  statuses={["OPEN", "PARTIALLY_PAID", "PAID", "VOID"]}
                />

                {!history.invoices?.items?.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <FileText
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No invoices match these filters.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-[820px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Invoice</th>
                          <th className="p-3">Issued (UTC)</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Outstanding</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.invoices.items.map((row) => {
                          const overdue =
                            row.status !== "PAID" &&
                            row.status !== "VOID" &&
                            new Date(row.due_at) < new Date();
                          return (
                            <tr
                              key={row.id}
                              className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <td className={`${tableCell} font-medium`}>
                                {row.invoice_number}
                              </td>
                              <td className={tableCell}>
                                {formatDate(row.issued_at, "UTC")}
                              </td>
                              <td className={tableCell}>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                                    row.status === "PAID"
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                      : row.status === "VOID"
                                        ? "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                                        : overdue
                                          ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                                          : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
                                  }`}
                                >
                                  {humanize(row.status)}
                                  {overdue ? " · Overdue" : ""}
                                </span>
                              </td>
                              <td className={tableCell}>
                                {money(row.total, row.currency)}
                              </td>
                              <td className={`${tableCell} font-medium`}>
                                {money(row.outstanding, row.currency)}
                              </td>
                              <td className={`${tableCell} text-right`}>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void open("invoice", row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Eye size={12} />
                                    View
                                  </button>
                                  {!organizationId &&
                                    row.status !== "PAID" &&
                                    row.status !== "VOID" && (
                                      <button
                                        type="button"
                                        onClick={() => void open("proof", row)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#064789] to-[#427aa1] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
                                      >
                                        <Upload size={12} />
                                        Submit Proof
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
              </div>
            </section>

            {/* ============ PAYMENTS ============ */}
            <section className={card}>
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Payment submissions
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {history.payments?.total ?? 0} records
                </span>
              </header>

              <div className="p-4">
                <HistoryControls
                  kind="payments"
                  statuses={["PENDING_REVIEW", "APPROVED", "REJECTED"]}
                />

                {!history.payments?.items?.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <Receipt
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No payments match these filters.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="p-3">Claimed</th>
                          <th className="p-3">Method / Reference</th>
                          <th className="p-3">Submitted</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Review note</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.payments.items.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className={`${tableCell} font-medium`}>
                              {money(row.claimed_amount, row.currency)}
                            </td>
                            <td className={tableCell}>
                              <div className="min-w-0">
                                <p className="truncate">
                                  {humanize(row.method)}
                                </p>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.reference}
                                </p>
                              </div>
                            </td>
                            <td className={tableCell}>
                              {formatDate(row.created_at, "UTC")}
                            </td>
                            <td className={tableCell}>
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                                  row.status === "APPROVED"
                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                                    : row.status === "REJECTED"
                                      ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30"
                                      : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
                                }`}
                              >
                                {humanize(row.status)}
                              </span>
                              {row.duplicate_warning && (
                                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                  <AlertTriangle size={10} />
                                  Possible duplicate
                                </p>
                              )}
                            </td>
                            <td className={tableCell}>
                              <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                {row.review_note || "—"}
                              </span>
                            </td>
                            <td className={`${tableCell} text-right`}>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void proof(row.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                >
                                  <Download size={12} />
                                  Proof
                                </button>
                                {row.status === "APPROVED" && (
                                  <button
                                    type="button"
                                    onClick={() => void open("receipt", row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                                  >
                                    <Receipt size={12} />
                                    Receipt
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* ============ TIMELINE ============ */}
            <section className={card}>
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarClock size={16} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Subscription timeline
                  </h2>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {history.periods?.total ?? 0} records
                </span>
              </header>

              <div className="p-4">
                <HistoryControls kind="periods" statuses={["TRIAL", "PAID"]} />

                {!history.periods?.items?.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <CalendarClock
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No trial or paid periods match these filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.periods.items.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800"
                      >
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                            row.kind === "TRIAL"
                              ? "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30"
                              : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                          }`}
                        >
                          {humanize(row.kind)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                          {row.plan_snapshot?.name || "—"}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {humanize(row.billing_cycle)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(row.starts_at, "UTC")} →{" "}
                          {formatDate(row.ends_at, "UTC")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )
      )}

      {/* ============ MODAL ============ */}
      <ActionModal
        open={!!action}
        title={
          {
            invoice: "Invoice",
            proof: "Submit Payment Proof",
            receipt: "Verified Payment Receipt",
          }[action] || ""
        }
        dirty={dirty}
        onClose={closeModal}
        size="lg"
      >
        {action === "proof" ? (
          <form onSubmit={submit} className="space-y-4 text-sm">
            <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              Invoice {selected?.invoice_number} · outstanding{" "}
              {money(selected?.outstanding, selected?.currency)}. Proof is
              reviewed manually and does not guarantee approval.
            </p>

            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Method
              </span>
              <select
                className={selectClass}
                value={form.method || "BANK_TRANSFER"}
                onChange={(e) => {
                  setForm({ ...form, method: e.target.value });
                  setDirty(true);
                }}
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="MOBILE_MONEY">Mobile money</option>
              </select>
            </label>

            <Input
              required
              label="Claimed amount"
              type="number"
              min="0.0001"
              step="0.0001"
              value={form.claimedAmount || ""}
              onChange={(e) => {
                setForm({ ...form, claimedAmount: e.target.value });
                setDirty(true);
              }}
            />

            <Input label="Currency" readOnly value={form.currency || ""} />

            <Input
              required
              label="Transaction reference"
              value={form.reference || ""}
              onChange={(e) => {
                setForm({ ...form, reference: e.target.value });
                setDirty(true);
              }}
            />

            <Input
              required
              type="datetime-local"
              label="Payment date/time (browser local)"
              value={form.claimedPaidAt || ""}
              onChange={(e) => {
                setForm({ ...form, claimedPaidAt: e.target.value });
                setDirty(true);
              }}
            />

            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Proof (PDF, JPEG or PNG; up to 5 MB)
              </span>
              <input
                required
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#064789]/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#064789] hover:file:bg-[#064789]/20 dark:text-slate-200 dark:file:bg-[#427aa1]/20 dark:file:text-[#8fc7e8]"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  setForm({ ...form, proof: e.target.files?.[0] || null });
                  setDirty(true);
                }}
              />
            </label>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy} leftIcon={Send}>
                Submit for Review
              </Button>
            </div>
          </form>
        ) : invoice ? (
          <div className="space-y-4 text-sm">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-gradient-to-br from-[#064789]/5 to-[#427aa1]/5 p-4 dark:border-slate-700 dark:from-[#064789]/15 dark:to-[#427aa1]/10">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {action === "receipt" ? "Receipt" : "Invoice"}
                </p>
                <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">
                  {action === "receipt" ? selected?.id : invoice.invoice_number}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {invoice.organization_name}
                </p>
              </div>
              <span className="rounded-full bg-[#064789]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                {invoice.currency}
              </span>
            </div>

            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Plan</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {invoice.plan_snapshot?.name || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Total</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {money(invoice.total, invoice.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Outstanding</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {money(invoice.outstanding, invoice.currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Issued (UTC)</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(invoice.issued_at, "UTC")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Due (UTC)</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {formatDate(invoice.due_at, "UTC")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className={sectionTitle}>Cycle</p>
                <p className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
                  {humanize(invoice.billing_cycle)}
                </p>
              </div>
            </div>

            {action === "receipt" && selected && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <p className={sectionTitle}>Verified allocation</p>
                <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                  {money(selected.verified_amount, selected.currency)} ·{" "}
                  {selected.reference}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button
                onClick={() =>
                  action === "receipt"
                    ? receiptPdf(selected, invoice)
                    : invoicePdf(invoice)
                }
                leftIcon={Download}
              >
                Download PDF
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading invoice…
              </p>
            </div>
          </div>
        )}
      </ActionModal>
    </div>
  );

  return embedded ? (
    body
  ) : (
    <PageContainer
      title={organizationId ? "Organization Billing" : "Billing"}
      subtitle="Manual payments, invoices and subscription periods"
    >
      {body}
    </PageContainer>
  );
}