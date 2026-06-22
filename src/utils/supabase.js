import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = 'https://kzjtserfhbkgzvcfpoyx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anRzZXJmaGJrZ3p2Y2Zwb3l4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njc1NDg2MCwiZXhwIjoyMDkyMzMwODYwfQ.SY9dZB5V8r1mfG-hnpA0kXU0xc7jFxfJpHO4ibAM3ZU';

import AsyncStorage from '@react-native-async-storage/async-storage';

// Custom storage adapter: Use SecureStore with AsyncStorage fallback for native, localStorage for web
const UniversalStorageAdapter = {
  getItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val) {
        await AsyncStorage.setItem(key, val);
        return val;
      }
    } catch (e) {
      console.warn('Supabase SecureStore getItem failed, trying AsyncStorage:', e);
    }
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } else {
      try {
        await SecureStore.setItemAsync(key, value);
      } catch (e) {
        console.warn('Supabase SecureStore setItem failed:', e);
      }
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        console.warn('Supabase SecureStore deleteItem failed:', e);
      }
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: UniversalStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
