import { useThemeContext } from '../../context/ThemeContext';

const SIZES = {
  xs: { box: 20, stroke: 2 },
  sm: { box: 28, stroke: 2.5 },
  md: { box: 40, stroke: 3 },
  lg: { box: 56, stroke: 3.5 },
  xl: { box: 72, stroke: 4 },
};

export default function Loader({ size = 'md', fullScreen = false, label, className = '' }) {
  const { getBrandPrimary, getBrandSecondary, darkMode } = useThemeContext();
  const primary = getBrandPrimary?.() || '#064789';
  const secondary = getBrandSecondary?.() || '#427aa1';
  const { box, stroke } = SIZES[size] || SIZES.md;
  const r = (box - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * 0.7;

  const loader = (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="animate-spin">
        <defs>
          <linearGradient id="actpulse-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
        </defs>
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={darkMode ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.08)'}
          strokeWidth={stroke}
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke="url(#actpulse-loader-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      {/* Soft glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-40 blur-md"
        style={{ background: `radial-gradient(circle, ${secondary}55, transparent 70%)` }}
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/40 bg-white/90 px-8 py-6 shadow-2xl backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/90">
          {loader}
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {label || 'Loading…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="inline-flex flex-col items-center gap-2">
      {loader}
      {label && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      )}
    </div>
  );
}