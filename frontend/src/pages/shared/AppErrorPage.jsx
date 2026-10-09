import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { ArrowLeft, House, TriangleAlert } from 'lucide-react';
import Button from '../../components/common/Button';
import { actPulseApi } from '../../api/actPulse.Api';
import { useAuthStore } from '../../store/auth.store';

export default function AppErrorPage({ notFound = false }) {
  const error = useRouteError();
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);
  const missing = notFound || (isRouteErrorResponse(error) && error.status === 404);
  const canGoBack = Number(window.history.state?.idx) > 0;

  const goBack = () => { if (canGoBack) navigate(-1); };
  const goHome = () => {
    const token = useAuthStore.getState().token;
    clearSession();
    if (token) void actPulseApi.post('/auth/logout', undefined, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    }).catch(() => undefined);
    navigate('/', { replace: true });
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8 dark:border-slate-700 dark:bg-slate-900" role="alert">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"><TriangleAlert aria-hidden="true" /></div>
      <p className="text-sm font-semibold uppercase tracking-wide text-[#427aa1] dark:text-[#8fc7e8]">ACTPulse</p>
      <h1 className="mt-2 text-2xl font-bold text-[#064789] dark:text-[#8fc7e8]">{missing ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{missing ? 'This page may have moved or the address may be incorrect.' : 'We could not display this page. You can return to the previous page or sign out and go home.'}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button className="w-full sm:w-auto" variant="outline" leftIcon={ArrowLeft} onClick={goBack} disabled={!canGoBack}>Go Back</Button>
        <Button className="w-full sm:w-auto" leftIcon={House} onClick={goHome}>Sign Out &amp; Go Home</Button>
      </div>
    </section>
  </main>;
}
