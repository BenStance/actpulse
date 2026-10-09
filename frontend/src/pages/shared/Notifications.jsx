import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import ActionModal from '../../components/common/ActionModal';
import { notificationsApi } from '../../api/actPulse.Api';
import { getSocket } from '../../components/realtime/socket';
import { useAuthStore } from '../../store/auth.store';

export default function Notifications() {
  const base = useAuthStore((state) => state.user?.role === 'Admin' ? '/admin' : '/controller');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({ inApp: true });
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesDirty, setPreferencesDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: result } = await notificationsApi.list({ page, pageSize: 25 });
      if (!result || !Array.isArray(result.items)) throw new Error('Invalid notifications response');
      setData(result);
    } catch (err) {
      setData(null);
      setError(err?.response?.data?.message || 'Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { notificationsApi.preferences().then(({ data: value }) => setPreferences({ inApp: value.in_app })).catch(() => undefined); }, []);
  useEffect(() => { const socket = getSocket(); if (!socket) return undefined; const refresh = () => { void load(); }; socket.on('alerts.updated', refresh); return () => socket.off('alerts.updated', refresh); }, [load]);

  const mark = async (id) => {
    setBusy(true);
    try {
      if (id) await notificationsApi.read(id); else await notificationsApi.readAll();
      await load();
      window.dispatchEvent(new Event('actpulse:notifications-read'));
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not update read state.');
    } finally {
      setBusy(false);
    }
  };
  const savePreferences = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await notificationsApi.updatePreferences(preferences);
      setPreferencesOpen(false);
      setPreferencesDirty(false);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save preferences.');
    } finally {
      setBusy(false);
    }
  };
  const items = data?.items ?? [];

  return <PageContainer title="Notifications" subtitle="Your in-app alert messages and read state">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status">{data?.unread ?? '—'} unread</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreferencesOpen(true)}>Preferences</Button>
          <Button variant="outline" disabled={busy || !data?.unread} onClick={() => void mark()}>Mark All Read</Button>
        </div>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span>{error}</span>{!data && <Button variant="outline" onClick={() => void load()} disabled={loading}>Retry</Button>}</div>}
      {loading ? <p className="rounded-xl border p-6 text-slate-500 dark:border-slate-700">Loading notifications…</p>
        : !data ? null
          : !items.length ? <p className="rounded-xl border p-6 text-slate-500 dark:border-slate-700">No notifications.</p>
            : items.map((item) => <article key={item.id} className={`rounded-xl border p-4 dark:border-slate-700 ${item.read_at ? 'bg-white dark:bg-slate-900' : 'bg-blue-50 dark:bg-blue-950/30'}`}><div className="flex flex-wrap justify-between gap-2"><strong>{item.title}</strong><span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span></div><p className="text-sm">{item.message}</p><div className="mt-2 flex flex-wrap gap-2"><Link to={item.equipment_id ? `${base}/equipment/${item.equipment_id}` : `${base}/${base === '/admin' ? 'platform-billing' : 'billing'}`} className="text-sm text-[#064789] underline dark:text-[#8fc7e8]">{item.equipment_id ? 'View equipment' : 'View billing'}</Link>{!item.read_at && <button className="text-sm text-[#064789] underline dark:text-[#8fc7e8]" onClick={() => void mark(item.id)} disabled={busy}>Mark read</button>}</div></article>)}
      {data && <div className="flex items-center gap-2"><Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={loading || items.length < 25} onClick={() => setPage(page + 1)}>Next</Button></div>}
    </div>
    <ActionModal open={preferencesOpen} title="Notification Preferences" dirty={preferencesDirty} onClose={() => setPreferencesOpen(false)}><form onSubmit={savePreferences} className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={preferences.inApp} onChange={(event) => { setPreferences({ inApp: event.target.checked }); setPreferencesDirty(true); }} />In-app alerts</label><p className="text-xs text-slate-500">Email delivery is not configured for this workspace.</p><Button type="submit" loading={busy}>Save Preferences</Button></form></ActionModal>
  </PageContainer>;
}
