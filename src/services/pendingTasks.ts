import { DailyLogRecord, todayKey, isManualEntryTracker, isRepaidLoanTracker } from './dailyLogs';
import { getMissedMembers } from './birthdays';
import { toLocalDateKey } from '../utils/date';

const daysBetween = (fromDateStr: string, toDateStr: string): number => {
  const [fy, fm, fd] = fromDateStr.split('-').map(Number);
  const [ty, tm, td] = toDateStr.split('-').map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
};

// Collects every consecutive un-logged day immediately before today (most recent first),
// stopping at the first day (going backward) that has a log, or at the tracker's start date.
const missedDayDates = (tracker: any, logs: DailyLogRecord[]): string[] => {
  const loggedDates = new Set(logs.map((log) => log.date));
  const startDateStr = toLocalDateKey(new Date(tracker.startDate || tracker.createdAt));
  // A backdated start date (picked just to describe history) must never make a just-created
  // tracker look instantly behind — never scan for missed days earlier than its actual creation.
  const createdDateStr = toLocalDateKey(new Date(tracker.createdAt));
  const earliestTrackedDate = startDateStr > createdDateStr ? startDateStr : createdDateStr;

  const dates: string[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);
  cursor.setHours(0, 0, 0, 0);

  while (toLocalDateKey(cursor) >= earliestTrackedDate) {
    const key = toLocalDateKey(cursor);
    if (loggedDates.has(key)) break;
    dates.push(key);
    cursor.setDate(cursor.getDate() - 1);
  }
  return dates;
};

export interface PendingInfo {
  pending: boolean;
  daysBehind: number;
  missedDates: string[];
}

export const computePendingInfo = (tracker: any, logs: DailyLogRecord[]): PendingInfo => {
  const kind = tracker.kind ?? 'quantity';

  // Birthdays can have several members overdue on different dates at once — a wish logged today
  // for one member must never clear another member's still-missed birthday, so this bypasses the
  // single "logged something today" short-circuit the other kinds rely on below.
  if (kind === 'birthday') {
    const missed = getMissedMembers(tracker, logs);
    if (missed.length === 0) return { pending: false, daysBehind: 0, missedDates: [] };
    return {
      pending: true,
      daysBehind: Math.max(...missed.map((m) => -m.daysUntil)),
      missedDates: missed.map((m) => toLocalDateKey(m.occurrence)),
    };
  }

  // Allowance spend isn't obligatory day-to-day (unlike milk/newspaper), so a day with nothing
  // logged is never "missed" — this applies regardless of entry mode.
  if (kind === 'allowance') return { pending: false, daysBehind: 0, missedDates: [] };

  const today = todayKey();
  const hasTodayLog = logs.some((log) => log.date === today);
  if (hasTodayLog) return { pending: false, daysBehind: 0, missedDates: [] };

  if (kind === 'quantity') {
    const dates = missedDayDates(tracker, logs);
    return { pending: dates.length > 0, daysBehind: dates.length, missedDates: dates };
  }

  if (!tracker.startDate) return { pending: false, daysBehind: 0, missedDates: [] };
  const dueDate = toLocalDateKey(new Date(tracker.startDate));
  if (dueDate >= today) return { pending: false, daysBehind: 0, missedDates: [] };

  // Loan: overdue status depends only on the explicit "Mark as Repaid" flag — an acknowledged
  // reminder logged on/after the due date must not silently clear the overdue state.
  if (kind === 'loan') {
    if (isRepaidLoanTracker(tracker)) return { pending: false, daysBehind: 0, missedDates: [] };
    return { pending: true, daysBehind: daysBetween(dueDate, today), missedDates: [dueDate] };
  }

  // bill / booking / event: pending once their date has passed with nothing logged since
  const donePastDue = logs.some((log) => log.status === 'done' && log.date >= dueDate);
  if (donePastDue) return { pending: false, daysBehind: 0, missedDates: [] };
  return { pending: true, daysBehind: daysBetween(dueDate, today), missedDates: [dueDate] };
};

export const groupLogsByTracker = (logs: DailyLogRecord[]): Map<string, DailyLogRecord[]> => {
  const map = new Map<string, DailyLogRecord[]>();
  logs.forEach((log) => {
    map.set(log.trackerId, [...(map.get(log.trackerId) || []), log]);
  });
  return map;
};

export interface PendingTrackerEntry {
  tracker: any;
  daysBehind: number;
  missedDates: string[];
}

export const getPendingTrackers = (trackers: any[], logs: DailyLogRecord[]): PendingTrackerEntry[] => {
  const byTracker = groupLogsByTracker(logs);
  return trackers
    .filter((t) => t.status === 'Active' && !t.awaitingNewCycle && !isManualEntryTracker(t) && !isRepaidLoanTracker(t))
    .map((t) => ({ tracker: t, info: computePendingInfo(t, byTracker.get(t.id) || []) }))
    .filter((r) => r.info.pending)
    .map((r) => ({
      tracker: r.tracker,
      daysBehind: r.info.daysBehind,
      missedDates: r.info.missedDates,
    }))
    .sort((a, b) => b.daysBehind - a.daysBehind);
};

// A tracker behind by N days counts as N separate missed tasks (matches the day-grouped Missed Tasks list),
// not one task per tracker.
export const countMissedTasks = (entries: PendingTrackerEntry[]): number =>
  entries.reduce((sum, entry) => sum + entry.missedDates.length, 0);
