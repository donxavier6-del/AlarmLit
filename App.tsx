import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  Animated,
  TextInput,
  Platform,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import WheelPicker from 'react-native-wheel-scrollview-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Accelerometer } from 'expo-sensors';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Check if running in Expo Go (where push notifications are not supported in SDK 53+)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Configure notification handler (only in development builds, not Expo Go)
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type AlarmSound = 'sunrise' | 'ocean' | 'forest' | 'chimes' | 'piano' | 'birds';
type DismissType = 'simple' | 'breathing' | 'affirmation' | 'math' | 'shake';
type WakeIntensity = 'whisper' | 'gentle' | 'moderate' | 'energetic';
type TabName = 'alarms' | 'morning' | 'insights' | 'settings';

type Alarm = {
  id: string;
  hour: number;
  minute: number;
  days: boolean[];
  enabled: boolean;
  label: string;
  snooze: number;
  wakeIntensity: WakeIntensity;
  sound: AlarmSound;
  dismissType: DismissType;
};

type MathProblem = {
  question: string;
  answer: number;
};

type SleepEntry = {
  id: string;
  bedtime: number; // timestamp
  wakeTime: number; // timestamp
  sleepDuration: number; // minutes
};

type Settings = {
  bedtimeReminderEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
};

const SNOOZE_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
];

const WAKE_INTENSITY_OPTIONS: { label: string; value: WakeIntensity; volume: number }[] = [
  { label: 'Whisper', value: 'whisper', volume: 0.3 },
  { label: 'Gentle', value: 'gentle', volume: 0.5 },
  { label: 'Moderate', value: 'moderate', volume: 0.75 },
  { label: 'Energetic', value: 'energetic', volume: 1.0 },
];

const SOUND_OPTIONS: { label: string; value: AlarmSound; icon: string }[] = [
  { label: 'Sunrise', value: 'sunrise', icon: '☀️' },
  { label: 'Ocean', value: 'ocean', icon: '🌊' },
  { label: 'Forest', value: 'forest', icon: '🌲' },
  { label: 'Chimes', value: 'chimes', icon: '🔔' },
  { label: 'Soft Piano', value: 'piano', icon: '🎹' },
  { label: 'Birds', value: 'birds', icon: '🐦' },
];

const DISMISS_OPTIONS: { label: string; value: DismissType; icon: string; description: string; isMission?: boolean }[] = [
  { label: 'Simple', value: 'simple', icon: '⏹️', description: 'One tap to dismiss' },
  { label: 'Breathing Exercise', value: 'breathing', icon: '🌬️', description: 'Complete a breathing cycle', isMission: true },
  { label: 'Type Affirmation', value: 'affirmation', icon: '✨', description: 'Type a positive affirmation', isMission: true },
  { label: 'Math Problem', value: 'math', icon: '🧮', description: 'Solve a math problem', isMission: true },
  { label: 'Shake Phone', value: 'shake', icon: '📳', description: 'Shake your phone to wake up', isMission: true },
];

const SHAKE_THRESHOLD = 1.5;
const REQUIRED_SHAKES = 5;

const AFFIRMATIONS = [
  'I am ready for a great day',
  'Today I choose positivity',
  'I am grateful and energized',
  'I welcome this new day',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STORAGE_KEY = '@softwake_alarms';
const SLEEP_STORAGE_KEY = '@softwake_sleep_data';
const SETTINGS_STORAGE_KEY = '@softwake_settings';
const BEDTIME_NOTIFICATION_ID = 'bedtime-reminder';

const DEFAULT_SETTINGS: Settings = {
  bedtimeReminderEnabled: false,
  bedtimeHour: 22,
  bedtimeMinute: 0,
};

// Premium Wheel Time Picker with smooth scrolling like iOS/Android alarm apps
type TimePickerProps = {
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  minuteStep?: number;
};

// Generate hour data (1-12)
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const AMPM = ['AM', 'PM'];

const TimePicker = ({ hour, minute, onHourChange, onMinuteChange, minuteStep = 1 }: TimePickerProps) => {
  const displayHour = hour % 12 || 12;
  const isPM = hour >= 12;
  const lastHourRef = useRef(displayHour);
  const lastMinuteRef = useRef(minute);
  const lastAmPmRef = useRef(isPM ? 1 : 0);

  // Generate minute options based on step
  const minuteOptions: number[] = [];
  for (let i = 0; i < 60; i += minuteStep) {
    minuteOptions.push(i);
  }

  const handleHourChange = (index: number) => {
    const newDisplayHour = HOURS[index];
    if (newDisplayHour !== lastHourRef.current) {
      lastHourRef.current = newDisplayHour;
      Haptics.selectionAsync();
      if (isPM) {
        onHourChange(newDisplayHour === 12 ? 12 : newDisplayHour + 12);
      } else {
        onHourChange(newDisplayHour === 12 ? 0 : newDisplayHour);
      }
    }
  };

  const handleMinuteChange = (index: number) => {
    const newMinute = minuteOptions[index];
    if (newMinute !== lastMinuteRef.current) {
      lastMinuteRef.current = newMinute;
      Haptics.selectionAsync();
      onMinuteChange(newMinute);
    }
  };

  const handleAMPMChange = (index: number) => {
    if (index !== lastAmPmRef.current) {
      lastAmPmRef.current = index;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (index === 0 && isPM) {
        onHourChange(hour - 12);
      } else if (index === 1 && !isPM) {
        onHourChange(hour + 12);
      }
    }
  };

  const renderHourItem = (data: number, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.itemText,
        isSelected && timePickerStyles.selectedItemText
      ]}>
        {data}
      </Text>
    </View>
  );

  const renderMinuteItem = (data: number, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.itemText,
        isSelected && timePickerStyles.selectedItemText
      ]}>
        {data.toString().padStart(2, '0')}
      </Text>
    </View>
  );

  const renderAMPMItem = (data: string, index: number, isSelected: boolean) => (
    <View style={timePickerStyles.itemContainer}>
      <Text style={[
        timePickerStyles.ampmText,
        isSelected && timePickerStyles.selectedAmpmText
      ]}>
        {data}
      </Text>
    </View>
  );

  return (
    <View style={timePickerStyles.container}>
      {/* Selection highlight overlay */}
      <View style={timePickerStyles.selectionHighlight} pointerEvents="none" />

      {/* Hour picker */}
      <View style={timePickerStyles.wheelWrapper}>
        <WheelPicker
          dataSource={HOURS}
          selectedIndex={HOURS.indexOf(displayHour)}
          onValueChange={(_data: number | undefined, index: number) => handleHourChange(index)}
          renderItem={renderHourItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>

      <Text style={timePickerStyles.separator}>:</Text>

      {/* Minute picker */}
      <View style={timePickerStyles.wheelWrapper}>
        <WheelPicker
          dataSource={minuteOptions}
          selectedIndex={minuteOptions.indexOf(minute)}
          onValueChange={(_data: number | undefined, index: number) => handleMinuteChange(index)}
          renderItem={renderMinuteItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>

      {/* AM/PM picker */}
      <View style={timePickerStyles.ampmWrapper}>
        <WheelPicker
          dataSource={AMPM}
          selectedIndex={isPM ? 1 : 0}
          onValueChange={(_data: string | undefined, index: number) => handleAMPMChange(index)}
          renderItem={renderAMPMItem}
          itemHeight={60}
          wrapperHeight={180}
          wrapperBackground="transparent"
          highlightColor="transparent"
          highlightBorderWidth={0}
        />
      </View>
    </View>
  );
};

const timePickerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  selectionHighlight: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 60,
    top: '50%',
    marginTop: -30,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  wheelWrapper: {
    width: 80,
    height: 180,
    overflow: 'hidden',
  },
  ampmWrapper: {
    width: 70,
    height: 180,
    overflow: 'hidden',
    marginLeft: 8,
  },
  itemContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 36,
    fontWeight: '200',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  selectedItemText: {
    fontSize: 42,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  ampmText: {
    fontSize: 24,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.35)',
  },
  selectedAmpmText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  separator: {
    fontSize: 42,
    fontWeight: '200',
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
});

const generateMathProblem = (): MathProblem => {
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let a: number, b: number, answer: number;

  switch (operation) {
    case '+':
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 50) + 30;
      b = Math.floor(Math.random() * 30) + 1;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 12) + 2;
      b = Math.floor(Math.random() * 12) + 2;
      answer = a * b;
      break;
    default:
      a = 10;
      b = 10;
      answer = 20;
  }

  return {
    question: `${a} ${operation} ${b}`,
    answer,
  };
};

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmScreenVisible, setAlarmScreenVisible] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [mathProblem, setMathProblem] = useState<MathProblem>(generateMathProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [wrongAnswer, setWrongAnswer] = useState(false);

  // Breathing exercise state
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale' | 'done'>('inhale');
  const [breathingCycle, setBreathingCycle] = useState(0);
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const BREATHING_CYCLES_REQUIRED = 3;

  // Affirmation state
  const [affirmationText, setAffirmationText] = useState('');
  const [targetAffirmation, setTargetAffirmation] = useState(AFFIRMATIONS[0]);

  // New alarm state
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<boolean[]>([
    false, false, false, false, false, false, false,
  ]);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [selectedSnooze, setSelectedSnooze] = useState(10);
  const [selectedWakeIntensity, setSelectedWakeIntensity] = useState<WakeIntensity>('energetic');
  const [selectedSound, setSelectedSound] = useState<AlarmSound>('sunrise');
  const [selectedDismissType, setSelectedDismissType] = useState<DismissType>('simple');
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);

  // Shake detection state
  const [shakeCount, setShakeCount] = useState(0);
  const lastShakeTime = useRef<number>(0);

  // Sleep tracking state
  const [sleepData, setSleepData] = useState<SleepEntry[]>([]);
  const [bedtimeModalVisible, setBedtimeModalVisible] = useState(false);
  const [bedtimeHour, setBedtimeHour] = useState(22);
  const [bedtimeMinute, setBedtimeMinute] = useState(0);
  const [pendingWakeTime, setPendingWakeTime] = useState<Date | null>(null);
  const [sleepInsightVisible, setSleepInsightVisible] = useState(false);

  // Audio
  const soundRef = useRef<Audio.Sound | null>(null);
  const lastTriggeredRef = useRef<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [settingsBedtimeHour, setSettingsBedtimeHour] = useState(22);
  const [settingsBedtimeMinute, setSettingsBedtimeMinute] = useState(0);
  const [settingsReminderEnabled, setSettingsReminderEnabled] = useState(false);

  // Stats modal state
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabName>('alarms');

  // Load alarms, sleep data, and settings from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedAlarms, storedSleep, storedSettings] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(SLEEP_STORAGE_KEY),
          AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
        ]);
        if (storedAlarms) {
          setAlarms(JSON.parse(storedAlarms));
        }
        if (storedSleep) {
          setSleepData(JSON.parse(storedSleep));
        }
        if (storedSettings) {
          const parsedSettings = JSON.parse(storedSettings) as Settings;
          setSettings(parsedSettings);
        }
      } catch (error) {
        console.log('Error loading data:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save alarms to storage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    const saveAlarms = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
      } catch (error) {
        console.log('Error saving alarms:', error);
      }
    };
    saveAlarms();
  }, [alarms, isLoaded]);

  // Save sleep data to storage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    const saveSleepData = async () => {
      try {
        await AsyncStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(sleepData));
      } catch (error) {
        console.log('Error saving sleep data:', error);
      }
    };
    saveSleepData();
  }, [sleepData, isLoaded]);

  // Save settings and schedule bedtime notification
  useEffect(() => {
    if (!isLoaded) return;
    const saveSettingsAndSchedule = async () => {
      try {
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        await scheduleBedtimeNotification();
      } catch (error) {
        console.log('Error saving settings:', error);
      }
    };
    saveSettingsAndSchedule();
  }, [settings, isLoaded]);

  // Request notification permissions on mount (only in development builds, not Expo Go)
  useEffect(() => {
    if (isExpoGo) return;
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    requestPermissions();
  }, []);

  const scheduleBedtimeNotification = async () => {
    // Skip notifications in Expo Go (not supported in SDK 53+)
    if (isExpoGo) return;

    // Cancel existing bedtime notification
    await Notifications.cancelScheduledNotificationAsync(BEDTIME_NOTIFICATION_ID).catch(() => {});

    if (!settings.bedtimeReminderEnabled) {
      return;
    }

    // Calculate notification time (30 minutes before bedtime)
    let reminderHour = settings.bedtimeHour;
    let reminderMinute = settings.bedtimeMinute - 30;

    if (reminderMinute < 0) {
      reminderMinute += 60;
      reminderHour -= 1;
      if (reminderHour < 0) {
        reminderHour = 23;
      }
    }

    // Schedule daily notification
    await Notifications.scheduleNotificationAsync({
      identifier: BEDTIME_NOTIFICATION_ID,
      content: {
        title: 'Time to Wind Down',
        body: `Your target bedtime is in 30 minutes. Start preparing for sleep!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderHour,
        minute: reminderMinute,
      },
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for alarm triggers
  useEffect(() => {
    const now = currentTime;
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay();
    const timeKey = `${currentHour}:${currentMinute}`;

    alarms.forEach((alarm) => {
      if (!alarm.enabled) return;
      if (alarm.hour !== currentHour || alarm.minute !== currentMinute) return;

      // Check if alarm should trigger today
      const shouldTrigger = alarm.days.every((d) => !d) || alarm.days[currentDay];
      if (!shouldTrigger) return;

      // Prevent multiple triggers in the same minute
      const alarmKey = `${alarm.id}-${timeKey}`;
      if (lastTriggeredRef.current === alarmKey) return;
      lastTriggeredRef.current = alarmKey;

      triggerAlarm(alarm);
    });
  }, [currentTime, alarms]);

  // Shake detection for alarm dismissal
  useEffect(() => {
    if (!alarmScreenVisible || !activeAlarm || activeAlarm.dismissType !== 'shake') {
      return;
    }

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const totalForce = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (totalForce > SHAKE_THRESHOLD && now - lastShakeTime.current > 300) {
        lastShakeTime.current = now;
        setShakeCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= REQUIRED_SHAKES) {
            handleShakeDismiss();
          }
          return newCount;
        });
      }
    });

    Accelerometer.setUpdateInterval(100);

    return () => {
      subscription.remove();
    };
  }, [alarmScreenVisible, activeAlarm]);

  const handleShakeDismiss = async () => {
    await stopAlarmSound();
    setAlarmScreenVisible(false);
    setShakeCount(0);

    // Store wake time and show bedtime prompt
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);

    // Disable one-time alarms
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      setAlarms(alarms.map((a) =>
        a.id === activeAlarm.id ? { ...a, enabled: false } : a
      ));
    }
    setActiveAlarm(null);
  };

  const handleSimpleDismiss = async () => {
    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // Store wake time and show bedtime prompt
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);

    // Disable one-time alarms
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      setAlarms(alarms.map((a) =>
        a.id === activeAlarm.id ? { ...a, enabled: false } : a
      ));
    }
    setActiveAlarm(null);
  };

  const startBreathingExercise = () => {
    setBreathingPhase('inhale');
    setBreathingCycle(0);
    let cycle = 0;
    let phase: 'inhale' | 'hold' | 'exhale' | 'done' = 'inhale';

    const runPhase = () => {
      if (phase === 'inhale') {
        phase = 'hold';
        setBreathingPhase('hold');
        breathingTimerRef.current = setTimeout(runPhase, 2000);
      } else if (phase === 'hold') {
        phase = 'exhale';
        setBreathingPhase('exhale');
        breathingTimerRef.current = setTimeout(runPhase, 4000);
      } else if (phase === 'exhale') {
        cycle++;
        setBreathingCycle(cycle);
        if (cycle >= BREATHING_CYCLES_REQUIRED) {
          phase = 'done';
          setBreathingPhase('done');
        } else {
          phase = 'inhale';
          setBreathingPhase('inhale');
          breathingTimerRef.current = setTimeout(runPhase, 4000);
        }
      }
    };

    breathingTimerRef.current = setTimeout(runPhase, 4000); // First inhale: 4 seconds
  };

  const handleBreathingDismiss = async () => {
    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    await stopAlarmSound();
    setAlarmScreenVisible(false);
    setPendingWakeTime(new Date());
    setBedtimeHour(22);
    setBedtimeMinute(0);
    setBedtimeModalVisible(true);
    if (activeAlarm && activeAlarm.days.every((d) => !d)) {
      setAlarms(alarms.map((a) =>
        a.id === activeAlarm.id ? { ...a, enabled: false } : a
      ));
    }
    setActiveAlarm(null);
  };

  const handleAffirmationDismiss = async () => {
    if (affirmationText.toLowerCase().trim() === targetAffirmation.toLowerCase()) {
      await stopAlarmSound();
      setAlarmScreenVisible(false);
      setAffirmationText('');
      setPendingWakeTime(new Date());
      setBedtimeHour(22);
      setBedtimeMinute(0);
      setBedtimeModalVisible(true);
      if (activeAlarm && activeAlarm.days.every((d) => !d)) {
        setAlarms(alarms.map((a) =>
          a.id === activeAlarm.id ? { ...a, enabled: false } : a
        ));
      }
      setActiveAlarm(null);
    } else {
      setWrongAnswer(true);
      setTimeout(() => setWrongAnswer(false), 500);
    }
  };

  const triggerAlarm = async (alarm: Alarm) => {
    setActiveAlarm(alarm);
    setMathProblem(generateMathProblem());
    setUserAnswer('');
    setAffirmationText('');
    setTargetAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
    setWrongAnswer(false);
    setShakeCount(0);
    setAlarmScreenVisible(true);

    if (alarm.dismissType === 'breathing') {
      startBreathingExercise();
    }

    await playAlarmSound(alarm.wakeIntensity, alarm.sound);
  };

  // Sound configurations for different alarm tones
  const SOUND_CONFIGS: Record<AlarmSound, { rate: number; pattern: number[] | null }> = {
    sunrise: { rate: 1.0, pattern: null }, // Normal, continuous
    ocean: { rate: 0.75, pattern: [3000, 1500] }, // Slow, wave-like with pauses
    forest: { rate: 1.2, pattern: [500, 200, 500, 200, 500, 1500] }, // Higher pitch, bird-like rhythm
    chimes: { rate: 1.1, pattern: [400, 600, 400, 600, 400, 1200] }, // Quick chime pattern
    piano: { rate: 0.85, pattern: [2000, 800] }, // Slower, melodic
    birds: { rate: 1.4, pattern: [300, 150, 300, 150, 300, 150, 300, 1000] }, // High pitch, chirpy
  };

  const patternIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const patternIndexRef = useRef<number>(0);

  const playAlarmSound = async (wakeIntensity: WakeIntensity, soundType: AlarmSound = 'sunrise') => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const config = SOUND_CONFIGS[soundType];
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === wakeIntensity);
      const initialVolume = intensityOption ? intensityOption.volume : 0.5;

      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm-sound.mp3'),
        {
          isLooping: true,
          volume: initialVolume,
          rate: config.rate,
          shouldCorrectPitch: false, // Changing rate also changes pitch for distinct sounds
        }
      );

      soundRef.current = sound;
      await sound.playAsync();

      // Apply pattern if defined (creates rhythmic on/off effect)
      if (config.pattern) {
        patternIndexRef.current = 0;
        let isPlaying = true;

        const runPattern = async () => {
          if (!soundRef.current) return;

          const pattern = config.pattern!;
          const duration = pattern[patternIndexRef.current % pattern.length];

          if (isPlaying) {
            await soundRef.current.setVolumeAsync(initialVolume);
          } else {
            await soundRef.current.setVolumeAsync(0.05); // Very quiet instead of silent for smoother effect
          }

          isPlaying = !isPlaying;
          patternIndexRef.current++;

          patternIntervalRef.current = setTimeout(runPattern, duration);
        };

        patternIntervalRef.current = setTimeout(runPattern, config.pattern[0]);
      }

    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const stopAlarmSound = async () => {
    if (patternIntervalRef.current) {
      clearTimeout(patternIntervalRef.current);
      patternIntervalRef.current = null;
    }
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const playPreviewSound = async () => {
    // Stop any existing preview
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync();
      await previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }

    try {
      const intensityOption = WAKE_INTENSITY_OPTIONS.find(o => o.value === selectedWakeIntensity);
      const volume = intensityOption ? intensityOption.volume : 0.5;
      const config = SOUND_CONFIGS[selectedSound];

      const { sound } = await Audio.Sound.createAsync(
        require('./assets/alarm-sound.mp3'),
        {
          volume,
          rate: config.rate,
          shouldCorrectPitch: false,
        }
      );

      previewSoundRef.current = sound;
      await sound.playAsync();

      // Stop after 2 seconds
      setTimeout(async () => {
        if (previewSoundRef.current) {
          await previewSoundRef.current.stopAsync();
          await previewSoundRef.current.unloadAsync();
          previewSoundRef.current = null;
        }
      }, 2000);
    } catch (error) {
      console.log('Error playing preview:', error);
    }
  };

  const handleDismissAlarm = async () => {
    const answer = parseInt(userAnswer, 10);
    if (answer === mathProblem.answer) {
      await stopAlarmSound();
      setAlarmScreenVisible(false);
      setUserAnswer('');

      // Store wake time and show bedtime prompt
      setPendingWakeTime(new Date());
      // Default bedtime to 10 PM previous night
      setBedtimeHour(22);
      setBedtimeMinute(0);
      setBedtimeModalVisible(true);

      // Disable one-time alarms
      if (activeAlarm && activeAlarm.days.every((d) => !d)) {
        setAlarms(alarms.map((a) =>
          a.id === activeAlarm.id ? { ...a, enabled: false } : a
        ));
      }
      setActiveAlarm(null);
    } else {
      setWrongAnswer(true);
      setUserAnswer('');
      setTimeout(() => setWrongAnswer(false), 500);
    }
  };

  const handleSnoozeAlarm = async () => {
    if (!activeAlarm || activeAlarm.snooze === 0) return;

    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current);
      breathingTimerRef.current = null;
    }
    await stopAlarmSound();
    setAlarmScreenVisible(false);

    // Schedule snooze
    setTimeout(() => {
      if (activeAlarm) {
        triggerAlarm(activeAlarm);
      }
    }, activeAlarm.snooze * 60 * 1000);

    setActiveAlarm(null);
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const displayHours = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return {
      time: `${displayHours}:${minutes.toString().padStart(2, '0')}`,
      ampm,
    };
  };

  const formatAlarmTime = (hour: number, minute: number) => {
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const { time, ampm } = formatTime(currentTime);

  const getNextAlarmCountdown = (): { hours: number; minutes: number } | null => {
    const enabledAlarms = alarms.filter(a => a.enabled);
    if (enabledAlarms.length === 0) return null;

    const now = currentTime;
    let minDiff = Infinity;

    for (const alarm of enabledAlarms) {
      if (alarm.days.some(d => d)) {
        for (let i = 0; i < 7; i++) {
          const dayIndex = (now.getDay() + i) % 7;
          if (alarm.days[dayIndex]) {
            const candidate = new Date(now);
            candidate.setDate(now.getDate() + i);
            candidate.setHours(alarm.hour, alarm.minute, 0, 0);
            if (candidate.getTime() > now.getTime()) {
              const diff = candidate.getTime() - now.getTime();
              if (diff < minDiff) minDiff = diff;
              break;
            }
          }
        }
      } else {
        const alarmDate = new Date(now);
        alarmDate.setHours(alarm.hour, alarm.minute, 0, 0);
        if (alarmDate.getTime() <= now.getTime()) {
          alarmDate.setDate(alarmDate.getDate() + 1);
        }
        const diff = alarmDate.getTime() - now.getTime();
        if (diff < minDiff) minDiff = diff;
      }
    }

    if (minDiff === Infinity) return null;

    const totalMinutes = Math.floor(minDiff / 60000);
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    };
  };

  const formatCountdownText = (): string => {
    const countdown = getNextAlarmCountdown();
    if (!countdown) return '';
    const { hours, minutes } = countdown;
    if (hours > 0 && minutes > 0) {
      return `${hours} hr ${minutes} min of rest ahead`;
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} of rest ahead`;
    } else {
      return `${minutes} min of rest ahead`;
    }
  };

  const handleAddAlarm = () => {
    setEditingAlarmId(null);
    setSelectedHour(8);
    setSelectedMinute(0);
    setSelectedDays([false, false, false, false, false, false, false]);
    setSelectedLabel('');
    setSelectedSnooze(10);
    setSelectedWakeIntensity('energetic');
    setSelectedSound('sunrise');
    setSelectedDismissType('simple');
    setModalVisible(true);
  };

  const handleEditAlarm = (alarm: Alarm) => {
    setEditingAlarmId(alarm.id);
    setSelectedHour(alarm.hour);
    setSelectedMinute(alarm.minute);
    setSelectedDays([...alarm.days]);
    setSelectedLabel(alarm.label);
    setSelectedSnooze(alarm.snooze);
    setSelectedWakeIntensity(alarm.wakeIntensity || 'energetic');
    setSelectedSound(alarm.sound || 'sunrise');
    const dismissType = alarm.dismissType === 'off' ? 'simple' : (alarm.dismissType || 'simple');
    setSelectedDismissType(dismissType as DismissType);
    setModalVisible(true);
  };

  const toggleDay = (index: number) => {
    const newDays = [...selectedDays];
    newDays[index] = !newDays[index];
    setSelectedDays(newDays);
  };

  const handleSaveAlarm = () => {
    if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
    if (editingAlarmId) {
      // Update existing alarm
      setAlarms(alarms.map((alarm) =>
        alarm.id === editingAlarmId
          ? {
              ...alarm,
              hour: selectedHour,
              minute: selectedMinute,
              days: selectedDays,
              label: selectedLabel,
              snooze: selectedSnooze,
              wakeIntensity: selectedWakeIntensity,
              sound: selectedSound,
              dismissType: selectedDismissType,
            }
          : alarm
      ));
    } else {
      // Create new alarm
      const newAlarm: Alarm = {
        id: Date.now().toString(),
        hour: selectedHour,
        minute: selectedMinute,
        days: selectedDays,
        enabled: true,
        label: selectedLabel,
        snooze: selectedSnooze,
        wakeIntensity: selectedWakeIntensity,
        sound: selectedSound,
        dismissType: selectedDismissType,
      };
      setAlarms([...alarms, newAlarm]);
    }
    setModalVisible(false);
    setEditingAlarmId(null);
  };

  const getRepeatText = (days: boolean[]) => {
    if (days.every((d) => !d)) return 'Once';
    if (days.every((d) => d)) return 'Every day';
    if (days.slice(1, 6).every((d) => d) && !days[0] && !days[6]) return 'Weekdays';
    if (days[0] && days[6] && days.slice(1, 6).every((d) => !d)) return 'Weekends';
    return days
      .map((selected, i) => (selected ? DAYS[i] : null))
      .filter(Boolean)
      .join(', ');
  };

  const toggleAlarm = (id: string) => {
    setAlarms(alarms.map((alarm) =>
      alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm
    ));
  };

  const deleteAlarm = (id: string) => {
    setAlarms(alarms.filter((alarm) => alarm.id !== id));
  };

  const handleOpenSettings = () => {
    setSettingsBedtimeHour(settings.bedtimeHour);
    setSettingsBedtimeMinute(settings.bedtimeMinute);
    setSettingsReminderEnabled(settings.bedtimeReminderEnabled);
    setSettingsModalVisible(true);
  };

  const handleSaveSettings = () => {
    setSettings({
      bedtimeReminderEnabled: settingsReminderEnabled,
      bedtimeHour: settingsBedtimeHour,
      bedtimeMinute: settingsBedtimeMinute,
    });
    setSettingsModalVisible(false);
  };

  const formatSettingsTime = (hour: number, minute: number) => {
    const displayHour = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getWeeklyData = () => {
    const now = new Date();
    const weekData: { day: string; duration: number; date: Date }[] = [];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Find sleep entry for this day (based on wake time)
      const entry = sleepData.find((e) => {
        const wakeDate = new Date(e.wakeTime);
        return wakeDate >= date && wakeDate < nextDate;
      });

      weekData.push({
        day: DAYS[date.getDay()],
        duration: entry ? entry.sleepDuration : 0,
        date,
      });
    }

    return weekData;
  };

  const getSleepStats = () => {
    if (sleepData.length === 0) {
      return null;
    }

    const durations = sleepData.map((e) => e.sleepDuration);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = Math.round(total / durations.length);

    const best = sleepData.reduce((max, e) =>
      e.sleepDuration > max.sleepDuration ? e : max
    );
    const worst = sleepData.reduce((min, e) =>
      e.sleepDuration < min.sleepDuration ? e : min
    );

    // Calculate average bedtime
    const bedtimeMinutes = sleepData.map((e) => {
      const bed = new Date(e.bedtime);
      let mins = bed.getHours() * 60 + bed.getMinutes();
      if (mins < 720) mins += 1440; // After midnight, add 24h
      return mins;
    });
    const avgBedtimeMinutes = Math.round(
      bedtimeMinutes.reduce((sum, m) => sum + m, 0) / bedtimeMinutes.length
    ) % 1440;
    const avgBedtimeHour = Math.floor(avgBedtimeMinutes / 60);
    const avgBedtimeMinute = avgBedtimeMinutes % 60;

    // Calculate average wake time
    const wakeMinutes = sleepData.map((e) => {
      const wake = new Date(e.wakeTime);
      return wake.getHours() * 60 + wake.getMinutes();
    });
    const avgWakeMinutes = Math.round(
      wakeMinutes.reduce((sum, m) => sum + m, 0) / wakeMinutes.length
    );
    const avgWakeHour = Math.floor(avgWakeMinutes / 60);
    const avgWakeMinute = avgWakeMinutes % 60;

    return {
      average,
      best: {
        duration: best.sleepDuration,
        date: new Date(best.wakeTime),
      },
      worst: {
        duration: worst.sleepDuration,
        date: new Date(worst.wakeTime),
      },
      totalNights: sleepData.length,
      avgBedtime: formatSettingsTime(avgBedtimeHour, avgBedtimeMinute),
      avgWakeTime: formatSettingsTime(avgWakeHour, avgWakeMinute),
    };
  };

  const handleSaveBedtime = () => {
    if (!pendingWakeTime) return;

    // Calculate bedtime timestamp (previous day if bedtime hour > wake hour)
    const wakeTime = pendingWakeTime;
    const bedtime = new Date(wakeTime);
    bedtime.setHours(bedtimeHour, bedtimeMinute, 0, 0);

    // If bedtime is after wake time, it was the previous day
    if (bedtime >= wakeTime) {
      bedtime.setDate(bedtime.getDate() - 1);
    }

    const sleepDuration = Math.round((wakeTime.getTime() - bedtime.getTime()) / (1000 * 60));

    const newEntry: SleepEntry = {
      id: Date.now().toString(),
      bedtime: bedtime.getTime(),
      wakeTime: wakeTime.getTime(),
      sleepDuration,
    };

    const updatedSleepData = [...sleepData, newEntry];
    setSleepData(updatedSleepData);
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);

    // Show insight if we have 7+ entries
    if (updatedSleepData.length >= 7) {
      setSleepInsightVisible(true);
    }
  };

  const handleSkipBedtime = () => {
    setBedtimeModalVisible(false);
    setPendingWakeTime(null);
  };

  const getOptimalWakeTime = (): { hour: number; minute: number; avgSleep: number } | null => {
    if (sleepData.length < 7) return null;

    // Use last 7 entries for analysis
    const recentData = sleepData.slice(-7);

    // Calculate average sleep duration
    const avgSleepDuration = Math.round(
      recentData.reduce((sum, entry) => sum + entry.sleepDuration, 0) / recentData.length
    );

    // Calculate average bedtime (in minutes from midnight)
    const avgBedtimeMinutes = Math.round(
      recentData.reduce((sum, entry) => {
        const bed = new Date(entry.bedtime);
        let minutes = bed.getHours() * 60 + bed.getMinutes();
        // Handle times after midnight (treat as previous day)
        if (minutes < 720) minutes += 1440; // Add 24 hours if before noon
        return sum + minutes;
      }, 0) / recentData.length
    );

    // Optimal sleep is ~7.5-8 hours (450-480 min) for most adults
    // Suggest wake time based on average bedtime + optimal sleep duration
    const optimalSleepMinutes = 480; // 8 hours
    let optimalWakeMinutes = (avgBedtimeMinutes + optimalSleepMinutes) % 1440;

    const optimalHour = Math.floor(optimalWakeMinutes / 60);
    const optimalMinute = Math.round((optimalWakeMinutes % 60) / 5) * 5; // Round to nearest 5 min

    return {
      hour: optimalHour,
      minute: optimalMinute,
      avgSleep: avgSleepDuration,
    };
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    id: string
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteAlarm(id)}
      >
        <Animated.Text style={[styles.deleteText, { transform: [{ scale }] }]}>
          Delete
        </Animated.Text>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />

      {/* Tab Content */}
      {activeTab === 'alarms' && (
        <View style={styles.tabContent}>
          <View style={styles.clockContainer}>
            <Text style={styles.timeText}>{time}</Text>
            <Text style={styles.ampmText}>{ampm}</Text>
          </View>

          <Text style={styles.dateText}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <View style={styles.countdownContainer}>
            {alarms.some(a => a.enabled) ? (
              <>
                <Text style={styles.countdownIcon}>☽</Text>
                <Text style={styles.countdownText}>{formatCountdownText()}</Text>
              </>
            ) : (
              <>
                <Text style={styles.countdownIcon}>☁</Text>
                <Text style={styles.countdownText}>No alarms set – sleep well tonight</Text>
              </>
            )}
          </View>

          <View style={styles.alarmsContainer}>
            <Text style={styles.sectionTitle}>Alarms</Text>
            {alarms.length === 0 ? (
              <Text style={styles.noAlarmsText}>No alarms set</Text>
            ) : (
              alarms.map((alarm) => (
                <Swipeable
                  key={alarm.id}
                  renderRightActions={(progress, dragX) =>
                    renderRightActions(progress, dragX, alarm.id)
                  }
                  overshootRight={false}
                  overshootLeft={false}
                  containerStyle={styles.swipeableContainer}
                >
                  <View style={styles.alarmItem}>
                    <TouchableOpacity
                      style={styles.alarmInfo}
                      onPress={() => handleEditAlarm(alarm)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.alarmTime,
                        !alarm.enabled && styles.alarmTimeDisabled,
                      ]}>
                        {formatAlarmTime(alarm.hour, alarm.minute)}
                      </Text>
                      <Text style={[
                        styles.alarmDays,
                        !alarm.enabled && styles.alarmDaysDisabled,
                      ]}>
                        {alarm.label ? `${alarm.label} · ` : ''}{getRepeatText(alarm.days)}
                        {alarm.wakeIntensity && alarm.wakeIntensity !== 'energetic' ? ` · ${alarm.wakeIntensity.charAt(0).toUpperCase() + alarm.wakeIntensity.slice(1)}` : ''}
                      </Text>
                    </TouchableOpacity>
                    <Switch
                      value={alarm.enabled}
                      onValueChange={() => toggleAlarm(alarm.id)}
                      trackColor={{ false: '#2A2A2A', true: '#818CF8' }}
                      thumbColor={alarm.enabled ? '#FFFFFF' : '#666666'}
                    />
                  </View>
                </Swipeable>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAddAlarm}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'morning' && (
        <View style={styles.tabContent}>
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderIcon}>{"☀\uFE0F"}</Text>
            <Text style={styles.placeholderTitle}>Morning Routine</Text>
            <Text style={styles.placeholderSubtitle}>
              Your personalized morning flow will appear here
            </Text>
          </View>
        </View>
      )}

      {activeTab === 'insights' && (
        <View style={styles.tabContent}>
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderIcon}>{"📊"}</Text>
            <Text style={styles.placeholderTitle}>Sleep Insights</Text>
            <Text style={styles.placeholderSubtitle}>
              Track your sleep patterns and get recommendations
            </Text>
          </View>
        </View>
      )}

      {activeTab === 'settings' && (
        <View style={styles.tabContent}>
          <View style={styles.placeholderScreen}>
            <Text style={styles.placeholderIcon}>{"⚙\uFE0F"}</Text>
            <Text style={styles.placeholderTitle}>Settings</Text>
            <Text style={styles.placeholderSubtitle}>
              Customize your Softwake experience
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('alarms')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'alarms' && styles.tabIconActive]}>
            {"⏰"}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'alarms' && styles.tabLabelActive]}>
            Alarms
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('morning')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'morning' && styles.tabIconActive]}>
            {"☀\uFE0F"}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'morning' && styles.tabLabelActive]}>
            Morning
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('insights')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'insights' && styles.tabIconActive]}>
            {"📊"}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'insights' && styles.tabLabelActive]}>
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.tabIconActive]}>
            {"⚙\uFE0F"}
          </Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Alarm Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
          setModalVisible(false);
          setEditingAlarmId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => {
                  if (previewSoundRef.current) { previewSoundRef.current.stopAsync(); previewSoundRef.current.unloadAsync(); previewSoundRef.current = null; }
                  setModalVisible(false);
                  setEditingAlarmId(null);
                }}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                  {editingAlarmId ? 'Edit Alarm' : 'New Alarm'}
                </Text>
                <TouchableOpacity onPress={handleSaveAlarm}>
                  <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
              </View>

              <TimePicker
                hour={selectedHour}
                minute={selectedMinute}
                onHourChange={setSelectedHour}
                onMinuteChange={setSelectedMinute}
              />

              <View style={styles.repeatSection}>
                <Text style={styles.repeatLabel}>Repeat</Text>
                <View style={styles.daysContainer}>
                  {DAYS.map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(index)}
                      style={[
                        styles.dayButton,
                        selectedDays[index] && styles.dayButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selectedDays[index] && styles.dayTextSelected,
                        ]}
                      >
                        {day[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.labelSection}>
                <Text style={styles.labelTitle}>Label</Text>
                <TextInput
                  style={styles.labelInput}
                  value={selectedLabel}
                  onChangeText={setSelectedLabel}
                  placeholder="Alarm"
                  placeholderTextColor="#444444"
                />
              </View>

              <View style={styles.snoozeSection}>
                <Text style={styles.snoozeTitle}>Snooze</Text>
                <View style={styles.snoozeOptions}>
                  {SNOOZE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedSnooze(option.value)}
                      style={[
                        styles.snoozeOption,
                        selectedSnooze === option.value && styles.snoozeOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.snoozeOptionText,
                          selectedSnooze === option.value && styles.snoozeOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.wakeIntensitySection}>
                <View style={styles.wakeIntensityHeader}>
                  <Text style={styles.wakeIntensityTitle}>Wake Intensity</Text>
                  <TouchableOpacity
                    onPress={playPreviewSound}
                    style={styles.previewButton}
                  >
                    <Text style={styles.previewButtonIcon}>🔊</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.wakeIntensityOptions}>
                  {WAKE_INTENSITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedWakeIntensity(option.value)}
                      style={[
                        styles.wakeIntensityOption,
                        selectedWakeIntensity === option.value && styles.wakeIntensityOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.wakeIntensityOptionText,
                          selectedWakeIntensity === option.value && styles.wakeIntensityOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.soundSection}>
                <Text style={styles.soundTitle}>Sound</Text>
                <View style={styles.soundOptions}>
                  {SOUND_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedSound(option.value)}
                      style={[
                        styles.soundOption,
                        selectedSound === option.value && styles.soundOptionSelected,
                      ]}
                    >
                      <Text style={styles.soundOptionIcon}>{option.icon}</Text>
                      <Text
                        style={[
                          styles.soundOptionText,
                          selectedSound === option.value && styles.soundOptionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.dismissTypeSection}>
                <Text style={styles.dismissTypeTitle}>Dismiss Method</Text>
                <View style={styles.dismissTypeOptions}>
                  {DISMISS_OPTIONS.filter(o => !o.isMission).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedDismissType(option.value)}
                      style={[
                        styles.dismissTypeOption,
                        selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                      ]}
                    >
                      <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                      <View style={styles.dismissTypeTextContainer}>
                        <Text
                          style={[
                            styles.dismissTypeLabel,
                            selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.dismissTypeDescription,
                            selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.missionsSubtitle}>Wake-up Missions</Text>
                <Text style={styles.missionsHint}>Optional challenges to help you wake up</Text>
                <View style={styles.dismissTypeOptions}>
                  {DISMISS_OPTIONS.filter(o => o.isMission).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setSelectedDismissType(option.value)}
                      style={[
                        styles.dismissTypeOption,
                        selectedDismissType === option.value && styles.dismissTypeOptionSelected,
                      ]}
                    >
                      <Text style={styles.dismissTypeIcon}>{option.icon}</Text>
                      <View style={styles.dismissTypeTextContainer}>
                        <Text
                          style={[
                            styles.dismissTypeLabel,
                            selectedDismissType === option.value && styles.dismissTypeLabelSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.dismissTypeDescription,
                            selectedDismissType === option.value && styles.dismissTypeDescriptionSelected,
                          ]}
                        >
                          {option.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Alarm Dismiss Screen */}
      <Modal
        animationType="fade"
        transparent={false}
        visible={alarmScreenVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.alarmScreen}>
          <Text style={styles.alarmScreenTime}>
            {activeAlarm ? formatAlarmTime(activeAlarm.hour, activeAlarm.minute) : ''}
          </Text>
          {activeAlarm?.label ? (
            <Text style={styles.alarmScreenLabel}>{activeAlarm.label}</Text>
          ) : null}

          {(activeAlarm?.dismissType === 'simple' || activeAlarm?.dismissType === 'off') ? (
            <View style={styles.simpleDismissContainer}>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleSimpleDismiss}
              >
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : activeAlarm?.dismissType === 'breathing' ? (
            <View style={styles.breathingContainer}>
              <Text style={styles.breathingTitle}>
                {breathingPhase === 'done' ? 'Well done!' : 'Breathe'}
              </Text>
              <Text style={styles.breathingPhaseText}>
                {breathingPhase === 'inhale' && 'Breathe in...'}
                {breathingPhase === 'hold' && 'Hold...'}
                {breathingPhase === 'exhale' && 'Breathe out...'}
                {breathingPhase === 'done' && 'Exercise complete'}
              </Text>
              <Text style={styles.breathingProgress}>
                {breathingCycle} / {BREATHING_CYCLES_REQUIRED} cycles
              </Text>
              {breathingPhase === 'done' && (
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={handleBreathingDismiss}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : activeAlarm?.dismissType === 'affirmation' ? (
            <View style={styles.affirmationContainer}>
              <Text style={styles.affirmationTitle}>Type to dismiss</Text>
              <Text style={styles.affirmationTarget}>"{targetAffirmation}"</Text>
              <TextInput
                style={[
                  styles.mathInput,
                  wrongAnswer && styles.mathInputWrong,
                ]}
                value={affirmationText}
                onChangeText={setAffirmationText}
                placeholder="Type the affirmation"
                placeholderTextColor="#444444"
                autoCapitalize="none"
                autoFocus
              />
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleAffirmationDismiss}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : activeAlarm?.dismissType === 'shake' ? (
            <View style={styles.shakeContainer}>
              <Text style={styles.shakeTitle}>Shake to dismiss</Text>
              <Text style={styles.shakeIcon}>📳</Text>
              <View style={styles.shakeProgressContainer}>
                <View style={styles.shakeProgressBar}>
                  <View
                    style={[
                      styles.shakeProgressFill,
                      { width: `${(shakeCount / REQUIRED_SHAKES) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.shakeProgressText}>
                  {shakeCount} / {REQUIRED_SHAKES} shakes
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.mathContainer}>
              <Text style={styles.mathTitle}>Solve to dismiss</Text>
              <Text style={styles.mathProblem}>{mathProblem.question} = ?</Text>
              <TextInput
                style={[
                  styles.mathInput,
                  wrongAnswer && styles.mathInputWrong,
                ]}
                value={userAnswer}
                onChangeText={setUserAnswer}
                keyboardType="number-pad"
                placeholder="Answer"
                placeholderTextColor="#444444"
                autoFocus
              />
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={handleDismissAlarm}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeAlarm && activeAlarm.snooze > 0 && (
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={handleSnoozeAlarm}
            >
              <Text style={styles.snoozeButtonText}>
                Snooze ({activeAlarm.snooze} min)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Bedtime Logging Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={bedtimeModalVisible}
        onRequestClose={handleSkipBedtime}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bedtimeModalContent}>
            <Text style={styles.bedtimeTitle}>Log Your Sleep</Text>
            <Text style={styles.bedtimeSubtitle}>When did you go to bed last night?</Text>

            <TimePicker
              hour={bedtimeHour}
              minute={bedtimeMinute}
              onHourChange={setBedtimeHour}
              onMinuteChange={setBedtimeMinute}
              minuteStep={5}
            />

            <TouchableOpacity style={styles.saveBedtimeButton} onPress={handleSaveBedtime}>
              <Text style={styles.saveBedtimeButtonText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBedtimeButton} onPress={handleSkipBedtime}>
              <Text style={styles.skipBedtimeButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sleep Insight Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={sleepInsightVisible}
        onRequestClose={() => setSleepInsightVisible(false)}
      >
        <View style={styles.insightOverlay}>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Sleep Insight</Text>
            {(() => {
              const insight = getOptimalWakeTime();
              if (!insight) return null;
              const avgHours = Math.floor(insight.avgSleep / 60);
              const avgMins = insight.avgSleep % 60;
              return (
                <>
                  <Text style={styles.insightText}>
                    Based on your last 7 nights, you average{' '}
                    <Text style={styles.insightHighlight}>
                      {avgHours}h {avgMins}m
                    </Text>{' '}
                    of sleep.
                  </Text>
                  <Text style={styles.insightText}>
                    For optimal rest (8 hours), try waking up at:
                  </Text>
                  <Text style={styles.insightTime}>
                    {formatAlarmTime(insight.hour, insight.minute)}
                  </Text>
                  <TouchableOpacity
                    style={styles.insightButton}
                    onPress={() => {
                      handleAddAlarm();
                      setSelectedHour(insight.hour);
                      setSelectedMinute(insight.minute);
                      setSelectedLabel('Optimal Wake');
                      setSleepInsightVisible(false);
                    }}
                  >
                    <Text style={styles.insightButtonText}>Create Alarm</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
            <TouchableOpacity
              style={styles.insightDismiss}
              onPress={() => setSleepInsightVisible(false)}
            >
              <Text style={styles.insightDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={handleSaveSettings}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <View style={styles.settingsRow}>
                <View style={styles.settingsLabelContainer}>
                  <Text style={styles.settingsLabel}>Bedtime Reminder</Text>
                  <Text style={styles.settingsDescription}>
                    Get notified 30 min before bedtime
                  </Text>
                </View>
                <Switch
                  value={settingsReminderEnabled}
                  onValueChange={setSettingsReminderEnabled}
                  trackColor={{ false: '#2A2A2A', true: '#818CF8' }}
                  thumbColor={settingsReminderEnabled ? '#FFFFFF' : '#666666'}
                />
              </View>

              {settingsReminderEnabled && (
                <View style={styles.settingsBedtimeSection}>
                  <Text style={styles.settingsBedtimeLabel}>Target Bedtime</Text>
                  <TimePicker
                    hour={settingsBedtimeHour}
                    minute={settingsBedtimeMinute}
                    onHourChange={setSettingsBedtimeHour}
                    onMinuteChange={setSettingsBedtimeMinute}
                    minuteStep={5}
                  />

                  <Text style={styles.settingsReminderInfo}>
                    You'll receive a reminder at {formatSettingsTime(
                      settingsBedtimeMinute < 30
                        ? (settingsBedtimeHour === 0 ? 23 : settingsBedtimeHour - 1)
                        : settingsBedtimeHour,
                      settingsBedtimeMinute < 30
                        ? settingsBedtimeMinute + 30
                        : settingsBedtimeMinute - 30
                    )}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Sleep Stats Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={statsModalVisible}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.statsModalContent}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Sleep Stats</Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Text style={styles.statsCloseButton}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.statsScrollView} showsVerticalScrollIndicator={false}>
              {sleepData.length === 0 ? (
                <View style={styles.statsEmptyState}>
                  <Text style={styles.statsEmptyIcon}>😴</Text>
                  <Text style={styles.statsEmptyTitle}>No Sleep Data Yet</Text>
                  <Text style={styles.statsEmptyText}>
                    Dismiss alarms to start tracking your sleep patterns
                  </Text>
                </View>
              ) : (
                <>
                  {/* Weekly Chart */}
                  <View style={styles.statsSection}>
                    <Text style={styles.statsSectionTitle}>This Week</Text>
                    <View style={styles.weeklyChart}>
                      {getWeeklyData().map((day, index) => {
                        const maxDuration = 600; // 10 hours max
                        const barHeight = day.duration > 0
                          ? Math.min((day.duration / maxDuration) * 120, 120)
                          : 4;
                        const isToday = index === 6;

                        return (
                          <View key={day.day} style={styles.chartBar}>
                            <Text style={styles.chartDuration}>
                              {day.duration > 0 ? `${Math.floor(day.duration / 60)}h` : '-'}
                            </Text>
                            <View style={styles.chartBarContainer}>
                              <View
                                style={[
                                  styles.chartBarFill,
                                  {
                                    height: barHeight,
                                    backgroundColor: day.duration === 0
                                      ? '#2A2A2A'
                                      : day.duration >= 420 // 7 hours
                                        ? '#4CAF50'
                                        : day.duration >= 360 // 6 hours
                                          ? '#FFC107'
                                          : '#FF5722',
                                  },
                                  isToday && styles.chartBarToday,
                                ]}
                              />
                            </View>
                            <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>
                              {day.day}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Stats Summary */}
                  {(() => {
                    const stats = getSleepStats();
                    if (!stats) return null;

                    return (
                      <>
                        <View style={styles.statsSection}>
                          <Text style={styles.statsSectionTitle}>Average</Text>
                          <View style={styles.statsCard}>
                            <View style={styles.statsMainStat}>
                              <Text style={styles.statsMainValue}>
                                {formatDuration(stats.average)}
                              </Text>
                              <Text style={styles.statsMainLabel}>per night</Text>
                            </View>
                            <View style={styles.statsSubStats}>
                              <View style={styles.statsSubStat}>
                                <Text style={styles.statsSubLabel}>Avg Bedtime</Text>
                                <Text style={styles.statsSubValue}>{stats.avgBedtime}</Text>
                              </View>
                              <View style={styles.statsSubStat}>
                                <Text style={styles.statsSubLabel}>Avg Wake</Text>
                                <Text style={styles.statsSubValue}>{stats.avgWakeTime}</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        <View style={styles.statsSection}>
                          <Text style={styles.statsSectionTitle}>Best & Worst</Text>
                          <View style={styles.statsBestWorst}>
                            <View style={[styles.statsBWCard, styles.statsBestCard]}>
                              <Text style={styles.statsBWIcon}>🌟</Text>
                              <Text style={styles.statsBWLabel}>Best Night</Text>
                              <Text style={styles.statsBWValue}>
                                {formatDuration(stats.best.duration)}
                              </Text>
                              <Text style={styles.statsBWDate}>
                                {stats.best.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                            <View style={[styles.statsBWCard, styles.statsWorstCard]}>
                              <Text style={styles.statsBWIcon}>😓</Text>
                              <Text style={styles.statsBWLabel}>Worst Night</Text>
                              <Text style={styles.statsBWValue}>
                                {formatDuration(stats.worst.duration)}
                              </Text>
                              <Text style={styles.statsBWDate}>
                                {stats.worst.date.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.statsSection}>
                          <Text style={styles.statsTotalNights}>
                            Based on {stats.totalNights} night{stats.totalNights !== 1 ? 's' : ''} of data
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 40,
  },
  timeText: {
    fontSize: 96,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -4,
  },
  ampmText: {
    fontSize: 24,
    fontWeight: '400',
    color: '#666666',
    marginLeft: 8,
  },
  dateText: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  countdownIcon: {
    fontSize: 18,
    marginRight: 8,
    opacity: 0.7,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '300',
    color: '#9999AA',
    letterSpacing: 0.3,
  },
  alarmsContainer: {
    flex: 1,
    marginTop: 24,
    marginHorizontal: -24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  noAlarmsText: {
    fontSize: 16,
    color: '#444444',
    paddingHorizontal: 24,
  },
  swipeableContainer: {
    overflow: 'visible',
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingLeft: 24,
    paddingRight: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#0D0D0D',
  },
  alarmInfo: {
    flex: 1,
    marginRight: 16,
    overflow: 'visible',
  },
  alarmTime: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  alarmTimeDisabled: {
    color: '#444444',
  },
  alarmDays: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  alarmDaysDisabled: {
    color: '#333333',
  },
  deleteAction: {
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
  },
  deleteText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#555555',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#818CF8',
    fontWeight: '600',
  },
  placeholderScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 20,
    opacity: 0.8,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  placeholderSubtitle: {
    fontSize: 15,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    marginTop: 100,
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666666',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#818CF8',
  },
  repeatSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  repeatLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#FFFFFF',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  dayTextSelected: {
    color: '#0D0D0D',
  },
  labelSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  labelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  labelInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  snoozeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  snoozeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  snoozeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snoozeOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  snoozeOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  snoozeOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  snoozeOptionTextSelected: {
    color: '#0D0D0D',
  },
  wakeIntensitySection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  wakeIntensityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wakeIntensityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonIcon: {
    fontSize: 16,
  },
  wakeIntensityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  wakeIntensityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
  },
  wakeIntensityOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  wakeIntensityOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
  },
  wakeIntensityOptionTextSelected: {
    color: '#0D0D0D',
  },
  soundSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  soundTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  soundOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  soundOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    gap: 6,
  },
  soundOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  soundOptionIcon: {
    fontSize: 16,
  },
  soundOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  soundOptionTextSelected: {
    color: '#0D0D0D',
  },
  dismissTypeSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  dismissTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  dismissTypeOptions: {
    gap: 12,
  },
  dismissTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#2A2A2A',
    gap: 14,
  },
  dismissTypeOptionSelected: {
    backgroundColor: '#FFFFFF',
  },
  dismissTypeIcon: {
    fontSize: 24,
  },
  dismissTypeTextContainer: {
    flex: 1,
  },
  dismissTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  dismissTypeLabelSelected: {
    color: '#0D0D0D',
  },
  dismissTypeDescription: {
    fontSize: 13,
    color: '#666666',
  },
  dismissTypeDescriptionSelected: {
    color: '#444444',
  },
  missionsSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818CF8',
    marginTop: 16,
    marginBottom: 4,
  },
  missionsHint: {
    fontSize: 12,
    color: '#555555',
    marginBottom: 12,
  },
  // Alarm Screen Styles
  alarmScreen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alarmScreenTime: {
    fontSize: 72,
    fontWeight: '200',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  alarmScreenLabel: {
    fontSize: 24,
    color: '#666666',
    marginBottom: 60,
  },
  mathContainer: {
    width: '100%',
    alignItems: 'center',
  },
  mathTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  mathProblem: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    marginBottom: 30,
  },
  mathInput: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 32,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  mathInputWrong: {
    backgroundColor: '#2A2545',
  },
  shakeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  shakeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 30,
  },
  shakeIcon: {
    fontSize: 80,
    marginBottom: 40,
  },
  shakeProgressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  shakeProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  shakeProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  shakeProgressText: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '500',
  },
  dismissButton: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  simpleDismissContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  stopButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#818CF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#818CF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  stopButtonText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  breathingContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 40,
  },
  breathingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  breathingPhaseText: {
    fontSize: 22,
    fontWeight: '500',
    color: '#818CF8',
    marginBottom: 24,
  },
  breathingProgress: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
  },
  affirmationContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 40,
  },
  affirmationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  affirmationTarget: {
    fontSize: 18,
    fontWeight: '500',
    color: '#818CF8',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 24,
  },
  snoozeButton: {
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  snoozeButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  // Bedtime Modal Styles
  bedtimeModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    marginTop: 'auto',
  },
  bedtimeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  bedtimeSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  saveBedtimeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBedtimeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  skipBedtimeButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBedtimeButtonText: {
    fontSize: 16,
    color: '#666666',
  },
  // Sleep Insight Modal Styles
  insightOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  insightContent: {
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  insightText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  insightHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  insightTime: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
    marginVertical: 20,
  },
  insightButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  insightButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  insightDismiss: {
    paddingVertical: 16,
    marginTop: 8,
  },
  insightDismissText: {
    fontSize: 16,
    color: '#666666',
  },
  // Settings Modal Styles
  settingsModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    marginTop: 'auto',
  },
  settingsSection: {
    padding: 20,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingsDescription: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  settingsBedtimeSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  settingsBedtimeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingsReminderInfo: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  // Sleep Stats Modal Styles
  statsModalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 100,
    flex: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsCloseButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsScrollView: {
    flex: 1,
    padding: 20,
  },
  statsEmptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  statsEmptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  statsEmptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  statsEmptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  weeklyChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    padding: 16,
    height: 180,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  chartDuration: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 8,
  },
  chartBarContainer: {
    height: 120,
    width: 24,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBarFill: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarToday: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chartDay: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
  },
  chartDayToday: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    padding: 20,
  },
  statsMainStat: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statsMainValue: {
    fontSize: 48,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  statsMainLabel: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  statsSubStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    paddingTop: 16,
  },
  statsSubStat: {
    alignItems: 'center',
  },
  statsSubLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statsSubValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  statsBestWorst: {
    flexDirection: 'row',
    gap: 12,
  },
  statsBWCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statsBestCard: {
    backgroundColor: 'rgba(99, 179, 237, 0.12)',
  },
  statsWorstCard: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  statsBWIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsBWLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statsBWValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statsBWDate: {
    fontSize: 12,
    color: '#666666',
  },
  statsTotalNights: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
