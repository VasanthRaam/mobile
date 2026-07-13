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
      try {
        localStorage.setItem('bb_cache_' + key, valStr);
      } catch (domException) {
        // Handle localStorage quota limits
        if (
          domException.name === 'QuotaExceededError' ||
          domException.name === 'NS_ERROR_DOM_QUOTA_REACHED'
        ) {
          console.warn('Cache quota exceeded. Pruning older caches to free space...');
          const keys = Object.keys(localStorage);
          keys.forEach(k => {
            if (k.startsWith('bb_cache_') && k !== 'bb_cache_' + key) {
              localStorage.removeItem(k);
              delete memoryCache[k.replace('bb_cache_', '')];
            }
          });
          // Retry setting the item
          try {
            localStorage.setItem('bb_cache_' + key, valStr);
          } catch (retryErr) {
            console.error('Failed to set cache even after pruning:', retryErr);
          }
        } else {
          throw domException;
        }
      }
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

export const clearCache = async () => {
  // Clear memory cache
  for (const key in memoryCache) {
    delete memoryCache[key];
  }
  
  try {
    if (Platform.OS === 'web') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('bb_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } else {
      const keysStr = await SecureStore.getItemAsync('bb_cache_keys');
      if (keysStr) {
        const keys = JSON.parse(keysStr);
        for (const key of keys) {
          await SecureStore.deleteItemAsync('bb_cache_' + key);
        }
        await SecureStore.deleteItemAsync('bb_cache_keys');
      }
    }
    console.log('Persistent cache cleared successfully.');
  } catch (e) {
    console.error('Failed to clear cache:', e);
  }
};
