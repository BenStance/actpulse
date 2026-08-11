import { create } from 'zustand';
import { dashboardApi, deviceApi } from '../api/actPulse.Api';

export const useDeviceStore = create((set) => ({
  devices: [], summary: null, uptime: [], downtime: [], activity: [], loading: false,
  loadDashboard: async () => {
    set({ loading: true });
    try {
      const [summary, uptime, downtime, activity] = await Promise.all([dashboardApi.summary(), dashboardApi.uptime(), dashboardApi.downtime(), dashboardApi.activity()]);
      set({ summary: summary.data, uptime: uptime.data, downtime: downtime.data, activity: activity.data, loading: false });
    } catch (error) { set({ loading: false }); throw error; }
  },
  loadDevices: async () => { const { data } = await deviceApi.list(); set({ devices: data }); },
  applyRealtimeStatus: ({ deviceId, status, timestamp }) => set((state) => ({ activity: [{ id: `rt-${Date.now()}`, deviceId, deviceName: 'Live Device', status, recordedAt: timestamp }, ...state.activity].slice(0, 50) })),
}));
