import { getAll, upsertRecord, setAll, BaseRecord } from './localStore';
import { toLocalDateKey } from '../utils/date';
import { generateId } from '../utils/id';

export interface DailyLogRecord extends BaseRecord {
  trackerId: string;
  date: string; // YYYY-MM-DD
  status: 'done' | 'skipped';
  quantity?: string;
  amount: number;
  memberId?: string; // birthday trackers: which member this wish log belongs to
}

const toLocalMonthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const todayKey = (): string => toLocalDateKey(new Date());

export const monthKey = (): string => toLocalMonthKey(new Date());

export const yesterdayKey = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateKey(d);
};

export const lastMonthKey = (): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toLocalMonthKey(d);
};

export const isPayAtTargetTracker = (tracker: any): boolean =>
  (tracker.kind ?? 'quantity') === 'quantity' && tracker.paymentMethod === 'quantity' && !!tracker.targetQuantity;

// Manual Entry trackers have no schedule to be logged against — payments are added by the user
// whenever they choose, so they should never generate a daily action or count as missed/pending.
export const isManualEntryTracker = (tracker: any): boolean => {
  const kind = tracker.kind ?? 'quantity';
  if (kind === 'quantity') return tracker.paymentMethod === 'manual';
  if (kind === 'allowance') return tracker.entryMode === 'manual';
  return false;
};

// A loan is only "repaid" once its Details page's explicit action sets this — an acknowledged
// reminder (Daily/Weekly/Monthly/Yearly) never counts as repayment on its own.
export const isRepaidLoanTracker = (tracker: any): boolean =>
  (tracker.kind ?? 'quantity') === 'loan' && !!tracker.loanRepaidAt;

// A log belongs to a cycle if it's dated after the cycle started, or — for a log dated the same day
// the cycle started — was recorded at/after that exact restart moment. The date-only check matters
// when a cycle is backdated: a log from a later calendar day must count even though its raw timestamp
// can predate the backdated cycleStartAt.
export const belongsToCurrentCycle = (log: DailyLogRecord, cycleStartAt: string, cycleStartDate: string): boolean =>
  log.date > cycleStartDate || (log.date === cycleStartDate && log.updatedAt >= cycleStartAt);

// Whether `log` counts toward `tracker`'s currently-active cycle. For trackers that don't use the
// pay-at-target cycle model, every log for that tracker counts (there's no cycle to scope it to).
export const logBelongsToTrackerCycle = (log: DailyLogRecord, tracker: any): boolean => {
  if (!isPayAtTargetTracker(tracker)) return true;
  const cycleStartAt = tracker.startDate || tracker.createdAt;
  const cycleStartDate = toLocalDateKey(new Date(cycleStartAt));
  return belongsToCurrentCycle(log, cycleStartAt, cycleStartDate);
};

export const getTodaysLogs = async (): Promise<DailyLogRecord[]> => {
  const all = await getAll<DailyLogRecord>('dailyLogs');
  const today = todayKey();
  return all.filter((log) => log.date === today);
};

export const getMonthlyLogs = async (): Promise<DailyLogRecord[]> => {
  const all = await getAll<DailyLogRecord>('dailyLogs');
  const month = monthKey();
  return all.filter((log) => log.date.startsWith(month));
};

export const getLogsForTracker = async (trackerId: string): Promise<DailyLogRecord[]> => {
  const all = await getAll<DailyLogRecord>('dailyLogs');
  return all.filter((log) => log.trackerId === trackerId);
};

export const logTrackerForDate = async (
  trackerId: string,
  date: string,
  data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }
): Promise<DailyLogRecord[]> => {
  const now = new Date().toISOString();
  return upsertRecord<DailyLogRecord>('dailyLogs', {
    id: `${trackerId}_${date}`,
    trackerId,
    date,
    status: data.status,
    quantity: data.quantity,
    amount: data.amount ?? 0,
    createdAt: now,
    updatedAt: now,
  });
};

export const logTrackerToday = (
  trackerId: string,
  data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }
): Promise<DailyLogRecord[]> => logTrackerForDate(trackerId, todayKey(), data);

// Manual Entry has no one-log-per-day rule — each trigger adds a brand new row (unique id) instead
// of upserting on `${trackerId}_${date}`, so logging several times in one day keeps every entry.
export const logTrackerEntry = async (
  trackerId: string,
  data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }
): Promise<DailyLogRecord[]> => {
  const now = new Date().toISOString();
  return upsertRecord<DailyLogRecord>('dailyLogs', {
    id: generateId(),
    trackerId,
    date: todayKey(),
    status: data.status,
    quantity: data.quantity,
    amount: data.amount ?? 0,
    createdAt: now,
    updatedAt: now,
  });
};

// When a tracker's price is edited, past logs already have their amount baked in at the old price —
// they naturally keep it (no-op) unless the user explicitly opts to recalculate all history here.
export const applyPriceChangeToAllLogs = async (
  trackerId: string,
  kind: string,
  newPrice: number
): Promise<DailyLogRecord[]> => {
  const all = await getAll<DailyLogRecord>('dailyLogs');
  const updated = all.map((log) => {
    if (log.trackerId !== trackerId || log.status !== 'done') return log;
    const amount = kind === 'quantity' && log.quantity ? parseFloat(log.quantity) * newPrice : newPrice;
    return { ...log, amount, updatedAt: new Date().toISOString() };
  });
  return setAll('dailyLogs', updated);
};

// Deleting a tracker should also clear its logged history — otherwise these rows linger forever,
// orphaned against a tracker id nothing can look up again.
export const deleteLogsForTracker = async (trackerId: string): Promise<DailyLogRecord[]> => {
  const all = await getAll<DailyLogRecord>('dailyLogs');
  return setAll('dailyLogs', all.filter((log) => log.trackerId !== trackerId));
};
