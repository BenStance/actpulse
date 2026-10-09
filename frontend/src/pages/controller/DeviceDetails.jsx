import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageContainer from '../../components/layout/PageContainer';
import { deviceApi } from '../../api/actPulse.Api';

export default function DeviceDetails() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    deviceApi.getById(id).then(({ data }) => setDevice(data))
      .catch((err) => setError(err?.response?.data?.message || 'Device unavailable.'));
  }, [id]);
  return <PageContainer title="Monitor Details" subtitle="Read-only monitoring hardware information">
    {error ? <p role="alert" className="text-red-600">{error}</p> : !device ? <p>Loading device...</p> :
      <div className="max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-semibold">{device.name}</h2>
        <p>Equipment: {device.equipment?.name || 'Unbound'}</p>
        <p>Site: {device.equipment?.site?.name || 'No site'}</p>
        <p>Identifier: {device.deviceIdentifier}</p>
        <p>Lifecycle: {device.lifecycleState}</p>
        <p>Connectivity: {device.connectivity}</p>
        <p>Observed state: {device.currentStatus}</p>
        <p>Last contact: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never connected'}</p>
        <p>Last reading: {device.lastReadingAt ? new Date(device.lastReadingAt).toLocaleString() : 'No readings yet'}</p>
      </div>}
  </PageContainer>;
}
