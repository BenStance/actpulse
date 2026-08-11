// src/pages/public/Login.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useThemeContext } from '../../context/ThemeContext';
import Loader from '../../components/common/Loader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuthStore } from '../../store/auth.store';
import { ROLES } from '../../utils/constants';
import logoImage from '../../assets/images/logo.png';
import { Mail, Lock, ArrowRight, Sun, Moon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('benedict@act-ltd.com');
  const [password, setPassword] = useState('45653211');
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { login, loading } = useAuthStore();
  const { darkMode, toggleTheme, getBrandPrimary, getBrandSecondary } = useThemeContext();

  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setIsAnimating(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login({ email, password });
      const role = data.user.role;
      if (role === ROLES.ADMIN) navigate('/admin/dashboard');
      else if (role === ROLES.CONTROLLER) navigate('/controller/dashboard');
      else navigate('/user/dashboard');
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  if (!mounted) return <Loader fullScreen />;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Gradient Background (same as landing page) */}
      <div className="fixed inset-0 z-0">
        <div className={`absolute inset-0 transition-colors duration-700 ${darkMode
            ? 'bg-gradient-to-br from-slate-900 via-[#0a1a2f] to-slate-900'
            : 'bg-gradient-to-br from-white via-[#ebf2fa] to-white'
          }`} />

        {/* Animated blob 1 */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 80, 0],
            y: [0, -40, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${darkMode ? 'bg-[#064789]' : 'bg-[#427aa1]'
            }`}
        />

        {/* Animated blob 2 */}
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -60, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${darkMode ? 'bg-[#427aa1]' : 'bg-[#064789]'
            }`}
        />

        {/* Subtle grid for dark mode */}
        {darkMode && (
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, ${secondaryColor} 1px, transparent 1px)`,
              backgroundSize: '40px 40px',
            }}
          />
        )}
      </div>

      {/* Particles (lighter than landing page) */}
      <Particles
        id="login-particles"
        init={particlesInit}
        options={{
          background: { color: { value: 'transparent' } },
          fpsLimit: 60,
          interactivity: {
            events: {
              onHover: { enable: true, mode: 'repulse' },
              resize: true,
            },
            modes: { repulse: { distance: 80, duration: 0.4 } },
          },
          particles: {
            color: { value: darkMode ? secondaryColor : primaryColor },
            links: {
              color: darkMode ? secondaryColor : primaryColor,
              distance: 150,
              enable: true,
              opacity: darkMode ? 0.06 : 0.1,
              width: 1,
            },
            move: {
              enable: true,
              speed: 0.5,
              direction: 'none',
              random: true,
              outModes: { default: 'bounce' },
            },
            number: { density: { enable: true, area: 800 }, value: 40 },
            opacity: { value: darkMode ? 0.08 : 0.12 },
            shape: { type: 'circle' },
            size: { value: { min: 1, max: 2 } },
          },
          detectRetina: true,
        }}
        className="fixed inset-0 pointer-events-none z-0"
      />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl backdrop-blur-md shadow-lg transition-all duration-300 border group"
        style={{
          background: darkMode ? 'rgba(6, 71, 137, 0.3)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: darkMode ? `${secondaryColor}50` : `${primaryColor}30`,
        }}
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-400 group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-slate-700 group-hover:rotate-12 transition-transform duration-300" />
        )}
      </button>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className={`w-full max-w-md transition-all duration-700 transform ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}>

          {/* Glassmorphic Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-xl rounded-2xl shadow-2xl p-8 border"
            style={{
              background: darkMode
                ? 'rgba(15, 23, 42, 0.7)'
                : 'rgba(255, 255, 255, 0.85)',
              borderColor: darkMode ? `${secondaryColor}30` : `${primaryColor}20`,
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Logo / Title */}
            <div className="text-center mb-8">
              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ y: { duration: 2.5, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' } }}
                className="relative inline-flex mb-4"
              >
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  aria-label="Go to landing page"
                  className="relative focus:outline-none"
                >
                  <div
                    className="absolute inset-0 rounded-full blur-3xl opacity-40"
                    style={{ background: `radial-gradient(circle, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                  />
                  <div
                    className="absolute inset-0 rounded-full blur-2xl opacity-20"
                    style={{ background: `radial-gradient(circle, ${primaryColor} 0%, transparent 70%)` }}
                  />
                  <img
                    src={logoImage}
                    alt="ACTpulse logo"
                    className="h-28 w-auto sm:h-32 md:h-36 relative z-10 drop-shadow-2xl cursor-pointer"
                    style={{ filter: `drop-shadow(0 0 20px ${primaryColor}80)` }}
                  />
                </button>
              </motion.div>
              <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'
                }`}>
                Welcome Back
              </h1>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'
                }`}>
                Sign in to your ACTpulse account
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`} />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
                >
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-base font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: darkMode ? `0 0 15px ${secondaryColor}80` : `0 4px 15px ${primaryColor}60`,
                }}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </div>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>

              <div className="flex justify-between text-sm mt-6">
                <Link
                  to="/forgot-password"
                  className={`transition-colors hover:underline ${darkMode ? 'text-slate-400 hover:text-[#427aa1]' : 'text-slate-600 hover:text-[#064789]'
                    }`}
                >
                  Forgot password?
                </Link>
                <Link
                  to="/activate-account"
                  className={`transition-colors hover:underline ${darkMode ? 'text-slate-400 hover:text-[#427aa1]' : 'text-slate-600 hover:text-[#064789]'
                    }`}
                >
                  Activate account
                </Link>
              </div>
            </form>
          </motion.div>
        </div>
      </div>

      {/* Subtle bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-20"
        style={{
          background: `linear-gradient(to top, ${darkMode ? 'rgba(2,6,23,0.9)' : 'rgba(255,255,255,0.9)'}, transparent)`
        }}
      />
    </div>
  );
}
