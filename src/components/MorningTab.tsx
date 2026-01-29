/**
 * MorningTab Component
 * Morning greeting screen with quick actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { Theme } from '../types';

interface MorningTabProps {
  theme: Theme;
  hapticFeedback: boolean;
}

export function MorningTab({ theme, hapticFeedback }: MorningTabProps) {
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleDeepBreath = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert('Deep Breath', 'Breathe in... hold... breathe out...');
  };

  const handleSetIntention = () => {
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert('Set Intention', 'What do you want to focus on today?');
  };

  return (
    <View style={styles.container}>
      <View style={styles.morningContainer}>
        <Text style={[styles.morningGreeting, { color: theme.text }]}>
          {getGreeting()}
        </Text>
        <Text style={[styles.morningQuote, { color: theme.textMuted }]}>
          "Today is full of possibilities"
        </Text>
        <View style={styles.morningButtons}>
          <TouchableOpacity
            style={[styles.morningButton, { backgroundColor: theme.card }]}
            onPress={handleDeepBreath}
          >
            <Text style={styles.morningButtonIcon}>🌬️</Text>
            <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Deep Breath</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.morningButton, { backgroundColor: theme.card }]}
            onPress={handleSetIntention}
          >
            <Text style={styles.morningButtonIcon}>🎯</Text>
            <Text style={[styles.morningButtonLabel, { color: theme.text }]}>Set Intention</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  morningContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  morningGreeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  morningQuote: {
    fontSize: 16,
    color: '#9999AA',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 48,
  },
  morningButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  morningButton: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  morningButtonIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  morningButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#818CF8',
  },
});
