// src/pages/admin/AdminDashboard.jsx
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Zap, 
  Cpu, 
  Power, 
  PowerOff, 
  TrendingUp,
  Clock,
  AlertCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { useThemeContext } from '../../context/ThemeContext';
import PageContainer from '../../components/layout/PageContainer';
import ActivityTimeline from '../../components/charts/ActivityTimeline';
import DowntimeChart from '../../components/charts/DowntimeChart';
import StatusPie from '../../components/charts/StatusPie';
import UptimeChart from '../../components/charts/UptimeChart';
import { getSocket } from '../../components/realtime/socket';
import { useDeviceStore } from '../../store/device.store';
import { SOCKET_EVENTS } from '../../utils/constants';

// Modern Stat Card Component with proper dark mode text
function StatCard({ label, value, icon: Icon, trend, color, delay = 0 }) {
  const { darkMode } = useThemeContext();
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`
        relative overflow-hidden rounded-2xl p-5 transition-all duration-300
        backdrop-blur-md border group
        ${darkMode 
          ? 'bg-slate-800/50 border-slate-700 hover:border-[#427aa1]/70 hover:shadow-lg hover:shadow-[#427aa1]/10' 
          : 'bg-white/80 border-slate-200 hover:border-[#064789]/40 hover:shadow-lg'
        }
      `}
    >
      {/* Animated gradient line */}
      <div 
        className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r transition-all duration-500 group-hover:h-1.5"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}80, ${color})` }}
      />
      
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
            {value}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">{trend}</span>
            </div>
          )}
        </div>
        <div 
          className="rounded-xl p-2 transition-all duration-300 group-hover:scale-110"
          style={{ background: `${color}15` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

// Modern Loading Skeleton with shimmer effect
function DashboardSkeleton() {
  const { darkMode } = useThemeContext();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className={`h-32 rounded-2xl animate-pulse ${
              darkMode ? 'bg-slate-800/60' : 'bg-slate-200'
            }`} 
          />
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className={`h-80 rounded-2xl animate-pulse ${
              darkMode ? 'bg-slate-800/60' : 'bg-slate-200'
            }`} 
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { darkMode, getBrandPrimary, getBrandSecondary } = useThemeContext();
  const { 
    summary, 
    uptime, 
    downtime, 
    activity, 
    loadDashboard, 
    applyRealtimeStatus,
    loading 
  } = useDeviceStore();

  const primaryColor = getBrandPrimary?.() || '#064789';
  const secondaryColor = getBrandSecondary?.() || '#427aa1';

  const cardColors = {
    total: primaryColor,
    active: secondaryColor,
    online: '#10b981',
    on: secondaryColor,
    off: '#E03A3A'
  };

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onStatus = (payload) => applyRealtimeStatus(payload);
    socket.on(SOCKET_EVENTS.STATUS_UPDATED, onStatus);
    return () => socket.off(SOCKET_EVENTS.STATUS_UPDATED, onStatus);
  }, [applyRealtimeStatus]);

  if (loading && !summary) {
    return (
      <PageContainer title="Admin Dashboard" subtitle="Real‑time fleet visibility">
        <DashboardSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer 
      title="Admin Dashboard" 
      subtitle="Real‑time generator & UPS fleet visibility"
      actions={[
        { label: 'Export Report', icon: Download, variant: 'secondary', onClick: () => console.log('export') },
        { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => loadDashboard() }
      ]}
    >
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 pb-8">
        <StatCard 
          label="Total Devices" 
          value={summary?.totalDevices ?? 0} 
          icon={Cpu}
          color={cardColors.total}
          trend="+12% this month"
          delay={0.05}
        />
        <StatCard 
          label="Active Devices" 
          value={summary?.activeDevices ?? 0} 
          icon={Activity}
          color={cardColors.active}
          delay={0.1}
        />
        <StatCard 
          label="Online" 
          value={summary?.onlineDevices ?? 0} 
          icon={Zap}
          color={cardColors.online}
          trend={`${summary?.onlineDevices ? Math.round((summary.onlineDevices / summary.totalDevices) * 100) : 0}% uptime`}
          delay={0.15}
        />
        <StatCard 
          label="Currently ON" 
          value={summary?.onCount ?? 0} 
          icon={Power}
          color={cardColors.on}
          delay={0.2}
        />
        <StatCard 
          label="Currently OFF" 
          value={summary?.offCount ?? 0} 
          icon={PowerOff}
          color={cardColors.off}
          delay={0.25}
        />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Uptime Chart Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`
            rounded-2xl p-5 backdrop-blur-md border transition-all duration-300
            hover:shadow-xl
            ${darkMode 
              ? 'bg-slate-800/50 border-slate-700 hover:border-[#427aa1]/30' 
              : 'bg-white/80 border-slate-200 hover:border-[#064789]/20'
            }
          `}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Uptime Trend
            </h3>
            <Clock size={18} className="text-[#064789] dark:text-[#427aa1]" />
          </div>
          <UptimeChart data={uptime} />
        </motion.div>

        {/* Downtime Chart Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`
            rounded-2xl p-5 backdrop-blur-md border transition-all duration-300
            hover:shadow-xl
            ${darkMode 
              ? 'bg-slate-800/50 border-slate-700 hover:border-[#427aa1]/30' 
              : 'bg-white/80 border-slate-200 hover:border-[#064789]/20'
            }
          `}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Downtime Analysis
            </h3>
            <AlertCircle size={18} className="text-[#E03A3A]" />
          </div>
          <DowntimeChart data={downtime} />
        </motion.div>

        {/* Status Pie Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`
            rounded-2xl p-5 backdrop-blur-md border transition-all duration-300
            hover:shadow-xl
            ${darkMode 
              ? 'bg-slate-800/50 border-slate-700 hover:border-[#427aa1]/30' 
              : 'bg-white/80 border-slate-200 hover:border-[#064789]/20'
            }
          `}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Current Status Distribution
            </h3>
            <Power size={18} className="text-[#E63F2E]" />
          </div>
          <StatusPie 
            onCount={summary?.onCount ?? 0} 
            offCount={summary?.offCount ?? 0} 
          />
        </motion.div>

        {/* Activity Timeline Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`
            rounded-2xl p-5 backdrop-blur-md border transition-all duration-300
            hover:shadow-xl
            ${darkMode 
              ? 'bg-slate-800/50 border-slate-700 hover:border-[#427aa1]/30' 
              : 'bg-white/80 border-slate-200 hover:border-[#064789]/20'
            }
          `}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              Recent Activity Timeline
            </h3>
            <Activity size={18} className="text-[#427aa1]" />
          </div>
          <ActivityTimeline data={activity} />
        </motion.div>
      </div>

      {/* Live Status Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className={`
          mt-4 rounded-2xl p-4 backdrop-blur-md border
          ${darkMode 
            ? 'bg-slate-800/40 border-slate-700' 
            : 'bg-white/60 border-slate-200'
          }
        `}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Live Feed Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real‑time WebSocket connected · Device state changes update instantly
          </p>
        </div>
      </motion.div>
    </PageContainer>
  );
}
