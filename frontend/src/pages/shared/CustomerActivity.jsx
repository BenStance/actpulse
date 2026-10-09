import { useCallback, useEffect, useState } from 'react';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import { billingApi } from '../../api/actPulse.Api';
import { formatDate } from '../../utils/formatDate';

export default function CustomerActivity() {
  const [items,setItems]=useState([]),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await billingApi.activity({page,pageSize:25});setItems(data.items);}catch(err){setError(err?.response?.data?.message||'Could not load activity.');}finally{setLoading(false);}},[page]);
  useEffect(()=>{const timer=setTimeout(()=>{void load();},0);return()=>clearTimeout(timer);},[load]);
  return <PageContainer title="Activity" subtitle="Subscription, billing and assigned equipment history"><div className="space-y-4">{error&&<p role="alert" className="text-red-600">{error}</p>}{loading?<p>Loading activity…</p>:!items.length?<p className="rounded-xl border p-4 dark:border-slate-700">No activity yet.</p>:items.map(row=><article key={row.id} className="rounded-xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><strong>{row.kind.replaceAll('_',' ')}</strong><p className="text-sm">{row.message}</p><p className="text-xs text-slate-500">{formatDate(row.occurred_at,'UTC')}</p></article>)}<div className="flex gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={items.length<25} onClick={()=>setPage(page+1)}>Next</Button></div></div></PageContainer>;
}
