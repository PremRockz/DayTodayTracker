import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { defaultTheme } from '../../theme/theme';
import { getAll } from '../../services/localStore';
import { logTrackerForDate, DailyLogRecord } from '../../services/dailyLogs';
import { getPendingTrackers, countMissedTasks, groupLogsByTracker, PendingTrackerEntry } from '../../services/pendingTasks';
import { wishBirthdayMember } from '../../services/birthdays';
import { TrackerActionCardBody } from '../../components/TrackerActionCard';

const formatDayHeader = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
};

// A tracker behind by multiple days appears once per missed day, not just under the earliest one.
const groupByMissedDate = (entries: PendingTrackerEntry[]): [string, PendingTrackerEntry[]][] => {
  const groups = new Map<string, PendingTrackerEntry[]>();
  entries.forEach((entry) => {
    entry.missedDates.forEach((date) => {
      groups.set(date, [...(groups.get(date) || []), entry]);
    });
  });
  return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
};

export const PendingActionsScreen = ({ navigation }: any) => {
  const [trackers, setTrackers] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<DailyLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [allTrackers, logs] = await Promise.all([
        getAll<any>('trackers'),
        getAll<DailyLogRecord>('dailyLogs'),
      ]);
      setTrackers(allTrackers);
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
    date: string,
    data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }
  ) => {
    const all = await logTrackerForDate(trackerId, date, data);
    setAllLogs(all);
  };

  const handleWishMember = async (trackerId: string, memberId: string, year: number) => {
    const all = await wishBirthdayMember(trackerId, memberId, year);
    setAllLogs(all);
  };

  const logsByTracker = groupLogsByTracker(allLogs);
  const pendingTasks = getPendingTrackers(trackers, allLogs);
  const dayGroups = groupByMissedDate(pendingTasks);
  const maxDaysBehind = pendingTasks[0]?.daysBehind ?? 0;
  const missedTaskCount = countMissedTasks(pendingTasks);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={22} color={defaultTheme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>Missed Tasks</Text>
            <View style={styles.backBtn} />
          </View>

          {!loading && pendingTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <CheckCircle2 size={40} color={defaultTheme.colors.success} />
              </View>
              <Text style={styles.emptyTitle}>Nothing pending</Text>
              <Text style={styles.emptyDesc}>You're all caught up on every tracker.</Text>
            </View>
          ) : (
            <>
              <View style={styles.pendingBanner}>
                <View style={styles.pendingIconCircle}>
                  <AlertCircle size={20} color={defaultTheme.colors.error} />
                </View>
                <View style={styles.pendingInfo}>
                  <Text style={styles.pendingTitle}>
                    You Missed {missedTaskCount} task{missedTaskCount === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.pendingSubtitle}>
                    From the last {maxDaysBehind} day{maxDaysBehind === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>


              {dayGroups.map(([date, entries]) => (
                <View key={date} style={styles.dayGroup}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayHeaderText}>{formatDayHeader(date)}</Text>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>
                        {entries.length} Task{entries.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </View>

                  {entries.map(({ tracker }) => (
                    <View key={tracker.id} style={styles.card}>
                      <TrackerActionCardBody
                        tracker={tracker}
                        log={undefined}
                        logs={logsByTracker.get(tracker.id)}
                        birthdayMode="missed"
                        birthdayFilterDate={date}
                        onLog={(data) => handleLog(tracker.id, date, data)}
                        onWishMember={(memberId, year) => handleWishMember(tracker.id, memberId, year)}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </>
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
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingBottom: 60,
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 0,
    padding: 14,
    marginBottom: defaultTheme.spacing.lg,
  },
  pendingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FECACA',
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
    color: defaultTheme.colors.error,
    marginBottom: 2,
  },
  pendingSubtitle: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: defaultTheme.spacing.md,
  },
  dayGroup: {
    marginBottom: defaultTheme.spacing.lg,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.sm,
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  dayBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: defaultTheme.colors.error,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
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
    marginTop: 40,
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
  },
});
