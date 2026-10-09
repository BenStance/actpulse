// src/pages/public/ResetPassword.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useThemeContext } from '../../context/ThemeContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { authApi } from '../../api/actPulse.Api';
import logoImage from '../../assets/images/logo.png';
import { Mail, Key, Lock, ArrowRight, Sun, Moon, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { darkMode, toggleTheme, getBrandPrimary, getBrandSecondary } = useThemeContext();

  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    const passwordBytes = new TextEncoder().encode(form.newPassword).length;
    if (passwordBytes < 8 || passwordBytes > 72) { setError('Password must be 8 to 72 UTF-8 bytes.'); return; }
    setLoading(true);
    try {
      const { data } = await authApi.resetPassword(form);
      setMsg(data.message || 'Password reset successfully. You can now log in.');
      // Optionally redirect after 2 seconds
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Reset failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 z-0">
        <div className={`absolute inset-0 transition-colors duration-700 ${
          darkMode
            ? 'bg-gradient-to-br from-slate-900 via-[#0a1a2f] to-slate-900'
            : 'bg-gradient-to-br from-white via-[#ebf2fa] to-white'
        }`} />

        {/* Animated blobs */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 80, 0], y: [0, -40, 0] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
            darkMode ? 'bg-[#064789]' : 'bg-[#427aa1]'
          }`}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], x: [0, -60, 0], y: [0, 50, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl opacity-30 ${
            darkMode ? 'bg-[#427aa1]' : 'bg-[#064789]'
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

      {/* Particles */}
      <Particles
        id="reset-particles"
        init={particlesInit}
        options={{
          background: { color: { value: 'transparent' } },
          fpsLimit: 60,
          interactivity: {
            events: { onHover: { enable: true, mode: 'repulse' }, resize: true },
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
            move: { enable: true, speed: 0.5, direction: 'none', random: true, outModes: { default: 'bounce' } },
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
        <div className={`w-full max-w-md transition-all duration-700 transform ${
          isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        }`}>
          {/* Glassmorphic Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="backdrop-blur-xl rounded-2xl shadow-2xl p-8 border"
            style={{
              background: darkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.85)',
              borderColor: darkMode ? `${secondaryColor}30` : `${primaryColor}20`,
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Logo with redirect */}
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
              <h1 className={`text-3xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                Reset Password
              </h1>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Enter your email, OTP, and new password
              </p>
            </div>

            {/* Reset Form */}
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  OTP Code
                </label>
                <div className="relative">
                  <Key className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <Input
                    type="text"
                    value={form.otp}
                    onChange={(e) => setForm({ ...form, otp: e.target.value })}
                    placeholder="6-digit code"
                    className="pl-10"
                    required
                    maxLength={6}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  New Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                  <Input
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {/* Success Message */}
              {msg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p>
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </motion.div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full py-3 text-base font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: darkMode ? `0 0 15px ${secondaryColor}80` : `0 4px 15px ${primaryColor}60`,
                }}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <div className="text-center text-sm mt-4">
                <Link
                  to="/login"
                  className={`transition-colors hover:underline inline-flex items-center gap-1 ${
                    darkMode ? 'text-slate-400 hover:text-[#427aa1]' : 'text-slate-600 hover:text-[#064789]'
                  }`}
                >
                  Back to Sign In
                  <ArrowRight className="w-3 h-3" />
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
