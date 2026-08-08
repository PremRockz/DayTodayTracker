export const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

// Local calendar date as "YYYY-MM-DD". Use this instead of `date.toISOString().slice(0, 10)`
// whenever deriving a day key from a Date/timestamp — toISOString is UTC, so in timezones ahead
// of UTC it reports yesterday's date for several hours after local midnight.
export const toLocalDateKey = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "Today • 9:30 AM" / "Yesterday • 6:20 PM" / "2 Aug • 10:15 AM" — used for note list timestamps.
export const formatRelativeDayTime = (date: Date): string => {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const dayLabel = isSameCalendarDay(date, now)
    ? 'Today'
    : isSameCalendarDay(date, yesterday)
    ? 'Yesterday'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return `${dayLabel} • ${formatTime(date)}`;
};
