export const TOKEN_KEY = 'actpulse_token';
export const USER_KEY = 'actpulse_user';
export const saveAuth = ({ token, user }) => { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(user)); };
export const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };
export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? '';
export const getStoredUser = () => { const raw = localStorage.getItem(USER_KEY); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } };
