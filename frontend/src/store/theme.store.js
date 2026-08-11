import { create } from 'zustand';
const initialTheme = localStorage.getItem('actpulse_theme') || 'light';
export const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (theme) => { localStorage.setItem('actpulse_theme', theme); document.documentElement.classList.toggle('dark', theme === 'dark'); set({ theme }); },
  toggleTheme: () => set((state) => { const next = state.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('actpulse_theme', next); document.documentElement.classList.toggle('dark', next === 'dark'); return { theme: next }; }),
}));
