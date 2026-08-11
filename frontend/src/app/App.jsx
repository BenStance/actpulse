import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import SideBar from '../components/layout/SideBar';
import TopBar from '../components/layout/TopBar';
import { connectSocket, disconnectSocket } from '../components/realtime/socket';
import { useAuthStore } from '../store/auth.store';

export default function App() {
  const { token } = useAuthStore();
  useEffect(() => { if (!token) { disconnectSocket(); return; } connectSocket(token); return () => disconnectSocket(); }, [token]);

  return <div className="flex min-h-screen"><SideBar /><div className="flex-1"><TopBar /><main className="p-6"><Outlet /></main></div></div>;
}
