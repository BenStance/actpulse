import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useSubscriptionStore } from '../store/subscription.store';

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, user, checking, sessionError, validateSession } = useAuthStore();
  const location = useLocation();
  const { status, loading: subscriptionLoading, error: subscriptionError, refresh } = useSubscriptionStore();
  const organizationId = user?.organizationId ?? user?.organization?.id;
  const currentStatus = status?.organizationId === organizationId ? status : null;
  useEffect(() => { void validateSession(); }, [validateSession]);
  useEffect(() => { if (isAuthenticated && user?.role === 'Controller') void refresh().catch(() => undefined); }, [isAuthenticated, user?.id, user?.role, refresh]);
  useEffect(() => {
    if (user?.role !== 'Controller' || !status?.valid) return;
    const end = status.state === 'TRIALING' ? status.trialEndsAt : status.state === 'GRACE' ? status.graceEndsAt : status.paidEndAt;
    const delay = new Date(end).getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) { const timer = setTimeout(() => void refresh().catch(() => undefined), 0); return () => clearTimeout(timer); }
    const timer = setTimeout(() => void refresh().catch(() => undefined), Math.min(delay + 1000, 2147483647));
    return () => clearTimeout(timer);
  }, [user?.role, status?.valid, status?.state, status?.trialEndsAt, status?.paidEndAt, status?.graceEndsAt, refresh]);
  useEffect(() => {
    if (user?.role !== 'Controller') return;
    const check = () => { if (!document.hidden) void refresh().catch(() => undefined); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [user?.role, refresh]);
  if (checking) return <div className="p-8 text-slate-600 dark:text-slate-300">Checking session...</div>;
  if (sessionError) return <div className="p-8"><p role="alert" className="mb-3 text-red-600">Could not verify your session. Try again.</p><button className="rounded-lg border px-4 py-2" onClick={validateSession}>Retry</button></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to="/login" replace />;
  if (user?.role === 'Controller') {
    if (subscriptionError && !currentStatus) return <div className="p-8"><p role="alert" className="mb-3 text-red-600">{subscriptionError}</p><button className="rounded-lg border px-4 py-2" onClick={() => void refresh().catch(() => undefined)}>Retry</button></div>;
    if (!currentStatus) return <div className="p-8 text-slate-600 dark:text-slate-300">{subscriptionLoading ? 'Checking subscription…' : 'Loading subscription…'}</div>;
    const billingPath = ['/controller/subscription', '/controller/billing', '/controller/profile', '/controller/account-security', '/controller/activity', '/controller/notifications'].some((path) => location.pathname === path);
    if (!currentStatus.valid && !billingPath) return <Navigate to="/controller/subscription" replace />;
  }
  return <Outlet />;
}
