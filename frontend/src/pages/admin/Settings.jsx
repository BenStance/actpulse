import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { deviceApi } from '../../api/actPulse.Api';

export default function Settings() {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [rotatedKey, setRotatedKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadDevices = async () => {
    try {
      const res = await deviceApi.list();
      const list = res.data || [];
      setDevices(list);
      setSelectedDeviceId((curr) => curr || list[0]?.id || '');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load devices');
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  const handleRotate = async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await deviceApi.rotateKey(selectedDeviceId);
      setRotatedKey(res.data?.apiKey || '');
      setShowKeyModal(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to rotate API key');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = async () => {
    if (!rotatedKey) return;
    await navigator.clipboard.writeText(rotatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <PageContainer title="Settings" subtitle="Security operations and API key management">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Rotate Device API Key</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Select a device and rotate its API key. The old key becomes invalid immediately.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.location})
              </option>
            ))}
          </select>
          <Button onClick={handleRotate} loading={loading} className="gap-2">
            <RefreshCw size={16} />
            Rotate Key
          </Button>
        </div>

        {selectedDevice && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Selected: {selectedDevice.name} - {selectedDevice.location}
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <Modal open={showKeyModal} onClose={() => setShowKeyModal(false)} title="API Key Rotated" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            New API key for <span className="font-semibold">{selectedDevice?.name}</span>:
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <code className="flex-1 break-all text-sm text-slate-800 dark:text-slate-200">{rotatedKey}</code>
            <button onClick={copyKey} className="rounded-lg p-1.5 hover:bg-white dark:hover:bg-slate-700" title="Copy key">
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} className="text-slate-600 dark:text-slate-300" />}
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Store this key securely. The previous key is no longer valid for device authentication.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => setShowKeyModal(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
