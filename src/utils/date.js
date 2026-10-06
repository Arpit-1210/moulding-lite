// The factory operates in Asia/Kolkata. Every production record is stamped
// with the factory-local date and time at save time, so "today's production"
// means the same thing on the supervisor's phone and the owner's dashboard
// regardless of the device's own timezone or clock.

const FACTORY_TZ = 'Asia/Kolkata';

/** Factory-local calendar date as YYYY-MM-DD, for grouping/filtering. */
export function factoryDateToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FACTORY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Factory-local clock time as HH:MM:SS (24h), for storage. */
export function factoryTimeNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: FACTORY_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.hour}:${map.minute}:${map.second}`;
}

/** Format an ISO timestamp (created_at) as a short factory-local clock time, e.g. "10:42 AM". */
export function formatFactoryClock(isoTimestamp) {
  const d = new Date(isoTimestamp);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: FACTORY_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** Factory-local date N days before today, as YYYY-MM-DD. */
export function factoryDateDaysAgo(days) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FACTORY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Factory-local date for the most recent Monday (start of this week), as YYYY-MM-DD. */
export function factoryStartOfWeek() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: FACTORY_TZ })
  );
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  return factoryDateDaysAgo(diffToMonday);
}

/** Factory-local date for the 1st of this month, as YYYY-MM-DD. */
export function factoryStartOfMonth() {
  const today = factoryDateToday();
  return `${today.slice(0, 7)}-01`;
}

/**
 * Resolves a named range ("today" | "week" | "month") or an explicit
 * { from, to } into concrete { from, to } factory-local date strings.
 */
export function resolveDateRange(range) {
  const today = factoryDateToday();
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') return { from: factoryStartOfWeek(), to: today };
  if (range === 'month') return { from: factoryStartOfMonth(), to: today };
  if (range && range.from && range.to) return range;
  return { from: today, to: today };
}

export { FACTORY_TZ };
