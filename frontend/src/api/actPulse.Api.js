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
  login: (payload) => actPulseApi.post('/auth/login', payload),
  logout: () => actPulseApi.post('/auth/logout'),
  forgotPassword: (payload) => actPulseApi.post('/auth/forgot-password', payload),
  resetPassword: (payload) => actPulseApi.post('/auth/reset-password', payload),
  changePassword: (payload) => actPulseApi.post('/auth/change-password', payload),
};

export const usersApi = {
  create: (payload) => actPulseApi.post('/users', payload),
  activate: (payload) => actPulseApi.post('/users/activate', payload),
  list: () => actPulseApi.get('/users'),
  getById: (id) => actPulseApi.get(`/users/${id}`),
  update: (id, payload) => actPulseApi.patch(`/users/${id}`, payload),
  remove: (id) => actPulseApi.delete(`/users/${id}`),
  assignDevices: (id, payload) => actPulseApi.post(`/users/${id}/assign-devices`, payload),
};

export const deviceApi = {
  create: (payload) => actPulseApi.post('/devices', payload),
  list: () => actPulseApi.get('/devices'),
  getById: (id) => actPulseApi.get(`/devices/${id}`),
  update: (id, payload) => actPulseApi.patch(`/devices/${id}`, payload),
  remove: (id) => actPulseApi.delete(`/devices/${id}`),
  rotateKey: (id) => actPulseApi.post(`/devices/${id}/rotate-key`),
};

export const sensorApi = {
  pushStatus: (apiKey, payload) => actPulseApi.post('/sensors/status', payload, { headers: { Authorization: `ApiKey ${apiKey}` } }),
  heartbeat: (apiKey, payload = {}) => actPulseApi.post('/sensors/heartbeat', payload, { headers: { Authorization: `ApiKey ${apiKey}` } }),
};

export const dashboardApi = {
  summary: () => actPulseApi.get('/dashboard/summary'),
  uptime: () => actPulseApi.get('/dashboard/uptime'),
  downtime: () => actPulseApi.get('/dashboard/downtime'),
  activity: () => actPulseApi.get('/dashboard/activity'),
};

export const reportsApi = {
  getDeviceUptimeReport: (params) => actPulseApi.get('/reports/device-uptime', { params }),
  getDeviceDailyReport: (params) => actPulseApi.get('/reports/device-daily', { params }),
  getDeviceEventsReport: (params) => actPulseApi.get('/reports/device-events', { params }),
  getFleetSummary: (params) => actPulseApi.get('/reports/fleet-summary', { params }),
};
