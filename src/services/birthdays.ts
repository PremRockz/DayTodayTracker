import { upsertRecord } from './localStore';
import { DailyLogRecord } from './dailyLogs';
import { toLocalDateKey } from '../utils/date';

export interface BirthdayMember {
  id: string;
  name: string;
  dateOfBirth: string; // ISO date string; only the month/day are used for the yearly recurrence
  reminderOffsetDays: number;
}

export const REMINDER_OFFSET_OPTIONS: { label: string; days: number }[] = [
  { label: '1 Day Before', days: 1 },
  { label: '1 Week Before', days: 7 },
  { label: '1 Month Before', days: 30 },
];

const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// This year's occurrence of `dateOfBirth`'s month/day — deliberately not rolled forward, so callers
// can tell whether it's still upcoming (>= today) or already passed this year (< today) themselves.
export const occurrenceThisYear = (dateOfBirth: string, today: Date = new Date()): Date => {
  const dob = new Date(dateOfBirth);
  const ref = startOfDay(today);
  return new Date(ref.getFullYear(), dob.getMonth(), dob.getDate());
};

export const daysBetween = (from: Date, to: Date): number =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (24 * 60 * 60 * 1000));

export const ageOnOccurrence = (dateOfBirth: string, occurrence: Date): number =>
  occurrence.getFullYear() - new Date(dateOfBirth).getFullYear();

export const memberLogId = (trackerId: string, memberId: string, year: number): string =>
  `${trackerId}_${memberId}_${year}`;

export const isMemberWished = (
  trackerId: string,
  memberId: string,
  year: number,
  logs: DailyLogRecord[]
): boolean => logs.some((log) => log.id === memberLogId(trackerId, memberId, year) && log.status === 'done');

// Distinct from `memberLogId` (contains "_ack_") so an acknowledged lead-up nudge never collides
// with — or counts as — that member's actual yearly wish.
export const memberAckLogId = (trackerId: string, memberId: string, dateKey: string): string =>
  `${trackerId}_${memberId}_ack_${dateKey}`;

export const isMemberAcknowledgedToday = (
  trackerId: string,
  memberId: string,
  logs: DailyLogRecord[],
  today: Date = new Date()
): boolean =>
  logs.some((log) => log.id === memberAckLogId(trackerId, memberId, toLocalDateKey(today)) && log.status === 'done');

export interface DueBirthdayMember {
  member: BirthdayMember;
  occurrence: Date;
  daysUntil: number; // negative once this year's date has passed
}

const membersWithOccurrence = (tracker: any, today: Date): DueBirthdayMember[] =>
  ((tracker.members || []) as BirthdayMember[]).map((member) => {
    const occurrence = occurrenceThisYear(member.dateOfBirth, today);
    return { member, occurrence, daysUntil: daysBetween(today, occurrence) };
  });

// Members whose (this year's) birthday is within their own reminder lead time and not yet wished —
// the set shown in Today's Actions, soonest first. Before the actual day, an "Acknowledge" for
// today drops the member out for today only (it reappears tomorrow); on the actual day (daysUntil
// === 0) that acknowledgment no longer applies — only a Wish clears it.
export const getDueSoonMembers = (
  tracker: any,
  logs: DailyLogRecord[],
  today: Date = new Date()
): DueBirthdayMember[] =>
  membersWithOccurrence(tracker, today)
    .filter(({ member, occurrence, daysUntil }) => {
      if (daysUntil < 0 || daysUntil > member.reminderOffsetDays) return false;
      if (isMemberWished(tracker.id, member.id, occurrence.getFullYear(), logs)) return false;
      if (daysUntil > 0 && isMemberAcknowledgedToday(tracker.id, member.id, logs, today)) return false;
      return true;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

// Members whose (this year's) birthday has already passed with no wish logged — the set shown in
// Missed Tasks. Grows daysBehind until acknowledged; automatically resets once next year's
// occurrence becomes "this year's" again.
export const getMissedMembers = (
  tracker: any,
  logs: DailyLogRecord[],
  today: Date = new Date()
): DueBirthdayMember[] =>
  membersWithOccurrence(tracker, today)
    .filter(
      ({ member, occurrence, daysUntil }) =>
        daysUntil < 0 && !isMemberWished(tracker.id, member.id, occurrence.getFullYear(), logs)
    )
    .sort((a, b) => a.daysUntil - b.daysUntil);

export const wishBirthdayMember = async (
  trackerId: string,
  memberId: string,
  year: number
): Promise<DailyLogRecord[]> => {
  const now = new Date().toISOString();
  return upsertRecord<DailyLogRecord>('dailyLogs', {
    id: memberLogId(trackerId, memberId, year),
    trackerId,
    memberId,
    date: toLocalDateKey(new Date()),
    status: 'done',
    amount: 0,
    createdAt: now,
    updatedAt: now,
  });
};

export const memberNameById = (tracker: any, memberId: string | undefined): string =>
  ((tracker.members || []) as BirthdayMember[]).find((m) => m.id === memberId)?.name || 'Member';

export const acknowledgeBirthdayMember = async (trackerId: string, memberId: string): Promise<DailyLogRecord[]> => {
  const now = new Date().toISOString();
  const dateKey = toLocalDateKey(new Date());
  return upsertRecord<DailyLogRecord>('dailyLogs', {
    id: memberAckLogId(trackerId, memberId, dateKey),
    trackerId,
    memberId,
    date: dateKey,
    status: 'done',
    amount: 0,
    createdAt: now,
    updatedAt: now,
  });
};
