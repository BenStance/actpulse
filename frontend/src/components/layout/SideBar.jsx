// src/components/layout/Sidebar.jsx
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Cpu,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Activity,
  Menu,
  X,
  Building2,
  CreditCard,
  ScrollText,
  MapPin,
  Wrench,
  Fuel,
  Bell,
  BarChart3,
  UserCog,
  Gauge,
  Radio,
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/auth.store';
import { ROLES } from '../../utils/constants';
import { useSubscriptionStore } from '../../store/subscription.store';
import logoImage from '../../assets/images/logo.png';

// Icon mapping (expanded with distinct, semantic icons)
const iconMap = {
  Dashboard: LayoutDashboard,
  Users: Users,
  Devices: Cpu,
  Monitors: Radio,
  Reports: BarChart3,
  Settings: Settings,
  Organizations: Building2,
  Sites: MapPin,
  Equipment: Gauge,
  Fuel: Fuel,
  Maintenance: Wrench,
  Alerts: Bell,
  Notifications: Bell,
  'Platform Billing': CreditCard,
  'Audit Logs': ScrollText,
  Subscription: CreditCard,
  Billing: FileText,
  Activity: Activity,
  Profile: UserCog,
};

/**
 * Navigation is grouped into sections per role.
 * Each section renders a small uppercase label (hidden when collapsed).
 */
const navigation = {
  [ROLES.ADMIN]: [
    {
      section: 'Overview',
      items: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: 'Dashboard' },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: 'Audit Logs' },
      ],
    },
    {
      section: 'Organization',
      items: [
        { to: '/admin/users', label: 'Users', icon: 'Users' },
        { to: '/admin/organizations', label: 'Organizations', icon: 'Organizations' },
        { to: '/admin/devices', label: 'Devices', icon: 'Devices' },
      ],
    },
    {
      section: 'Operations',
      items: [
        { to: '/admin/sites', label: 'Sites', icon: 'Sites' },
        { to: '/admin/equipment', label: 'Equipment', icon: 'Equipment' },
        { to: '/admin/fuel', label: 'Fuel', icon: 'Fuel' },
        { to: '/admin/maintenance', label: 'Maintenance', icon: 'Maintenance' },
        { to: '/admin/alerts', label: 'Alerts', icon: 'Alerts' },
      ],
    },
    {
      section: 'Business',
      items: [
        { to: '/admin/platform-billing', label: 'Platform Billing', icon: 'Platform Billing' },
        { to: '/admin/reports', label: 'Reports', icon: 'Reports' },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/admin/settings', label: 'Settings', icon: 'Settings' },
        { to: '/admin/profile', label: 'Profile', icon: 'Profile' },
      ],
    },
  ],

  [ROLES.CONTROLLER]: [
    {
      section: 'Overview',
      items: [
        { to: '/controller/dashboard', label: 'Dashboard', icon: 'Dashboard' },
        { to: '/controller/activity', label: 'Activity', icon: 'Activity' },
      ],
    },
    {
      section: 'Operations',
      items: [
        { to: '/controller/sites', label: 'Sites', icon: 'Sites' },
        { to: '/controller/equipment', label: 'Equipment', icon: 'Equipment' },
        { to: '/controller/fuel', label: 'Fuel', icon: 'Fuel' },
        { to: '/controller/maintenance', label: 'Maintenance', icon: 'Maintenance' },
        { to: '/controller/alerts', label: 'Alerts', icon: 'Alerts' },
        { to: '/controller/assigned-devices', label: 'Monitors', icon: 'Monitors' },
      ],
    },
    {
      section: 'Business',
      items: [
        { to: '/controller/subscription', label: 'Subscription', icon: 'Subscription' },
        { to: '/controller/billing', label: 'Billing', icon: 'Billing' },
        { to: '/controller/reports', label: 'Reports', icon: 'Reports' },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/controller/profile', label: 'Profile', icon: 'Profile' },
      ],
    },
  ],
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const subscription = useSubscriptionStore((state) => state.status);
  const { darkMode } = useThemeContext();
  const navigate = useNavigate();

  const orangeAccent = '#E63F2E';

  const roleSections = navigation[user?.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  const sidebarContent = (
    <div className={`flex h-full flex-col ${collapsed ? 'w-20' : 'w-64'} transition-all duration-300`}>
      {/* Brand Header */}
      <div className="flex items-center justify-between py-2 px-4 border-b border-slate-200 dark:border-slate-700 min-h-[60px]">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center"
          >
            <img src={logoImage} alt="ACTpulse" className="pl-2 h-14 w-auto object-contain" />
          </motion.div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <img src={logoImage} alt="ACTpulse" className="h-8 w-8 object-contain" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <button
          onClick={toggleMobile}
          className="md:hidden p-1 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation Links (grouped by section) */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {roleSections.map((group) => (
          <div key={group.section} className="space-y-1">
            {/* Section label */}
            {!collapsed && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.section}
              </p>
            )}
            {collapsed && (
              <div className="mx-auto mb-1 h-px w-6 bg-slate-200 dark:bg-slate-700" />
            )}

            {group.items.map((item) => {
              const Icon = iconMap[item.icon];
              const restricted =
                user?.role === ROLES.CONTROLLER && subscription && !subscription.valid;
              const available = [
                '/controller/subscription',
                '/controller/billing',
                '/controller/profile',
              ];
              const locked = restricted && !available.includes(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={(event) => {
                    setMobileOpen(false);
                    if (locked) {
                      event.preventDefault();
                      navigate('/controller/subscription', {
                        state: { lockedFrom: item.label },
                      });
                    }
                  }}
                  aria-label={
                    locked
                      ? `${item.label}, locked until subscription access is restored`
                      : item.label
                  }
                  className={({ isActive }) => `
                    group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                    transition-all duration-200 hover:scale-105
                    ${collapsed ? 'justify-center' : ''}
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-[#064789]/10 to-[#427aa1]/10 dark:from-[#427aa1]/20 dark:to-[#ebf2fa]/5 text-[#064789] dark:text-[#427aa1] font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                  style={({ isActive }) => ({
                    borderLeft: isActive ? `3px solid ${orangeAccent}` : '3px solid transparent',
                  })}
                >
                  {Icon && <Icon size={20} className="shrink-0" />}
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm"
                    >
                      {item.label}
                      {locked && (
                        <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                          Locked
                        </span>
                      )}
                    </motion.span>
                  )}
                  {collapsed && (
                    <div className="absolute left-full ml-2 hidden group-hover:block z-50 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="border-t border-slate-200 dark:border-slate-700 p-4">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] flex items-center justify-center text-white font-bold">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.role || 'Role'}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={`mt-4 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={toggleMobile}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700"
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col border-r border-slate-200 dark:border-slate-700 transition-all duration-300 ${
          darkMode ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'
        } ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={toggleMobile}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed left-0 top-0 z-50 h-screen flex flex-col shadow-2xl md:hidden ${
                darkMode ? 'bg-slate-900/95 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md'
              } w-64`}
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content offset */}
      <div
        className={`hidden md:block transition-all duration-300 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      />
    </>
  );
}
