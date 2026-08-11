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
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import { useAuthStore } from '../../store/auth.store';

export default function TopBar() {
  const { darkMode, toggleTheme, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState(3); // example count
  const menuRef = useRef(null);

  // const primaryColor = getBrandPrimary?.() || '#064789';
  // const secondaryColor = getBrandSecondary?.() || '#427aa1';
  // const orangeAccent = '#E63F2E';
  // const redAccent = '#E03A3A';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className={`
      sticky top-0 z-30 flex items-center justify-between px-4 md:px-6 py-3
      border-b transition-all duration-300
      ${darkMode 
        ? 'bg-slate-900/80 backdrop-blur-md border-slate-700' 
        : 'bg-white/80 backdrop-blur-md border-slate-200'
      }
    `}>
      {/* Left section: Logo + page indicator (optional) */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className={`hidden sm:inline font-bold text-lg ${
            darkMode ? 'text-white' : 'text-slate-800'
          }`}>
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
        {/* Theme toggle with brand glow */}
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

        {/* Notification bell with badge */}
        <div className="relative">
          <button
            className={`
              p-2 rounded-xl transition-all duration-200 relative
              ${darkMode 
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }
            `}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E03A3A] text-[10px] font-bold text-white">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </button>
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
            <div className={`
              flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br
              from-[#064789] to-[#427aa1] text-white font-bold text-sm
            `}>
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

          {/* Dropdown menu */}
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
                    to="/profile"
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
                    to="/settings"
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
                    <span>Settings</span>
                  </Link>
                  <hr className={`my-1 ${darkMode ? 'border-slate-700' : 'border-slate-100'}`} />
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className={`
                      flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                    `}
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
