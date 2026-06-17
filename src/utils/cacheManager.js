import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memoryCache = {};

export const initCache = async () => {
  try {
    if (Platform.OS === 'web') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('bb_cache_')) {
          const val = localStorage.getItem(key);
          if (val) {
            memoryCache[key.replace('bb_cache_', '')] = JSON.parse(val);
          }
        }
      });
    } else {
      const keysStr = await SecureStore.getItemAsync('bb_cache_keys');
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        for (const key of keys) {
          const val = await SecureStore.getItemAsync('bb_cache_' + key);
          if (val) {
            memoryCache[key] = JSON.parse(val);
          }
        }
      }
    }
    console.log('Cache initialized with keys:', Object.keys(memoryCache));
  } catch (e) {
    console.error('Failed to init cache:', e);
  }
};

export const setCache = async (key, val) => {
  memoryCache[key] = val;
  try {
    const valStr = JSON.stringify(val);
    if (Platform.OS === 'web') {
      localStorage.setItem('bb_cache_' + key, valStr);
    } else {
      await SecureStore.setItemAsync('bb_cache_' + key, valStr);
      // Update key index
      const keysStr = await SecureStore.getItemAsync('bb_cache_keys');
      const keys = keysStr ? JSON.parse(keysStr) : [];
      if (!keys.includes(key)) {
        keys.push(key);
        await SecureStore.setItemAsync('bb_cache_keys', JSON.stringify(keys));
      }
    }
  } catch (e) {
    console.error('Failed to set cache for key:', key, e);
  }
};

export const getCache = (key) => {
  return memoryCache[key] || null;
};
