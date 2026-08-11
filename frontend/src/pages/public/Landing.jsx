// src/pages/public/Landing.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { useThemeContext } from '../../context/ThemeContext';
import Loader from '../../components/common/Loader';
import {
  Activity,
  Zap,
  BarChart3,
  Bell,
  Shield,
  Sun,
  Moon,
  ArrowRight,
  CheckCircle2,
  Clock,
  Wifi,
  Gauge,
  TrendingUp
} from 'lucide-react';
import logoImage from '../../assets/images/logo.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const { darkMode, toggleTheme, getBrandPrimary, getBrandSecondary, getBrandAccent } = useThemeContext();
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get brand colors from theme context with fallback
  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';
  const accentColor = getBrandAccent?.() || '#ebf2fa';

  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setIsAnimating(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSignIn = () => {
    navigate('/login');
  };

  if (!mounted) return <Loader fullScreen />;

  // Dynamic particle colors based on dark mode
  const particleColor = darkMode ? secondaryColor : primaryColor;
  const particleLinkColor = darkMode ? secondaryColor : primaryColor;

  return (
    <div className="relative min-h-screen h-screen overflow-hidden">
      {/* Animated Gradient Backgrounds */}
      <div className="fixed inset-0 z-0">
        <div className={`absolute inset-0 transition-colors duration-700 ${
          darkMode 
            ? 'bg-gradient-to-br from-slate-900 via-[#0a1a2f] to-slate-900' 
            : 'bg-gradient-to-br from-white via-[#ebf2fa] to-white'
        }`} />
        
        <motion.div
          animate={{ scale: [1, 1.2, 1], x: [0, 100, 0], y: [0, -50, 0] }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute top-1/4 -left-20 w-96 h-96 rounded-full blur-3xl opacity-30 ${
            darkMode ? 'bg-[#064789]' : 'bg-[#427aa1]'
          }`}
        />
        
        <motion.div
          animate={{ scale: [1, 1.3, 1], x: [0, -80, 0], y: [0, 60, 0] }}
          transition={{ duration: 25, repeat: Infinity, repeatType: "reverse" }}
          className={`absolute bottom-1/4 -right-20 w-96 h-96 rounded-full blur-3xl opacity-30 ${
            darkMode ? 'bg-[#427aa1]' : 'bg-[#064789]'
          }`}
        />

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

      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          background: { color: { value: 'transparent' } },
          fpsLimit: 60,
          interactivity: {
            events: {
              onHover: { enable: true, mode: 'repulse' },
              onClick: { enable: true, mode: 'push' },
              resize: true,
            },
            modes: {
              repulse: { distance: 100, duration: 0.4 },
              push: { quantity: 2 },
            },
          },
          particles: {
            color: { value: particleColor },
            links: {
              color: particleLinkColor,
              distance: 150,
              enable: true,
              opacity: darkMode ? 0.08 : 0.12,
              width: 1,
            },
            move: {
              enable: true,
              speed: 0.6,
              direction: 'none',
              random: true,
              straight: false,
              outModes: { default: 'bounce' },
            },
            number: {
              density: { enable: true, area: 800 },
              value: darkMode ? 30 : 50,
            },
            opacity: { value: darkMode ? 0.1 : 0.15 },
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
        className="fixed top-4 right-4 z-50 p-2.5 rounded-xl backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 border group"
        style={{
          background: darkMode ? 'rgba(6, 71, 137, 0.3)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: darkMode ? `${secondaryColor}50` : `${primaryColor}30`,
        }}
        aria-label="Toggle theme"
      >
        {darkMode ? (
          <Sun className="w-5 h-5 text-yellow-400 group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <Moon className="w-5 h-5 text-slate-700 group-hover:rotate-12 transition-transform duration-300" />
        )}
      </button>

      {/* Main Content */}
      <div className="relative z-10 h-screen flex items-center justify-center overflow-y-auto">
        <div className="container mx-auto px-6 py-8">
          <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 transform ${
            isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
          }`}>
            
            {/* Logo */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ y: { duration: 2.5, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' } }}
              className="relative inline-flex mb-8"
            >
              <div className="relative">
                <div 
                  className="absolute inset-0 rounded-full blur-3xl opacity-60"
                  style={{ background: `radial-gradient(circle, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                />
                <div 
                  className="absolute inset-0 rounded-full blur-2xl opacity-40"
                  style={{ background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 70%)` }}
                />
                {logoImage ? (
                  <img
                    src={logoImage}
                    alt="ACTpulse logo"
                    className="h-28 w-auto sm:h-32 md:h-36 lg:h-44 relative z-10 drop-shadow-2xl"
                    style={{ 
                      filter: darkMode 
                        ? `drop-shadow(0 0 25px ${secondaryColor}) drop-shadow(0 0 10px ${primaryColor})`
                        : `drop-shadow(0 0 20px ${primaryColor}80)`
                    }}
                  />
                ) : (
                  <div className={`relative z-10 rounded-2xl p-5 shadow-2xl ${
                    darkMode ? 'bg-slate-800/50 backdrop-blur-md' : 'bg-white'
                  }`}>
                    <Zap className={`w-24 h-24 ${darkMode ? 'text-[#427aa1]' : 'text-[#064789]'}`} strokeWidth={1.5} />
                  </div>
                )}
              </div>
            </motion.div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#064789] via-[#427aa1] to-[#064789] dark:from-[#427aa1] dark:via-[#ebf2fa] dark:to-[#427aa1] animate-gradient">
                ACTpulse
              </span>
            </h1>
            <p className={`text-xl md:text-2xl mb-3 font-medium ${
              darkMode ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Real‑time Generator & UPS Monitoring
            </p>
            
            {/* Feature Cards - Visible only on large screens (desktop) */}
            <div className="hidden lg:grid lg:grid-cols-3 gap-6 mt-4 max-w-6xl mx-auto">
              {[
                { icon: Activity, title: "Live Status", desc: "Real‑time ON/OFF state, voltage, and frequency – updated instantly via WebSockets.", delay: 0.2 },
                { icon: BarChart3, title: "Analytics", desc: "Uptime/downtime charts, historical trends, and exportable reports.", delay: 0.3 },
                { icon: Bell, title: "Smart Alerts", desc: "Instant notifications on state change, prolonged downtime, or maintenance needs.", delay: 0.4 },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: feature.delay }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group p-6 rounded-2xl backdrop-blur-md shadow-lg transition-all duration-300 hover:shadow-2xl cursor-default"
                  style={{ 
                    background: darkMode 
                      ? `linear-gradient(135deg, rgba(6, 71, 137, 0.25), rgba(66, 122, 161, 0.15))`
                      : `linear-gradient(135deg, rgba(6, 71, 137, 0.06), rgba(235, 242, 250, 0.9))`,
                    border: `1px solid ${darkMode ? `${secondaryColor}40` : `${primaryColor}25`}`,
                    backdropFilter: 'blur(16px)'
                  }}
                >
                  <div 
                    className="w-14 h-14 rounded-xl p-3 mb-4 mx-auto transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                      boxShadow: darkMode ? `0 0 15px ${secondaryColor}80` : 'none'
                    }}
                  >
                    <feature.icon className="w-full h-full text-white" strokeWidth={1.8} />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${
                    darkMode ? 'text-white' : 'text-slate-800'
                  }`}>
                    {feature.title}
                  </h3>
                  <p className={`text-sm ${
                    darkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Sign In Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mt-12"
            >
              <button
                onClick={handleSignIn}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-10 py-4 text-base font-bold text-white transition-all duration-300 hover:shadow-2xl hover:scale-105 group relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                  boxShadow: darkMode ? `0 0 20px ${secondaryColor}80` : `0 4px 15px ${primaryColor}60`
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Sign In
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              className="flex flex-wrap items-center justify-center gap-8 mt-12"
            >
              {[
                { icon: CheckCircle2, label: "Real‑time Data" },
                { icon: Clock, label: "99.9% Uptime" },
                { icon: Wifi, label: "ESP32 Ready" },
                { icon: Shield, label: "Enterprise Security" },
                
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" style={{ color: darkMode ? secondaryColor : primaryColor }} />
                  <span className={`text-xs font-medium ${
                    darkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Subtle bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none z-20"
        style={{ 
          background: `linear-gradient(to top, ${darkMode ? 'rgba(2,6,23,0.9)' : 'rgba(255,255,255,0.9)'}, transparent)`
        }}
      />

      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradientShift 3s ease infinite;
        }
      `}</style>
    </div>
  );
}