import { create } from 'zustand';
import { authApi, actPulseApi } from '../api/actPulse.Api';
import { disconnectSocket } from '../components/realtime/socket';
import { clearAuth, getStoredUser, getToken, saveAuth } from '../utils/auth';
import { useDeviceStore } from './device.store';

let validationInFlight = null;

function clearSession(set) {
  clearAuth();
  disconnectSocket();
  useDeviceStore.getState().reset();
  window.dispatchEvent(new Event('subscription:clear'));
  set({ token: '', user: null, isAuthenticated: false, checking: false, sessionError: false });
}

export const useAuthStore = create((set, get) => ({
  token: getToken(),
  user: getStoredUser(),
  isAuthenticated: !!getToken(),
  checking: !!getToken(),
  sessionError: false,
  loading: false,
  login: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await authApi.login(payload);
      useDeviceStore.getState().reset();
      window.dispatchEvent(new Event('subscription:clear'));
      saveAuth({ token: data.accessToken, user: data.user });
      set({ token: data.accessToken, user: data.user, isAuthenticated: true, checking: false, sessionError: false, loading: false });
      return data;
    } catch (error) { set({ loading: false }); throw error; }
  },
  validateSession: async () => {
    if (!get().token) { set({ checking: false }); return; }
    if (!validationInFlight) {
      const validatingToken = get().token;
      set({ checking: true, sessionError: false });
      validationInFlight = authApi.me().then(({ data }) => {
        if (get().token !== validatingToken) return;
        saveAuth({ token: validatingToken, user: data });
        set({ user: data, isAuthenticated: true, checking: false, sessionError: false });
      }).catch((error) => {
        if (get().token !== validatingToken) return;
        if (error?.response?.status === 401) clearSession(set);
        else set({ checking: false, sessionError: true });
      }).finally(() => { validationInFlight = null; });
    }
    await validationInFlight;
  },
  updateUser: (user) => {
    saveAuth({ token: get().token, user });
    set({ user });
  },
  clearSession: () => clearSession(set),
  logout: async () => {
    try { if (get().token) await authApi.logout(); }
    finally { clearSession(set); }
  },
}));

actPulseApi.interceptors.response.use((response) => response, (error) => {
  if (error?.response?.status === 401) useAuthStore.getState().clearSession();
  if (error?.response?.status === 403 && ['SUBSCRIPTION_REQUIRED', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_SUSPENDED'].includes(error?.response?.data?.code)) window.dispatchEvent(new Event('subscription:access-changed'));
  return Promise.reject(error);
});
