import { create } from 'zustand';
import { authApi, actPulseApi } from '../api/actPulse.Api';
import { clearAuth, getStoredUser, getToken, saveAuth } from '../utils/auth';

export const useAuthStore = create((set, get) => ({
  token: getToken(),
  user: getStoredUser(),
  isAuthenticated: !!getToken(),
  loading: false,
  login: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await authApi.login(payload);
      saveAuth({ token: data.accessToken, user: data.user });
      set({ token: data.accessToken, user: data.user, isAuthenticated: true, loading: false });
      return data;
    } catch (error) { set({ loading: false }); throw error; }
  },
  logout: async () => {
    try { if (get().token) await authApi.logout(); } finally { clearAuth(); set({ token: '', user: null, isAuthenticated: false }); }
  },
}));

actPulseApi.interceptors.response.use((response) => response, (error) => {
  if (error?.response?.status === 401) { clearAuth(); useAuthStore.setState({ token: '', user: null, isAuthenticated: false }); }
  return Promise.reject(error);
});
