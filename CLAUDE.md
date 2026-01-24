# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Softwake - a premium alarm clock app. React Native + Expo SDK 54 + TypeScript. Single-file architecture: all UI and logic lives in `App.tsx` (~3500 lines). Entry point is `index.ts` which calls `registerRootComponent(App)`.

## Commands

```bash
npx expo start          # Start dev server (Expo Go or dev client)
npx expo start --android  # Start on Android
npx expo start --ios      # Start on iOS
npx expo start --web      # Start in browser
npm install             # Install dependencies
```

No test or lint scripts are configured.

## Architecture

Single-file app (`App.tsx`) with 4 tab screens: Alarms, Morning, Insights, Settings. State is managed with React hooks (`useState`/`useEffect`/`useRef`). Data persisted via AsyncStorage with keys:
- `@softwake_alarms` - alarm list
- `@softwake_sleep_data` - sleep tracking entries
- `@softwake_settings` - user preferences

## Key Dependencies

- `expo-av` - alarm sound playback
- `expo-haptics` - haptic feedback
- `expo-notifications` - alarm scheduling (dev builds only, not Expo Go)
- `expo-sensors` (Accelerometer) - shake-to-dismiss
- `expo-linear-gradient` - gradient backgrounds
- `react-native-gesture-handler` (Swipeable) - swipe-to-delete alarms
- `react-native-wheel-scrollview-picker` - time picker wheels
- `@react-native-async-storage/async-storage` - local persistence

## Constraints

- Expo Go does not support push notifications in SDK 53+. The app runtime-checks `Constants.executionEnvironment` and skips notification code in Expo Go.
- New Architecture is enabled (`"newArchEnabled": true`).
- Portrait orientation only.
- Dark UI style (`"userInterfaceStyle": "dark"`).

## Design Tokens

- Background: `#0a0a0a`
- Accent: `#818CF8`
- Text: `#FFFFFF` (primary), `#9999AA` (muted)
- Gradient stops: `#0a0a1a` / `#1a1a2e` / `#0f0f23`
- Splash/adaptive icon background: `#1a1a2e`

## Patterns

- All screens use `LinearGradient` as root background.
- Styles defined at bottom of App.tsx via `StyleSheet.create`.
- No separate component files - everything inline in `App.tsx`.

## Types

Key types defined at top of App.tsx:
- `Alarm` - alarm config (time, days, sound, dismiss method, wake intensity)
- `Settings` - app-wide preferences
- `SleepEntry` - bedtime/wake timestamps
- `AlarmSound`, `DismissType`, `WakeIntensity`, `TabName` - union string literals
