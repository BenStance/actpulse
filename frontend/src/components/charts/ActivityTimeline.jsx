export default function ActivityTimeline({ data = [] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Recent Activity</h3>
      <div className="max-h-80 space-y-2 overflow-auto">
        {data.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
            <div className="font-medium text-slate-800 dark:text-slate-100">{item.deviceName || item.deviceId}</div>
            <div className="text-slate-500 dark:text-slate-300">
              {item.status} at {new Date(item.recordedAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
