# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm start                 # Start Metro bundler
npm run android           # Build & run on Android (emulator/device)
npm run ios               # Build & run on iOS (run `bundle install` then `bundle exec pod install` in ios/ first)
npm run lint              # ESLint (@react-native/eslint-config)
npm test                  # Jest, all tests
npx jest __tests__/App.test.tsx   # Run a single test file
cd android && ./gradlew clean     # Clean Android build (needed after keystore/OAuth config changes)
```

No `typecheck` script exists; use `npx tsc --noEmit` if type-checking is needed.

## Product context

`PRD.md` is the authoritative product spec (HomeBook: a backend-free household management app that syncs each user's data to their own Google Drive App Data folder). Treat it as the target design, **not** the current state of the code — the PRD describes SQLite, Zustand, MMKV, and a full Drive sync engine, none of which are implemented yet (see Architecture below for what actually exists).

## Architecture

**Current implementation is an early-stage shell**, not the PRD's full architecture. Persistence today is entirely `@react-native-async-storage/async-storage`, used directly in screen components (no repository/service layer, no SQLite, no Zustand store). Each screen independently reads/writes its own AsyncStorage keys on mount — there is no shared app-level state.

- **Entry/auth flow** ([App.tsx](App.tsx)): a single native-stack `Navigator` decides between an Auth stack (`SignIn`/`SignUp`) and `MainTabs` based on an `isAuthenticated` AsyncStorage flag, checked once on launch. `setIsAuthenticated` is passed down as a prop through screens rather than via context — any screen that can affect auth state (sign-in, sign-up, logout in `SettingsScreen`) receives it directly as a prop.
- **Two independent auth paths**:
  - Email/password in `SignInScreen`/`SignUpScreen` is a local mock: it stores a single user record under the `user` AsyncStorage key and compares credentials against it — there's no multi-account support or real backend call.
  - Google Sign-In ([src/services/googleAuth.ts](src/services/googleAuth.ts)) is real, via `@react-native-google-signin/google-signin`, configured with `GOOGLE_WEB_CLIENT_ID` from [src/config/googleAuthConfig.ts](src/config/googleAuthConfig.ts) and the `drive.appdata` scope — this scope is provisioned for the PRD's future Drive-sync backup but no sync code exists yet.
  - Android OAuth requires the SHA-1 of whichever keystore signs the build to be registered against package `com.daytodayproject` in Google Cloud Console (debug and release keystores need separate entries) — mismatches surface as `DEVELOPER_ERROR`.
- **Navigation** ([src/navigation/TabNavigator.tsx](src/navigation/TabNavigator.tsx)): bottom tabs (Home, Trackers, Summary, Settings) nested inside the root stack's `MainTabs` screen.
- **Trackers feature** is the most built-out vertical slice and the reference pattern for adding new features: `TrackersScreen` + `CreateTrackerScreen` (a pushed full-screen form, not a modal) manage a single JSON array under the `trackers` AsyncStorage key via the generic `upsertRecord`/`getAll` helpers in `src/services/localStore.ts` (create/edit/toggle-active, `id` generated via `generateId()` in `src/utils/id.ts`). Each tracker has a `kind` (`quantity` | `bill` | `booking` | `event`) that determines which form fields and which action UI it gets. `HomeScreen` reads real tracker + daily-log data (see below); `SummaryScreen` does not yet read this data — its stat cards and empty states are still static placeholders.
- **Daily logs**: `src/services/dailyLogs.ts` stores one record per (tracker, day) under the `dailyLogs` AsyncStorage key, id'd as `${trackerId}_${date}` so re-logging the same tracker on the same day upserts rather than duplicates. `HomeScreen`'s "Today's Actions" list renders each active tracker with a kind-specific action (quantity buttons, pay/book/done pill) that writes to this store; the Spend/Pending/Completed stat tiles are computed live from it. Synced to Drive alongside `trackers` (see `SYNCED_KEYS` in `src/services/driveSync.ts`).
- **Theming**: a single plain object, `defaultTheme` in [src/theme/theme.ts](src/theme/theme.ts) (colors/spacing/borderRadius), imported directly by every screen/component — no `ThemeProvider` or context.
- **Android package name** is `com.daytodayproject` ([android/app/build.gradle](android/app/build.gradle)); relevant when working with OAuth clients, deep links, or Play Console config.

## Conventions

- Name variables and functions for what they hold or do, not their type or position — prefer `activeTrackers` over `data`/`arr`/`list`, `handleCreateTracker` over `onPress`/`fn`.
- Booleans read as a question or state (`isActive`, `hasTodayLog`, `showIconPicker`); collections are plural (`trackers`, `pendingTasks`); derived lookup structures say what they're keyed or grouped by (`logsByTracker`, `pendingIds`, `trackersById`).
- Avoid abbreviations unless already idiomatic in this codebase (`qty`, `id`) — spell out things like `quantity`, `tracker`, `amount` elsewhere.
- Match the existing naming already in a file/module before introducing a new convention alongside it.

## Google Drive sync (in progress)

Chosen design for the PRD's "no backend, data lives in the user's own Drive" requirement: **whole-blob auto-sync**, not the PRD's full per-record sync queue (Section 9). AsyncStorage stays the local source of truth; the whole app-data blob is pushed/pulled as one JSON file (`homebook-data.json`) in the signed-in user's Drive App Data folder — a hidden, per-account folder Google itself isolates, so "data goes to whoever is logged in" is enforced by Google, not app code.

- **Push**: on every local data change (trackers today), debounced ~2s, upload the whole blob, overwriting the previous version.
- **Pull**: right after Google sign-in, only if local storage has no data yet, download and restore the blob.
- **Gated to Google accounts only** — the mock email/password login (`authProvider !== 'google'`) has no Drive access and is skipped entirely.
- Low-level Drive REST calls (token via `GoogleSignin.getTokens()`, multipart upload, `alt=media` download) live in `src/services/googleDrive.ts`.

This was chosen over the PRD's full sync-queue architecture because it's proportional to the current codebase (no SQLite/Zustand exist yet) and still satisfies the MVP scope items "Google Drive Backup" and "Restore."

**Known tradeoffs, accepted deliberately — do not silently fix without discussion:**
1. **No conflict resolution.** Same Google account edited on two devices offline → last push wins, other device's changes are silently overwritten. Acceptable for a single-device household user; not safe for real concurrent multi-device editing.
2. **Small data-loss window.** If the app is killed within the ~2s debounce after an edit, that edit never reaches Drive (it stays in local AsyncStorage until the next edit re-triggers a push). Not flushed on background/logout.
3. **No client-side encryption before upload**, despite PRD Section 10 calling for "encrypted backup before upload." The App Data folder is private/hidden via Google's own access control, but blob contents are plain JSON.
4. **Not built for scale.** Every edit re-uploads the entire blob. Fine at household data volumes; if the PRD's full SQLite + sync-queue model is ever built, this whole-blob approach gets replaced, not extended.
