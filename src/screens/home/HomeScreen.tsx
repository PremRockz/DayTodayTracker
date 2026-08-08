import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultTheme } from '../../theme/theme';
import { getAll } from '../../services/localStore';
import {
  logTrackerToday,
  todayKey,
  yesterdayKey,
  monthKey,
  lastMonthKey,
  logBelongsToTrackerCycle,
  isManualEntryTracker,
  isRepaidLoanTracker,
  DailyLogRecord,
} from '../../services/dailyLogs';
import { getPendingTrackers, countMissedTasks, groupLogsByTracker } from '../../services/pendingTasks';
import { getDueSoonMembers, wishBirthdayMember, acknowledgeBirthdayMember } from '../../services/birthdays';
import { syncAllowanceCycles } from '../../services/allowance';
import { TrackerActionCardBody } from '../../components/TrackerActionCard';
import { BottomSheet } from '../../components/BottomSheet';
import { formatIndianNumber } from '../../utils/number';
import {
  Bell,
  IndianRupee,
  Calendar,
  PiggyBank,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Target,
  Plus,
  AlertCircle,
  ChevronRight,
} from 'lucide-react-native';

const getGreeting = (): { text: string; emoji: string } => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good morning', emoji: '🌅' };
  if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '☀️' };
  if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌇' };
  return { text: 'Good night', emoji: '🌙' };
};

interface Trend {
  direction: 'up' | 'down';
  pct: number;
}

const computeTrend = (current: number, previous: number): Trend => {
  if (previous === 0) return { direction: 'up', pct: current === 0 ? 0 : 100 };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { direction: pct >= 0 ? 'up' : 'down', pct: Math.abs(pct) };
};

const avgQuantityByTracker = (logs: DailyLogRecord[]): Map<string, number> => {
  const qtysByTracker = new Map<string, number[]>();
  logs.forEach((log) => {
    if (log.status !== 'done' || !log.quantity) return;
    const qty = parseFloat(log.quantity);
    if (Number.isNaN(qty)) return;
    qtysByTracker.set(log.trackerId, [...(qtysByTracker.get(log.trackerId) || []), qty]);
  });
  const avgByTracker = new Map<string, number>();
  qtysByTracker.forEach((qtys, trackerId) => {
    avgByTracker.set(trackerId, qtys.reduce((sum, q) => sum + q, 0) / qtys.length);
  });
  return avgByTracker;
};

// Approximates the spend avoided by "Skip" actions: price × the tracker's typical logged quantity.
const savedFromSkips = (
  logs: DailyLogRecord[],
  trackersById: Map<string, any>,
  avgQtyByTracker: Map<string, number>
): number =>
  logs.reduce((sum, log) => {
    if (log.status !== 'skipped') return sum;
    const tracker = trackersById.get(log.trackerId);
    if (!tracker || (tracker.kind ?? 'quantity') !== 'quantity') return sum;
    const price = parseFloat(tracker.price) || 0;
    const avgQty = avgQtyByTracker.get(log.trackerId) ?? 1;
    return sum + price * avgQty;
  }, 0);

const StatCard = ({
  icon,
  iconBg,
  value,
  label,
  trend,
  trendLabel,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  label: string;
  trend: Trend;
  trendLabel: string;
}) => {
  const TrendIcon = trend.direction === 'up' ? ArrowUp : ArrowDown;
  const trendColor = trend.direction === 'up' ? defaultTheme.colors.success : defaultTheme.colors.error;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statTrendRow}>
        <TrendIcon size={12} color={trendColor} />
        <Text style={[styles.statTrendPct, { color: trendColor }]}>{trend.pct}%</Text>
        <Text style={styles.statTrendLabel}>{trendLabel}</Text>
      </View>
    </View>
  );
};

const TrackerActionCard = ({
  tracker,
  log,
  logs,
  dismiss,
  onLog,
  onWishMember,
  onAcknowledgeMember,
  onLogAllowance,
  onDismissComplete,
  onPress,
}: {
  tracker: any;
  log: DailyLogRecord | undefined;
  logs?: DailyLogRecord[];
  dismiss: boolean;
  onLog: (data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }) => void;
  onWishMember?: (memberId: string, year: number) => void;
  onAcknowledgeMember?: (memberId: string) => void;
  onLogAllowance?: () => void;
  onDismissComplete: () => void;
  onPress: () => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const onDismissCompleteRef = useRef(onDismissComplete);
  onDismissCompleteRef.current = onDismissComplete;

  useEffect(() => {
    if (dismiss) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -500, duration: 260, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onDismissCompleteRef.current();
      });
    }
  }, [dismiss, translateX, opacity]);

  return (
    <Animated.View style={[styles.actionCard, { transform: [{ translateX }], opacity }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <TrackerActionCardBody
          tracker={tracker}
          log={log}
          logs={logs}
          onLog={onLog}
          onWishMember={onWishMember}
          onAcknowledgeMember={onAcknowledgeMember}
          onLogAllowance={onLogAllowance}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const [trackers, setTrackers] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<DailyLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [allowanceEntryTrackerId, setAllowanceEntryTrackerId] = useState<string | null>(null);
  const [allowanceAmountInput, setAllowanceAmountInput] = useState('');

  const loadData = async () => {
    try {
      await syncAllowanceCycles();
      const [allTrackers, logs, userStr] = await Promise.all([
        getAll<any>('trackers'),
        getAll<DailyLogRecord>('dailyLogs'),
        AsyncStorage.getItem('user'),
      ]);
      setTrackers(allTrackers);
      setUserName(userStr ? JSON.parse(userStr).name || '' : '');
      setAllLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleLog = async (
    trackerId: string,
    data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }
  ) => {
    setDismissingIds((prev) => new Set(prev).add(trackerId));
    const all = await logTrackerToday(trackerId, data);
    setAllLogs(all);
  };

  const handleSubmitAllowanceEntry = async () => {
    const amount = parseFloat(allowanceAmountInput);
    if (!allowanceEntryTrackerId || Number.isNaN(amount) || amount <= 0) return;
    await handleLog(allowanceEntryTrackerId, { status: 'done', amount });
    setAllowanceEntryTrackerId(null);
    setAllowanceAmountInput('');
  };

  const handleWishMember = async (trackerId: string, memberId: string, year: number) => {
    const all = await wishBirthdayMember(trackerId, memberId, year);
    setAllLogs(all);
  };

  const handleAcknowledgeMember = async (trackerId: string, memberId: string) => {
    const all = await acknowledgeBirthdayMember(trackerId, memberId);
    setAllLogs(all);
  };

  const handleDismissComplete = (trackerId: string) => {
    setDismissingIds((prev) => {
      const next = new Set(prev);
      next.delete(trackerId);
      return next;
    });
  };

  const todaysLogs = allLogs.filter((log) => log.date === todayKey());
  const yesterdaysLogs = allLogs.filter((log) => log.date === yesterdayKey());
  const thisMonthLogs = allLogs.filter((log) => log.date.startsWith(monthKey()));
  const lastMonthLogs = allLogs.filter((log) => log.date.startsWith(lastMonthKey()));

  const activeTrackers = trackers.filter((t) => t.status === 'Active' && !t.awaitingNewCycle);
  const trackersById = new Map(trackers.map((t) => [t.id, t]));
  // A log dated today only counts as "already logged" if it belongs to the tracker's current cycle —
  // otherwise a same-day cycle restart would hide the tracker from Today's Actions using a log that
  // actually belonged to the just-closed (already-paid) cycle.
  const logsByTracker = new Map(
    todaysLogs
      .filter((log) => {
        const tracker = trackersById.get(log.trackerId);
        return !tracker || logBelongsToTrackerCycle(log, tracker);
      })
      .map((log) => [log.trackerId, log])
  );
  const logsByTrackerAll = groupLogsByTracker(allLogs);
  const pendingTasks = getPendingTrackers(trackers, allLogs);
  const missedTaskCount = countMissedTasks(pendingTasks);
  const pendingIds = new Set(pendingTasks.map((entry) => entry.tracker.id));
  const visibleTrackers = activeTrackers.filter((t) => {
    if (isManualEntryTracker(t) || isRepaidLoanTracker(t)) return false;
    const kind = t.kind ?? 'quantity';
    // Birthdays have no single daily log — a tracker stays visible for as long as any of its
    // members are within their own reminder lead time and not yet wished this year.
    if (kind === 'birthday') {
      return getDueSoonMembers(t, logsByTrackerAll.get(t.id) || []).length > 0;
    }
    const notLoggedToday = !logsByTracker.has(t.id) || dismissingIds.has(t.id);
    if (!notLoggedToday) return false;
    // One-off kinds (bill/booking/event) are a single task, not a new occurrence each day —
    // once overdue they move fully into Missed Tasks instead of also cluttering Today's Actions.
    if (kind !== 'quantity' && pendingIds.has(t.id)) return false;
    return true;
  });

  const todaysSpend = todaysLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const yesterdaysSpend = yesterdaysLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const monthlySpend = thisMonthLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const lastMonthSpend = lastMonthLogs.reduce((sum, log) => sum + (log.amount || 0), 0);

  const avgQtyByTracker = avgQuantityByTracker(allLogs);
  const todaySaved = savedFromSkips(todaysLogs, trackersById, avgQtyByTracker);
  const yesterdaySaved = savedFromSkips(yesterdaysLogs, trackersById, avgQtyByTracker);

  const spendTrend = computeTrend(todaysSpend, yesterdaysSpend);
  const monthlySpendTrend = computeTrend(monthlySpend, lastMonthSpend);
  const savedTrend = computeTrend(todaySaved, yesterdaySaved);

  const greeting = getGreeting();
  const firstName = userName.split(' ')[0];

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>
                {greeting.emoji} {greeting.text}{firstName ? `, ${firstName}` : ''}!
              </Text>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <View style={styles.bellBox}>
              <Bell size={20} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon={<IndianRupee size={20} color={defaultTheme.colors.primaryDark} />}
              iconBg={defaultTheme.colors.primaryLight}
              value={`₹${formatIndianNumber(Math.round(todaysSpend))}`}
              label="Today's Spend"
              trend={spendTrend}
              trendLabel="vs Yesterday"
            />
            <StatCard
              icon={<Calendar size={20} color={defaultTheme.colors.secondary} />}
              iconBg={defaultTheme.colors.secondaryLight}
              value={`₹${formatIndianNumber(Math.round(monthlySpend))}`}
              label="Monthly Spend"
              trend={monthlySpendTrend}
              trendLabel="vs Last Month"
            />
            <StatCard
              icon={<PiggyBank size={20} color={defaultTheme.colors.primaryDark} />}
              iconBg={defaultTheme.colors.primaryLight}
              value={`₹${formatIndianNumber(Math.round(todaySaved))}`}
              label="Today Saved"
              trend={savedTrend}
              trendLabel="vs Yesterday"
            />
          </View>

          {pendingTasks.length > 0 && (
            <TouchableOpacity
              style={styles.pendingBanner}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('PendingActions')}
            >
              <View style={styles.pendingIconCircle}>
                <AlertCircle size={20} color={defaultTheme.colors.warning} />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingTitle}>
                  You have {missedTaskCount} pending task{missedTaskCount === 1 ? '' : 's'}
                </Text>
                <Text style={styles.pendingSubtitle}>
                  From the last {pendingTasks[0].daysBehind} day{pendingTasks[0].daysBehind === 1 ? '' : 's'}
                </Text>
              </View>
              <ChevronRight size={20} color={defaultTheme.colors.textSecondary} />
            </TouchableOpacity>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Actions</Text>
          </View>

          {!loading && activeTrackers.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Target size={40} color={defaultTheme.colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No trackers yet</Text>
              <Text style={styles.emptyDesc}>
                Create your first tracker — like daily milk, newspaper, or groceries — to start logging.
              </Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTracker')}>
                <Plus size={20} color="#FFFFFF" strokeWidth={3} style={styles.createBtnIcon} />
                <Text style={styles.createBtnText}>Create Tracker</Text>
              </TouchableOpacity>
            </View>
          ) : !loading && visibleTrackers.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <CheckCircle2 size={40} color={defaultTheme.colors.success} />
              </View>
              <Text style={styles.emptyTitle}>All done for today</Text>
              <Text style={styles.emptyDesc}>Nice work — you've logged everything for today.</Text>
            </View>
          ) : (
            visibleTrackers.map((tracker) => (
              <TrackerActionCard
                key={tracker.id}
                tracker={tracker}
                log={logsByTracker.get(tracker.id)}
                logs={logsByTrackerAll.get(tracker.id)}
                dismiss={logsByTracker.has(tracker.id) && dismissingIds.has(tracker.id)}
                onLog={(data) => handleLog(tracker.id, data)}
                onWishMember={(memberId, year) => handleWishMember(tracker.id, memberId, year)}
                onAcknowledgeMember={(memberId) => handleAcknowledgeMember(tracker.id, memberId)}
                onLogAllowance={() => setAllowanceEntryTrackerId(tracker.id)}
                onDismissComplete={() => handleDismissComplete(tracker.id)}
                onPress={() => navigation.navigate('TrackerDetails', { trackerId: tracker.id })}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <BottomSheet visible={!!allowanceEntryTrackerId} onClose={() => setAllowanceEntryTrackerId(null)}>
        <Text style={styles.sheetTitle}>Log Expense</Text>
        <View style={styles.sheetAmountInputRow}>
          <Text style={styles.sheetAmountPrefix}>₹</Text>
          <TextInput
            style={styles.sheetAmountInput}
            value={allowanceAmountInput}
            onChangeText={setAllowanceAmountInput}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={defaultTheme.colors.textSecondary}
            autoFocus
          />
        </View>
        <View style={styles.sheetButtonRow}>
          <TouchableOpacity style={styles.sheetSecondaryBtn} onPress={() => setAllowanceEntryTrackerId(null)}>
            <Text style={styles.sheetSecondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleSubmitAllowanceEntry}>
            <Text style={styles.sheetPrimaryBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultTheme.colors.background,
  },
  topBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 230,
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: defaultTheme.spacing.sm,
    marginBottom: 56,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bellBox: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: defaultTheme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -40,
    marginBottom: defaultTheme.spacing.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: defaultTheme.colors.card,
    borderRadius: defaultTheme.borderRadius.lg,
    paddingVertical: defaultTheme.spacing.md,
    paddingHorizontal: defaultTheme.spacing.sm,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.sm,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
    textAlign: 'center',
  },
  statTrendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  statTrendPct: {
    fontSize: 11,
    fontWeight: '700',
  },
  statTrendLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    borderRadius: 0,
    padding: 14,
    marginBottom: defaultTheme.spacing.lg,
  },
  pendingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDE8CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.primary,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: defaultTheme.spacing.md,
    marginTop: 20,
    paddingBottom: 40,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    backgroundColor: defaultTheme.colors.card,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.sm,
  },
  emptyDesc: {
    fontSize: 15,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: defaultTheme.spacing.xl,
  },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: defaultTheme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: defaultTheme.borderRadius.full,
    alignItems: 'center',
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBtnIcon: {
    marginRight: 8,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.lg,
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
  sheetAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
    paddingVertical: 12,
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
});
