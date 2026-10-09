import { useMemo } from 'react';

const STATUS_STYLES = {
  ON: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    label: 'Online',
    icon: '●',
  },
  OFF: {
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300',
    label: 'Offline',
    icon: '○',
  },
  ALERT: {
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    label: 'Alert',
    icon: '▲',
  },
  MAINTENANCE: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    label: 'Maintenance',
    icon: '⚙',
  },
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ActivityTimeline({ data = [], title = 'Recent Activity' }) {
  const normalized = useMemo(
    () =>
      data.map((item) => {
        const status = (item.status || 'OFF').toUpperCase();
        return {
          ...item,
          _status: STATUS_STYLES[status] ? status : 'OFF',
          _style: STATUS_STYLES[status] || STATUS_STYLES.OFF,
        };
      }),
    [data]
  );

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {normalized.length} event{normalized.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>

      {/* List */}
      <div className="max-h-80 flex-1 overflow-y-auto px-3 py-3">
        {normalized.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-slate-800">
              🕒
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No recent activity
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Events will appear here as devices report.
            </p>
          </div>
        ) : (
          <ul className="relative space-y-1">
            {/* vertical timeline line */}
            <span className="pointer-events-none absolute left-[18px] top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-800" />
            {normalized.map((item) => (
              <li
                key={item.id}
                className="group relative flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span
                  className={`relative z-10 mt-1.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${item._style.dot}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {item.deviceName || item.deviceId || 'Unknown device'}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${item._style.badge}`}
                    >
                      {item._style.label}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span title={new Date(item.recordedAt).toLocaleString()}>
                      {timeAgo(item.recordedAt)}
                    </span>
                    <span>·</span>
                    <span className="truncate">
                      {new Date(item.recordedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
