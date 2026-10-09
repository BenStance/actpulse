import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Clock3, Cpu, MapPin, Power, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import { deviceApi, organizationsApi } from '../../api/actPulse.Api';
import { formatDate } from '../../utils/formatDate';

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#427aa1] focus:ring-2 focus:ring-[#427aa1]/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

function Status({ value }) {
  const state = String(value || 'UNKNOWN').toUpperCase();
  const tone = state === 'ON' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' : state === 'OFF' ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30' : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}><Power size={13} />{state === 'UNKNOWN' ? 'Unknown' : state}</span>;
}

function Summary({ label, count, Icon, tone }) {
  return <div className={`${card} flex items-center gap-3 p-4`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span><div><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{count}</p></div></div>;
}

export default function AssignedDevices() {
  const [devices, setDevices] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [site, setSite] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    setError('');
    try {
      const [deviceResult, orgResult] = await Promise.allSettled([deviceApi.list(), organizationsApi.me()]);
      if (deviceResult.status === 'rejected') throw deviceResult.reason;
      const data = deviceResult.value.data;
      setDevices(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
      if (orgResult.status === 'fulfilled') setOrganization(orgResult.value.data);
    } catch (err) { setError(err?.response?.data?.message || 'Could not load assigned monitors.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void load(true); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const sites = useMemo(() => [...new Map(devices.filter((d) => d.equipment?.site?.id).map((d) => [d.equipment.site.id, d.equipment.site])).values()].sort((a, b) => a.name.localeCompare(b.name)), [devices]);
  const filtered = useMemo(() => devices.filter((d) => {
    if (status !== 'ALL' && String(d.currentStatus || 'UNKNOWN').toUpperCase() !== status) return false;
    if (site !== 'ALL' && d.equipment?.site?.id !== site) return false;
    const q = search.trim().toLowerCase();
    return !q || [d.name, d.deviceIdentifier, d.equipment?.name, d.equipment?.site?.name].some((v) => String(v || '').toLowerCase().includes(q));
  }), [devices, search, site, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  return <PageContainer title="Assigned Monitors" subtitle={organization?.name ? `${organization.name} · monitors on your assigned equipment` : 'Monitors on your assigned equipment'}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500 dark:text-slate-400">Current status and most recent observations</p><Button size="sm" variant="outline" leftIcon={RefreshCw} loading={refreshing} onClick={() => void load()}>Refresh</Button></div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monitor summary">
        <Summary label="Assigned monitors" count={devices.length} Icon={Cpu} tone="bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]" />
        <Summary label="Observed ON" count={devices.filter((d) => d.currentStatus === 'ON').length} Icon={Power} tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" />
        <Summary label="Observed OFF" count={devices.filter((d) => d.currentStatus === 'OFF').length} Icon={Power} tone="bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" />
        <Summary label="Online monitors" count={devices.filter((d) => d.connectivity === 'ONLINE').length} Icon={Wifi} tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
      </section>
      <section className={`${card} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]`} aria-label="Monitor filters">
        <label><span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Search</span><span className="relative block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${field} pl-9`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Monitor, equipment, identifier…" /></span></label>
        <label><span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Observed state</span><select className={field} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">All states</option><option value="ON">ON</option><option value="OFF">OFF</option><option value="UNKNOWN">Unknown</option></select></label>
        <label><span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Site</span><select className={field} value={site} onChange={(e) => { setSite(e.target.value); setPage(1); }}><option value="ALL">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </section>
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      {loading ? <div className={`${card} p-12 text-center text-sm text-slate-500`}>Loading assigned monitors…</div> : filtered.length === 0 ? <div className={`${card} p-12 text-center`}><Cpu size={28} className="mx-auto text-slate-400" /><p className="mt-3 font-medium text-slate-700 dark:text-slate-200">{devices.length ? 'No monitors match these filters' : 'No monitors assigned yet'}</p><p className="text-sm text-slate-500">{devices.length ? 'Try a different search or filter.' : 'Monitors linked to your equipment will appear here.'}</p></div> : <>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"><span>Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}</span><span>Unknown means no recent confirmed reading.</span></div>
        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Assigned monitors">{visible.map((d) => <article key={d.id} className={`${card} flex min-w-0 flex-col overflow-hidden`}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#064789]/10 text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#8fc7e8]"><Cpu size={21} /></span><div className="min-w-0"><h2 className="truncate font-semibold text-slate-800 dark:text-slate-100">{d.name || 'Unnamed monitor'}</h2><p className="truncate text-xs text-slate-500">{d.deviceIdentifier || 'No identifier'}</p></div></div><Status value={d.currentStatus} /></div>
          <div className="flex-1 space-y-3 p-4 text-sm"><p className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200"><Activity size={15} className="shrink-0 text-slate-400" /><span className="truncate">{d.equipment?.name || 'No linked equipment'}</span></p><p className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><MapPin size={15} className="shrink-0 text-slate-400" /><span className="truncate">{d.equipment?.site?.name || 'No site'}</span></p><p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">{d.connectivity === 'ONLINE' ? <Wifi size={15} className="text-emerald-500" /> : <WifiOff size={15} className="text-slate-400" />}{d.connectivity === 'ONLINE' ? 'Online' : d.connectivity === 'NEVER_CONNECTED' ? 'Never connected' : 'Offline'}</p><p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400"><Clock3 size={14} className="mt-0.5 shrink-0" /><span>Last reading: {formatDate(d.lastReadingAt)}<br />Last contact: {formatDate(d.lastSeenAt)}</span></p></div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/30"><span className="truncate text-xs text-slate-500 dark:text-slate-400">{d.equipment?.type || 'Assigned monitor'}</span><Link to={`/controller/device/${d.id}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#064789] hover:underline dark:text-[#8fc7e8]">View details <ArrowUpRight size={14} /></Link></div>
        </article>)}</section>
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-slate-500">Rows <select className={field} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>{[6, 12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}</select></label><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</Button><span className="text-xs text-slate-500">{current} / {pages}</span><Button variant="outline" size="sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</Button></div></div>
      </>}
    </div>
  </PageContainer>;
}
