// src/pages/admin/Settings.jsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import {
  alertsApi,
  billingApi,
  deviceApi,
  notificationsApi,
} from "../../api/actPulse.Api";

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900";
const cardPad = `${card} p-5`;
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

const emptyInstruction = {
  method: "BANK_TRANSFER",
  accountName: "",
  provider: "",
  accountNumber: "",
  referenceInstructions: "",
  currency: "TZS",
  isActive: true,
  reason: "",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const label = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const message = (error, fallback) => {
  const value = error?.response?.data?.message;
  return typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.join(", ")
      : fallback;
};

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                 */
/* ------------------------------------------------------------------ */
function ConfigCard({ icon: Icon, title, subtitle, tone = "brand", children, footer }) {
  const tones = {
    brand: "bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    <section className={cardPad}>
      <header className="mb-4 flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone] || tones.brand}`}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
      {footer && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          {footer}
        </div>
      )}
    </section>
  );
}

function StatPill({ tone = "neutral", children, icon: Icon }) {
  const tones = {
    brand: "bg-[#064789]/10 text-[#064789] ring-[#064789]/20 dark:bg-[#427aa1]/20 dark:text-[#8fc7e8] dark:ring-[#427aa1]/30",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30",
    amber: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${tones[tone] || tones.neutral}`}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#064789]" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  );
}

/* ================================================================== */
/*  Settings                                                          */
/* ================================================================== */
export default function Settings() {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [timingDraft, setTimingDraft] = useState(null);
  const [preferences, setPreferences] = useState(null);
  const [rules, setRules] = useState([]);
  const [ruleReason, setRuleReason] = useState("");
  const [instructions, setInstructions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [instructionForm, setInstructionForm] = useState(null);
  const [rotatedKey, setRotatedKey] = useState("");
  const [rotatedDeviceName, setRotatedDeviceName] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  /* ---------------- load ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      deviceApi.list(),
      notificationsApi.preferences(),
      alertsApi.rules(),
      billingApi.adminInstructions(),
      billingApi.plans(),
    ]);
    const names = ["monitors", "notifications", "alerts", "payments", "plans"];
    const nextErrors = {};
    results.forEach((result, index) => {
      if (result.status === "rejected")
        nextErrors[names[index]] = message(
          result.reason,
          `Could not load ${names[index]}.`
        );
    });
    if (results[0].status === "fulfilled") {
      const rows = Array.isArray(results[0].value.data)
        ? results[0].value.data
        : [];
      setDevices(rows);
      setSelectedDeviceId((current) =>
        rows.some((row) => row.id === current) ? current : rows[0]?.id || ""
      );
    }
    if (results[1].status === "fulfilled")
      setPreferences({ inApp: results[1].value.data?.in_app !== false });
    if (results[2].status === "fulfilled")
      setRules(
        Array.isArray(results[2].value.data) ? results[2].value.data : []
      );
    if (results[3].status === "fulfilled")
      setInstructions(
        Array.isArray(results[3].value.data) ? results[3].value.data : []
      );
    if (results[4].status === "fulfilled")
      setPlans(
        Array.isArray(results[4].value.data) ? results[4].value.data : []
      );
    setLoadErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /* ---------------- derived ---------------- */
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const heartbeat =
    timingDraft?.heartbeatIntervalSeconds ??
    selectedDevice?.heartbeatIntervalSeconds ??
    "";
  const offline =
    timingDraft?.offlineTimeoutSeconds ??
    selectedDevice?.offlineTimeoutSeconds ??
    "";

  const begin = (key) => {
    setBusy(key);
    setError("");
    setNotice("");
  };
  const succeed = (text) => {
    setError("");
    setNotice(text);
    setTimeout(() => setNotice(""), 4000);
  };

  /* ---------------- monitor timing ---------------- */
  const saveTiming = async (event) => {
    event.preventDefault();
    if (!selectedDevice) return;
    const heartbeatIntervalSeconds = Number(heartbeat);
    const offlineTimeoutSeconds = Number(offline);
    if (
      !Number.isInteger(heartbeatIntervalSeconds) ||
      heartbeatIntervalSeconds < 10 ||
      heartbeatIntervalSeconds > 3600 ||
      !Number.isInteger(offlineTimeoutSeconds) ||
      offlineTimeoutSeconds < 30 ||
      offlineTimeoutSeconds > 86400 ||
      offlineTimeoutSeconds <= heartbeatIntervalSeconds
    ) {
      setError(
        "Use a heartbeat of 10–3600 seconds and an offline timeout of 30–86400 seconds that exceeds the heartbeat."
      );
      return;
    }
    begin("timing");
    try {
      const { data } = await deviceApi.update(selectedDevice.id, {
        heartbeatIntervalSeconds,
        offlineTimeoutSeconds,
      });
      setDevices((current) =>
        current.map((d) => (d.id === selectedDevice.id ? data : d))
      );
      setTimingDraft(null);
      succeed("Monitor timing saved.");
    } catch (err) {
      setError(message(err, "Could not save monitor timing."));
    } finally {
      setBusy("");
    }
  };

  const rotateKey = async () => {
    if (
      !selectedDevice ||
      !window.confirm(
        `Rotate ${selectedDevice.name}'s API key? Its current key will stop working immediately.`
      )
    )
      return;
    begin("rotate");
    try {
      const { data } = await deviceApi.rotateKey(selectedDevice.id);
      if (!data?.apiKey) throw new Error("Missing replacement key");
      setRotatedKey(data.apiKey);
      setRotatedDeviceName(selectedDevice.name);
      setCopied(false);
      succeed("API key rotated. Update the monitor with the replacement key.");
    } catch (err) {
      setError(message(err, "Could not rotate the API key."));
    } finally {
      setBusy("");
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(rotatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Clipboard access failed. Copy the key manually before closing this window."
      );
    }
  };

  /* ---------------- preferences ---------------- */
  const savePreferences = async (event) => {
    event.preventDefault();
    begin("preferences");
    try {
      const { data } = await notificationsApi.updatePreferences(preferences);
      setPreferences({ inApp: data.in_app !== false });
      succeed("Notification preference saved.");
    } catch (err) {
      setError(message(err, "Could not save notification preference."));
    } finally {
      setBusy("");
    }
  };

  /* ---------------- alert rules ---------------- */
  const toggleRule = async (rule) => {
    if (!ruleReason.trim()) {
      setError("Enter a change reason before changing an alert rule.");
      return;
    }
    begin(`rule-${rule.id}`);
    try {
      const { data } = await alertsApi.updateRule(rule.id, {
        organizationId: rule.organization_id || undefined,
        equipmentId: rule.equipment_id || undefined,
        type: rule.type,
        severity: rule.severity,
        threshold: rule.threshold,
        freshnessMinutes: rule.freshness_minutes,
        debounceMinutes: rule.debounce_minutes,
        inApp: rule.in_app,
        enabled: !rule.enabled,
        reason: ruleReason.trim(),
      });
      setRules((current) =>
        current.map((item) => (item.id === rule.id ? data : item))
      );
      setRuleReason("");
      succeed(`Alert rule ${data.enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      setError(message(err, "Could not update alert rule."));
    } finally {
      setBusy("");
    }
  };

  /* ---------------- payment instructions ---------------- */
  const editInstruction = (row) => {
    setInstructionForm(
      row
        ? {
            id: row.id,
            method: row.method,
            accountName: row.account_name,
            provider: row.provider,
            accountNumber: row.account_number,
            referenceInstructions: row.reference_instructions || "",
            currency: row.currency,
            isActive: row.is_active,
            reason: "",
          }
        : { ...emptyInstruction }
    );
    setError("");
  };

  const saveInstruction = async (event) => {
    event.preventDefault();
    if (!instructionForm?.reason.trim()) {
      setError("Enter a change reason for the payment instruction.");
      return;
    }
    begin("instruction");
    try {
      const { data } = await billingApi.saveInstruction(
        instructionForm,
        instructionForm.id
      );
      setInstructions((current) =>
        instructionForm.id
          ? current.map((item) => (item.id === data.id ? data : item))
          : [data, ...current]
      );
      setInstructionForm(null);
      window.dispatchEvent(new Event("billing:changed"));
      succeed("Payment instruction saved.");
    } catch (err) {
      setError(message(err, "Could not save payment instruction."));
    } finally {
      setBusy("");
    }
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="Settings"
      subtitle="Platform configuration, notifications and monitor security"
    >
      <div className="space-y-4">
        {/* ============ HEADER BAR ============ */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changes here are saved to the backend and take effect immediately.
          </p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={RefreshCw}
            disabled={loading || !!busy}
            onClick={() => void load()}
          >
            Refresh
          </Button>
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

        {/* ============ LOADING ============ */}
        {loading && (
          <div className={`${cardPad} flex items-center justify-center py-16`}>
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading settings…
              </p>
            </div>
          </div>
        )}

        {/* ============ CONFIG GRID ============ */}
        {!loading && (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {/* --- Monitor security --- */}
              <ConfigCard
                icon={KeyRound}
                title="Monitor security & connectivity"
                subtitle="Heartbeat, offline timeout, and API key rotation per monitor."
                tone="brand"
              >
                {loadErrors.monitors && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loadErrors.monitors}
                  </p>
                )}

                {!devices.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <Wifi
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No monitors available.
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Register a monitor from Devices.
                    </p>
                    <Link
                      to="/admin/devices"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#064789] underline-offset-2 hover:underline dark:text-[#8fc7e8]"
                    >
                      Go to Devices <ExternalLink size={11} />
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={saveTiming} className="space-y-4">
                    <label className="block text-sm">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Monitor
                      </span>
                      <select
                        className={selectClass}
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value);
                          setTimingDraft(null);
                        }}
                      >
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.deviceIdentifier})
                          </option>
                        ))}
                      </select>
                    </label>

                    {selectedDevice && (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatPill tone="brand" icon={Layers}>
                            {selectedDevice.equipment?.name || "Unbound"}
                          </StatPill>
                          <StatPill
                            tone={
                              selectedDevice.lifecycleState === "ACTIVE"
                                ? "emerald"
                                : "neutral"
                            }
                            icon={Wifi}
                          >
                            {selectedDevice.lifecycleState || "Unknown status"}
                          </StatPill>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            label="Heartbeat interval (seconds)"
                            type="number"
                            min="10"
                            max="3600"
                            required
                            value={heartbeat}
                            onChange={(e) =>
                              setTimingDraft((cur) => ({
                                heartbeatIntervalSeconds: e.target.value,
                                offlineTimeoutSeconds:
                                  cur?.offlineTimeoutSeconds ?? offline,
                              }))
                            }
                          />
                          <Input
                            label="Offline timeout (seconds)"
                            type="number"
                            min="30"
                            max="86400"
                            required
                            value={offline}
                            onChange={(e) =>
                              setTimingDraft((cur) => ({
                                heartbeatIntervalSeconds:
                                  cur?.heartbeatIntervalSeconds ?? heartbeat,
                                offlineTimeoutSeconds: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            loading={busy === "timing"}
                            disabled={!!busy || !timingDraft}
                          >
                            Save timing
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            loading={busy === "rotate"}
                            disabled={!!busy}
                            onClick={() => void rotateKey()}
                            leftIcon={KeyRound}
                          >
                            Rotate API key
                          </Button>
                        </div>
                      </>
                    )}
                  </form>
                )}
              </ConfigCard>

              {/* --- Notifications --- */}
              <ConfigCard
                icon={Bell}
                title="Notification preferences"
                subtitle="In-app alerts for your account. Email delivery is not yet configured."
                tone="brand"
              >
                {loadErrors.notifications && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loadErrors.notifications}
                  </p>
                )}

                {preferences && (
                  <form onSubmit={savePreferences} className="space-y-4">
                    <ToggleSwitch
                      checked={preferences.inApp}
                      onChange={(e) =>
                        setPreferences({ inApp: e.target.checked })
                      }
                      label="Receive in-app alerts"
                      description="Alerts appear in the top bar and Alerts page."
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        size="sm"
                        loading={busy === "preferences"}
                        disabled={!!busy}
                      >
                        Save preference
                      </Button>
                    </div>
                  </form>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {[
                    { to: "/admin/profile", label: "Profile" },
                    { to: "/admin/profile?tab=security", label: "Change password" },
                    { to: "/admin/audit-logs", label: "Audit logs" },
                  ].map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#427aa1] dark:hover:text-[#8fc7e8]"
                    >
                      {link.label}
                      <ExternalLink size={11} />
                    </Link>
                  ))}
                </div>
              </ConfigCard>

              {/* --- Alert rules --- */}
              <ConfigCard
                icon={SlidersHorizontal}
                title="Alert rules"
                subtitle="Enable or disable configured rules. Thresholds and scope are managed in Alerts."
                tone="brand"
              >
                {loadErrors.alerts && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loadErrors.alerts}
                  </p>
                )}

                <Input
                  label="Change reason"
                  value={ruleReason}
                  onChange={(e) => setRuleReason(e.target.value)}
                  maxLength={1000}
                  placeholder="Required to enable or disable a rule"
                />

                {!rules.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <SlidersHorizontal
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No alert rules configured.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:hover:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {label(rule.type)}
                            </p>
                            <StatPill
                              tone={
                                rule.severity === "CRITICAL"
                                  ? "rose"
                                  : rule.severity === "WARNING"
                                    ? "amber"
                                    : "brand"
                              }
                            >
                              {label(rule.severity)}
                            </StatPill>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {rule.enabled ? "Enabled" : "Disabled"} ·{" "}
                            {rule.equipment_id
                              ? "Equipment rule"
                              : "Organization rule"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!busy || !ruleReason.trim()}
                          loading={busy === `rule-${rule.id}`}
                          onClick={() => void toggleRule(rule)}
                        >
                          {rule.enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  to="/admin/alerts"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#064789] underline-offset-2 hover:underline dark:text-[#8fc7e8]"
                >
                  Configure rules in Alerts <ExternalLink size={11} />
                </Link>
              </ConfigCard>

              {/* --- Payment instructions --- */}
              <ConfigCard
                icon={CreditCard}
                title="Payment instructions"
                subtitle="Bank and mobile money details shown to customers when paying invoices."
                tone="brand"
                footer={
                  <Button
                    size="sm"
                    leftIcon={Plus}
                    onClick={() => editInstruction()}
                  >
                    Add instruction
                  </Button>
                }
              >
                {loadErrors.payments && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {loadErrors.payments}
                  </p>
                )}

                {!instructions.length ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                    <CreditCard
                      size={20}
                      className="mb-2 text-slate-300 dark:text-slate-600"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No payment instructions configured.
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Add one to guide customers on how to pay.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {instructions.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50/60 dark:border-slate-700 dark:hover:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {row.provider} · {label(row.method)}
                            </p>
                            <StatPill
                              tone={row.is_active ? "emerald" : "neutral"}
                            >
                              {row.is_active ? "Active" : "Inactive"}
                            </StatPill>
                          </div>
                          <p className="mt-1 break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                            {row.account_name} · {row.account_number} ·{" "}
                            {row.currency}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => editInstruction(row)}
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ConfigCard>
            </div>

            {/* --- Subscription plans (full width) --- */}
            <ConfigCard
              icon={ShieldCheck}
              title="Subscription plans"
              subtitle="Review the configured plans here. Prices, limits and features are edited in Platform Billing."
              tone="brand"
              footer={
                <Link
                  to="/admin/platform-billing?tab=plans"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#064789] underline-offset-2 hover:underline dark:text-[#8fc7e8]"
                >
                  Manage subscription plans <ExternalLink size={11} />
                </Link>
              }
            >
              {loadErrors.plans && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {loadErrors.plans}
                </p>
              )}

              {!plans.length ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
                  <ShieldCheck
                    size={20}
                    className="mb-2 text-slate-300 dark:text-slate-600"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No plans configured.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="relative overflow-hidden rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-1 ${
                          plan.is_active
                            ? "bg-gradient-to-r from-[#064789] to-[#427aa1]"
                            : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      />
                      <div className="flex items-start justify-between gap-2 pt-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          {plan.name}
                        </p>
                        <StatPill
                          tone={plan.is_active ? "emerald" : "neutral"}
                        >
                          {plan.is_active ? "Active" : "Inactive"}
                        </StatPill>
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {plan.currency} {plan.monthly_price} / month
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatPill tone="brand">
                          {plan.site_limit} sites
                        </StatPill>
                        <StatPill tone="brand">
                          {plan.equipment_limit} equipment
                        </StatPill>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ConfigCard>
          </>
        )}

        {/* ============ ROTATED KEY MODAL ============ */}
        <Modal
          open={!!rotatedKey}
          onClose={() => setRotatedKey("")}
          title="API key rotated"
          size="md"
        >
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              />
              <p className="text-amber-900 dark:text-amber-200">
                Copy the new key now. It will not be shown again. The previous
                key is invalid immediately.
              </p>
            </div>

            <p className="text-slate-700 dark:text-slate-200">
              Replacement key for{" "}
              <strong className="text-slate-800 dark:text-slate-100">
                {rotatedDeviceName}
              </strong>
              .
            </p>

            <div className="relative">
              <code className="block break-all rounded-xl border border-slate-200 bg-slate-50 p-3 pr-12 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {rotatedKey}
              </code>
              <button
                type="button"
                onClick={() => void copyKey()}
                aria-label="Copy API key"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:border-[#427aa1] hover:text-[#064789] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setRotatedKey("")}>Done</Button>
            </div>
          </div>
        </Modal>

        {/* ============ PAYMENT INSTRUCTION MODAL ============ */}
        <Modal
          open={!!instructionForm}
          onClose={() => {
            if (!busy) setInstructionForm(null);
          }}
          title={
            instructionForm?.id
              ? "Edit payment instruction"
              : "Add payment instruction"
          }
          size="md"
        >
          <form
            onSubmit={saveInstruction}
            className="max-h-[65vh] space-y-3 overflow-y-auto pr-1 text-sm"
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Method
              </span>
              <select
                className={selectClass}
                value={instructionForm?.method || "BANK_TRANSFER"}
                onChange={(e) =>
                  setInstructionForm((cur) => ({
                    ...cur,
                    method: e.target.value,
                  }))
                }
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="MOBILE_MONEY">Mobile money</option>
              </select>
            </label>

            {[
              ["accountName", "Account or business name"],
              ["provider", "Bank or provider"],
              ["accountNumber", "Account or payment number"],
              ["referenceInstructions", "Reference instructions"],
              ["currency", "Currency"],
              ["reason", "Change reason"],
            ].map(([key, title]) => (
              <Input
                key={key}
                label={title}
                required={key !== "referenceInstructions"}
                value={instructionForm?.[key] || ""}
                maxLength={
                  key === "referenceInstructions"
                    ? 2000
                    : key === "currency"
                      ? 3
                      : key === "reason"
                        ? 1000
                        : 160
                }
                onChange={(e) =>
                  setInstructionForm((cur) => ({
                    ...cur,
                    [key]:
                      key === "currency"
                        ? e.target.value.toUpperCase()
                        : e.target.value,
                  }))
                }
              />
            ))}

            <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Active for customers
              </span>
              <span
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  instructionForm?.isActive ?? true
                    ? "bg-[#064789]"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={instructionForm?.isActive ?? true}
                  onChange={(e) =>
                    setInstructionForm((cur) => ({
                      ...cur,
                      isActive: e.target.checked,
                    }))
                  }
                  className="peer sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    instructionForm?.isActive ?? true
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
              >
                <AlertTriangle size={14} />
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={!!busy}
                onClick={() => setInstructionForm(null)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy === "instruction"}>
                Save instruction
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </PageContainer>
  );
}