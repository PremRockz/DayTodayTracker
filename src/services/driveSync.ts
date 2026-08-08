import AsyncStorage from '@react-native-async-storage/async-storage';
import { uploadAppDataFile, downloadAppDataFile } from './googleDrive';

const BLOB_FILE_NAME = 'homebook-data.json';
const PUSH_DEBOUNCE_MS = 2000;

// Every module that should be included in the Drive backup blob.
// Add a module's AsyncStorage key here when it starts using upsertRecord.
export const SYNCED_KEYS = ['trackers', 'dailyLogs', 'cyclePayments'];

let pushTimer: ReturnType<typeof setTimeout> | null = null;

const isGoogleAccount = async (): Promise<boolean> => {
  const userStr = await AsyncStorage.getItem('user');
  if (!userStr) return false;
  const user = JSON.parse(userStr);
  return user.authProvider === 'google';
};

const pushToDrive = async (): Promise<void> => {
  if (!(await isGoogleAccount())) return;

  const blob: Record<string, unknown> = {};
  for (const key of SYNCED_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (raw) blob[key] = JSON.parse(raw);
  }
  await uploadAppDataFile(BLOB_FILE_NAME, blob);
  console.log('Drive push succeeded:', Object.keys(blob));
};

/** Call after any local write to a synced module; pushes the whole blob ~2s later. */
export const scheduleDrivePush = (): void => {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushToDrive().catch((e) => console.error('Drive push failed', e));
  }, PUSH_DEBOUNCE_MS);
};

const hasAnyLocalData = async (): Promise<boolean> => {
  for (const key of SYNCED_KEYS) {
    if (await AsyncStorage.getItem(key)) return true;
  }
  return false;
};

/** Call right after Google sign-in; restores the blob only if local storage is empty. */
export const pullFromDriveIfEmpty = async (): Promise<void> => {
  if (await hasAnyLocalData()) return;

  const blob = await downloadAppDataFile<Record<string, unknown>>(BLOB_FILE_NAME);
  if (!blob) return;

  for (const key of SYNCED_KEYS) {
    if (blob[key] !== undefined) {
      await AsyncStorage.setItem(key, JSON.stringify(blob[key]));
    }
  }
};
