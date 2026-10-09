import axios from 'axios';
import { getToken } from '../utils/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const actPulseApi = axios.create({ baseURL, timeout: 15000 });

actPulseApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  me: () => actPulseApi.get('/auth/me'),
  updateMe: (payload) => actPulseApi.patch('/auth/me', payload),
  login: (payload) => actPulseApi.post('/auth/login', payload),
  logout: () => actPulseApi.post('/auth/logout'),
  forgotPassword: (payload) => actPulseApi.post('/auth/forgot-password', payload),
  resetPassword: (payload) => actPulseApi.post('/auth/reset-password', payload),
  changePassword: (payload) => actPulseApi.post('/auth/change-password', payload),
};

export const subscriptionApi = {
  plans: () => actPulseApi.get('/subscriptions/plans'),
  status: (organizationId) => actPulseApi.get('/subscriptions/status', { params: organizationId ? { organizationId } : {} }),
  select: (payload) => actPulseApi.post('/subscriptions/select', payload),
  suspend: (organizationId, reason) => actPulseApi.post(`/subscriptions/${organizationId}/suspend`, { reason }),
  restore: (organizationId, reason) => actPulseApi.post(`/subscriptions/${organizationId}/restore`, { reason }),
};

export const billingApi = {
  me: () => actPulseApi.get('/billing/me'),
  history: (kind, params) => actPulseApi.get(`/billing/history/${kind}`, { params }),
  organization: (id) => actPulseApi.get(`/billing/organization/${id}`),
  invoice: (id) => actPulseApi.get(`/billing/invoices/${id}`),
  submitProof: (id, payload) => actPulseApi.post(`/billing/invoices/${id}/proof`, payload),
  proof: (id) => actPulseApi.get(`/billing/submissions/${id}/proof`, { responseType: 'blob' }),
  instructions: () => actPulseApi.get('/billing/instructions'),
  adminInstructions: () => actPulseApi.get('/billing/admin/instructions'),
  saveInstruction: (payload, id) => id ? actPulseApi.patch(`/billing/admin/instructions/${id}`, payload) : actPulseApi.post('/billing/admin/instructions', payload),
  reviews: (params) => actPulseApi.get('/billing/admin/reviews', { params }),
  review: (id, payload) => actPulseApi.post(`/billing/admin/reviews/${id}`, payload),
  stats: (params) => actPulseApi.get('/billing/admin/stats', { params }),
  audit: (params) => actPulseApi.get('/billing/admin/audit', { params }),
  activity: (params) => actPulseApi.get('/billing/activity', { params }),
  plans: () => actPulseApi.get('/billing/admin/plans'),
  savePlan: (payload, id) => id ? actPulseApi.patch(`/billing/admin/plans/${id}`, payload) : actPulseApi.post('/billing/admin/plans', payload),
};

export const usersApi = {
  create: (payload) => actPulseApi.post('/users', payload),
  activate: (payload) => actPulseApi.post('/users/activate', payload),
  list: (params) => actPulseApi.get('/users', { params }),
  getById: (id) => actPulseApi.get(`/users/${id}`),
  update: (id, payload) => actPulseApi.patch(`/users/${id}`, payload),
  remove: (id) => actPulseApi.delete(`/users/${id}`),
  assignDevices: (id, payload) => actPulseApi.post(`/users/${id}/assign-devices`, payload),
  reactivate: (id) => actPulseApi.post(`/users/${id}/reactivate`),
  resendInvitation: (id) => actPulseApi.post(`/users/${id}/resend-invitation`),
};

export const organizationsApi = {
  list: (params) => actPulseApi.get('/organizations', { params }),
  getById: (id) => actPulseApi.get(`/organizations/${id}`),
  me: () => actPulseApi.get('/organizations/me'),
  create: (payload) => actPulseApi.post('/organizations', payload),
  update: (id, payload) => actPulseApi.patch(`/organizations/${id}`, payload),
  activate: (id) => actPulseApi.post(`/organizations/${id}/activate`),
  deactivate: (id) => actPulseApi.post(`/organizations/${id}/deactivate`),
};

export const deviceApi = {
  create: (payload) => actPulseApi.post('/devices', payload),
  list: () => actPulseApi.get('/devices'),
  getById: (id) => actPulseApi.get(`/devices/${id}`),
  update: (id, payload) => actPulseApi.patch(`/devices/${id}`, payload),
  remove: (id) => actPulseApi.delete(`/devices/${id}`),
  rotateKey: (id) => actPulseApi.post(`/devices/${id}/rotate-key`),
  activate: (id) => actPulseApi.post(`/devices/${id}/activate`),
  disable: (id) => actPulseApi.post(`/devices/${id}/disable`),
  retire: (id) => actPulseApi.post(`/devices/${id}/retire`),
  replace: (id, payload) => actPulseApi.post(`/devices/${id}/replace`, payload),
};

export const sitesApi = {
  list: (params) => actPulseApi.get('/sites', { params }),
  detail: (id, params) => actPulseApi.get(`/sites/${id}`, { params }),
  create: (payload) => actPulseApi.post('/sites', payload),
  update: (id, payload) => actPulseApi.patch(`/sites/${id}`, payload),
  activate: (id) => actPulseApi.post(`/sites/${id}/activate`),
  deactivate: (id) => actPulseApi.post(`/sites/${id}/deactivate`),
};

export const equipmentApi = {
  list: (params) => actPulseApi.get('/equipment', { params }),
  detail: (id, params) => actPulseApi.get(`/equipment/${id}`, { params }),
  events: (id, params) => actPulseApi.get(`/equipment/${id}/events`, { params }),
  create: (payload) => actPulseApi.post('/equipment', payload),
  update: (id, payload) => actPulseApi.patch(`/equipment/${id}`, payload),
  activate: (id) => actPulseApi.post(`/equipment/${id}/activate`),
  archive: (id) => actPulseApi.post(`/equipment/${id}/archive`),
  assignControllers: (id, controllerIds) => actPulseApi.post(`/equipment/${id}/controllers`, { controllerIds }),
};

export const sensorApi = {
  pushStatus: (apiKey, payload) => actPulseApi.post('/sensors/status', payload, { headers: { Authorization: `ApiKey ${apiKey}` } }),
  heartbeat: (apiKey, payload = {}) => actPulseApi.post('/sensors/heartbeat', payload, { headers: { Authorization: `ApiKey ${apiKey}` } }),
};

export const dashboardApi = {
  admin: (params) => actPulseApi.get('/dashboard/admin', { params }),
  overview: (params) => actPulseApi.get('/dashboard/overview', { params }),
  summary: () => actPulseApi.get('/dashboard/summary'),
  uptime: () => actPulseApi.get('/dashboard/uptime'),
  downtime: () => actPulseApi.get('/dashboard/downtime'),
  activity: () => actPulseApi.get('/dashboard/activity'),
};

export const reportsApi = {
  equipment: (params) => actPulseApi.get('/reports/equipment', { params }),
  events: (params) => actPulseApi.get('/reports/equipment-events', { params }),
  fleet: (params) => actPulseApi.get('/reports/fleet-summary', { params }),
  fleetCsv: (params) => actPulseApi.get('/reports/fleet.csv', { params, responseType: 'blob' }),
  getDeviceUptimeReport: (params) => actPulseApi.get('/reports/device-uptime', { params }),
  getDeviceDailyReport: (params) => actPulseApi.get('/reports/device-daily', { params }),
  getDeviceEventsReport: (params) => actPulseApi.get('/reports/device-events', { params }),
  getFleetSummary: (params) => actPulseApi.get('/reports/fleet-summary', { params }),
};

export const fuelApi = {
  overview: (equipmentId, params) => actPulseApi.get(`/fuel/${equipmentId}`, { params }),
  configureTank: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/tank`, payload),
  reading: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/readings`, payload),
  refill: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/refills`, payload),
  adjustment: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/adjustments`, payload),
  estimate: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/estimates`, payload),
  reconcile: (equipmentId, payload) => actPulseApi.post(`/fuel/${equipmentId}/reconciliations`, payload),
  finalize: (id, note) => actPulseApi.post(`/fuel/reconciliations/${id}/finalize`, { note }),
  voidRecord: (kind, id, reason) => actPulseApi.post(`/fuel/${kind}/${id}/void`, { reason }),
  correctRecord: (kind, id, payload) => actPulseApi.post(`/fuel/${kind}/${id}/correct`, payload),
};

export const maintenanceApi = {
  list: (params) => actPulseApi.get('/maintenance', { params }),
  plan: (payload) => actPulseApi.post('/maintenance/plans', payload),
  updatePlan: (id, payload) => actPulseApi.patch(`/maintenance/plans/${id}`, payload),
  service: (payload) => actPulseApi.post('/maintenance/services', payload),
  voidService: (id, reason) => actPulseApi.post(`/maintenance/services/${id}/void`, { reason }),
  correctService: (id, payload) => actPulseApi.post(`/maintenance/services/${id}/correct`, payload),
};

export const alertsApi = {
  list: (params) => actPulseApi.get('/alerts', { params }),
  rules: (params) => actPulseApi.get('/alerts/rules', { params }),
  createRule: (payload) => actPulseApi.post('/alerts/rules', payload),
  updateRule: (id, payload) => actPulseApi.patch(`/alerts/rules/${id}`, payload),
  acknowledge: (id, note) => actPulseApi.post(`/alerts/${id}/acknowledge`, { note }),
};

export const notificationsApi = {
  list: (params) => actPulseApi.get('/notifications', { params }),
  read: (id) => actPulseApi.post(`/notifications/${id}/read`),
  readAll: () => actPulseApi.post('/notifications/read-all'),
  preferences: () => actPulseApi.get('/notifications/preferences'),
  updatePreferences: (payload) => actPulseApi.patch('/notifications/preferences', payload),
};

export const operationalReportsApi = {
  report: (params) => actPulseApi.get('/reports/operations', { params }),
  csv: (params) => actPulseApi.get('/reports/operations/export.csv', { params, responseType: 'blob' }),
};
