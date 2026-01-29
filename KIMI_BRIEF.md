# Kimi K2.5 Project Brief

## Who You Are

You are **Kimi K2.5**, working as part of a multi-agent development team on the **SoftWake** project.

**Team Structure:**
| Agent | Role | Responsibilities |
|-------|------|------------------|
| Claude Opus 4.5 | Orchestrator | Bug fixes, architecture, code review, final QA |
| You (Kimi K2.5) | Refactor Specialist | Component extraction, UI modularization |
| Codex | Utility | Testing, quick fixes, optimization |

**Important:** Claude reviews all your work before merge. Work on feature branches.

---

## Project Context

### What is SoftWake?
A premium gentle alarm clock app for Android (React Native + Expo).

### Tech Stack
- React Native 0.81.5
- Expo SDK 54
- TypeScript
- AsyncStorage for persistence
- expo-notifications, expo-av, expo-haptics

### The Problem
The entire app is in **one file**: `App.tsx` (~3,900 lines). This is unmaintainable.

### Current State
- App builds and runs on Android emulator
- Security vulnerabilities: FIXED
- Bug fixes: IN PROGRESS (Claude handling)
- Refactoring: YOUR JOB

---

## Files You Must Read

Before doing ANY work, read these files in order:

1. **`CLAUDE.md`** - Project conventions, architecture, design tokens
2. **`CODE_ASSESSMENT.md`** - Full assessment, bugs list, action plan
3. **`App.tsx`** - The monolith (scan structure, don't memorize)

---

## Target Architecture

We're breaking `App.tsx` into this structure:

```
src/
├── components/
│   ├── AlarmsList.tsx       # Alarm list with swipe-to-delete
│   ├── AlarmEditor.tsx      # Create/edit alarm modal
│   ├── AlarmScreen.tsx      # Dismiss screens (shake, breathing, math)
│   ├── SleepTracker.tsx     # Bedtime logging modal
│   ├── InsightsChart.tsx    # Weekly sleep visualization
│   └── SettingsPanel.tsx    # Settings tab
├── hooks/
│   ├── useAlarms.ts         # Alarm state & logic
│   ├── useSleepTracking.ts  # Sleep data management
│   ├── useSettings.ts       # Settings state
│   └── useAlarmSound.ts     # Sound playback
├── utils/
│   └── timeFormatting.ts    # Unified time formatting
└── constants/
    └── options.ts           # All option arrays
```

---

## Rules (MUST FOLLOW)

1. **DO NOT fix bugs** - Claude is handling bugs. Extract code as-is.
2. **DO NOT change behavior** - Same inputs = same outputs.
3. **DO NOT modify styles** - Keep StyleSheet definitions where they are for now.
4. **DO use TypeScript** - Maintain all existing types.
5. **DO work incrementally** - One extraction per task, wait for review.
6. **DO create feature branches** - `git checkout -b refactor/task-name`
7. **DO ask questions** - If unclear, ask before assuming.

---

## Task List

| # | Task | Status |
|---|------|--------|
| 1 | Extract `constants/options.ts` | COMPLETE |
| 2 | Extract `utils/timeFormatting.ts` | COMPLETE |
| 3 | Extract `components/InsightsChart.tsx` | COMPLETE |
| 4 | Extract `components/SettingsPanel.tsx` | COMPLETE |
| 5 | Extract `components/AlarmsList.tsx` | ASSIGNED |
| 3 | Extract `components/InsightsChart.tsx` | PENDING |
| 4 | Extract `components/SettingsPanel.tsx` | PENDING |
| 5 | Extract `hooks/useSettings.ts` | PENDING |
| 6 | Extract `components/AlarmsList.tsx` | PENDING |
| 7 | Extract `hooks/useAlarms.ts` | PENDING |
| 8 | Extract remaining components | PENDING |

---

## TASK 1: Extract Constants

### Objective
Move all option/configuration arrays from `App.tsx` to `src/constants/options.ts`.

### What to Extract

Find these constants near the top of `App.tsx` (around lines 100-200):

```typescript
const SNOOZE_OPTIONS = [...]
const WAKE_INTENSITY_OPTIONS = [...]
const SOUND_OPTIONS = [...]
const DISMISS_OPTIONS = [...]
const DAYS = [...]
const AFFIRMATIONS = [...]
```

### Steps

1. **Create branch:**
   ```bash
   git checkout -b refactor/extract-constants
   ```

2. **Create directory:**
   ```bash
   mkdir -p src/constants
   ```

3. **Create `src/constants/options.ts`:**
   - Move all the constant arrays listed above
   - Export each one
   - Add proper TypeScript types if not already typed

4. **Update `App.tsx`:**
   - Add import statement at top
   - Remove the moved constants
   - Verify no duplicate definitions remain

5. **Test:**
   - Run the app: `npx expo start --android`
   - Verify all screens still work
   - Check alarms tab, settings tab specifically

### Expected Output

Show me:
1. The complete `src/constants/options.ts` file
2. The import line added to `App.tsx`
3. Confirmation that the app still runs

### DO NOT
- Change any values in the arrays
- Add new constants
- Modify anything else in App.tsx
- Commit yet (wait for review)

---

## Questions?

If anything is unclear about:
- Where a constant is located
- Whether something should be extracted
- How something is used

**ASK before making assumptions.** Claude will clarify.

---

## When Done

Reply with:
1. The new file content
2. The changes to App.tsx
3. "Ready for review"

Claude will review and either approve or request changes.

---
---

## TASK 5: Extract AlarmsList Component

### Objective
Extract the Alarms tab list (alarm items with swipe-to-delete) into `src/components/AlarmsList.tsx`.

### What to Extract

Find in App.tsx the alarms list section:
```tsx
{activeTab === 'alarms' && (
  <View style={styles.tabContent}>
    {/* Clock display */}
    ...
    {/* Alarms list with PanGestureHandler items */}
    ...
    {/* Add button */}
  </View>
)}
```

### Steps

1. **Create branch:**
   ```bash
   git checkout -b refactor/extract-alarms-list
   ```

2. **Create `src/components/AlarmsList.tsx`:**
   - Extract the alarm list rendering (the ScrollView with alarm items)
   - Keep the PanGestureHandler swipe-to-delete logic
   - Props interface:
     ```typescript
     interface AlarmsListProps {
       alarms: Alarm[];
       theme: Theme;
       onToggleAlarm: (id: string, enabled: boolean) => void;
       onEditAlarm: (alarm: Alarm) => void;
       onDeleteAlarm: (id: string) => void;
       formatAlarmTime: (hour: number, minute: number) => string;
     }
     ```

3. **Keep in App.tsx:**
   - The clock display (time, ampm)
   - The countdown text
   - The Add button (or extract separately)

4. **Update `App.tsx`:**
   - Import and use the new component

### Notes
- This component uses PanGestureHandler for swipe-to-delete
- Import DAYS from constants for day display
- The alarm toggle should call `onToggleAlarm` prop

### Expected Output
Show me:
1. The complete `src/components/AlarmsList.tsx` file
2. The usage in App.tsx

---

## TASK 4: Extract SettingsPanel Component

### Objective
Extract the Settings tab content into `src/components/SettingsPanel.tsx`.

### What to Extract

Find the settings section in App.tsx:
```tsx
{activeTab === 'settings' && (
  <ScrollView style={styles.settingsTabContent}>
    ...
  </ScrollView>
)}
```

### Steps

1. **Create branch:**
   ```bash
   git checkout -b refactor/extract-settings-panel
   ```

2. **Create `src/components/SettingsPanel.tsx`:**
   - Extract the entire settings ScrollView content
   - Props interface:
     ```typescript
     interface SettingsPanelProps {
       settings: Settings;
       theme: Theme;
       updateSettings: (updates: Partial<Settings>) => void;
       // Any other needed props for formatSettingsTime, option arrays, etc.
     }
     ```
   - Import shared types, constants (WAKE_INTENSITY_OPTIONS, etc.), and formatTimeWithPeriod

3. **Update `App.tsx`:**
   - Import the new component
   - Replace inline JSX with: `<SettingsPanel ... />`

### Notes
- Settings panel has several TouchableOpacity handlers that cycle through options
- Keep the same visual appearance and behavior
- Import constants from `src/constants/options.ts`
- Import time formatting from `src/utils/timeFormatting.ts`

### Expected Output
Show me:
1. The complete `src/components/SettingsPanel.tsx` file
2. The usage in App.tsx

---

## TASK 3: Extract InsightsChart Component

### Objective
Extract the Insights tab content into a standalone component `src/components/InsightsChart.tsx`.

### What to Extract

Find the insights section in App.tsx (around lines 1616-1700):
```tsx
{activeTab === 'insights' && (
  <ScrollView style={styles.insightsContainer}>
    ...
  </ScrollView>
)}
```

### Steps

1. **Create branch:**
   ```bash
   git checkout -b refactor/extract-insights-chart
   ```

2. **Create `src/components/InsightsChart.tsx`:**
   - Extract the entire insights ScrollView content
   - Accept these props:
     ```typescript
     interface InsightsChartProps {
       sleepData: SleepEntry[];
       settings: Settings;
       theme: typeof THEMES.dark;
       getWeeklyData: () => { day: string; duration: number; date: Date }[];
       getSleepStats: () => SleepStatsResult | null;
     }
     ```
   - Import styles from App.tsx (for now, pass as prop or import)
   - Keep the empty state handling

3. **Update `App.tsx`:**
   - Import the new component
   - Replace the inline JSX with: `<InsightsChart ... />`
   - Export the types that InsightsChart needs (SleepEntry, Settings, etc.)

4. **Move types to shared file (optional but recommended):**
   - Create `src/types/index.ts`
   - Move `SleepEntry`, `Settings`, `Alarm` types there
   - Import in both App.tsx and InsightsChart.tsx

### Expected Output

Show me:
1. The complete `src/components/InsightsChart.tsx` file
2. The import and usage in App.tsx
3. Any shared types file if created

### DO NOT
- Change any visual styling
- Modify the data calculations (getWeeklyData, getSleepStats stay in App.tsx for now)
- Break the empty state handling

### Notes
- The Insights section was recently updated to use real data (not hardcoded)
- Make sure to preserve all the dynamic calculations

---

## TASK 2: Extract Time Formatting Utils

### Objective
Consolidate the 4 duplicate time formatting functions from `App.tsx` into `src/utils/timeFormatting.ts`.

### What to Extract

Find these functions scattered in App.tsx:

1. **Inside `scheduleAlarmNotifications`** (around line 670-674):
   ```typescript
   const formatTime = (h: number, m: number) => {
     return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
   };
   ```

2. **`formatTime` function** (around line 1153-1162):
   ```typescript
   const formatTime = (date: Date) => {
     // formats time for display
   };
   ```

3. **`formatAlarmTime` function** (around line 1164-1168):
   ```typescript
   const formatAlarmTime = (hour: number, minute: number) => {
     // formats alarm time
   };
   ```

4. **`formatSettingsTime` function** (around line 1357-1361):
   ```typescript
   const formatSettingsTime = (hour: number, minute: number) => {
     // formats time for settings display
   };
   ```

### Steps

1. **Create branch:**
   ```bash
   git checkout -b refactor/extract-time-formatting
   ```

2. **Create directory:**
   ```bash
   mkdir -p src/utils
   ```

3. **Create `src/utils/timeFormatting.ts`:**
   - Analyze all 4 functions to understand their purposes
   - Create a unified API that covers all use cases
   - Export named functions with clear names:
     - `formatTimeHHMM(hour: number, minute: number): string` - "07:30"
     - `formatTimeDisplay(date: Date): string` - "7:30 AM"
     - `formatTimeWithPeriod(hour: number, minute: number): string` - "7:30 AM"
   - Add JSDoc comments explaining each function

4. **Update `App.tsx`:**
   - Add import statement
   - Replace inline functions with imported ones
   - Remove duplicate definitions
   - Update any call sites to use new function names

5. **Test:**
   - Run the app
   - Check time displays on: Alarms list, Alarm editor, Settings tab

### Expected Output

Show me:
1. The complete `src/utils/timeFormatting.ts` file
2. The import line added to `App.tsx`
3. Example of how you replaced a call site
4. Confirmation that the app still runs

### DO NOT
- Change how times are displayed (format must match original)
- Add timezone handling (keep it simple)
- Modify anything unrelated to time formatting

---
