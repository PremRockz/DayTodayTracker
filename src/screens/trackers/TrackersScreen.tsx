import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, PanResponder, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { defaultTheme } from '../../theme/theme';
import { getAll, deleteRecord } from '../../services/localStore';
import { isRepaidLoanTracker, deleteLogsForTracker, getMonthlyLogs, DailyLogRecord } from '../../services/dailyLogs';
import { deleteCyclePaymentsForTracker } from '../../services/cyclePayments';
import { syncAllowanceCycles, computeAllowanceMonthTotal } from '../../services/allowance';
import { TRACKER_ICON_MAP } from '../../constants/trackerIcons';
import { formatDate, formatTime } from '../../utils/date';
import { formatIndianNumber } from '../../utils/number';
import {
  Target,
  Plus,
  Trash2,
  Pencil,
  Circle,
  Store,
} from 'lucide-react-native';

const DELETE_WIDTH = 84;
const SWIPE_OPEN_THRESHOLD = DELETE_WIDTH / 2;

const trackerSubtitle = (tracker: any, monthlyLogs: DailyLogRecord[]): string => {
  const kind = tracker.kind ?? 'quantity';
  if (kind === 'bill') return `₹ ${formatIndianNumber(tracker.price)} due`;
  if (kind === 'loan') return tracker.loanRepaidAt ? 'Repaid' : `₹ ${formatIndianNumber(tracker.price)} due`;
  if (kind === 'booking') {
    return tracker.reminderDate ? `Book before ${formatTime(new Date(tracker.reminderDate))}` : 'Booking';
  }
  if (kind === 'event') {
    return tracker.startDate ? formatDate(new Date(tracker.startDate)) : 'Event';
  }
  if (kind === 'birthday') {
    const count = tracker.members?.length || 0;
    return `${count} member${count === 1 ? '' : 's'}`;
  }
  if (kind === 'allowance') {
    const { totalSpent } = computeAllowanceMonthTotal(tracker.id, monthlyLogs);
    return tracker.monthlyLimit
      ? `₹ ${formatIndianNumber(totalSpent)} / ₹${formatIndianNumber(tracker.monthlyLimit)} this month`
      : `₹ ${formatIndianNumber(totalSpent)} this month`;
  }
  return `₹ ${tracker.price}/${tracker.unit ? tracker.unit[0] : ''}`;
};

const TrackerCard = ({
  tracker,
  monthlyLogs,
  onEdit,
  onPress,
}: {
  tracker: any;
  monthlyLogs: DailyLogRecord[];
  onEdit: (tracker: any) => void;
  onPress: (tracker: any) => void;
}) => {
  const IconComponent = TRACKER_ICON_MAP[tracker.iconId] || Trash2;
  const isPaused = tracker.status !== 'Active';
  const isCompleted = isRepaidLoanTracker(tracker);
  const iconColor = isPaused ? '#CBD5E1' : tracker.color;
  const iconBg = isPaused ? '#F1F5F9' : tracker.color + '15';
  const kind = tracker.kind ?? 'quantity';
  const statusLabel = isCompleted ? 'Completed' : isPaused ? 'Inactive' : 'Active';

  return (
    <TouchableOpacity
      style={[styles.card, isPaused && styles.cardPaused]}
      activeOpacity={0.8}
      onPress={() => onPress(tracker)}
    >
      <View style={[styles.cardIconBox, { backgroundColor: iconBg }]}>
        <IconComponent size={24} color={iconColor} />
      </View>

      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, isPaused && styles.textMuted]}>{tracker.name}</Text>
        <View style={styles.cardSubDetails}>
          <Text style={[styles.cardPrice, isPaused && styles.textMuted]}>{trackerSubtitle(tracker, monthlyLogs)}</Text>
          {kind === 'quantity' && (
            <View style={styles.cardSellerRow}>
              <Store size={12} color={isPaused ? '#CBD5E1' : defaultTheme.colors.textSecondary} />
              <Text style={[styles.cardSeller, isPaused && styles.textMuted]}>{tracker.sellerName || 'N/A'}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardRight}>
        <View
          style={[
            styles.statusBadge,
            isCompleted ? styles.statusBadgeCompleted : isPaused && styles.statusBadgePaused,
          ]}
        >
          <Circle
            size={8}
            color={isCompleted ? defaultTheme.colors.secondary : isPaused ? '#94A3B8' : defaultTheme.colors.success}
            fill={isCompleted ? defaultTheme.colors.secondary : isPaused ? '#94A3B8' : defaultTheme.colors.success}
          />
          <Text
            style={[
              styles.statusText,
              isCompleted ? styles.statusTextCompleted : isPaused && styles.statusTextPaused,
            ]}
          >
            {statusLabel}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtnBottom} onPress={() => onEdit(tracker)}>
            <Pencil size={18} color={isPaused ? '#CBD5E1' : defaultTheme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Wraps TrackerCard with a swipe-left-to-reveal-delete gesture, built on core RN Animated +
// PanResponder (no gesture-handler dependency in this project). Swiping left past halfway snaps
// the card open to reveal a Delete button behind it; tapping the card while open just closes it.
const SwipeableTrackerCard = ({
  tracker,
  monthlyLogs,
  onEdit,
  onPress,
  onDelete,
}: {
  tracker: any;
  monthlyLogs: DailyLogRecord[];
  onEdit: (tracker: any) => void;
  onPress: (tracker: any) => void;
  onDelete: (tracker: any) => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const snapTo = (open: boolean) => {
    isOpenRef.current = open;
    Animated.spring(translateX, {
      toValue: open ? -DELETE_WIDTH : 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_evt, gesture) => {
        const base = isOpenRef.current ? -DELETE_WIDTH : 0;
        const next = Math.min(0, Math.max(-DELETE_WIDTH, base + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const base = isOpenRef.current ? -DELETE_WIDTH : 0;
        const next = base + gesture.dx;
        snapTo(next < -SWIPE_OPEN_THRESHOLD);
      },
    })
  ).current;

  const handleCardPress = (t: any) => {
    if (isOpenRef.current) {
      snapTo(false);
      return;
    }
    onPress(t);
  };

  return (
    <View style={styles.swipeRow}>
      <View style={styles.deleteAction}>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(tracker)}>
          <Trash2 size={22} color="#FFFFFF" />
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TrackerCard tracker={tracker} monthlyLogs={monthlyLogs} onEdit={onEdit} onPress={handleCardPress} />
      </Animated.View>
    </View>
  );
};

export const TrackersScreen = () => {
  const navigation = useNavigation<any>();
  const [trackers, setTrackers] = useState<any[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<DailyLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrackers = async () => {
    try {
      await syncAllowanceCycles();
      const [allTrackers, logs] = await Promise.all([getAll<any>('trackers'), getMonthlyLogs()]);
      setTrackers(allTrackers);
      setMonthlyLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTrackers();
    }, [])
  );

  const handleDeleteTracker = (tracker: any) => {
    Alert.alert(
      'Delete Tracker',
      `Delete "${tracker.name}"? This removes it and its entire history. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecord('trackers', tracker.id);
            await deleteLogsForTracker(tracker.id);
            await deleteCyclePaymentsForTracker(tracker.id);
            setTrackers((prev) => prev.filter((t) => t.id !== tracker.id));
          },
        },
      ]
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <Text>Loading trackers...</Text>
        </View>
      );
    }

    if (trackers.length > 0) {
      return (
        <View style={styles.listContainer}>
          {trackers.map((item) => (
            <SwipeableTrackerCard
              key={item.id}
              tracker={item}
              monthlyLogs={monthlyLogs}
              onEdit={(tracker) => navigation.navigate('CreateTracker', { trackerId: tracker.id })}
              onPress={(tracker) => navigation.navigate('TrackerDetails', { trackerId: tracker.id })}
              onDelete={handleDeleteTracker}
            />
          ))}
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <View style={styles.emptyIconBox}>
          <Target size={48} color={defaultTheme.colors.primary} />
        </View>
        <Text style={styles.emptyText}>Manage your active trackers here.</Text>
        <Text style={styles.subText}>Everything you track daily will be listed in this section.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBg} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Trackers</Text>
          </View>

          {renderContent()}
        </ScrollView>
      </SafeAreaView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('CreateTracker')}
      >
        <Plus size={32} color="#FFFFFF" strokeWidth={3} />
      </TouchableOpacity>
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
    height: 180,
    backgroundColor: defaultTheme.colors.headerBackground,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: defaultTheme.spacing.lg,
    paddingTop: defaultTheme.spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: defaultTheme.spacing.xl,
    marginTop: defaultTheme.spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: defaultTheme.spacing.xl,
  },
  emptyIconBox: {
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: defaultTheme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: defaultTheme.spacing.sm,
  },
  subText: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContainer: {
    gap: 16,
  },
  swipeRow: {
    position: 'relative',
    borderRadius: 24,
  },
  deleteAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    borderRadius: 24,
    backgroundColor: defaultTheme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 4,
  },
  cardSubDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  cardSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSeller: {
    fontSize: 14,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: defaultTheme.colors.success,
    marginLeft: 6,
  },
  cardActions: {
    flexDirection: 'column',
  },
  actionBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnBottom: {
    width: 36,
    height: 36,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cardPaused: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  textMuted: {
    color: '#CBD5E1',
  },
  statusBadgePaused: {
    backgroundColor: '#F1F5F9',
  },
  statusTextPaused: {
    color: '#94A3B8',
  },
  statusBadgeCompleted: {
    backgroundColor: defaultTheme.colors.secondaryLight,
  },
  statusTextCompleted: {
    color: defaultTheme.colors.secondary,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: defaultTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: defaultTheme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
});
