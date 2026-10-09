// src/components/layout/TopBar.jsx
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  CheckCheck,
  Inbox,
  ChevronRight,
  X,
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/auth.store';
import { ROLES } from '../../utils/constants';
import { notificationsApi } from '../../api/actPulse.Api';
import { getSocket } from '../realtime/socket';

/* ------------------------------------------------------------------ */
/*  Notification helpers                                              */
/* ------------------------------------------------------------------ */
function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TYPE_STYLES = {
  alert:   { dot: 'bg-rose-500',    ring: 'bg-rose-50 dark:bg-rose-500/10' },
  warning: { dot: 'bg-amber-500',   ring: 'bg-amber-50 dark:bg-amber-500/10' },
  success: { dot: 'bg-emerald-500', ring: 'bg-emerald-50 dark:bg-emerald-500/10' },
  info:    { dot: 'bg-sky-500',     ring: 'bg-sky-50 dark:bg-sky-500/10' },
};

/* Normalize whatever shape your API returns into:
   { id, title, body, time, read, type } */
function normalizeNotification(raw) {
  return {
    id: raw.id ?? raw._id ?? Math.random().toString(36).slice(2),
    title: raw.title ?? raw.subject ?? raw.type ?? 'Notification',
    body: raw.body ?? raw.message ?? raw.description ?? '',
    time: raw.createdAt ?? raw.recordedAt ?? raw.timestamp ?? new Date().toISOString(),
    read: raw.read ?? raw.isRead ?? false,
    type: (raw.severity ?? raw.level ?? raw.type ?? 'info').toLowerCase(),
  };
}

/* ------------------------------------------------------------------ */
/*  TopBar                                                            */
/* ------------------------------------------------------------------ */
export default function TopBar() {
  const { darkMode, toggleTheme } = useThemeContext();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(0);       // unread count
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const accountBase = user?.role === ROLES.ADMIN ? '/admin' : '/controller';
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const refreshPreviewRef = useRef(null);

  /* ---------------- Data fetching: count + preview ---------------- */
  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    const refreshCount = () => {
      notificationsApi
        .list({ page: 1, pageSize: 1 })
        .then(({ data }) => {
          if (active) setNotifications(data.unread ?? 0);
        })
        .catch(() => undefined);
    };

    const refreshPreview = () => {
      if (!active) return;
      setNotifLoading(true);
      notificationsApi
        .list({ page: 1, pageSize: 5 })
        .then(({ data }) => {
          if (!active) return;
          const list = data?.items ?? data?.results ?? data?.notifications ?? [];
          setNotifItems(list.map(normalizeNotification));
        })
        .catch(() => undefined)
        .finally(() => {
          if (active) setNotifLoading(false);
        });
    };

    const refreshAll = () => {
      refreshCount();
      refreshPreview();
    };

    // First fetch + interval for count
    const timer = setTimeout(refreshAll, 0);
    const interval = setInterval(refreshCount, 60000);

    // Realtime
    const socket = getSocket();
    socket?.on('alerts.updated', refreshAll);
    window.addEventListener('actpulse:notifications-read', refreshAll);

    // Expose preview refresh so the dropdown can trigger it on open
    refreshPreviewRef.current = refreshPreview;

    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(interval);
      socket?.off('alerts.updated', refreshAll);
      window.removeEventListener('actpulse:notifications-read', refreshAll);
      refreshPreviewRef.current = null;
    };
  }, [user]);

  /* ---------------- Outside click + Escape ---------------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  /* ---------------- Handlers ---------------- */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openNotifications = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) refreshPreviewRef.current?.();
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead?.();
    } catch {
      /* keep going — still update UI optimistically */
    }
    setNotifications(0);
    setNotifItems((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new Event('actpulse:notifications-read'));
  };

  const goToAllNotifications = () => {
    setNotifOpen(false);
    navigate(`${accountBase}/notifications`);
  };

  /* ------------------------------------------------------------------ */
  return (
    <header
      className={`
        sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 py-3
        border-b transition-all duration-300
        ${darkMode
          ? 'bg-slate-900/80 backdrop-blur-md border-slate-700'
          : 'bg-white/80 backdrop-blur-md border-slate-200'
        }
      `}
    >
      {/* Left section: Logo + page indicator */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span
            className={`hidden sm:inline font-bold text-lg ${
              darkMode ? 'text-white' : 'text-slate-800'
            }`}
          >
            ACTpulse
          </span>
        </Link>
        <div className="hidden md:block h-6 w-px bg-slate-300 dark:bg-slate-700" />
        <div className="hidden md:block">
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-300">
            Live Monitor
          </p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-100">
            {user?.role || 'Guest'} Workspace
          </p>
        </div>
      </div>

      {/* Right section: Theme toggle, Notifications, User menu */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className={`
            relative p-2 rounded-xl transition-all duration-200
            ${darkMode
              ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }
          `}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>

        {/* Notification bell with dropdown */}
        <div className="relative" ref={notifRef}>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={openNotifications}
            aria-label={
              notifications > 0
                ? `Notifications, ${notifications} unread`
                : 'Notifications'
            }
            aria-expanded={notifOpen}
            aria-haspopup="true"
            className={`
              relative p-2 rounded-xl transition-all duration-200
              ${darkMode
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
          >
            <Bell size={18} />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#E03A3A] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-900">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <>
                {/* Mobile backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setNotifOpen(false)}
                  className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
                />

                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                  role="menu"
                  className={`
                    z-50 overflow-hidden border shadow-2xl
                    fixed inset-x-3 bottom-3 rounded-2xl
                    md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-96 md:rounded-2xl
                    ${darkMode
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-white border-slate-200'
                    }
                  `}
                >
                  {/* Header */}
                  <div
                    className={`flex items-center justify-between border-b px-4 py-3 ${
                      darkMode ? 'border-slate-700' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <h3
                        className={`text-sm font-semibold ${
                          darkMode ? 'text-slate-100' : 'text-slate-800'
                        }`}
                      >
                        Notifications
                      </h3>
                      {notifications > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#E03A3A] dark:bg-red-500/10">
                          {notifications} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {notifications > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className={`
                            flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors
                            ${darkMode
                              ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                            }
                          `}
                        >
                          <CheckCheck size={14} />
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        aria-label="Close notifications"
                        className={`
                          rounded-lg p-1 transition-colors md:hidden
                          ${darkMode
                            ? 'text-slate-400 hover:bg-slate-700'
                            : 'text-slate-400 hover:bg-slate-100'
                          }
                        `}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* List */}
                  <div className="max-h-[55vh] overflow-y-auto md:max-h-80">
                    {notifLoading && notifItems.length === 0 ? (
                      <div className="flex items-center justify-center px-4 py-8">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#064789] dark:border-slate-700 dark:border-t-[#427aa1]" />
                      </div>
                    ) : notifItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                        <div
                          className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                            darkMode
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Inbox size={22} />
                        </div>
                        <p
                          className={`text-sm font-medium ${
                            darkMode ? 'text-slate-300' : 'text-slate-600'
                          }`}
                        >
                          You're all caught up
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          New notifications will appear here.
                        </p>
                      </div>
                    ) : (
                      <ul
                        className={`divide-y ${
                          darkMode ? 'divide-slate-700' : 'divide-slate-100'
                        }`}
                      >
                        {notifItems.map((n) => {
                          const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
                          return (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setNotifOpen(false);
                                  navigate(`${accountBase}/notifications`);
                                }}
                                className={`
                                  group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                                  ${darkMode ? 'hover:bg-slate-700/60' : 'hover:bg-slate-50'}
                                  ${!n.read ? (darkMode ? 'bg-sky-500/5' : 'bg-sky-50/40') : ''}
                                `}
                              >
                                <div
                                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.ring}`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p
                                      className={`truncate text-sm font-medium ${
                                        darkMode ? 'text-slate-100' : 'text-slate-800'
                                      }`}
                                    >
                                      {n.title}
                                    </p>
                                    {!n.read && (
                                      <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                                    )}
                                  </div>
                                  {n.body && (
                                    <p
                                      className={`mt-0.5 line-clamp-2 text-xs ${
                                        darkMode ? 'text-slate-400' : 'text-slate-500'
                                      }`}
                                    >
                                      {n.body}
                                    </p>
                                  )}
                                  <p
                                    className={`mt-1 text-[10px] font-medium uppercase tracking-wide ${
                                      darkMode ? 'text-slate-500' : 'text-slate-400'
                                    }`}
                                  >
                                    {timeAgo(n.time)}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Footer — View all */}
                  <div
                    className={`border-t px-3 py-2.5 ${
                      darkMode
                        ? 'border-slate-700 bg-slate-800/60'
                        : 'border-slate-100 bg-slate-50/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={goToAllNotifications}
                      className={`
                        group flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors
                        ${darkMode
                          ? 'text-[#427aa1] hover:bg-[#427aa1]/10'
                          : 'text-[#064789] hover:bg-[#064789]/5'
                        }
                      `}
                    >
                      View all notifications
                      <ChevronRight
                        size={16}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* User menu with avatar and dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`
              flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all duration-200
              ${darkMode
                ? 'bg-slate-800 hover:bg-slate-700'
                : 'bg-slate-100 hover:bg-slate-200'
              }
            `}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#064789] to-[#427aa1] text-sm font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-100">
                {user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {user?.role || 'Role'}
              </p>
            </div>
            <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`
                  absolute right-0 mt-2 w-56 rounded-xl shadow-lg border overflow-hidden
                  ${darkMode
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                  }
                `}
              >
                <div className="py-1">
                  <Link
                    to={`${accountBase}/profile`}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                      }
                    `}
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User size={16} />
                    <span>Profile</span>
                  </Link>
                  <Link
                    to={`${accountBase}/profile?tab=security`}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${darkMode
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                      }
                    `}
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings size={16} />
                    <span>Account Security</span>
                  </Link>
                  <hr
                    className={`my-1 ${
                      darkMode ? 'border-slate-700' : 'border-slate-100'
                    }`}
                  />
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
