// src/pages/admin/Users.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Link, 
  Search, 
  CheckCircle, 
  XCircle,
  UserPlus,
  Cpu,
  Mail,
  User as UserIcon,
  Shield,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import PageContainer from '../../components/layout/PageContainer';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { deviceApi, usersApi } from '../../api/actPulse.Api';

// Helper to format date
const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

// Status badge component
function StatusBadge({ isActive, isActivated }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
        <XCircle size={12} />Inactive
      </span>
    );
  }
  if (isActivated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle size={12} />Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
      Pending
    </span>
  );
}

// ─── Mobile User Card ────────────────────────────────────────────────────────
function UserCard({ user, onEdit, onAssign, onDeactivate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/40"
    >
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800 dark:text-white">{user.name}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
        <StatusBadge isActive={user.isActive} isActivated={user.isActivated} />
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mb-4">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 font-medium text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#427aa1]">
          <Shield size={11} /> {user.role}
        </span>
        <span className="inline-flex items-center gap-1">
          <Cpu size={12} /> {user.devices?.length || 0} device{user.devices?.length !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} /> {formatDate(user.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <button
          onClick={() => onEdit(user)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <Edit size={13} /> Edit
        </button>
        <button
          onClick={() => onAssign(user)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          <Link size={13} /> Assign
        </button>
        <button
          onClick={() => onDeactivate(user)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={13} /> Deactivate
        </button>
      </div>
    </motion.div>
  );
}

export default function Users() {
  const { darkMode } = useThemeContext();
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'Controller', deviceIds: [] });
  const [editForm, setEditForm] = useState({ name: '', role: 'Controller' });
  const [assignForm, setAssignForm] = useState({ deviceIds: [] });
  const [createDeviceMenuOpen, setCreateDeviceMenuOpen] = useState(false);
  const [assignDeviceMenuOpen, setAssignDeviceMenuOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, devicesRes] = await Promise.all([usersApi.list(), deviceApi.list()]);
      setUsers(usersRes.data || []);
      setDevices(devicesRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Create user
  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await usersApi.create(createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', role: 'Controller', deviceIds: [] });
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to invite user');
    } finally {
      setActionLoading(false);
    }
  };

  // Update user (name, role)
  const handleUpdate = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError('');
    try {
      await usersApi.update(selectedUser.id, editForm);
      setShowEditModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  // Assign devices
  const handleAssignDevices = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError('');
    try {
      await usersApi.assignDevices(selectedUser.id, { deviceIds: assignForm.deviceIds });
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to assign devices');
    } finally {
      setActionLoading(false);
    }
  };

  // Deactivate user
  const handleDeactivate = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    setError('');
    try {
      await usersApi.remove(selectedUser.id);
      setShowDeactivateModal(false);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to deactivate user');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users by search
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Helper to open modals
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({ name: user.name, role: user.role });
    setShowEditModal(true);
    setError('');
  };

  const openAssignModal = (user) => {
    setSelectedUser(user);
    const currentDeviceIds = user.devices?.map(d => d.id) || [];
    setAssignForm({ deviceIds: currentDeviceIds });
    setShowAssignModal(true);
    setAssignDeviceMenuOpen(false);
    setError('');
  };

  const openDeactivateModal = (user) => {
    setSelectedUser(user);
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
    <div className="py-12 text-center text-slate-500 dark:text-slate-400">No users found</div>
  );

  return (
    <PageContainer title="Users" subtitle="Invite, manage and assign devices to users">
      {/* Header: search + invite button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2 w-auto shrink-0">
          <UserPlus size={16} /> Invite User
        </Button>
      </div>

      {/* ── MOBILE: Card list (hidden on md+) ────────────────────────────── */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          <LoadingState />
        ) : filteredUsers.length === 0 ? (
          <EmptyState />
        ) : (
          filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={openEditModal}
              onAssign={openAssignModal}
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
              {['Name', 'Email', 'Role', 'Status', 'Devices', 'Created', 'Actions'].map((h, i) => (
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
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-4 py-8">
                  <EmptyState />
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800 dark:text-white">{user.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{user.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#064789]/10 px-2 py-0.5 text-xs font-medium text-[#064789] dark:bg-[#427aa1]/20 dark:text-[#427aa1]">
                      <Shield size={12} /> {user.role}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <StatusBadge isActive={user.isActive} isActivated={user.isActivated} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1">
                      <Cpu size={14} /> {user.devices?.length || 0}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(user.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(user)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => openAssignModal(user)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700" title="Assign Devices">
                        <Link size={16} />
                      </button>
                      <button onClick={() => openDeactivateModal(user)} className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" title="Deactivate">
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
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Invite New User" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Full Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          <Input label="Email" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="Controller">Controller</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Assign Devices (at least one)</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCreateDeviceMenuOpen((v) => !v)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {createForm.deviceIds.length > 0 ? `${createForm.deviceIds.length} device(s) selected` : 'Select devices'}
              </button>
              {createDeviceMenuOpen && (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {devices.map((d) => {
                    const checked = createForm.deviceIds.includes(d.id);
                    return (
                      <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...createForm.deviceIds, d.id]
                              : createForm.deviceIds.filter((id) => id !== d.id);
                            setCreateForm({ ...createForm, deviceIds: next });
                          }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{d.name} ({d.location})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button type="submit" loading={actionLoading}>Send Invitation</Button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User" size="md">
        <div className="space-y-4">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="Controller">Controller</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate} loading={actionLoading}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* ASSIGN DEVICES MODAL */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Devices" size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            User: <span className="font-semibold">{selectedUser?.name}</span>
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Select Devices</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setAssignDeviceMenuOpen((v) => !v)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {assignForm.deviceIds.length > 0 ? `${assignForm.deviceIds.length} device(s) selected` : 'Select devices'}
              </button>
              {assignDeviceMenuOpen && (
                <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {devices.map((d) => {
                    const checked = assignForm.deviceIds.includes(d.id);
                    return (
                      <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...assignForm.deviceIds, d.id]
                              : assignForm.deviceIds.filter((id) => id !== d.id);
                            setAssignForm({ deviceIds: next });
                          }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{d.name} ({d.location})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button onClick={handleAssignDevices} loading={actionLoading}>Assign Devices</Button>
          </div>
        </div>
      </Modal>

      {/* DEACTIVATE CONFIRM MODAL */}
      <Modal open={showDeactivateModal} onClose={() => setShowDeactivateModal(false)} title="Deactivate User" size="sm">
        <div className="space-y-4">
          <p className="text-slate-700 dark:text-slate-300">
            Are you sure you want to deactivate <span className="font-semibold">{selectedUser?.name}</span>?
            This will revoke all sessions and prevent login.
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
