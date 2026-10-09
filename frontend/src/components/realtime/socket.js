import { io } from 'socket.io-client';
let socket;
let currentToken;
export function connectSocket(token) {
  if (!token) return null;
  if (socket && currentToken === token) return socket;
  if (socket) socket.disconnect();
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  socket = io(baseURL, {
    auth: { token: `Bearer ${token}` },
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnectionDelay: 1500,
  });
  currentToken = token;
  return socket;
}
export const getSocket = () => socket;
export function disconnectSocket() { if (socket) socket.disconnect(); socket = null; currentToken = null; }
