import { io } from 'socket.io-client';
let socket;
export function connectSocket(token) {
  if (!token) return null;
  if (socket?.connected) return socket;
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  socket = io(baseURL, { auth: { token: `Bearer ${token}` }, transports: ['websocket'] });
  return socket;
}
export const getSocket = () => socket;
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }
