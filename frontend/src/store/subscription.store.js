import { create } from 'zustand';
import { subscriptionApi } from '../api/actPulse.Api';

export const useSubscriptionStore = create((set) => ({
  status: null, loading: false, error: '',
  refresh: async () => {
    set({ loading: true, error: '' });
    try { const { data } = await subscriptionApi.status(); set({ status: data, loading: false }); return data; }
    catch (error) { set({ loading: false, error: error?.response?.data?.message || 'Could not load subscription status.' }); throw error; }
  },
  clear: () => set({ status: null, loading: false, error: '' }),
}));

actPulseSubscriptionEvents();
function actPulseSubscriptionEvents() {
  window.addEventListener('subscription:access-changed', () => { void useSubscriptionStore.getState().refresh().catch(() => undefined); });
  window.addEventListener('subscription:clear', () => useSubscriptionStore.getState().clear());
}
