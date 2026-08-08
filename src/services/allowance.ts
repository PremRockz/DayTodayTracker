import { getAll, upsertRecord } from './localStore';
import { DailyLogRecord, monthKey } from './dailyLogs';
import { recordCyclePayment } from './cyclePayments';

export const computeAllowanceMonthTotal = (
  trackerId: string,
  logs: DailyLogRecord[]
): { entryCount: number; totalSpent: number } => {
  const month = monthKey();
  const monthLogs = logs.filter((log) => log.trackerId === trackerId && log.date.startsWith(month));
  return {
    entryCount: monthLogs.length,
    totalSpent: monthLogs.reduce((sum, log) => sum + (log.amount || 0), 0),
  };
};

export const lastDateOfMonth = (month: string): string => {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
};

// Allowance trackers reset on the calendar month, not on a target quantity or explicit user
// action — this is the only automatic (non-user-triggered) cycle rollover in the app, so it has
// to be checked on screen load rather than relying on any existing cycle-close handler.
export const syncAllowanceCycles = async (): Promise<void> => {
  const [trackers, logs] = await Promise.all([getAll<any>('trackers'), getAll<DailyLogRecord>('dailyLogs')]);
  const currentMonth = monthKey();
  const now = new Date().toISOString();

  for (const tracker of trackers) {
    if ((tracker.kind ?? 'quantity') !== 'allowance') continue;
    if (!tracker.allowanceCycleMonth || tracker.allowanceCycleMonth === currentMonth) continue;

    const closedMonth = tracker.allowanceCycleMonth;
    const monthLogs = logs.filter((log) => log.trackerId === tracker.id && log.date.startsWith(closedMonth));

    if (monthLogs.length > 0) {
      const totalSpent = monthLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
      const limit = tracker.monthlyLimit ? parseFloat(tracker.monthlyLimit) : null;
      await recordCyclePayment(tracker.id, {
        cycleStartDate: `${closedMonth}-01`,
        cycleEndDate: lastDateOfMonth(closedMonth),
        targetQuantity: tracker.monthlyLimit || '',
        collected: monthLogs.length,
        expectedAmount: limit ?? totalSpent,
        paidAmount: totalSpent,
        outstanding: limit ? Math.max(limit - totalSpent, 0) : 0,
        paymentMethod: tracker.entryMode,
      });
    }

    await upsertRecord('trackers', { ...tracker, allowanceCycleMonth: currentMonth, updatedAt: now });
  }
};
