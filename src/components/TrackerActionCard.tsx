import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Trash2, Cake } from 'lucide-react-native';
import { defaultTheme } from '../theme/theme';
import { TRACKER_ICON_MAP } from '../constants/trackerIcons';
import { formatDate, formatTime, toLocalDateKey } from '../utils/date';
import { formatIndianNumber } from '../utils/number';
import { DailyLogRecord } from '../services/dailyLogs';
import { getDueSoonMembers, getMissedMembers, ageOnOccurrence, DueBirthdayMember } from '../services/birthdays';
import { computeAllowanceMonthTotal } from '../services/allowance';

export const DEFAULT_QUANTITY_OPTIONS = ['0.5', '1', '2'];

const daysUntilNextOccurrence = (isoDate: string): number => {
  const target = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), target.getMonth(), target.getDate());
  next.setHours(0, 0, 0, 0);
  if (next.getTime() < today.getTime()) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
};

export const TrackerActionCardBody = ({
  tracker,
  log,
  logs,
  onLog,
  onWishMember,
  onAcknowledgeMember,
  onLogAllowance,
  birthdayMode = 'dueSoon',
  birthdayFilterDate,
}: {
  tracker: any;
  log: DailyLogRecord | undefined;
  logs?: DailyLogRecord[];
  onLog: (data: { status: 'done' | 'skipped'; quantity?: string; amount?: number }) => void;
  onWishMember?: (memberId: string, year: number) => void;
  onAcknowledgeMember?: (memberId: string) => void;
  onLogAllowance?: () => void;
  birthdayMode?: 'dueSoon' | 'missed';
  birthdayFilterDate?: string;
}) => {
  const IconComponent = TRACKER_ICON_MAP[tracker.iconId] || Trash2;
  const kind = tracker.kind ?? 'quantity';
  const reminderTime = tracker.reminderDate ? formatTime(new Date(tracker.reminderDate)) : null;

  let subtitle: string;
  let trailingAction: React.ReactNode = null;
  let birthdayRows: DueBirthdayMember[] = [];

  if (kind === 'birthday') {
    const allRows =
      birthdayMode === 'missed' ? getMissedMembers(tracker, logs || []) : getDueSoonMembers(tracker, logs || []);
    birthdayRows = birthdayFilterDate
      ? allRows.filter((row) => toLocalDateKey(row.occurrence) === birthdayFilterDate)
      : allRows;
    // Named directly rather than just a count — when two or more members share the same reminder
    // date, whoever's due needs to be identifiable at a glance, not just "2 birthdays coming up".
    const names = birthdayRows.map((row) => row.member.name);
    const namesLabel =
      names.length === 0
        ? 'No birthdays due'
        : names.length <= 2
        ? names.join(' & ')
        : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
    subtitle = `${namesLabel}${birthdayMode === 'missed' ? ' — missed' : ''}`;
  } else if (kind === 'bill') {
    const paid = log?.status === 'done';
    subtitle = tracker.startDate ? `Due ${formatDate(new Date(tracker.startDate))}` : 'Amount due';
    trailingAction = (
      <TouchableOpacity
        style={[styles.pillBtn, paid ? styles.pillBtnDone : styles.pillBtnDanger]}
        onPress={() => onLog({ status: 'done', amount: parseFloat(tracker.price) || 0 })}
        disabled={paid}
      >
        {paid && <Check size={14} color={defaultTheme.colors.primaryDark} />}
        <Text style={paid ? styles.pillBtnTextDone : styles.pillBtnTextDanger}>
          {paid ? 'Paid' : `₹${formatIndianNumber(tracker.price)}`}
        </Text>
      </TouchableOpacity>
    );
  } else if (kind === 'loan') {
    // A loan's reminder (whatever its frequency) is just a nudge to check in — it must never itself
    // log the full payable amount. Only the explicit "Mark as Repaid" action on the Details page does that.
    const repaid = !!tracker.loanRepaidAt;
    const acknowledgedToday = log?.status === 'done';
    subtitle = repaid
      ? 'Repaid'
      : tracker.startDate
      ? `Due ${formatDate(new Date(tracker.startDate))}`
      : 'Amount due';
    trailingAction = repaid ? (
      <View style={[styles.pillBtn, styles.pillBtnDone]}>
        <Check size={14} color={defaultTheme.colors.primaryDark} />
        <Text style={styles.pillBtnTextDone}>Repaid</Text>
      </View>
    ) : (
      <TouchableOpacity
        style={[styles.pillBtn, acknowledgedToday ? styles.pillBtnDone : styles.pillBtnOutline]}
        onPress={() => onLog({ status: 'done', amount: 0 })}
        disabled={acknowledgedToday}
      >
        {acknowledgedToday && <Check size={14} color={defaultTheme.colors.primaryDark} />}
        <Text style={acknowledgedToday ? styles.pillBtnTextDone : styles.pillBtnTextOutline}>
          {acknowledgedToday ? 'Noted' : 'Acknowledge'}
        </Text>
      </TouchableOpacity>
    );
  } else if (kind === 'booking') {
    const booked = log?.status === 'done';
    subtitle = reminderTime ? `Book before ${reminderTime}` : 'Booking';
    trailingAction = (
      <TouchableOpacity
        style={[styles.pillBtn, booked ? styles.pillBtnDone : styles.pillBtnOutline]}
        onPress={() => onLog({ status: 'done' })}
        disabled={booked}
      >
        {booked && <Check size={14} color={defaultTheme.colors.primaryDark} />}
        <Text style={booked ? styles.pillBtnTextDone : styles.pillBtnTextOutline}>
          {booked ? 'Booked' : 'Book'}
        </Text>
      </TouchableOpacity>
    );
  } else if (kind === 'event') {
    const acknowledged = log?.status === 'done';
    const days = tracker.startDate ? daysUntilNextOccurrence(tracker.startDate) : null;
    subtitle =
      days === null
        ? 'Event'
        : days === 0
        ? 'Today'
        : `In ${days} Day${days === 1 ? '' : 's'} • ${formatDate(new Date(tracker.startDate))}`;
    trailingAction = (
      <TouchableOpacity
        style={[styles.pillBtn, acknowledged ? styles.pillBtnDone : styles.pillBtnOutline]}
        onPress={() => onLog({ status: 'done' })}
        disabled={acknowledged}
      >
        {acknowledged && <Check size={14} color={defaultTheme.colors.primaryDark} />}
        <Text style={acknowledged ? styles.pillBtnTextDone : styles.pillBtnTextOutline}>Done</Text>
      </TouchableOpacity>
    );
  } else if (kind === 'allowance') {
    const { totalSpent } = computeAllowanceMonthTotal(tracker.id, logs || []);
    subtitle = tracker.monthlyLimit
      ? `₹${formatIndianNumber(totalSpent)} / ₹${formatIndianNumber(tracker.monthlyLimit)} this month`
      : `₹${formatIndianNumber(totalSpent)} this month`;
    trailingAction = (
      <TouchableOpacity style={[styles.pillBtn, styles.pillBtnOutline]} onPress={() => onLogAllowance?.()}>
        <Text style={styles.pillBtnTextOutline}>Log Expense</Text>
      </TouchableOpacity>
    );
  } else {
    subtitle = reminderTime || 'No reminder set';
  }

  return (
    <>
      <View style={styles.actionCardRow}>
        <View style={[styles.actionIconBox, { backgroundColor: tracker.color + '20' }]}>
          <IconComponent size={22} color={tracker.color} />
        </View>
        <View style={styles.actionCardInfo}>
          <Text style={styles.actionCardName}>{tracker.name}</Text>
          <Text style={styles.actionCardSubtitle}>{subtitle}</Text>
        </View>
        {trailingAction}
      </View>

      {kind === 'quantity' && (
        <View style={styles.quantityOptions}>
          {(tracker.quantityOptions?.length ? tracker.quantityOptions : DEFAULT_QUANTITY_OPTIONS).map((qty: string) => (
            <TouchableOpacity
              key={qty}
              style={styles.qtyBtn}
              onPress={() =>
                onLog({ status: 'done', quantity: qty, amount: (parseFloat(tracker.price) || 0) * parseFloat(qty) })
              }
            >
              <Text style={styles.qtyBtnText}>
                {qty}{tracker.unit ? tracker.unit[0] : ''}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.qtyBtn} onPress={() => onLog({ status: 'skipped', amount: 0 })}>
            <Text style={styles.qtyBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {kind === 'birthday' && birthdayRows.length > 0 && (
        <View style={styles.birthdayMemberList}>
          {birthdayRows.map(({ member, occurrence, daysUntil }) => {
            const age = ageOnOccurrence(member.dateOfBirth, occurrence);
            const timingLabel =
              daysUntil === 0
                ? 'Today'
                : daysUntil > 0
                ? `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
                : `${-daysUntil} day${-daysUntil === 1 ? '' : 's'} ago`;
            // Wish (the completing action) is only available on the actual day, or once it's
            // overdue in Missed Tasks — during the lead-up, all you can do is acknowledge today's
            // nudge, which comes back tomorrow until the day itself arrives.
            const canWish = birthdayMode === 'missed' || daysUntil === 0;
            return (
              <View key={member.id} style={styles.birthdayMemberRow}>
                <Cake size={16} color={tracker.color} />
                <View style={styles.birthdayMemberInfo}>
                  <Text style={styles.birthdayMemberName}>{member.name}</Text>
                  <Text style={styles.birthdayMemberTiming}>Turns {age} • {timingLabel}</Text>
                </View>
                {canWish ? (
                  <TouchableOpacity
                    style={[styles.pillBtn, styles.pillBtnOutline]}
                    onPress={() => onWishMember?.(member.id, occurrence.getFullYear())}
                  >
                    <Text style={styles.pillBtnTextOutline}>Wish</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.pillBtn, styles.pillBtnOutline]}
                    onPress={() => onAcknowledgeMember?.(member.id)}
                  >
                    <Text style={styles.pillBtnTextOutline}>Acknowledge</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
};

export const styles = StyleSheet.create({
  actionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  actionCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  pillBtnDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pillBtnTextDanger: {
    color: defaultTheme.colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
  pillBtnOutline: {
    backgroundColor: '#FFFFFF',
    borderColor: defaultTheme.colors.primary,
  },
  pillBtnTextOutline: {
    color: defaultTheme.colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  pillBtnDone: {
    backgroundColor: defaultTheme.colors.primaryLight,
    borderColor: defaultTheme.colors.primaryLight,
  },
  pillBtnTextDone: {
    color: defaultTheme.colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  quantityOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  qtyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: defaultTheme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  qtyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: defaultTheme.colors.textPrimary,
  },
  birthdayMemberList: {
    marginTop: 12,
    gap: 10,
  },
  birthdayMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  birthdayMemberInfo: {
    flex: 1,
  },
  birthdayMemberName: {
    fontSize: 14,
    fontWeight: '700',
    color: defaultTheme.colors.textPrimary,
  },
  birthdayMemberTiming: {
    fontSize: 12,
    color: defaultTheme.colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
});
