import { createBrowserRouter, Navigate } from 'react-router-dom';
import Landing from '../pages/public/Landing';
import Login from '../pages/public/Login';
import ForgotPassword from '../pages/public/ForgotPassword';
import ResetPassword from '../pages/public/ResetPassword';
import ActivateAccount from '../pages/public/ActivateAccount';
import AdminDashboard from '../pages/admin/AdminDashboard';
import Users from '../pages/admin/Users';
import Devices from '../pages/admin/Devices';
import Reports from '../pages/shared/ReportsWorkspace';
import Settings from '../pages/admin/Settings';
import ControllerDashboard from '../pages/controller/ControllerDashboard';
import AssignedDevices from '../pages/controller/AssignedDevices';
import DeviceDetails from '../pages/controller/DeviceDetails';
import AccountProfile from '../pages/shared/AccountProfile';
import Organizations from '../pages/admin/Organizations';
import Sites from '../pages/shared/Sites';
import Equipment from '../pages/shared/Equipment';
import EquipmentDetails from '../pages/shared/EquipmentDetails';
import Fuel from '../pages/shared/Fuel';
import Maintenance from '../pages/shared/Maintenance';
import Alerts from '../pages/shared/Alerts';
import Notifications from '../pages/shared/Notifications';
import SubscriptionControl from '../pages/shared/SubscriptionControl';
import BillingWorkspace from '../pages/shared/BillingWorkspace';
import CustomerActivity from '../pages/shared/CustomerActivity';
import PlatformBilling from '../pages/admin/PlatformBilling';
import AuditLogs from '../pages/admin/AuditLogs';
import AppErrorPage from '../pages/shared/AppErrorPage';
import ProtectedRoute from './ProtectedRoute';
import App from './App';

const adminPages = [
  { path: 'dashboard', element: <AdminDashboard /> },
  { path: 'organizations', element: <Organizations /> },
  { path: 'platform-billing', element: <PlatformBilling /> },
  { path: 'audit-logs', element: <AuditLogs /> },
  { path: 'sites', element: <Sites /> },
  { path: 'sites/:id', element: <Sites /> },
  { path: 'equipment', element: <Equipment /> },
  { path: 'equipment/:id', element: <EquipmentDetails /> },
  { path: 'fuel', element: <Fuel /> },
  { path: 'maintenance', element: <Maintenance /> },
  { path: 'alerts', element: <Alerts /> },
  { path: 'notifications', element: <Notifications /> },
  { path: 'users', element: <Users /> },
  { path: 'devices', element: <Devices /> },
  { path: 'reports', element: <Reports /> },
  { path: 'settings', element: <Settings /> },
  { path: 'profile', element: <AccountProfile /> },
  { path: 'account-security', element: <Navigate to="/admin/profile?tab=security" replace /> },
  { index: true, element: <Navigate to="dashboard" replace /> },
];

const controllerPages = [
  { path: 'dashboard', element: <ControllerDashboard /> },
  { path: 'subscription', element: <SubscriptionControl /> },
  { path: 'billing', element: <BillingWorkspace /> },
  { path: 'activity', element: <CustomerActivity /> },
  { path: 'sites', element: <Sites /> },
  { path: 'sites/:id', element: <Sites /> },
  { path: 'equipment', element: <Equipment /> },
  { path: 'equipment/:id', element: <EquipmentDetails /> },
  { path: 'fuel', element: <Fuel /> },
  { path: 'maintenance', element: <Maintenance /> },
  { path: 'alerts', element: <Alerts /> },
  { path: 'notifications', element: <Notifications /> },
  { path: 'assigned-devices', element: <AssignedDevices /> },
  { path: 'reports', element: <Reports /> },
  { path: 'profile', element: <AccountProfile /> },
  { path: 'account-security', element: <Navigate to="/controller/profile?tab=security" replace /> },
  { path: 'device/:id', element: <DeviceDetails /> },
  { index: true, element: <Navigate to="dashboard" replace /> },
];

export const router = createBrowserRouter([
  { path: '/', element: <Landing />, errorElement: <AppErrorPage /> },
  { path: '/login', element: <Login />, errorElement: <AppErrorPage /> },
  { path: '/forgot-password', element: <ForgotPassword />, errorElement: <AppErrorPage /> },
  { path: '/reset-password', element: <ResetPassword />, errorElement: <AppErrorPage /> },
  { path: '/activate-account', element: <ActivateAccount />, errorElement: <AppErrorPage /> },
  {
    element: <ProtectedRoute allowedRoles={['Admin']} />,
    errorElement: <AppErrorPage />,
    children: [{ path: '/admin', element: <App />, children: adminPages }],
  },
  {
    element: <ProtectedRoute allowedRoles={['Controller']} />,
    errorElement: <AppErrorPage />,
    children: [{ path: '/controller', element: <App />, children: controllerPages }],
  },
  { path: '*', element: <AppErrorPage notFound /> },
]);
