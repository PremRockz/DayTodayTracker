import AsyncStorage from '@react-native-async-storage/async-storage';
import { scheduleDrivePush } from './driveSync';

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const getAll = async <T extends BaseRecord>(moduleKey: string): Promise<T[]> => {
  const raw = await AsyncStorage.getItem(moduleKey);
  return raw ? JSON.parse(raw) : [];
};

/** Upserts `record` into the `moduleKey` array by id, persists it, and schedules a Drive push. */
export const upsertRecord = async <T extends BaseRecord>(moduleKey: string, record: T): Promise<T[]> => {
  const all = await getAll<T>(moduleKey);
  const idx = all.findIndex((r) => r.id === record.id);
  const updated = idx >= 0
    ? all.map((r, i) => (i === idx ? { ...r, ...record } : r))
    : [...all, record];

  await AsyncStorage.setItem(moduleKey, JSON.stringify(updated));
  scheduleDrivePush();
  return updated;
};

/** Replaces the entire `moduleKey` array in one write (bulk edits), persists it, and schedules a Drive push. */
export const setAll = async <T extends BaseRecord>(moduleKey: string, records: T[]): Promise<T[]> => {
  await AsyncStorage.setItem(moduleKey, JSON.stringify(records));
  scheduleDrivePush();
  return records;
};

/** Removes the record with `id` from `moduleKey`, persists it, and schedules a Drive push. */
export const deleteRecord = async <T extends BaseRecord>(moduleKey: string, id: string): Promise<T[]> => {
  const all = await getAll<T>(moduleKey);
  return setAll(moduleKey, all.filter((r) => r.id !== id));
};
