import { getAll, upsertRecord, setAll, BaseRecord } from './localStore';

export interface CyclePaymentRecord extends BaseRecord {
  trackerId: string;
  cycleNumber: number;
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string; // YYYY-MM-DD
  targetQuantity: string;
  unit?: string;
  price?: string;
  collected: number;
  expectedAmount: number;
  paidAmount: number;
  outstanding: number;
  status: 'paid' | 'partial' | 'cancelled';
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
}

export const getCyclePaymentsForTracker = async (trackerId: string): Promise<CyclePaymentRecord[]> => {
  const all = await getAll<CyclePaymentRecord>('cyclePayments');
  return all
    .filter((record) => record.trackerId === trackerId)
    .sort((a, b) => b.cycleNumber - a.cycleNumber);
};

// Deleting a tracker should also clear its cycle-payment history for the same reason as
// deleteLogsForTracker — no tracker means no way to ever look these up again.
export const deleteCyclePaymentsForTracker = async (trackerId: string): Promise<CyclePaymentRecord[]> => {
  const all = await getAll<CyclePaymentRecord>('cyclePayments');
  return setAll('cyclePayments', all.filter((record) => record.trackerId !== trackerId));
};

export const recordCyclePayment = async (
  trackerId: string,
  data: {
    cycleStartDate: string;
    cycleEndDate: string;
    targetQuantity: string;
    unit?: string;
    price?: string;
    collected: number;
    expectedAmount: number;
    paidAmount: number;
    outstanding: number;
    paymentMethod?: string;
    paidAt?: string;
    notes?: string;
    cancelled?: boolean;
  }
): Promise<CyclePaymentRecord[]> => {
  const existing = await getCyclePaymentsForTracker(trackerId);
  const cycleNumber = existing.length > 0 ? Math.max(...existing.map((r) => r.cycleNumber)) + 1 : 1;
  const now = new Date().toISOString();
  const { cancelled, ...data_ } = data;
  return upsertRecord<CyclePaymentRecord>('cyclePayments', {
    id: `${trackerId}_cycle_${cycleNumber}`,
    trackerId,
    cycleNumber,
    status: cancelled ? 'cancelled' : data.outstanding > 0 ? 'partial' : 'paid',
    createdAt: now,
    updatedAt: now,
    ...data_,
  });
};
