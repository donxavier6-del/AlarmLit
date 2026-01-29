# SoftWake Code Assessment

**Last Updated:** 2026-01-29
**Overall Rating:** 5/10 (Functional but Needs Work)

---

## Summary

| Area | Score | Status |
|------|-------|--------|
| Architecture | 3/10 | 3,926 lines in single file |
| Type Safety | 8/10 | Good TypeScript, minor issues |
| Error Handling | 2/10 | Silent console.log only |
| Performance | 4/10 | Re-renders every second |
| Security | Critical | HIGH severity vulnerability |
| Test Coverage | 0/10 | No tests |

**Recommendation:** Refactor, don't scrap. Core functionality is solid.

---

## Multi-Agent Workflow

We're using a multi-agent approach with Claude Opus 4.5 as orchestrator.

### Available Models

| Model | Strengths | Best For |
|-------|-----------|----------|
| **Claude Opus 4.5** | Deep reasoning, architecture, code review, quality control | Complex bugs, design decisions, orchestration, final review |
| **Kimi K2.5** | 76.8% SWE-Bench, Agent Swarm (100 sub-agents), strong frontend | UI components, visual coding, component extraction |
| **OpenAI Codex** | GPT-5.2-Codex optimized, cloud parallel tasks, fast | Quick fixes, refactors, migrations, running tests |

### Task Assignment Strategy

| Task Type | Assigned To | Rationale |
|-----------|-------------|-----------|
| Bug analysis & critical fixes | Claude Opus 4.5 | Requires deep reasoning, understanding side effects |
| Architecture decisions | Claude Opus 4.5 | Needs full context, consistency enforcement |
| Component extraction | Kimi K2.5 | Frontend specialty, can use Agent Swarm for parallel extraction |
| UI refactoring | Kimi K2.5 | Strong at visual/UI work |
| Test setup & writing | Codex | Fast, good at boilerplate |
| Quick fixes & migrations | Codex | Efficient for straightforward tasks |
| Code review & QA | Claude Opus 4.5 | Final quality gate before merge |

### Workflow Process

1. **Claude (Orchestrator)** analyzes task, breaks it down, writes specific briefs
2. **User** spins up Kimi/Codex sessions with the briefs
3. **Kimi/Codex** executes tasks, commits to feature branches
4. **Claude** reviews PRs, catches issues, ensures consistency
5. **User** merges approved changes

### Model Resources

- [Kimi K2.5 Technical Report](https://www.kimi.com/blog/kimi-k2-5.html)
- [Kimi K2.5 on TechCrunch](https://techcrunch.com/2026/01/27/chinas-moonshot-releases-a-new-open-source-model-kimi-k2-5-and-a-coding-agent/)
- [OpenAI Codex](https://openai.com/codex/)
- [GPT-5.2-Codex Announcement](https://openai.com/index/introducing-gpt-5-2-codex/)

---

## Action Plan

### Phase 1 - Critical (Do Now) `[Claude]`
- [x] Run `npm audit fix` for tar vulnerability
- [x] Fix missing plugin reference in app.json
- [x] Configure Android build (local.properties, notifee repo)
- [x] Fix hardcoded fake data in Insights tab (Lines 1678-1694)

### Phase 2 - Stabilize `[Claude]`
- [x] Fix memory leak in breathing exercise
- [x] Fix race condition in sound preview
- [x] Add error boundaries and proper error handling
- [x] Fix missing break in alarm countdown loop (was already correct)
- [x] Fix NaN handling in math problem

### Phase 3 - Refactor `[Kimi K2.5 + Claude Review]`
- [ ] Extract components from App.tsx:
  - [ ] `AlarmsList.tsx`
  - [ ] `AlarmEditor.tsx`
  - [ ] `AlarmScreen.tsx` (dismiss screens)
  - [ ] `SleepTracker.tsx`
  - [ ] `InsightsChart.tsx`
  - [ ] `SettingsPanel.tsx`
- [ ] Extract custom hooks:
  - [ ] `useAlarms.ts`
  - [ ] `useSleepTracking.ts`
  - [ ] `useSettings.ts`
  - [ ] `useAlarmSound.ts`
- [ ] Extract utilities:
  - [ ] `timeFormatting.ts`
  - [ ] `constants/options.ts`

### Phase 4 - Optimize `[Codex + Claude Review]`
- [ ] Add useMemo/useCallback for performance
- [ ] Replace ScrollView with FlatList for alarms
- [ ] Add debouncing to AsyncStorage saves
- [ ] Set up Jest and testing infrastructure
- [ ] Write unit tests for hooks
- [ ] Add ESLint + Prettier configuration

---

## Critical Bugs

### 1. ~~Memory Leak in Breathing Exercise~~ FIXED
**Location:** App.tsx Lines 842-887
**Severity:** High
**Issue:** If alarm is dismissed mid-breathing (e.g., user exits app), `breathingTimerRef.current` timeout fires in background. Could call `triggerAlarm()` with stale alarm.
**Resolution:** Added useEffect cleanup that clears breathingTimerRef when alarmScreenVisible becomes false or on unmount.

### 2. ~~Race Condition in Sound Preview~~ FIXED
**Location:** App.tsx Lines 1046-1098
**Severity:** Medium
**Issue:** `playPreviewSound()` can be called multiple times rapidly. If previous `.stopAsync()` is pending, new sound starts before cleanup completes.
**Resolution:** Added `isPreviewPlayingRef`, `previewTimeoutRef`, and `stopPreviewSound()` helper. All inline cleanup calls now use the centralized function.

### 3. ~~Hardcoded Fake Data in Insights~~ FIXED
**Location:** App.tsx Lines 1616-1700
**Severity:** High
**Issue:** Insights tab shows hardcoded test data instead of actual `sleepData`.
**Fix:** ~~Use `getWeeklyData()` function instead of hardcoded array.~~
**Resolution:** Replaced with dynamic data using `getWeeklyData()`, `getSleepStats()`, and `settings.sleepGoalHours`. Added empty state when no sleep data exists.

### 4. ~~Missing Break in Alarm Countdown~~ NOT A BUG
**Location:** App.tsx Lines 1128-1140
**Severity:** N/A
**Issue:** After finding first matching day for recurring alarm, loop continues instead of breaking.
**Resolution:** Code inspection revealed the break statement IS present at line 1137. This was a false positive in the original assessment.

### 5. ~~NaN Handling in Math Problem~~ FIXED
**Location:** App.tsx Line 1067-1076
**Severity:** Low
**Issue:** `parseInt('abc', 10)` returns `NaN`, which never equals `mathProblem.answer`.
**Resolution:** Added input validation with regex `/^-?\d+$/` to check for valid integers before parsing. Invalid input now shows brief "wrong" feedback without generating a new problem.

### 6. Stale Closure in Breathing Exercise
**Location:** App.tsx Lines 842-887
**Severity:** Medium
**Issue:** `runPhase()` captures `cycle` and `phase` as local variables. If user switches tabs and returns, UI shows wrong cycle count.

### 7. Data Loss on Concurrent Saves
**Location:** App.tsx Lines 562-600
**Severity:** Low
**Issue:** Multiple useEffect hooks can trigger simultaneous AsyncStorage writes. App crash mid-write could corrupt data.

---

## Code Quality Issues

### Architecture Problems

**Single-File Anti-Pattern:**
- 3,926 lines in App.tsx is unmaintainable
- 38 useState calls in one component
- Entire app re-renders on any state change
- Can't unit test individual logic

**Recommended Component Structure:**
```
src/
├── components/
│   ├── AlarmsList.tsx
│   ├── AlarmEditor.tsx
│   ├── AlarmScreen.tsx
│   ├── SleepTracker.tsx
│   ├── InsightsChart.tsx
│   └── SettingsPanel.tsx
├── hooks/
│   ├── useAlarms.ts
│   ├── useSleepTracking.ts
│   ├── useSettings.ts
│   └── useAlarmSound.ts
├── utils/
│   ├── timeFormatting.ts
│   └── alarmScheduling.ts
└── constants/
    └── options.ts
```

### Code Duplication

**Time Formatting (4 implementations):**
- Lines 670-674: Inside `scheduleAlarmNotifications`
- Lines 1153-1162: `formatTime()`
- Lines 1164-1168: `formatAlarmTime()`
- Lines 1357-1361: `formatSettingsTime()`

**Alarm Disable Logic (7 occurrences):**
- Lines 807-809, 827-829, 901-903, 921-924, 1117-1119
- Should extract: `const disableOneTimeAlarm = (alarmId) => {...}`

**Dismiss State Reset (4 occurrences):**
- Lines 795-832, 889-906, 908-929, 1103-1131
- All contain duplicate state reset code
- Should extract: `const dismissAlarm = (wakeTime: Date) => {...}`

**Settings Cycle Pattern (4 occurrences):**
- Lines 1731-1733, 1745-1747, 1759-1761, 1834-1836
- Should extract: `cycleSetting(settingKey, optionsArray)`

### Magic Numbers

Hardcoded values that should be constants:
- `setBedtimeHour(22)` - appears 10+ times
- Timeouts: `2000`, `2500`, `4000`, `7000`, `8000`
- Should create: `BEDTIME_RESET_HOUR`, `DISMISS_ANIMATION_DURATION`, etc.

### Error Handling

**Current State:** All errors silently logged with `console.log()`

**Locations with silent failures:**
- Lines 552, 569, 582, 596, 608, 1047, 1099
- Line 619: `.catch(() => {})` swallows errors completely
- Line 1091: Unhandled promise rejection in setTimeout

**Needed:**
- Error boundaries for React components
- Sentry or similar for production error tracking
- User-facing error messages for critical failures

### Performance Issues

1. **Excessive Re-renders:**
   - Line 733-738: `setInterval` updates `currentTime` every second
   - Causes full app re-render each tick
   - Only 1 `useCallback` in entire codebase

2. **Missing Optimizations:**
   - No `useMemo` for computed values
   - No `useCallback` for event handlers
   - Dynamic style objects created every render

3. **AsyncStorage:**
   - No debouncing on save operations
   - Could write hundreds of times during editing

4. **Lists:**
   - Using ScrollView instead of FlatList for alarms
   - No virtualization for large lists

---

## TypeScript Issues

### Good Practices
- Proper type annotations for all 38 useState calls
- Union types for enums: `AlarmSound`, `DismissType`, `WakeIntensity`, `TabName`
- Generic type parameters on refs

### Issues

**Unsafe Type Cast (Line 1249):**
```typescript
const dismissType = (alarm.dismissType as string) === 'off'
  ? 'simple'
  : (alarm.dismissType || 'simple');
```
Suggests possible data migration issue.

**Generic Error Typing (Line 37 in nativeAlarm.ts):**
```typescript
} catch (error: any) {
```
Should be `catch (error: unknown)` or specific error type.

**Untyped Native Module:**
- `NativeModules.AlarmModule` has no type checking
- Could be undefined at runtime

---

## Dependencies

### Security Vulnerabilities

**HIGH SEVERITY:**
```
tar <7.5.7 - Arbitrary File Creation/Overwrite via Hardlink Path Traversal
```
**Action:** Run `npm audit fix` immediately

### Outdated Packages
| Package | Current | Latest |
|---------|---------|--------|
| react | 19.1.0 | 19.2.4 |
| react-native | 0.81.5 | 0.83.1 |
| react-native-gesture-handler | 2.28.0 | 2.30.0 |

### Missing Dependencies
- No error tracking (`@sentry/react-native`)
- No analytics
- No testing (`jest`, `@testing-library/react-native`)
- No linting (`eslint`, `prettier`)

### Problematic Dependencies
- `react-native-wheel-scrollview-picker` - Not actively maintained
- Manual sound pattern implementation instead of using `expo-av` built-in patterns

---

## Strengths (What to Keep)

- Well-structured TypeScript interfaces (`Alarm`, `Settings`, `SleepEntry`)
- Proper separation in service files (`nativeAlarm.ts`, `alarmStorage.ts`)
- Consistent theme system with dark/light mode
- Clear configuration constants
- Working core alarm functionality
- Sound/haptics integration
- AsyncStorage persistence pattern
- Native module integration for Android

---

## Progress Log

### 2026-01-29
- Initial assessment completed
- Identified 7 critical bugs
- Created refactoring plan
- Security vulnerability identified
- **Fixed:** `npm audit fix` - resolved tar vulnerability
- **Fixed:** Removed missing `./plugins/withAlarmSound` from app.json
- **Fixed:** Ran `npx expo prebuild` to regenerate Android folder
- **Fixed:** Added `local.properties` with SDK path
- **Fixed:** Added notifee maven repository to build.gradle
- **Success:** App builds and runs on Android emulator
- **Note:** expo-av deprecation warning (will be removed in SDK 54)
- Established multi-agent workflow strategy (Claude + Kimi + Codex)
- **Fixed:** Insights tab hardcoded fake data - now uses real sleepData
- Kimi Task 1 complete: extracted constants (ba2b20d)
- Kimi Task 2 complete: time formatting utils (855cbd1)
- Kimi Task 3 complete: InsightsChart + shared types (33addf9)
- Kimi Task 4 complete: SettingsPanel component (c160ba2)
- Kimi Task 5 assigned: extract AlarmsList component
- **App.tsx reduced:** 3,661 lines (from ~3,900)
- **Fixed:** Memory leak in breathing exercise (added cleanup useEffect)
- **Fixed:** Race condition in sound preview (added refs + stopPreviewSound helper)
- **Fixed:** NaN handling in math problem (added regex validation)
- **Added:** ErrorBoundary component (src/components/ErrorBoundary.tsx)
- **Verified:** Alarm countdown loop was already correct (break exists)

---

## Notes

### Build Configuration
- Android SDK: `C:/Users/oluto/AppData/Local/Android/Sdk`
- Emulators available: `Medium_Phone_API_35`, `TipEase_Emulator`
- App package: `com.donxavier6.softwake`

### Known Warnings (Non-blocking)
- `expo-av` deprecated, will be removed in SDK 54 - migrate to `expo-audio` and `expo-video`
- Gradle deprecation warnings for Kotlin options DSL

### Agent Briefs (For Delegation)

| Brief | File | Status |
|-------|------|--------|
| Kimi K2.5 - Component Extraction | `KIMI_BRIEF.md` | Task 1 assigned |
| Codex - Testing Setup | _Not created yet_ | Pending Phase 4 |

**Instructions:** Point agent to the brief file. They read it + `CLAUDE.md` + `CODE_ASSESSMENT.md` first.
