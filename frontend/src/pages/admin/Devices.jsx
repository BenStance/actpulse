// src/pages/admin/Devices.jsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Cpu,
  MapPin,
  Activity,
  Calendar,
  Users,
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { deviceApi } from '../../api/actPulse.Api';

// Helper to format date
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

// Status badge component
function StatusBadge({ isActive, currentStatus }) {
  if (!isActive) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">Inactive</span>;
  }
  if (currentStatus === 'ON') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Activity size={12} />ON</span>;
  }
  if (currentStatus === 'OFF') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">OFF</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Unknown</span>;
}

// ─── Mobile Device Card ──────────────────────────────────────────────────────
function DeviceCard({ device, onEdit, onDeactivate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/40"
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Cpu size={16} className="shrink-0 text-[#064789] dark:text-[#427aa1]" />
          <p className="truncate font-semibold text-slate-800 dark:text-white">{device.name}</p>
        </div>
        <StatusBadge isActive={device.isActive} currentStatus={device.currentStatus} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4">
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} /> {device.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> {device.users?.length || 0} user{device.users?.length !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} /> {formatDate(device.createdAt)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700">
          {device.isActive ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <button
          onClick={() => onEdit(device)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <Edit size={13} /> Edit
        </button>
        <button
          onClick={() => onDeactivate(device)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={13} /> Deactivate
        </button>
      </div>
    </motion.div>
  );
}

export default function Devices() {
  const { darkMode } = useThemeContext();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', location: '' });
  const [editForm, setEditForm] = useState({ name: '', location: '' });

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.list();
      setDevices(res.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await deviceApi.create(createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', location: '' });
      loadDevices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create device');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    setError('');
    try {
      await deviceApi.update(selectedDevice.id, editForm);
      setShowEditModal(false);
      loadDevices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update device');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    setError('');
    try {
      await deviceApi.remove(selectedDevice.id);
      setShowDeactivateModal(false);
      loadDevices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to deactivate device');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDevices = devices.filter(d =>
    d.name?.toLowerCase().includes(search.toLowerCase()) ||
    d.location?.toLowerCase().includes(search.toLowerCase())
  );

  const openEditModal = (device) => {
    setSelectedDevice(device);
    setEditForm({ name: device.name, location: device.location });
    setShowEditModal(true);
    setError('');
  };

  const openDeactivateModal = (device) => {
    setSelectedDevice(device);
    setShowDeactivateModal(true);
    setError('');
  };

  // ── Shared loading / empty states ──────────────────────────────────────────
  const LoadingState = () => (
    <div className="flex justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#064789] border-t-transparent dark:border-[#427aa1]" />
    </div>
  );

  const EmptyState = () => (
    <div className="py-12 text-center text-slate-500 dark:text-slate-400">No devices found</div>
  );

  return (
    <PageContainer title="Devices" subtitle="Register, manage and monitor ESP32 controllers">
      {/* Header with search and create button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 shrink-0">
          <Plus size={16} /> Add Device
        </Button>
      </div>

      {/* ── MOBILE: Card list (hidden on md+) ────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          <LoadingState />
        ) : filteredDevices.length === 0 ? (
          <EmptyState />
        ) : (
          filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onEdit={openEditModal}
              onDeactivate={openDeactivateModal}
            />
          ))
        )}
      </div>

      {/* ── DESKTOP: Full table (hidden below md) ────────────────────────── */}
      <div className="hidden md:block rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/40">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50/50 dark:bg-slate-800/80">
            <tr>
              {['Name', 'Location', 'Power Status', 'Device State', 'Assigned Users', 'Created', 'Actions'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 ${i === 6 ? 'text-right' : 'text-left'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center">
                  <LoadingState />
                </td>
              </tr>
            ) : filteredDevices.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8">
                  <EmptyState />
                </td>
              </tr>
            ) : (
              filteredDevices.map((device) => (
                <motion.tr
                  key={device.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-[#064789] dark:text-[#427aa1]" />
                      {device.name}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      {device.location}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <StatusBadge isActive={device.isActive} currentStatus={device.currentStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {device.isActive ? 'Enabled' : 'Disabled'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {device.users?.length || 0} user(s)
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(device.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(device)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => openDeactivateModal(device)} className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" title="Deactivate">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MODALS (unchanged) ───────────────────────────────────────────── */}

      {/* CREATE MODAL */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Register New Device">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Device Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required placeholder="e.g., GEN-Plant-01" />
          <Input label="Location" value={createForm.location} onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })} required placeholder="e.g., Main Generator Room" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={actionLoading}>Create Device</Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Device">
        <div className="space-y-4">
          <Input label="Device Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Location" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} loading={actionLoading}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* DEACTIVATE CONFIRM MODAL */}
      <Modal open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)} title="Deactivate Device" size="sm">
        <div className="space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            Are you sure you want to deactivate <span className="font-semibold">{selectedDevice?.name}</span>?
            This device will no longer be able to send data.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
            <Button onClick={handleDeactivate} loading={actionLoading} className="bg-red-600 hover:bg-red-700">Deactivate</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
