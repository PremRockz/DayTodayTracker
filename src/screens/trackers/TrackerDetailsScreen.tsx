import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, TextInput, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  ArrowLeft,
  CheckCircle2,
  Check,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  Trash2,
  Droplet,
  IndianRupee,
  Info,
  RotateCw,
  History,
  CalendarCheck,
  Plus,
} from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll, upsertRecord } from '../../services/localStore';
import {
  getLogsForTracker,
  todayKey,
  DailyLogRecord,
  belongsToCurrentCycle,
  isManualEntryTracker,
  logTrackerEntry,
  logTrackerToday,
} from '../../services/dailyLogs';
import { recordCyclePayment } from '../../services/cyclePayments';
import { computeAllowanceMonthTotal } from '../../services/allowance';
import { computeLoanInterestBreakdown } from '../../services/loanInterest';
import {
  occurrenceThisYear,
  daysBetween,
  ageOnOccurrence,
  isMemberWished,
  wishBirthdayMember,
  memberNameById,
} from '../../services/birthdays';
import { TRACKER_ICON_MAP } from '../../constants/trackerIcons';
import { DEFAULT_QUANTITY_OPTIONS, styles as actionCardStyles } from '../../components/TrackerActionCard';
import { BottomSheet } from '../../components/BottomSheet';
import { toLocalDateKey } from '../../utils/date';
import { formatIndianNumber } from '../../utils/number';

const RECENT_LIMIT = 40;
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Other'];

const formatLogDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const shiftDateKey = (dateStr: string, deltaDays: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
};

// balance = expected - paid; positive means still owed (green, a saving), negative means overpaid (red, extra paid).
const describeBalance = (balance: number): { label: string; value: number; isExtra: boolean } => ({
  label: balance < 0 ? 'Extra Paid' : 'Remaining Balance',
  value: Math.abs(balance),
  isExtra: balance < 0,
});

interface HistoryDayRow {
  date: string;
  log?: DailyLogRecord;
}

// Walks backward day-by-day from today so gaps with no log show as "Missed" instead of silently disappearing.
const buildDailyHistoryRows = (tracker: any, logs: DailyLogRecord[]): HistoryDayRow[] => {
  const cycleStartAt = tracker.startDate || tracker.createdAt;
  const startDateStr = toLocalDateKey(new Date(cycleStartAt));
  // Excludes logs recorded before the current cycle started, so a same-day cycle restart
  // doesn't show a prior (already-paid) cycle's log as if it belonged to the new one.
  const logsByDate = new Map(
    logs.filter((log) => belongsToCurrentCycle(log, cycleStartAt, startDateStr)).map((log) => [log.date, log])
  );
  const rows: HistoryDayRow[] = [];

  let dateStr = todayKey();
  while (dateStr >= startDateStr) {
    rows.push({ date: dateStr, log: logsByDate.get(dateStr) });
    dateStr = shiftDateKey(dateStr, -1);
  }
  return rows;
};

export const TrackerDetailsScreen = ({ navigation, route }: any) => {
  const { trackerId } = route.params;
  const [tracker, setTracker] = useState<any>(null);
  const [logs, setLogs] = useState<DailyLogRecord[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSheet, setActiveSheet] = useState<'confirmPayment' | 'paymentSaved' | 'startCycle' | 'cancelCycle' | 'logActivity' | 'renewLoan' | 'logAllowanceEntry' | null>(null);
  const [allowanceEntryAmountInput, setAllowanceEntryAmountInput] = useState('');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [savedPayment, setSavedPayment] = useState<{ paidAmount: number; expectedAmount: number; outstanding: number } | null>(null);
  const [targetLitersInput, setTargetLitersInput] = useState('');
  const [pricePerLiterInput, setPricePerLiterInput] = useState('');
  const [newCycleStartDate, setNewCycleStartDate] = useState(new Date());
  const [showNewCycleDatePicker, setShowNewCycleDatePicker] = useState(false);
  const [cancelPaidAmountInput, setCancelPaidAmountInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState(PAYMENT_METHODS[0]);
  const [cancelPaymentMethodInput, setCancelPaymentMethodInput] = useState(PAYMENT_METHODS[0]);
  const [renewInterestInput, setRenewInterestInput] = useState('');
  const [renewDueDate, setRenewDueDate] = useState(new Date());
  const [showRenewDueDatePicker, setShowRenewDueDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const [allTrackers, trackerLogs] = await Promise.all([
            getAll<any>('trackers'),
            getLogsForTracker(trackerId),
          ]);
          setTracker(allTrackers.find((t) => t.id === trackerId) ?? null);
          setLogs(trackerLogs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [trackerId])
  );

  if (loading || !tracker) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnLight}>
            <ArrowLeft size={22} color={defaultTheme.colors.textPrimary} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const kind = tracker.kind ?? 'quantity';
  const IconComponent = TRACKER_ICON_MAP[tracker.iconId] || Trash2;
  const isManualEntry = isManualEntryTracker(tracker);
  const loanBreakdown = kind === 'loan'
    ? computeLoanInterestBreakdown(
        tracker.loanAmount,
        tracker.interestRate,
        tracker.disbursedDate ? new Date(tracker.disbursedDate) : null,
        tracker.startDate ? new Date(tracker.startDate) : null
      )
    : null;

  // Manual Entry trackers have no daily obligation, so walking every day as Missed doesn't apply —
  // they only ever show the activity the user actually chose to log via the button below.
  const useDailyHistory = kind === 'quantity' && !isManualEntry && tracker.status === 'Active' && !tracker.awaitingNewCycle;
  const allDailyRows = useDailyHistory ? buildDailyHistoryRows(tracker, logs) : [];
  const dailyRows = showAll ? allDailyRows : allDailyRows.slice(0, RECENT_LIMIT);

  // A loan's acknowledged reminder (amount 0) is just a nudge, not a history-worthy event —
  // only the money-moving actions (interest renewal, full repayment) belong in Activities.
  // Lead-up acknowledgments are transient daily nudge dismissals, not history-worthy — only actual
  // wishes belong in Activities.
  const displayLogs =
    kind === 'loan'
      ? logs.filter((log) => (log.amount || 0) > 0)
      : kind === 'birthday'
      ? logs.filter((log) => !log.id.includes('_ack_'))
      : logs;
  const hasMoreHistory = useDailyHistory ? allDailyRows.length > RECENT_LIMIT : displayLogs.length > RECENT_LIMIT;
  const visibleLogs = showAll ? displayLogs : displayLogs.slice(0, RECENT_LIMIT);
  // Manual Entry has no daily obligation, so it should never show an unprompted "Today: Pending" row —
  // only actual logged activity (via the button above) should ever appear here. Birthdays have their
  // own per-member status in the Members card above, so this generic "logged something today" check
  // doesn't apply to them either.
  const showPendingToday =
    kind !== 'birthday' && !isManualEntry && tracker.status === 'Active' && !logs.some((log) => log.date === todayKey());

  const isPayAtTarget = kind === 'quantity' && tracker.paymentMethod === 'quantity' && !!tracker.targetQuantity;
  // Manual Entry gets the same Current Cycle card (Collected/Amount Due, Payment Done, Start New Cycle) —
  // it just has no target to reach, so the Remaining stat and progress bar don't apply to it.
  // Allowance has its own "This Month" card below instead — this quantity-shaped card (Collected
  // in units, Payment Done/Cancel Cycle) doesn't apply to a plain expense log.
  const hasCycleTracking = isPayAtTarget || (isManualEntry && kind === 'quantity');
  const entryMode = tracker.entryMode ?? 'manual';
  const allowanceMonth = kind === 'allowance' ? computeAllowanceMonthTotal(tracker.id, logs) : null;
  const allowanceLimit = tracker.monthlyLimit ? parseFloat(tracker.monthlyLimit) : null;
  const allowanceProgressPct =
    allowanceMonth && allowanceLimit ? Math.min(100, Math.round((allowanceMonth.totalSpent / allowanceLimit) * 100)) : 0;
  const target = parseFloat(tracker.targetQuantity) || 0;
  const unitAbbr = tracker.unit ? tracker.unit[0] : '';
  let cycleStartDate = '';
  let collected = 0;
  let amountDue = 0;
  let remaining = 0;
  let progressPct = 0;

  if (hasCycleTracking) {
    const cycleStartAt = tracker.startDate || tracker.createdAt;
    cycleStartDate = toLocalDateKey(new Date(cycleStartAt));
    const cycleLogs = logs.filter(
      (log) => log.status === 'done' && log.quantity && belongsToCurrentCycle(log, cycleStartAt, cycleStartDate)
    );
    collected = cycleLogs.reduce((sum, log) => sum + parseFloat(log.quantity || '0'), 0);
    amountDue = collected * (parseFloat(tracker.price) || 0);
    if (isPayAtTarget) {
      remaining = Math.max(0, target - collected);
      progressPct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
    }
  }

  const targetReached = isPayAtTarget && progressPct >= 100;
  const cyclePaid = !!tracker.cyclePaidAt;
  const canCancelCycle = isPayAtTarget && tracker.status === 'Active' && !cyclePaid && !tracker.awaitingNewCycle;

  const paidAmount = parseFloat(paidAmountInput) || 0;
  const outstandingAmount = amountDue - paidAmount;
  const balanceDisplay = describeBalance(outstandingAmount);
  const savedBalanceDisplay = describeBalance(savedPayment?.outstanding ?? 0);

  const cancelPaidAmount = parseFloat(cancelPaidAmountInput) || 0;
  const cancelOutstandingAmount = amountDue - cancelPaidAmount;
  const cancelBalanceDisplay = describeBalance(cancelOutstandingAmount);

  const handleLogActivity = async (data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }) => {
    const all = await logTrackerEntry(tracker.id, data);
    setLogs(
      all
        .filter((log: DailyLogRecord) => log.trackerId === tracker.id)
        .sort((a: DailyLogRecord, b: DailyLogRecord) => (a.date < b.date ? 1 : -1))
    );
  };

  const openAllowanceEntrySheet = () => {
    if (entryMode === 'daily') {
      const todayLog = logs.find((log) => log.date === todayKey());
      setAllowanceEntryAmountInput(todayLog ? String(todayLog.amount) : '');
    } else {
      setAllowanceEntryAmountInput('');
    }
    setActiveSheet('logAllowanceEntry');
  };

  const handleSaveAllowanceEntry = async () => {
    const amount = parseFloat(allowanceEntryAmountInput);
    if (Number.isNaN(amount) || amount <= 0) return;
    const all =
      entryMode === 'daily'
        ? await logTrackerToday(tracker.id, { status: 'done', amount })
        : await logTrackerEntry(tracker.id, { status: 'done', amount });
    setLogs(
      all
        .filter((log: DailyLogRecord) => log.trackerId === tracker.id)
        .sort((a: DailyLogRecord, b: DailyLogRecord) => (a.date < b.date ? 1 : -1))
    );
    setActiveSheet(null);
    setAllowanceEntryAmountInput('');
  };

  const handleWishMember = async (memberId: string, year: number) => {
    const all = await wishBirthdayMember(tracker.id, memberId, year);
    setLogs(
      all
        .filter((log: DailyLogRecord) => log.trackerId === tracker.id)
        .sort((a: DailyLogRecord, b: DailyLogRecord) => (a.date < b.date ? 1 : -1))
    );
  };

  // The only action that actually closes out a loan — separate from acknowledging its reminder,
  // so a Daily/Weekly/Monthly check-in can never be mistaken for the loan being paid off.
  const handleMarkLoanRepaid = () => {
    const amount = parseFloat(tracker.price) || 0;
    Alert.alert(
      'Mark as Repaid',
      `Record ₹${formatIndianNumber(amount)} as fully repaid for this loan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Repaid',
          onPress: async () => {
            const now = new Date().toISOString();
            // A unique-id entry, not an upsert into today's row — otherwise this would silently
            // overwrite today's acknowledged-reminder log (or an earlier renewal) instead of adding to it.
            const all = await logTrackerEntry(tracker.id, { status: 'done', amount });
            setLogs(
              all
                .filter((log: DailyLogRecord) => log.trackerId === tracker.id)
                .sort((a: DailyLogRecord, b: DailyLogRecord) => (a.date < b.date ? 1 : -1))
            );
            const updatedTrackers = await upsertRecord('trackers', {
              ...tracker,
              loanRepaidAt: now,
              updatedAt: now,
            });
            setTracker(updatedTrackers.find((t: any) => t.id === tracker.id) ?? null);
          },
        },
      ]
    );
  };

  // Renewing pays only the interest for the cycle that just ended and rolls the loan into a new
  // one (new Disbursed Date = the old due date, new Due Date picked by the user) — the loan stays
  // active and un-repaid throughout, distinct from handleMarkLoanRepaid closing it out for good.
  const openRenewLoan = () => {
    setRenewInterestInput(loanBreakdown ? loanBreakdown.totalInterest.toFixed(2) : '');
    const oldDueDate = tracker.startDate ? new Date(tracker.startDate) : new Date();
    const suggestedDueDate = new Date(oldDueDate);
    suggestedDueDate.setMonth(suggestedDueDate.getMonth() + (loanBreakdown?.tenureMonths || 0));
    setRenewDueDate(suggestedDueDate);
    setActiveSheet('renewLoan');
  };

  const openRenewDueDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: renewDueDate,
        mode: 'date',
        onChange: (_e: any, date?: Date) => { if (date) setRenewDueDate(date); },
      });
    } else {
      setShowRenewDueDatePicker(true);
    }
  };

  const handleConfirmRenewLoan = async () => {
    const amount = parseFloat(renewInterestInput) || 0;
    const now = new Date().toISOString();
    const oldDueDate = tracker.startDate;
    // Total Payable must be recalculated for the new cycle — otherwise "Mark as Repaid" would
    // later close the loan out using the previous cycle's now-stale total.
    const newCycleTotalPayable = computeLoanInterestBreakdown(
      tracker.loanAmount,
      tracker.interestRate,
      new Date(oldDueDate),
      renewDueDate
    ).totalPayable;
    // A unique-id entry, not an upsert into today's row — otherwise this would silently
    // overwrite today's acknowledged-reminder log instead of recording the renewal as its own event.
    const all = await logTrackerEntry(tracker.id, { status: 'done', amount });
    setLogs(
      all
        .filter((log: DailyLogRecord) => log.trackerId === tracker.id)
        .sort((a: DailyLogRecord, b: DailyLogRecord) => (a.date < b.date ? 1 : -1))
    );
    const updatedTrackers = await upsertRecord('trackers', {
      ...tracker,
      disbursedDate: oldDueDate,
      startDate: renewDueDate.toISOString(),
      price: newCycleTotalPayable.toFixed(2),
      updatedAt: now,
    });
    setTracker(updatedTrackers.find((t: any) => t.id === tracker.id) ?? null);
    setActiveSheet(null);
  };

  const openConfirmPayment = () => {
    setPaidAmountInput(amountDue ? String(amountDue) : '');
    setPaymentNotesInput('');
    setPaymentMethodInput(PAYMENT_METHODS[0]);
    setActiveSheet('confirmPayment');
  };

  const handleSavePayment = async () => {
    const now = new Date().toISOString();
    const notes = paymentNotesInput.trim() || undefined;
    const updatedTrackers = await upsertRecord('trackers', {
      ...tracker,
      cyclePaidAt: now,
      lastPayment: {
        expectedAmount: amountDue,
        paidAmount,
        outstanding: outstandingAmount,
        notes,
        paidAt: now,
      },
      updatedAt: now,
    });
    setTracker(updatedTrackers.find((t: any) => t.id === tracker.id) ?? null);
    await recordCyclePayment(tracker.id, {
      cycleStartDate,
      cycleEndDate: todayKey(),
      targetQuantity: tracker.targetQuantity,
      unit: tracker.unit,
      price: tracker.price,
      collected,
      expectedAmount: amountDue,
      paidAmount,
      outstanding: outstandingAmount,
      paymentMethod: paymentMethodInput,
      paidAt: now,
      notes,
    });
    setSavedPayment({ paidAmount, expectedAmount: amountDue, outstanding: outstandingAmount });
    setActiveSheet('paymentSaved');
  };

  const openStartNewCycle = () => {
    setTargetLitersInput(tracker.targetQuantity || '');
    setPricePerLiterInput(tracker.price || '');
    setNewCycleStartDate(new Date());
    setActiveSheet('startCycle');
  };

  const openNewCycleDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: newCycleStartDate,
        mode: 'date',
        onChange: (_e: any, date?: Date) => { if (date) setNewCycleStartDate(date); },
      });
    } else {
      setShowNewCycleDatePicker(true);
    }
  };

  const handleConfirmNewCycle = async () => {
    const updatedTrackers = await upsertRecord('trackers', {
      ...tracker,
      startDate: newCycleStartDate.toISOString(),
      targetQuantity: targetLitersInput,
      price: pricePerLiterInput,
      cyclePaidAt: undefined,
      lastPayment: undefined,
      awaitingNewCycle: undefined,
      updatedAt: new Date().toISOString(),
    });
    setTracker(updatedTrackers.find((t: any) => t.id === tracker.id) ?? null);
    setActiveSheet(null);
  };

  const openCancelCycle = () => {
    setCancelPaidAmountInput('');
    setCancelPaymentMethodInput(PAYMENT_METHODS[0]);
    setActiveSheet('cancelCycle');
  };

  const handleCancelCycle = async () => {
    const now = new Date().toISOString();
    await recordCyclePayment(tracker.id, {
      cycleStartDate,
      cycleEndDate: todayKey(),
      targetQuantity: tracker.targetQuantity,
      unit: tracker.unit,
      price: tracker.price,
      collected,
      expectedAmount: amountDue,
      paidAmount: cancelPaidAmount,
      outstanding: cancelOutstandingAmount,
      paymentMethod: cancelPaidAmount > 0 ? cancelPaymentMethodInput : undefined,
      paidAt: cancelPaidAmount > 0 ? now : undefined,
      notes: 'Cycle cancelled before completion',
      cancelled: true,
    });
    const updatedTrackers = await upsertRecord('trackers', {
      ...tracker,
      cyclePaidAt: undefined,
      lastPayment: undefined,
      awaitingNewCycle: true,
      updatedAt: now,
    });
    setTracker(updatedTrackers.find((t: any) => t.id === tracker.id) ?? null);
    setActiveSheet(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{tracker.name}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('TrackerHistory', { trackerId: tracker.id })}
              style={styles.backBtn}
            >
              <History size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconBox, { backgroundColor: tracker.color + '20' }]}>
              <IconComponent size={28} color={tracker.color} />
            </View>
            <View style={styles.summaryInfo}>
              {kind === 'quantity' && tracker.sellerName ? (
                <>
                  <Text style={styles.summaryLabel}>Seller</Text>
                  <Text style={styles.summaryName}>{tracker.sellerName}</Text>
                  {tracker.sellerContact ? (
                    <TouchableOpacity
                      style={styles.summaryPhoneRow}
                      onPress={() => Linking.openURL(`tel:${tracker.sellerContact.replace(/\s+/g, '')}`)}
                    >
                      <Phone size={12} color={defaultTheme.colors.success} />
                      <Text style={styles.summaryPhoneText}>{tracker.sellerContact}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : (
                <Text style={styles.summaryName}>{tracker.name}</Text>
              )}
            </View>
            {kind === 'quantity' && (
              <View style={styles.summaryPriceBlock}>
                <Text style={styles.summaryPrice}>₹{tracker.price}</Text>
                <Text style={styles.summaryPriceUnit}>per {tracker.unit}</Text>
              </View>
            )}
          </View>

          {!!tracker.notes && (
            <View style={styles.notesCard}>
              <Text style={styles.notesCardLabel}>Notes</Text>
              <Text style={styles.notesCardText}>{tracker.notes}</Text>
            </View>
          )}

          {kind === 'birthday' && (
            <View style={styles.notesCard}>
              <Text style={styles.notesCardLabel}>Members</Text>
              {(tracker.members || []).map((member: any) => {
                const occurrence = occurrenceThisYear(member.dateOfBirth);
                const year = occurrence.getFullYear();
                const wished = isMemberWished(tracker.id, member.id, year, logs);
                const daysUntil = daysBetween(new Date(), occurrence);
                const age = ageOnOccurrence(member.dateOfBirth, occurrence);
                const timingLabel = wished
                  ? 'Wished this year'
                  : daysUntil === 0
                  ? 'Today'
                  : daysUntil > 0
                  ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
                  : `${-daysUntil} day${-daysUntil === 1 ? '' : 's'} ago`;
                // Wish is only offered once it's actually due (today or overdue) — while still
                // upcoming, this list is just a status overview with nothing to act on yet.
                const canWish = wished || daysUntil <= 0;
                return (
                  <View key={member.id} style={styles.memberDetailRow}>
                    <View style={styles.memberDetailInfo}>
                      <Text style={styles.memberDetailName}>{member.name}</Text>
                      <Text style={styles.memberDetailTiming}>Turns {age} • {timingLabel}</Text>
                    </View>
                    {canWish && (
                      <TouchableOpacity
                        style={[actionCardStyles.pillBtn, wished ? actionCardStyles.pillBtnDone : actionCardStyles.pillBtnOutline]}
                        onPress={() => handleWishMember(member.id, year)}
                        disabled={wished}
                      >
                        {wished && <Check size={14} color={defaultTheme.colors.primaryDark} />}
                        <Text style={wished ? actionCardStyles.pillBtnTextDone : actionCardStyles.pillBtnTextOutline}>
                          {wished ? 'Wished' : 'Wish'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {kind === 'loan' && loanBreakdown && (
            <View style={styles.sheetSummaryBox}>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Loan Amount</Text>
                <Text style={styles.sheetSummaryValue}>₹{formatIndianNumber(tracker.loanAmount || 0)}</Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Bank Name</Text>
                <Text style={styles.sheetSummaryValue}>{tracker.bankName || '—'}</Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Collateral</Text>
                <Text style={styles.sheetSummaryValue}>{tracker.collateralWeight || 0} {tracker.unit}</Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Interest Rate</Text>
                <Text style={styles.sheetSummaryValue}>{tracker.interestRate || 0}% p.a.</Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Disbursed On</Text>
                <Text style={styles.sheetSummaryValue}>
                  {tracker.disbursedDate ? formatLogDate(toLocalDateKey(new Date(tracker.disbursedDate))) : '—'}
                </Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Due Date</Text>
                <Text style={styles.sheetSummaryValue}>
                  {tracker.startDate ? formatLogDate(toLocalDateKey(new Date(tracker.startDate))) : '—'}
                </Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Interest / Month</Text>
                <Text style={styles.sheetSummaryValue}>
                  ₹{formatIndianNumber(loanBreakdown.monthlyInterest, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>
                  Total Interest ({loanBreakdown.tenureMonths} mo{loanBreakdown.tenureMonths === 1 ? '' : 's'})
                </Text>
                <Text style={styles.sheetSummaryValue}>
                  ₹{formatIndianNumber(loanBreakdown.totalInterest, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Total Payable</Text>
                <Text style={styles.sheetSummaryValue}>₹{formatIndianNumber(tracker.price)}</Text>
              </View>
              {tracker.loanRepaidAt && (
                <View style={styles.sheetSummaryRow}>
                  <Text style={styles.sheetSummaryLabel}>Repaid On</Text>
                  <Text style={[styles.sheetSummaryValue, styles.sheetSummaryPositiveText]}>
                    {formatLogDate(toLocalDateKey(new Date(tracker.loanRepaidAt)))}
                  </Text>
                </View>
              )}
            </View>
          )}

          {kind === 'loan' && !tracker.loanRepaidAt && tracker.status === 'Active' && (
            <>
              <TouchableOpacity style={styles.renewLoanBtn} onPress={openRenewLoan}>
                <RotateCw size={18} color={defaultTheme.colors.primary} />
                <Text style={styles.renewLoanBtnText}>Pay Interest & Renew</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentDoneBtn, styles.markLoanRepaidBtn]}
                onPress={handleMarkLoanRepaid}
              >
                <CheckCircle2 size={18} color="#FFFFFF" />
                <Text style={styles.paymentDoneBtnText}>Mark as Repaid</Text>
              </TouchableOpacity>
            </>
          )}

          {hasCycleTracking && (
            <View style={styles.cycleCard}>
              {tracker.awaitingNewCycle ? (
                <View style={styles.noCycleBox}>
                  <View style={styles.noCycleIconWrap}>
                    <RotateCw size={26} color={defaultTheme.colors.textSecondary} />
                  </View>
                  <Text style={styles.noCycleTitle}>No Active Cycle</Text>
                  <Text style={styles.noCycleDesc}>
                    The previous cycle was cancelled. Start a new cycle to begin tracking again.
                  </Text>
                  <TouchableOpacity style={styles.paymentDoneBtn} onPress={openStartNewCycle}>
                    <RotateCw size={18} color="#FFFFFF" />
                    <Text style={styles.paymentDoneBtnText}>Start New Cycle</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.cycleTitle}>Current Cycle (Started {formatLogDate(cycleStartDate)})</Text>
                  <View style={styles.cycleStatsRow}>
                    <View style={styles.cycleStat}>
                      <Text style={styles.cycleStatValue}>{collected}{unitAbbr}</Text>
                      <Text style={styles.cycleStatLabel}>Collected</Text>
                    </View>
                    <View style={styles.cycleStat}>
                      <Text style={styles.cycleStatValue}>₹{amountDue}</Text>
                      <Text style={styles.cycleStatLabel}>Amount Due</Text>
                    </View>
                    {isPayAtTarget && (
                      <View style={styles.cycleStat}>
                        <Text style={styles.cycleStatValue}>{remaining}{unitAbbr}</Text>
                        <Text style={styles.cycleStatLabel}>Remaining</Text>
                      </View>
                    )}
                  </View>

                  {targetReached && (
                    <View style={styles.targetReachedBox}>
                      <View style={styles.targetReachedHeaderRow}>
                        <View style={styles.targetReachedIconWrap}>
                          <Check size={32} color="#FFFFFF" strokeWidth={3} />
                        </View>
                        <View style={styles.targetReachedHeaderText}>
                          <Text style={styles.targetReachedTitle}>Target Reached! 🎉</Text>
                          <Text style={styles.targetReachedDesc}>
                            You have collected {tracker.targetQuantity} {tracker.unit}.
                          </Text>
                          <Text style={styles.targetReachedDesc}>
                            {cyclePaid
                              ? 'Payment has been recorded for this cycle.'
                              : `Please confirm that the payment has been done${tracker.sellerName ? ` to ${tracker.sellerName}` : ''}.`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.targetReachedStatsRow}>
                        <View style={styles.targetReachedStat}>
                          <View style={styles.targetReachedStatIconWrap}>
                            <Droplet size={16} color={defaultTheme.colors.success} />
                          </View>
                          <Text style={styles.targetReachedStatLabel}>Total {tracker.unit}</Text>
                          <Text style={styles.targetReachedStatValue}>{collected}{unitAbbr}</Text>
                        </View>
                        <View style={styles.targetReachedDivider} />
                        <View style={styles.targetReachedStat}>
                          <View style={styles.targetReachedStatIconWrap}>
                            <IndianRupee size={16} color={defaultTheme.colors.success} />
                          </View>
                          <Text style={styles.targetReachedStatLabel}>Total Amount</Text>
                          <Text style={styles.targetReachedStatValue}>₹{amountDue}</Text>
                        </View>
                      </View>

                      {cyclePaid ? (
                        <TouchableOpacity style={styles.paymentDoneBtn} onPress={openStartNewCycle}>
                          <RotateCw size={18} color="#FFFFFF" />
                          <Text style={styles.paymentDoneBtnText}>Start New Cycle</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <TouchableOpacity style={styles.paymentDoneBtn} onPress={openConfirmPayment}>
                            <CheckCircle2 size={18} color="#FFFFFF" />
                            <Text style={styles.paymentDoneBtnText}>Payment Done (Mark as Paid)</Text>
                          </TouchableOpacity>
                          <View style={styles.paymentDoneNoteRow}>
                            <Info size={12} color={defaultTheme.colors.textSecondary} />
                            <Text style={styles.paymentDoneNote}>We'll mark it as paid in your history</Text>
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  {isPayAtTarget && (
                    <>
                      <View style={styles.cycleTargetRow}>
                        {targetReached ? (
                          <View style={styles.cycleTargetCompletedRow}>
                            <Text style={styles.cycleTargetText}>
                              Target: {tracker.targetQuantity} {tracker.unit}
                            </Text>
                            <View style={styles.completedBadge}>
                              <Text style={styles.completedBadgeText}>Completed</Text>
                            </View>
                          </View>
                        ) : (
                          <Text style={styles.cycleTargetText}>
                            Target: {tracker.targetQuantity} {tracker.unit} (Pay when target is reached)
                          </Text>
                        )}
                      </View>
                      <View style={styles.progressRow}>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                        </View>
                        <Text style={styles.progressPct}>{progressPct}%</Text>
                      </View>
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {kind === 'allowance' && allowanceMonth && (
            <View style={styles.cycleCard}>
              <Text style={styles.cycleTitle}>This Month</Text>
              <View style={styles.cycleStatsRow}>
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatValue}>{allowanceMonth.entryCount}</Text>
                  <Text style={styles.cycleStatLabel}>Entries</Text>
                </View>
                <View style={styles.cycleStat}>
                  <Text style={styles.cycleStatValue}>₹{formatIndianNumber(allowanceMonth.totalSpent)}</Text>
                  <Text style={styles.cycleStatLabel}>Total Spent</Text>
                </View>
                {allowanceLimit !== null && (
                  <View style={styles.cycleStat}>
                    <Text style={styles.cycleStatValue}>
                      ₹{formatIndianNumber(Math.max(allowanceLimit - allowanceMonth.totalSpent, 0))}
                    </Text>
                    <Text style={styles.cycleStatLabel}>Remaining</Text>
                  </View>
                )}
              </View>
              {allowanceLimit !== null && (
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${allowanceProgressPct}%` }]} />
                  </View>
                  <Text style={styles.progressPct}>{allowanceProgressPct}%</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activities</Text>
            <View style={styles.sectionHeaderActions}>
              {hasMoreHistory && !tracker.awaitingNewCycle && (
                <TouchableOpacity onPress={() => setShowAll((v) => !v)}>
                  <Text style={styles.viewAll}>{showAll ? 'Show Less' : 'View All'}</Text>
                </TouchableOpacity>
              )}
              {(isManualEntry || (kind === 'allowance' && entryMode === 'daily')) &&
                tracker.status === 'Active' &&
                !tracker.awaitingNewCycle && (
                  <TouchableOpacity
                    style={styles.addActivityBtn}
                    onPress={() => (kind === 'allowance' ? openAllowanceEntrySheet() : setActiveSheet('logActivity'))}
                  >
                    <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {tracker.awaitingNewCycle ? (
            <Text style={styles.emptyText}>No active cycle. Start a new cycle to begin logging.</Text>
          ) : useDailyHistory ? (
            dailyRows.length === 0 ? (
              <Text style={styles.emptyText}>No activity logged yet.</Text>
            ) : (
              <View style={styles.historyList}>
                {dailyRows.map((row) => {
                  const isToday = row.date === todayKey();
                  const dateLabel = isToday ? 'Today' : formatLogDate(row.date);

                  if (!row.log) {
                    return (
                      <View key={row.date} style={styles.historyRow}>
                        <Text style={styles.historyDate}>{dateLabel}</Text>
                        <Text style={[styles.historyMiddle, isToday ? styles.historyPendingText : styles.historyMissedText]}>
                          {isToday ? 'Pending' : 'Missed'}
                        </Text>
                        <Text style={styles.historyAmount}>—</Text>
                        {isToday ? (
                          <Clock size={20} color={defaultTheme.colors.warning} />
                        ) : (
                          <AlertCircle size={20} color={defaultTheme.colors.error} />
                        )}
                      </View>
                    );
                  }

                  const log = row.log;
                  return (
                    <View key={row.date} style={styles.historyRow}>
                      <Text style={styles.historyDate}>{dateLabel}</Text>
                      <Text style={styles.historyMiddle}>
                        {log.status === 'skipped'
                          ? `0${tracker.unit ? tracker.unit[0] : ''}`
                          : `${log.quantity ?? ''}${tracker.unit ? tracker.unit[0] : ''}`}
                      </Text>
                      <Text style={styles.historyAmount}>{log.amount > 0 ? `₹${formatIndianNumber(log.amount)}` : '—'}</Text>
                      {log.status === 'done' ? (
                        <CheckCircle2 size={20} color={defaultTheme.colors.success} />
                      ) : (
                        <XCircle size={20} color="#CBD5E1" />
                      )}
                    </View>
                  );
                })}
              </View>
            )
          ) : displayLogs.length === 0 && !showPendingToday ? (
            <Text style={styles.emptyText}>No activity logged yet.</Text>
          ) : (
            <View style={styles.historyList}>
              {showPendingToday && (
                <View style={styles.historyRow}>
                  <Text style={styles.historyDate}>Today</Text>
                  <Text style={[styles.historyMiddle, styles.historyPendingText]}>Pending</Text>
                  <Text style={styles.historyAmount}>—</Text>
                  <Clock size={20} color={defaultTheme.colors.warning} />
                </View>
              )}
              {visibleLogs.map((log) => (
                <View key={log.id} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{formatLogDate(log.date)}</Text>
                  <Text style={styles.historyMiddle}>
                    {kind === 'quantity'
                      ? log.status === 'skipped'
                        ? `0${tracker.unit ? tracker.unit[0] : ''}`
                        : `${log.quantity ?? ''}${tracker.unit ? tracker.unit[0] : ''}`
                      : kind === 'birthday'
                      ? `Wished ${memberNameById(tracker, log.memberId || log.id.split('_')[1])}`
                      : kind === 'allowance'
                      ? 'Logged'
                      : log.status === 'done'
                      ? 'Done'
                      : 'Skipped'}
                  </Text>
                  <Text style={styles.historyAmount}>{log.amount > 0 ? `₹${formatIndianNumber(log.amount)}` : '—'}</Text>
                  {log.status === 'done' ? (
                    <CheckCircle2 size={20} color={defaultTheme.colors.success} />
                  ) : (
                    <XCircle size={20} color="#CBD5E1" />
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {canCancelCycle && (
          <View style={styles.cancelCycleFooter}>
            <TouchableOpacity style={styles.cancelCycleBtn} onPress={openCancelCycle}>
              <Trash2 size={18} color={defaultTheme.colors.error} />
              <Text style={styles.cancelCycleBtnText}>Cancel This Cycle</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>

      <BottomSheet visible={activeSheet === 'confirmPayment'} onClose={() => setActiveSheet(null)}>
        <Text style={styles.sheetTitle}>Confirm Payment</Text>

        <View style={styles.sheetStatsRow}>
          <View style={styles.sheetStatBox}>
            <Text style={styles.sheetStatLabel}>Collected {tracker.unit}</Text>
            <Text style={styles.sheetStatValue}>{collected}{unitAbbr}</Text>
          </View>
          <View style={styles.sheetStatBox}>
            <Text style={styles.sheetStatLabel}>Expected Amount</Text>
            <Text style={styles.sheetStatValue}>₹{amountDue}</Text>
          </View>
        </View>

        <Text style={styles.sheetFieldLabel}>How much did you actually pay?</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={paidAmountInput}
            onChangeText={setPaidAmountInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
        </View>

        <View style={styles.sheetSummaryBox}>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Expected Amount</Text>
            <Text style={styles.sheetSummaryValue}>₹{amountDue}</Text>
          </View>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Paid Amount</Text>
            <Text style={styles.sheetSummaryValue}>₹{paidAmount}</Text>
          </View>
          <View style={styles.sheetSummaryRow}>
            <Text style={[styles.sheetSummaryLabel, balanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
              {balanceDisplay.label}
            </Text>
            <Text style={[styles.sheetSummaryValue, balanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
              ₹{balanceDisplay.value}
            </Text>
          </View>
        </View>

        <Text style={styles.sheetFieldLabel}>Payment Method</Text>
        <View style={styles.paymentMethodRow}>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method}
              style={[styles.paymentMethodPill, paymentMethodInput === method && styles.paymentMethodPillActive]}
              onPress={() => setPaymentMethodInput(method)}
            >
              <Text style={[styles.paymentMethodPillText, paymentMethodInput === method && styles.paymentMethodPillTextActive]}>
                {method}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sheetFieldLabel}>Notes (Optional)</Text>
        <TextInput
          style={styles.sheetNotesInput}
          value={paymentNotesInput}
          onChangeText={setPaymentNotesInput}
          placeholder="Add a note"
          placeholderTextColor={defaultTheme.colors.textSecondary}
        />

        <View style={styles.sheetButtonRow}>
          <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setActiveSheet(null)}>
            <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleSavePayment}>
            <Text style={styles.sheetPrimaryBtnText}>Save Payment</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'paymentSaved'} onClose={() => setActiveSheet(null)}>
        <View style={styles.sheetSuccessIconWrap}>
          <Check size={32} color="#FFFFFF" strokeWidth={3} />
        </View>
        <Text style={styles.sheetSuccessTitle}>Payment Saved</Text>
        <Text style={styles.sheetSuccessSubtitle}>Payment has been saved successfully.</Text>

        <View style={styles.sheetSummaryBox}>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Paid Amount</Text>
            <Text style={styles.sheetSummaryValue}>₹{savedPayment?.paidAmount ?? 0}</Text>
          </View>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Expected Amount</Text>
            <Text style={styles.sheetSummaryValue}>₹{savedPayment?.expectedAmount ?? 0}</Text>
          </View>
          <View style={styles.sheetSummaryRow}>
            <Text style={[styles.sheetSummaryLabel, savedBalanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
              {savedBalanceDisplay.label}
            </Text>
            <Text style={[styles.sheetSummaryValue, savedBalanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
              ₹{savedBalanceDisplay.value}
            </Text>
          </View>
        </View>

        <Text style={styles.sheetFieldLabel}>What would you like to do next?</Text>
        <TouchableOpacity
          style={styles.sheetOptionRow}
          onPress={() => {
            setActiveSheet(null);
            openStartNewCycle();
          }}
        >
          <RotateCw size={18} color={defaultTheme.colors.success} />
          <Text style={styles.sheetOptionText}>Start New Cycle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sheetOptionRow}
          onPress={() => {
            setActiveSheet(null);
            navigation.navigate('TrackerHistory', { trackerId: tracker.id });
          }}
        >
          <History size={18} color={defaultTheme.colors.success} />
          <Text style={styles.sheetOptionText}>View History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetLaterBtn} onPress={() => setActiveSheet(null)}>
          <Text style={styles.sheetLaterBtnText}>Later</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'startCycle'} onClose={() => setActiveSheet(null)}>
        <Text style={styles.sheetTitle}>Start New Cycle</Text>

        <Text style={styles.sheetFieldLabel}>Cycle Start Date</Text>
        <TouchableOpacity style={styles.sheetAmountInputRow} onPress={openNewCycleDatePicker}>
          <CalendarCheck size={18} color={defaultTheme.colors.primary} />
          <Text style={[styles.sheetAmountInput, styles.sheetDateInputText]}>
            {formatLogDate(toLocalDateKey(newCycleStartDate))}
          </Text>
        </TouchableOpacity>

        {isPayAtTarget && (
          <>
            <Text style={styles.sheetFieldLabel}>Target {tracker.unit ? `${tracker.unit}${tracker.unit.endsWith('s') ? '' : 's'}` : 'Quantity'}</Text>
            <View style={styles.sheetAmountInputRow}>
              <TextInput
                style={styles.sheetAmountInput}
                value={targetLitersInput}
                onChangeText={setTargetLitersInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={defaultTheme.colors.textSecondary}
              />
              <Text style={styles.sheetAmountSuffix}>{unitAbbr}</Text>
            </View>
          </>
        )}

        <Text style={styles.sheetFieldLabel}>Price per {tracker.unit || 'unit'}</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={pricePerLiterInput}
            onChangeText={setPricePerLiterInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
        </View>

        <View style={styles.sheetInfoBox}>
          <Info size={14} color={defaultTheme.colors.textSecondary} />
          <Text style={styles.sheetInfoText}>These values are prefilled from previous cycle. You can edit if needed.</Text>
        </View>

        <View style={styles.sheetButtonRow}>
          <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setActiveSheet(null)}>
            <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleConfirmNewCycle}>
            <Text style={styles.sheetPrimaryBtnText}>Start New Cycle</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'cancelCycle'} onClose={() => setActiveSheet(null)}>
        <View style={styles.cancelCycleIconWrap}>
          <View style={styles.cancelCycleIconCircle}>
            <Trash2 size={28} color={defaultTheme.colors.error} />
          </View>
          <View style={styles.cancelCycleIconBadge}>
            <AlertCircle size={16} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.sheetSuccessTitle}>Cancel Current Cycle?</Text>
        <Text style={styles.sheetSuccessSubtitle}>This will stop the current cycle. Record any payment already collected below.</Text>

        <View style={styles.sheetSummaryBox}>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Started On</Text>
            <Text style={styles.sheetSummaryValue}>{formatLogDate(cycleStartDate)}</Text>
          </View>
          {isPayAtTarget && (
            <View style={styles.sheetSummaryRow}>
              <Text style={styles.sheetSummaryLabel}>Target</Text>
              <Text style={styles.sheetSummaryValue}>{tracker.targetQuantity} {tracker.unit}</Text>
            </View>
          )}
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Collected</Text>
            <Text style={styles.sheetSummaryValue}>{collected} {tracker.unit}</Text>
          </View>
          <View style={styles.sheetSummaryRow}>
            <Text style={styles.sheetSummaryLabel}>Amount Due</Text>
            <Text style={styles.sheetSummaryValue}>₹{amountDue}</Text>
          </View>
        </View>

        <Text style={styles.sheetFieldLabel}>Amount already paid (if any)</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={cancelPaidAmountInput}
            onChangeText={setCancelPaidAmountInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
        </View>

        {cancelPaidAmount > 0 && (
          <>
            <View style={styles.sheetSummaryBox}>
              <View style={styles.sheetSummaryRow}>
                <Text style={styles.sheetSummaryLabel}>Paid Amount</Text>
                <Text style={styles.sheetSummaryValue}>₹{cancelPaidAmount}</Text>
              </View>
              <View style={styles.sheetSummaryRow}>
                <Text style={[styles.sheetSummaryLabel, cancelBalanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
                  {cancelBalanceDisplay.label}
                </Text>
                <Text style={[styles.sheetSummaryValue, cancelBalanceDisplay.isExtra ? styles.sheetSummaryHighlightText : styles.sheetSummaryPositiveText]}>
                  ₹{cancelBalanceDisplay.value}
                </Text>
              </View>
            </View>

            <Text style={styles.sheetFieldLabel}>Payment Method</Text>
            <View style={styles.paymentMethodRow}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.paymentMethodPill, cancelPaymentMethodInput === method && styles.paymentMethodPillActive]}
                  onPress={() => setCancelPaymentMethodInput(method)}
                >
                  <Text style={[styles.paymentMethodPillText, cancelPaymentMethodInput === method && styles.paymentMethodPillTextActive]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={styles.cancelCycleDangerBtn} onPress={handleCancelCycle}>
          <Text style={styles.cancelCycleDangerBtnText}>Yes, Cancel Cycle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelCycleKeepBtn} onPress={() => setActiveSheet(null)}>
          <Text style={styles.cancelCycleKeepBtnText}>Keep Cycle</Text>
        </TouchableOpacity>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'logActivity'} onClose={() => setActiveSheet(null)}>
        <Text style={styles.sheetTitle}>Log Activity</Text>
        <View style={actionCardStyles.quantityOptions}>
          {(tracker.quantityOptions?.length ? tracker.quantityOptions : DEFAULT_QUANTITY_OPTIONS).map(
            (qty: string) => (
              <TouchableOpacity
                key={qty}
                style={actionCardStyles.qtyBtn}
                onPress={() => {
                  handleLogActivity({
                    status: 'done',
                    quantity: qty,
                    amount: (parseFloat(tracker.price) || 0) * parseFloat(qty),
                  });
                  setActiveSheet(null);
                }}
              >
                <Text style={actionCardStyles.qtyBtnText}>
                  {qty}{tracker.unit ? tracker.unit[0] : ''}
                </Text>
              </TouchableOpacity>
            )
          )}
          <TouchableOpacity
            style={actionCardStyles.qtyBtn}
            onPress={() => {
              handleLogActivity({ status: 'skipped', amount: 0 });
              setActiveSheet(null);
            }}
          >
            <Text style={actionCardStyles.qtyBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'logAllowanceEntry'} onClose={() => setActiveSheet(null)}>
        <Text style={styles.sheetTitle}>{entryMode === 'daily' ? "Log Today's Expense" : 'Log Expense'}</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={allowanceEntryAmountInput}
            onChangeText={setAllowanceEntryAmountInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
            autoFocus
          />
        </View>
        <View style={styles.sheetButtonRow}>
          <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setActiveSheet(null)}>
            <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleSaveAllowanceEntry}>
            <Text style={styles.sheetPrimaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <BottomSheet visible={activeSheet === 'renewLoan'} onClose={() => setActiveSheet(null)}>
        <Text style={styles.sheetTitle}>Pay Interest & Renew</Text>

        <View style={styles.sheetStatsRow}>
          <View style={styles.sheetStatBox}>
            <Text style={styles.sheetStatLabel}>Loan Amount</Text>
            <Text style={styles.sheetStatValue}>₹{formatIndianNumber(tracker.loanAmount || 0)}</Text>
          </View>
          <View style={styles.sheetStatBox}>
            <Text style={styles.sheetStatLabel}>Current Due Date</Text>
            <Text style={styles.sheetStatValue}>
              {tracker.startDate ? formatLogDate(toLocalDateKey(new Date(tracker.startDate))) : '—'}
            </Text>
          </View>
        </View>

        <Text style={styles.sheetFieldLabel}>Interest Amount to Pay</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={renewInterestInput}
            onChangeText={setRenewInterestInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
          />
        </View>

        <Text style={styles.sheetFieldLabel}>New Due Date</Text>
        <TouchableOpacity style={styles.sheetAmountInputRow} onPress={openRenewDueDatePicker}>
          <CalendarCheck size={18} color={defaultTheme.colors.primary} />
          <Text style={[styles.sheetAmountInput, styles.sheetDateInputText]}>
            {formatLogDate(toLocalDateKey(renewDueDate))}
          </Text>
        </TouchableOpacity>

        <View style={styles.sheetInfoBox}>
          <Info size={14} color={defaultTheme.colors.textSecondary} />
          <Text style={styles.sheetInfoText}>
            The loan amount and interest rate stay the same — only the interest above is recorded as
            paid. The loan stays active until you mark it fully repaid.
          </Text>
        </View>

        <View style={styles.sheetButtonRow}>
          <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setActiveSheet(null)}>
            <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleConfirmRenewLoan}>
            <Text style={styles.sheetPrimaryBtnText}>Renew Loan</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {Platform.OS === 'ios' && showNewCycleDatePicker && (
        <Modal transparent animationType="fade">
          <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowNewCycleDatePicker(false)}>
            <View style={styles.iosPickerCard}>
              <Text style={styles.iosPickerTitle}>Select Cycle Start Date</Text>
              <DateTimePicker
                value={newCycleStartDate}
                mode="date"
                display="inline"
                onChange={(_e: any, date?: Date) => { if (date) setNewCycleStartDate(date); }}
              />
              <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowNewCycleDatePicker(false)}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {Platform.OS === 'ios' && showRenewDueDatePicker && (
        <Modal transparent animationType="fade">
          <TouchableOpacity style={styles.iosPickerOverlay} activeOpacity={1} onPress={() => setShowRenewDueDatePicker(false)}>
            <View style={styles.iosPickerCard}>
              <Text style={styles.iosPickerTitle}>Select New Due Date</Text>
              <DateTimePicker
                value={renewDueDate}
                mode="date"
                display="inline"
                onChange={(_e: any, date?: Date) => { if (date) setRenewDueDate(date); }}
              />
              <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowRenewDueDatePicker(false)}>
                <Text style={styles.iosPickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  backBtnLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    margin: defaultTheme.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingBottom: 60,
  },
  cancelCycleFooter: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.sm,
    paddingBottom: defaultTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  cancelCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.error,
  },
  cancelCycleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.error,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: defaultTheme.spacing.sm,
    marginBottom: defaultTheme.spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  notesCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    marginBottom: 6,
  },
  notesCardText: {
    fontSize: 14,
    color: defaultTheme.colors.textPrimary,
    lineHeight: 20,
  },
  memberDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  memberDetailInfo: {
    flex: 1,
    marginRight: 12,
  },
  memberDetailName: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  memberDetailTiming: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  summaryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
    marginLeft: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryName: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 4,
  },
  summaryPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryPhoneText: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
  },
  summaryPriceBlock: {
    alignItems: 'flex-end',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.success,
  },
  summaryPriceUnit: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    marginTop: 2,
  },
  cycleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  cycleTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
    marginBottom: 14,
  },
  noCycleBox: {
    alignItems: 'center',
    paddingVertical: defaultTheme.spacing.sm,
  },
  noCycleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: defaultTheme.colors.cardAlternate,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  noCycleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 6,
  },
  noCycleDesc: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.lg,
  },
  cycleStatsRow: {
    flexDirection: 'row',
  },
  cycleStat: {
    flex: 1,
    alignItems: 'center',
  },
  cycleStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.success,
    marginBottom: 2,
  },
  cycleStatLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  targetReachedBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: defaultTheme.spacing.lg,
    alignItems: 'center',
    marginTop: 14,
  },
  targetReachedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: defaultTheme.spacing.md,
  },
  targetReachedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: defaultTheme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetReachedHeaderText: {
    flex: 1,
    marginLeft: defaultTheme.spacing.md,
  },
  targetReachedTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 6,
  },
  targetReachedDesc: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'left',
  },
  targetReachedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: defaultTheme.spacing.md,
    width: '100%',
    marginTop: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.md,
  },
  targetReachedStat: {
    flex: 1,
    alignItems: 'center',
  },
  targetReachedStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: defaultTheme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  targetReachedDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E2E8F0',
  },
  targetReachedStatLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    marginBottom: 4,
  },
  targetReachedStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  paymentDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: defaultTheme.colors.success,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
  },
  markLoanRepaidBtn: {
    marginBottom: defaultTheme.spacing.lg,
  },
  renewLoanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.primary,
    marginBottom: defaultTheme.spacing.sm,
  },
  renewLoanBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.primary,
  },
  paymentDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paymentDoneNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: defaultTheme.spacing.sm,
  },
  paymentDoneNote: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
  },
  cycleTargetRow: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 14,
    paddingTop: 14,
    alignItems: 'center',
  },
  cycleTargetText: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  cycleTargetCompletedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completedBadge: {
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: defaultTheme.colors.primaryDark,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: defaultTheme.colors.primary,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
    color: defaultTheme.colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.primary,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addActivityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  historyList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  historyDate: {
    flex: 1.3,
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  historyMiddle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  historyPendingText: {
    color: defaultTheme.colors.warning,
  },
  historyMissedText: {
    color: defaultTheme.colors.error,
  },
  historyAmount: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'right',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetStatsRow: {
    flexDirection: 'row',
    gap: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetStatBox: {
    flex: 1,
    backgroundColor: defaultTheme.colors.cardAlternate,
    borderRadius: defaultTheme.borderRadius.md,
    padding: defaultTheme.spacing.md,
  },
  sheetStatLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  sheetStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  sheetFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  sheetAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: defaultTheme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.primary,
    paddingHorizontal: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetAmountPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    marginRight: 4,
  },
  sheetAmountSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  sheetAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    paddingVertical: 12,
  },
  sheetSummaryBox: {
    backgroundColor: defaultTheme.colors.cardAlternate,
    borderRadius: defaultTheme.borderRadius.md,
    padding: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sheetSummaryLabel: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
  },
  sheetSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  sheetSummaryHighlightText: {
    color: defaultTheme.colors.error,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: defaultTheme.spacing.sm,
    marginBottom: defaultTheme.spacing.lg,
  },
  paymentMethodPill: {
    paddingHorizontal: defaultTheme.spacing.md,
    paddingVertical: 8,
    borderRadius: defaultTheme.borderRadius.full,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.border,
  },
  paymentMethodPillActive: {
    backgroundColor: defaultTheme.colors.primary,
    borderColor: defaultTheme.colors.primary,
  },
  paymentMethodPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  paymentMethodPillTextActive: {
    color: '#FFFFFF',
  },
  sheetSummaryPositiveText: {
    color: defaultTheme.colors.success,
  },
  sheetNotesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: defaultTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    paddingHorizontal: defaultTheme.spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetButtonRow: {
    flexDirection: 'row',
    gap: defaultTheme.spacing.md,
  },
  sheetSecondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: defaultTheme.borderRadius.md,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
  },
  sheetSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  sheetPrimaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: defaultTheme.borderRadius.md,
    backgroundColor: defaultTheme.colors.success,
  },
  sheetPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetSuccessIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: defaultTheme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  cancelCycleIconWrap: {
    alignSelf: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  cancelCycleIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelCycleIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: defaultTheme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cancelCycleDangerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: defaultTheme.borderRadius.md,
    backgroundColor: defaultTheme.colors.error,
    marginBottom: defaultTheme.spacing.sm,
  },
  cancelCycleDangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelCycleKeepBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: defaultTheme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: defaultTheme.colors.success,
  },
  cancelCycleKeepBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.success,
  },
  sheetSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetSuccessSubtitle: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: defaultTheme.spacing.sm,
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: defaultTheme.borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.sm,
  },
  sheetOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.primaryDark,
  },
  sheetLaterBtn: {
    alignItems: 'center',
    paddingVertical: defaultTheme.spacing.sm,
  },
  sheetLaterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textSecondary,
  },
  sheetDateInputText: {
    marginLeft: 8,
  },
  sheetInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: defaultTheme.colors.primaryLight,
    borderRadius: defaultTheme.borderRadius.md,
    padding: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.lg,
  },
  sheetInfoText: {
    flex: 1,
    fontSize: 12,
    color: defaultTheme.colors.primaryDark,
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iosPickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  iosPickerDone: {
    marginTop: 16,
    backgroundColor: defaultTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  iosPickerDoneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
