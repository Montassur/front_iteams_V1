/**
 * Format a Date as YYYY-MM-DD using **local** time — so the value matches
 * what the user sees on their wall clock, regardless of timezone offset.
 * Avoid `Date#toISOString().slice(0, 10)` for `<input type="date">` defaults:
 * that returns UTC date and can be off by ±1 day for users near midnight.
 */
export function localDateInputValue(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for today in local time. Convenience wrapper. */
export const todayInputValue = () => localDateInputValue(new Date());

/** YYYY-MM-DD for tomorrow in local time. */
export const tomorrowInputValue = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateInputValue(d);
};

/** HH:mm rounded up to the next quarter-hour, in local time. */
export function nextQuarterHourValue(d: Date = new Date()): string {
  const next = new Date(d);
  const remainder = 15 - (next.getMinutes() % 15);
  next.setMinutes(next.getMinutes() + (remainder === 0 ? 15 : remainder), 0, 0);
  // If rounding pushed us past midnight, clamp back to 23:45 of the same day.
  if (next.getDate() !== d.getDate()) return '23:45';
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
}

/** HH:mm in local time. */
export function localTimeInputValue(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
