import { NativeModules, Platform, Linking } from 'react-native';
import type { Alarm, AlarmSound } from '../types';

const { AlarmModule } = NativeModules;

/** Map AlarmSound names to native raw resource names */
const SOUND_TO_RESOURCE: Record<AlarmSound, string> = {
  sunrise: 'alarm_gentle',
  ocean: 'alarm_gentle',
  forest: 'alarm_sound',
  chimes: 'alarm_sound',
  piano: 'alarm_gentle',
  birds: 'alarm_sound',
};

export interface NativeAlarmService {
  scheduleAlarm(id: string, timestamp: number, soundName?: string): Promise<boolean>;
  cancelAlarm(id: string): Promise<boolean>;
  stopAlarm(): Promise<boolean>;
  snoozeAlarm(minutes: number, soundName?: string): Promise<boolean>;
  checkExactAlarmPermission(): Promise<boolean>;
  getLaunchAlarmId(): Promise<string | null>;
  openAlarmPermissionSettings(): void;
}

export const generateAlarmId = (): string => {
  return `alarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

class NativeAlarmManager implements NativeAlarmService {
  private isAndroid = Platform.OS === 'android';

  async scheduleAlarm(
    id: string,
    timestamp: number,
    soundName: string = 'alarm_gentle'
  ): Promise<boolean> {
    if (!this.isAndroid) {
      console.warn('Native alarms only supported on Android');
      return false;
    }

    if (timestamp <= Date.now()) {
      throw new Error('Alarm timestamp must be in the future');
    }

    try {
      return await AlarmModule.scheduleAlarm(id, timestamp, soundName);
    } catch (error: any) {
      if (error.code === 'PERMISSION_DENIED') {
        console.error('Exact alarm permission not granted');
      }
      throw error;
    }
  }

  async cancelAlarm(id: string): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.cancelAlarm(id);
    } catch (error) {
      console.error('Failed to cancel native alarm:', error);
      throw error;
    }
  }

  async stopAlarm(): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.stopAlarm();
    } catch (error) {
      console.error('Failed to stop native alarm:', error);
      throw error;
    }
  }

  async snoozeAlarm(minutes: number = 9, soundName: string = 'alarm_gentle'): Promise<boolean> {
    if (!this.isAndroid) return false;

    try {
      return await AlarmModule.snoozeAlarm(minutes, soundName);
    } catch (error) {
      console.error('Failed to snooze alarm:', error);
      throw error;
    }
  }

  async checkExactAlarmPermission(): Promise<boolean> {
    if (!this.isAndroid) return true;

    try {
      return await AlarmModule.checkExactAlarmPermission();
    } catch (error) {
      console.error('Failed to check alarm permission:', error);
      return false;
    }
  }

  async getLaunchAlarmId(): Promise<string | null> {
    if (!this.isAndroid) return null;

    try {
      const id = await AlarmModule.getLaunchAlarmId();
      return id || null;
    } catch (error) {
      console.error('Failed to get launch alarm id:', error);
      return null;
    }
  }

  openAlarmPermissionSettings(): void {
    if (!this.isAndroid) return;
    Linking.openSettings();
  }
}

export const nativeAlarm = new NativeAlarmManager();

/**
 * Compute the next trigger timestamp for an alarm based on its hour, minute, and repeat days.
 */
function getNextTriggerTimestamp(alarm: Alarm): number | null {
  if (!alarm.enabled) return null;

  const now = new Date();
  const today = now.getDay(); // 0=Sun

  // Build a Date for alarm time today
  const alarmToday = new Date();
  alarmToday.setHours(alarm.hour, alarm.minute, 0, 0);

  const isOneTime = alarm.days.every((d) => !d);

  if (isOneTime) {
    // One-time alarm: schedule for today if in the future, otherwise tomorrow
    if (alarmToday.getTime() > now.getTime()) {
      return alarmToday.getTime();
    }
    alarmToday.setDate(alarmToday.getDate() + 1);
    return alarmToday.getTime();
  }

  // Repeating alarm: find the next day that's enabled
  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (today + offset) % 7;
    if (!alarm.days[dayIndex]) continue;

    const candidate = new Date(alarmToday);
    candidate.setDate(candidate.getDate() + offset);

    if (candidate.getTime() > now.getTime()) {
      return candidate.getTime();
    }
  }

  // All enabled days are in the past this week — wrap to next week
  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (today + offset) % 7;
    if (!alarm.days[dayIndex]) continue;

    const candidate = new Date(alarmToday);
    candidate.setDate(candidate.getDate() + offset + 7);
    return candidate.getTime();
  }

  return null;
}

/**
 * Cancel all existing native alarms and reschedule enabled ones.
 * Call this whenever alarms change and on app startup/foreground resume.
 */
export async function scheduleNativeAlarms(alarms: Alarm[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Cancel all existing alarms
  for (const alarm of alarms) {
    try {
      await nativeAlarm.cancelAlarm(alarm.id);
    } catch (_) {
      // Ignore cancel errors for alarms that weren't scheduled
    }
  }

  // Schedule enabled alarms
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    const timestamp = getNextTriggerTimestamp(alarm);
    if (!timestamp) continue;

    const soundResource = SOUND_TO_RESOURCE[alarm.sound] || 'alarm_gentle';

    try {
      await nativeAlarm.scheduleAlarm(alarm.id, timestamp, soundResource);
    } catch (error) {
      console.error(`Failed to schedule native alarm ${alarm.id}:`, error);
    }
  }
}

/** Get the native resource name for an AlarmSound */
export function getSoundResourceName(sound: AlarmSound): string {
  return SOUND_TO_RESOURCE[sound] || 'alarm_gentle';
}
