export function formatDate(value, timeZone, dateOnly = false) {
  if (!value) return '—';
  const options = dateOnly
    ? { timeZone, year: 'numeric', month: 'short', day: 'numeric' }
    : { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
  try { return new Intl.DateTimeFormat(undefined, options).format(new Date(value)); }
  catch { return new Date(value).toISOString(); }
}
