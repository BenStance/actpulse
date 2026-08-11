import { createBrowserRouter, Navigate } from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Login from '../pages/public/Login';
import ForgotPassword from '../pages/public/ForgotPassword';
import ResetPassword from '../pages/public/ResetPassword';
import ActivateAccount from '../pages/public/ActivateAccount';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Users from '../pages/admin/Users';
import Devices from '../pages/admin/Devices';
import Reports from '../pages/admin/Reports';
import Settings from '../pages/admin/Settings';
import ControllerDashboard from '../pages/controller/ControllerDashboard';
import AssignedDevices from '../pages/controller/AssignedDevices';
import DeviceDetails from '../pages/controller/DeviceDetails' ;
import ProtectedRoute from './ProtectedRoute';
import App from './App';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/activate-account', element: <ActivateAccount /> },
  { element: <ProtectedRoute allowedRoles={['Admin']} />, children: [{ path: '/admin', element: <App />, children: [{ path: 'dashboard', element: <AdminDashboard /> }, { path: 'users', element: <Users /> }, { path: 'devices', element: <Devices /> }, { path: 'reports', element: <Reports /> }, { path: 'settings', element: <Settings /> }, { path: '', element: <Navigate to='dashboard' replace /> }] }] },
  { element: <ProtectedRoute allowedRoles={['Controller']} />, children: [{ path: '/controller', element: <App />, children: [{ path: 'dashboard', element: <ControllerDashboard /> }, { path: 'assigned-devices', element: <AssignedDevices /> }, { path: 'reports', element: <Reports /> }, { path: 'settings', element: <Settings /> }, { path: 'device/:id', element: <DeviceDetails /> }, { path: '', element: <Navigate to='dashboard' replace /> }] }] },
]);
