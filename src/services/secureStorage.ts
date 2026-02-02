/**
 * Secure Storage Service
 * Wraps react-native-encrypted-storage with automatic migration from plain AsyncStorage.
 * On first read, migrates existing unencrypted data to encrypted store and removes the old entry.
 */

import EncryptedStorage from 'react-native-encrypted-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

/** Keys that have already been migrated this session (avoid redundant checks). */
const migratedKeys = new Set<string>();

/**
 * Read from encrypted storage. If empty, check plain AsyncStorage for legacy
 * data and migrate it transparently.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    // Try encrypted store first
    const encrypted = await EncryptedStorage.getItem(key);
    if (encrypted != null) {
      migratedKeys.add(key);
      return encrypted;
    }

    // If we already checked migration for this key, nothing more to do
    if (migratedKeys.has(key)) return null;

    // Check plain AsyncStorage for legacy (pre-encryption) data
    const legacy = await AsyncStorage.getItem(key);
    if (legacy != null) {
      // Migrate: write to encrypted, remove from plain
      await EncryptedStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
      logger.log(`Migrated "${key}" to encrypted storage`);
      migratedKeys.add(key);
      return legacy;
    }

    migratedKeys.add(key);
    return null;
  } catch (error) {
    logger.error(`secureStorage.getItem("${key}") failed:`, error);
    // Fallback: try plain AsyncStorage so the app doesn't lose data
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

/**
 * Write to encrypted storage.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await EncryptedStorage.setItem(key, value);
  } catch (error) {
    logger.error(`secureStorage.setItem("${key}") failed:`, error);
    // Fallback: write to plain AsyncStorage so data isn't lost
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Remove from both encrypted and plain storage.
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    await EncryptedStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
  migratedKeys.delete(key);
}
