import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import SideBar from '../components/layout/SideBar';
import TopBar from '../components/layout/TopBar';
import { connectSocket, disconnectSocket } from '../components/realtime/socket';
import { useAuthStore } from '../store/auth.store';
import { useSubscriptionStore } from '../store/subscription.store';

export default function App() {
  const { token, validateSession } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const subscriptionValid = useSubscriptionStore((state) => state.status?.valid);
  useEffect(() => {
    if (!token || (user?.role === 'Controller' && !subscriptionValid)) { disconnectSocket(); return; }
    const socket = connectSocket(token);
    const onDisconnect = (reason) => {
      if (reason === 'io server disconnect') void validateSession();
    };
    socket?.on('disconnect', onDisconnect);
    return () => { socket?.off('disconnect', onDisconnect); disconnectSocket(); };
  }, [token, user?.role, subscriptionValid, validateSession]);

  return <div className="flex min-h-screen"><SideBar /><div className="flex-1"><TopBar /><main className="p-6"><Outlet /></main></div></div>;
}
