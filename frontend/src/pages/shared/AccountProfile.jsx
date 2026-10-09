// src/pages/shared/AccountProfile.jsx
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import PageContainer from "../../components/layout/PageContainer";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { authApi } from "../../api/actPulse.Api";
import { useAuthStore } from "../../store/auth.store";

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */
const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900";
const cardPad = `${card} p-5`;
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const TABS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "security", label: "Security", icon: ShieldCheck },
];

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

function DetailTile({ label, value, icon: Icon }) {
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
/*  AccountProfile                                                    */
/* ================================================================== */
export default function AccountProfile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  const tab = searchParams.get("tab") === "security" ? "security" : "profile";
  const setTab = (nextTab) => setSearchParams(nextTab === "security" ? { tab: "security" } : {});

  /* ---------------- profile form state ---------------- */
  const [name, setName] = useState(user?.name || "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  /* ---------------- password form state ---------------- */
  const [pw, setPw] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const pwStrength = useMemo(() => {
    const p = pw.newPassword;
    if (!p) return { level: 0, label: "—", tone: "bg-slate-200 dark:bg-slate-700" };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 2)
      return {
        level: 1,
        label: "Weak",
        tone: "bg-rose-500",
      };
    if (score === 3)
      return {
        level: 2,
        label: "Fair",
        tone: "bg-amber-500",
      };
    if (score === 4)
      return {
        level: 3,
        label: "Good",
        tone: "bg-emerald-500",
      };
    return {
      level: 4,
      label: "Strong",
      tone: "bg-emerald-600",
    };
  }, [pw.newPassword]);

  /* ---------------- profile actions ---------------- */
  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (name.trim().length < 2) {
      setProfileError("Name must have at least two characters.");
      return;
    }
    setProfileBusy(true);
    try {
      const { data } = await authApi.updateMe({ name: name.trim() });
      updateUser(data);
      setProfileSuccess("Profile updated.");
      setTimeout(() => setProfileSuccess(""), 4000);
    } catch (err) {
      setProfileError(
        err?.response?.data?.message || "Could not update profile."
      );
    } finally {
      setProfileBusy(false);
    }
  };

  /* ---------------- password actions ---------------- */
  const savePassword = async (event) => {
    event.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (pw.newPassword !== pw.confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    const bytes = new TextEncoder().encode(pw.newPassword).length;
    if (bytes < 8 || bytes > 72) {
      setPwError("Password must be 8 to 72 UTF-8 bytes.");
      return;
    }
    setPwBusy(true);
    try {
      await authApi.changePassword({
        oldPassword: pw.oldPassword,
        newPassword: pw.newPassword,
      });
      setPwSuccess("Password changed. Please sign in again.");
      clearSession();
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err) {
      setPwError(
        err?.response?.data?.message || "Could not change password."
      );
    } finally {
      setPwBusy(false);
    }
  };

  /* ================================================================ */
  return (
    <PageContainer
      title="Account Profile"
      subtitle="Your personal information and account security"
    >
      <div className="space-y-4">
        {/* ============ HERO HEADER ============ */}
        <section className={`${cardPad} relative overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#064789] to-[#427aa1] text-xl font-bold text-white shadow-md">
              {initials(user?.name || user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold text-slate-800 dark:text-slate-100">
                {user?.name || "Unnamed user"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                {user?.email || "—"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {user?.role && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]">
                    <Shield size={11} />
                    {user.role}
                  </span>
                )}
                {user?.organization?.name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Building2 size={11} />
                    {user.organization.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============ TABS ============ */}
        <nav
          className={`${card} flex flex-wrap gap-1 p-1.5`}
          aria-label="Account sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`
                  group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all
                  ${
                    active
                      ? "bg-gradient-to-r from-[#064789] to-[#427aa1] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }
                `}
              >
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* ============ PROFILE TAB ============ */}
        {tab === "profile" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Edit form */}
            <section className={`${cardPad} lg:col-span-2`}>
              <header className="mb-4 flex items-center gap-2">
                <UserIcon size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Personal information
                </h2>
              </header>
              <form onSubmit={saveProfile} className="space-y-4">
                <Input
                  label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  icon={UserIcon}
                />
                <Input
                  label="Email (read only)"
                  value={user?.email || ""}
                  readOnly
                  icon={Mail}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Role (read only)"
                    value={user?.role || ""}
                    readOnly
                    icon={Shield}
                  />
                  <Input
                    label="Organization (read only)"
                    value={user?.organization?.name || ""}
                    readOnly
                    icon={Building2}
                  />
                </div>

                {profileError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <AlertTriangle size={14} />
                    {profileError}
                  </p>
                )}
                {profileSuccess && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    <CheckCircle2 size={14} />
                    {profileSuccess}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={profileBusy}>
                    Save Changes
                  </Button>
                </div>
              </form>
            </section>

            {/* Side info */}
            <aside className="space-y-4">
              <section className={cardPad}>
                <header className="mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-slate-400" />
                  <h2 className={sectionTitle}>Account snapshot</h2>
                </header>
                <div className="space-y-3">
                  <DetailTile
                    label="Display name"
                    value={user?.name}
                    icon={UserIcon}
                  />
                  <DetailTile
                    label="Email"
                    value={user?.email}
                    icon={Mail}
                  />
                  <DetailTile
                    label="Role"
                    value={user?.role}
                    icon={Shield}
                  />
                  <DetailTile
                    label="Organization"
                    value={user?.organization?.name}
                    icon={Building2}
                  />
                </div>
              </section>
            </aside>
          </div>
        )}

        {/* ============ SECURITY TAB ============ */}
        {tab === "security" && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Password form */}
            <section className={`${cardPad} lg:col-span-2`}>
              <header className="mb-4 flex items-center gap-2">
                <KeyRound size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Change password
                </h2>
              </header>
              <form onSubmit={savePassword} className="space-y-4">
                <Input
                  label="Current password"
                  type="password"
                  value={pw.oldPassword}
                  onChange={(e) =>
                    setPw({ ...pw, oldPassword: e.target.value })
                  }
                  required
                  icon={Lock}
                />
                <Input
                  label="New password"
                  type="password"
                  value={pw.newPassword}
                  onChange={(e) =>
                    setPw({ ...pw, newPassword: e.target.value })
                  }
                  required
                  icon={KeyRound}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={pw.confirmPassword}
                  onChange={(e) =>
                    setPw({ ...pw, confirmPassword: e.target.value })
                  }
                  required
                  icon={KeyRound}
                />

                {/* Password strength meter */}
                {pw.newPassword && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Strength
                      </span>
                      <span
                        className={
                          pwStrength.level >= 3
                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                            : pwStrength.level === 2
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : "font-semibold text-rose-600 dark:text-rose-400"
                        }
                      >
                        {pwStrength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full transition-all ${pwStrength.tone}`}
                        style={{
                          width: `${(pwStrength.level / 4) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {pwError && (
                  <p
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <AlertTriangle size={14} />
                    {pwError}
                  </p>
                )}
                {pwSuccess && (
                  <p
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    <CheckCircle2 size={14} />
                    {pwSuccess}
                  </p>
                )}

                <div className="flex justify-end pt-2">
                  <Button type="submit" loading={pwBusy}>
                    Change Password
                  </Button>
                </div>
              </form>
            </section>

            {/* Guidance + summary */}
            <aside className="space-y-4">
              <section className={cardPad}>
                <header className="mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-slate-400" />
                  <h2 className={sectionTitle}>Password rules</h2>
                </header>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {[
                    "8 to 72 UTF-8 bytes",
                    "Use a unique password you don't reuse elsewhere",
                    "Mix upper case, lower case, digits and symbols",
                    "You will be signed out after changing it",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 shrink-0 text-emerald-500"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={cardPad}>
                <header className="mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-slate-400" />
                  <h2 className={sectionTitle}>Account protection</h2>
                </header>
                <div className="space-y-3">
                  <DetailTile
                    label="Signed in as"
                    value={user?.email}
                    icon={Mail}
                  />
                  <DetailTile
                    label="Role"
                    value={user?.role}
                    icon={Shield}
                  />
                  <DetailTile
                    label="Organization"
                    value={user?.organization?.name}
                    icon={Building2}
                  />
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  Two-factor authentication is not yet available for this
                  account. Contact your administrator if you suspect suspicious
                  activity.
                </p>
              </section>
            </aside>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
