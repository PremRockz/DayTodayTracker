import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll } from '../../services/localStore';
import { getCyclePaymentsForTracker, CyclePaymentRecord } from '../../services/cyclePayments';
import { getLogsForTracker, DailyLogRecord } from '../../services/dailyLogs';
import { toLocalDateKey } from '../../utils/date';

const formatLogDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMonthYear = (dateStr: string): string => {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const STATUS_BADGE: Record<CyclePaymentRecord['status'], { label: string; background: string; color: string }> = {
  paid: { label: 'Paid', background: defaultTheme.colors.successBackground, color: defaultTheme.colors.success },
  partial: { label: 'Partial', background: '#FEF3C7', color: defaultTheme.colors.warning },
  cancelled: { label: 'Cancelled', background: '#FEE2E2', color: defaultTheme.colors.error },
};

export const CycleDetailsScreen = ({ navigation, route }: any) => {
  const { trackerId, cycleId } = route.params;
  const [tracker, setTracker] = useState<any>(null);
  const [cycle, setCycle] = useState<CyclePaymentRecord | null>(null);
  const [entries, setEntries] = useState<DailyLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const [allTrackers, trackerCyclePayments, trackerLogs] = await Promise.all([
            getAll<any>('trackers'),
            getCyclePaymentsForTracker(trackerId),
            getLogsForTracker(trackerId),
          ]);
          const foundCycle = trackerCyclePayments.find((c) => c.id === cycleId) ?? null;
          setTracker(allTrackers.find((t) => t.id === trackerId) ?? null);
          setCycle(foundCycle);
          setEntries(
            foundCycle
              ? trackerLogs
                  .filter((log) => log.date >= foundCycle.cycleStartDate && log.date <= foundCycle.cycleEndDate)
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
              : []
          );
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [trackerId, cycleId])
  );

  if (loading || !cycle) {
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

  const unitAbbr = tracker?.unit ? tracker.unit[0] : '';
  const isCancelled = cycle.status === 'cancelled';
  const isAllowance = tracker?.kind === 'allowance';
  const badge = STATUS_BADGE[cycle.status];
  const pricePerUnit = cycle.price ?? (cycle.collected > 0 ? Math.round(cycle.expectedAmount / cycle.collected) : 0);
  const avgPerEntry = cycle.collected > 0 ? Math.round(cycle.paidAmount / cycle.collected) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tracker ? tracker.name : 'Cycle Details'}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>
              {isCancelled ? 'Cycle Cancelled' : isAllowance ? formatMonthYear(cycle.cycleEndDate) : `Cycle #${cycle.cycleNumber}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: badge.background }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>Started</Text>
              <Text style={styles.gridValue}>{formatLogDate(cycle.cycleStartDate)}</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isCancelled ? 'Cancelled' : 'Completed'}</Text>
              <Text style={styles.gridValue}>{formatLogDate(cycle.cycleEndDate)}</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isAllowance ? 'Monthly Limit' : 'Target'}</Text>
              <Text style={styles.gridValue}>
                {isAllowance
                  ? cycle.targetQuantity
                    ? `₹${cycle.targetQuantity}`
                    : 'No Limit'
                  : `${cycle.targetQuantity}${tracker?.unit ? ` ${tracker.unit}` : ''}`}
              </Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isAllowance ? 'Entries Logged' : 'Collected'}</Text>
              <Text style={styles.gridValue}>{cycle.collected}{isAllowance ? '' : tracker?.unit ? ` ${tracker.unit}` : ''}</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isAllowance ? 'Avg / Entry' : `Price${tracker?.unit ? ` / ${tracker.unit}` : ''}`}</Text>
              <Text style={styles.gridValue}>₹{isAllowance ? avgPerEntry : pricePerUnit}</Text>
            </View>
            {!isAllowance && (
              <View style={styles.gridBox}>
                <Text style={styles.gridLabel}>Expected Amount</Text>
                <Text style={styles.gridValue}>₹{cycle.expectedAmount}</Text>
              </View>
            )}
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isAllowance ? 'Total Spent' : 'Paid Amount'}</Text>
              <Text style={styles.gridValue}>₹{cycle.paidAmount}</Text>
            </View>
            <View style={styles.gridBox}>
              <Text style={styles.gridLabel}>{isAllowance ? 'Remaining' : 'Outstanding'}</Text>
              <Text style={styles.gridValue}>₹{cycle.outstanding}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{isAllowance ? 'Entries' : 'Collection Entries'}</Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>No entries logged in this cycle.</Text>
          ) : (
            <View style={styles.entriesList}>
              {entries.map((entry) => (
                <View key={entry.id} style={styles.entryRow}>
                  <Text style={styles.entryDate}>{formatLogDate(entry.date)}</Text>
                  <Text style={styles.entryMiddle}>
                    {isAllowance
                      ? '—'
                      : entry.status === 'skipped'
                      ? `0${unitAbbr}`
                      : `${entry.quantity ?? ''}${unitAbbr}`}
                  </Text>
                  <Text style={styles.entryAmount}>{entry.amount > 0 ? `₹${entry.amount}` : '—'}</Text>
                  {entry.status === 'done' ? (
                    <CheckCircle2 size={18} color={defaultTheme.colors.success} />
                  ) : (
                    <XCircle size={18} color="#CBD5E1" />
                  )}
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>{isAllowance ? 'Month Summary' : 'Payment Details'}</Text>
          <View style={styles.detailsBox}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>{isAllowance ? 'Total Spent' : 'Paid Amount'}</Text>
              <Text style={styles.detailsValue}>₹{cycle.paidAmount}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>{isAllowance ? 'Closed On' : 'Payment Date'}</Text>
              <Text style={styles.detailsValue}>
                {isAllowance
                  ? formatLogDate(cycle.cycleEndDate)
                  : cycle.paidAt
                  ? formatLogDate(toLocalDateKey(new Date(cycle.paidAt)))
                  : '—'}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>{isAllowance ? 'Entry Mode' : 'Payment Method'}</Text>
              <Text style={styles.detailsValue}>
                {isAllowance ? (cycle.paymentMethod === 'daily' ? 'Daily Entry' : 'Manual Entry') : cycle.paymentMethod ?? '—'}
              </Text>
            </View>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Notes</Text>
              <Text style={styles.detailsValue}>{cycle.notes ?? '—'}</Text>
            </View>
          </View>
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
  backBtnLight: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    margin: defaultTheme.spacing.md,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: defaultTheme.spacing.lg,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  statusBadge: {
    borderRadius: defaultTheme.borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: defaultTheme.spacing.sm,
    marginBottom: defaultTheme.spacing.lg,
  },
  gridBox: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: defaultTheme.colors.cardAlternate,
    borderRadius: defaultTheme.borderRadius.md,
    padding: defaultTheme.spacing.md,
  },
  gridLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    marginBottom: defaultTheme.spacing.lg,
  },
  entriesList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    marginBottom: defaultTheme.spacing.lg,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  entryDate: {
    flex: 1.3,
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  entryMiddle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  entryAmount: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'right',
  },
  detailsBox: {
    backgroundColor: defaultTheme.colors.cardAlternate,
    borderRadius: defaultTheme.borderRadius.md,
    padding: defaultTheme.spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailsLabel: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
  },
  detailsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
});
