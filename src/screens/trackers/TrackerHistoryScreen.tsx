import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2, XCircle, ChevronRight } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll } from '../../services/localStore';
import { getLogsForTracker, DailyLogRecord } from '../../services/dailyLogs';
import { getCyclePaymentsForTracker, CyclePaymentRecord } from '../../services/cyclePayments';
import { memberNameById } from '../../services/birthdays';
import { formatIndianNumber } from '../../utils/number';

const formatLogDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMonthYear = (dateStr: string): string => {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

interface CycleMonthGroup {
  label: string;
  cycles: CyclePaymentRecord[];
}

// Cycles arrive sorted newest-first, so months form contiguous runs to fold into.
const groupCyclesByMonth = (cycles: CyclePaymentRecord[]): CycleMonthGroup[] => {
  const groups: CycleMonthGroup[] = [];
  cycles.forEach((cycle) => {
    const label = formatMonthYear(cycle.cycleEndDate);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.cycles.push(cycle);
    } else {
      groups.push({ label, cycles: [cycle] });
    }
  });
  return groups;
};

export const TrackerHistoryScreen = ({ navigation, route }: any) => {
  const { trackerId } = route.params;
  const [tracker, setTracker] = useState<any>(null);
  const [logs, setLogs] = useState<DailyLogRecord[]>([]);
  const [cyclePayments, setCyclePayments] = useState<CyclePaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const [allTrackers, trackerLogs, trackerCyclePayments] = await Promise.all([
            getAll<any>('trackers'),
            getLogsForTracker(trackerId),
            getCyclePaymentsForTracker(trackerId),
          ]);
          setTracker(allTrackers.find((t) => t.id === trackerId) ?? null);
          setLogs(trackerLogs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
          setCyclePayments(trackerCyclePayments);
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [trackerId])
  );

  const kind = tracker?.kind ?? 'quantity';
  const unitAbbr = tracker?.unit ? tracker.unit[0] : '';
  const isPayAtTarget = kind === 'quantity' && tracker?.paymentMethod === 'quantity' && !!tracker?.targetQuantity;
  const isAllowance = kind === 'allowance';
  // Allowance months archive into the same cyclePayments store as pay-at-target cycles, so they
  // share this month-grouped view — just with expense-log labels instead of collection labels.
  const showsCycleHistory = isPayAtTarget || isAllowance;

  const totalCollected = cyclePayments.reduce((sum, c) => sum + c.collected, 0);
  const totalPaid = cyclePayments.reduce((sum, c) => sum + c.paidAmount, 0);
  const totalOutstanding = cyclePayments.reduce((sum, c) => sum + c.outstanding, 0);
  const cycleMonthGroups = groupCyclesByMonth(cyclePayments);
  // A loan's acknowledged reminder (amount 0) is just a nudge, not a history-worthy event —
  // only the money-moving actions (interest renewal, full repayment) belong in History.
  // Lead-up acknowledgments are transient daily nudge dismissals, not history-worthy — only actual
  // wishes belong in History.
  const displayLogs =
    kind === 'loan'
      ? logs.filter((log) => (log.amount || 0) > 0)
      : kind === 'birthday'
      ? logs.filter((log) => !log.id.includes('_ack_'))
      : logs;

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tracker ? `${tracker.name} History` : 'History'}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!loading && showsCycleHistory && (
            <>
              <View style={styles.statsCard}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{cyclePayments.length}</Text>
                  <Text style={styles.statLabel}>{isAllowance ? 'Total Months' : 'Total Cycles'}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{totalCollected}{isAllowance ? '' : unitAbbr}</Text>
                  <Text style={styles.statLabel}>{isAllowance ? 'Total Entries' : 'Total Collected'}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>₹{totalPaid}</Text>
                  <Text style={styles.statLabel}>{isAllowance ? 'Total Spent' : 'Total Paid'}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, totalOutstanding > 0 && styles.statValueWarning]}>₹{totalOutstanding}</Text>
                  <Text style={styles.statLabel}>{isAllowance ? 'Remaining' : 'Outstanding'}</Text>
                </View>
              </View>

              {cyclePayments.length === 0 ? (
                <Text style={styles.emptyText}>{isAllowance ? 'No months closed yet.' : 'No cycles paid yet.'}</Text>
              ) : (
                cycleMonthGroups.map((group) => (
                  <View key={group.label} style={styles.monthGroup}>
                    <Text style={styles.monthHeader}>{group.label}</Text>
                    {group.cycles.map((cycle) => {
                      const isCancelled = cycle.status === 'cancelled';
                      const dateLabel =
                        cycle.cycleStartDate === cycle.cycleEndDate
                          ? formatLogDate(cycle.cycleEndDate)
                          : `${formatLogDate(cycle.cycleStartDate)} - ${formatLogDate(cycle.cycleEndDate)}`;
                      return (
                        <TouchableOpacity
                          key={cycle.id}
                          style={styles.cycleCard}
                          onPress={() => navigation.navigate('CycleDetails', { trackerId, cycleId: cycle.id })}
                        >
                          <View style={[styles.cycleIconWrap, isCancelled ? styles.cycleIconWrapCancelled : styles.cycleIconWrapPaid]}>
                            {isCancelled ? (
                              <XCircle size={22} color={defaultTheme.colors.error} />
                            ) : (
                              <CheckCircle2 size={22} color={defaultTheme.colors.success} />
                            )}
                          </View>
                          <View style={styles.cycleInfo}>
                            <Text style={[styles.cycleTitle, isCancelled && styles.cycleTitleCancelled]}>
                              {isCancelled
                                ? 'Cycle Cancelled'
                                : isAllowance
                                ? formatMonthYear(cycle.cycleEndDate)
                                : `Cycle #${cycle.cycleNumber}`}
                            </Text>
                            <Text style={styles.cycleDateRange}>{dateLabel}</Text>
                          </View>
                          <View style={styles.cycleStat}>
                            <Text style={styles.cycleStatLabel}>{isAllowance ? 'Entries' : 'Collected'}</Text>
                            <Text style={styles.cycleStatValue}>{cycle.collected}{isAllowance ? '' : unitAbbr}</Text>
                          </View>
                          <View style={styles.cycleStat}>
                            <Text style={styles.cycleStatLabel}>{isAllowance ? 'Spent' : 'Price'}</Text>
                            <Text style={styles.cycleStatValue}>₹{cycle.paidAmount}</Text>
                          </View>
                          <ChevronRight size={18} color={defaultTheme.colors.textSecondary} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}

          {!loading && !showsCycleHistory && (
            displayLogs.length === 0 ? (
              <Text style={styles.emptyText}>No activity logged yet.</Text>
            ) : (
              <View style={styles.historyList}>
                {displayLogs.map((log) => (
                  <View key={log.id} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{formatLogDate(log.date)}</Text>
                    <Text style={styles.historyMiddle}>
                      {kind === 'quantity'
                        ? log.status === 'skipped'
                          ? `0${unitAbbr}`
                          : `${log.quantity ?? ''}${unitAbbr}`
                        : kind === 'birthday'
                        ? `Wished ${memberNameById(tracker, log.memberId || log.id.split('_')[1])}`
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
            )
          )}
        </ScrollView>
      </SafeAreaView>
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
    height: 160,
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: defaultTheme.spacing.sm,
    marginBottom: defaultTheme.spacing.lg,
    paddingHorizontal: defaultTheme.spacing.lg,
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
  scrollContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  statsCard: {
    flexDirection: 'row',
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
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultTheme.colors.success,
    marginBottom: 4,
  },
  statValueWarning: {
    color: defaultTheme.colors.error,
  },
  statLabel: {
    fontSize: 11,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  monthGroup: {
    marginBottom: defaultTheme.spacing.sm,
  },
  monthHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  cycleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: defaultTheme.spacing.md,
    marginBottom: defaultTheme.spacing.md,
  },
  cycleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleIconWrapPaid: {
    backgroundColor: defaultTheme.colors.successBackground,
  },
  cycleIconWrapCancelled: {
    backgroundColor: '#FEE2E2',
  },
  cycleInfo: {
    flex: 1.4,
  },
  cycleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  cycleTitleCancelled: {
    color: defaultTheme.colors.error,
  },
  cycleDateRange: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
  },
  cycleStat: {
    flex: 1,
    alignItems: 'center',
  },
  cycleStatLabel: {
    fontSize: 11,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  cycleStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
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
  historyAmount: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'right',
  },
});
