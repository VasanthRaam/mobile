import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// --- Supabase Config Toggle ---
// Uncomment the environment you want to build/run:

// 1. Development (Dev Database)
const supabaseUrl = 'https://dgmmkirxdpflxniqpako.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbW1raXJ4ZHBmbHhuaXFwYWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5ODAzMTgsImV4cCI6MjA5ODU1NjMxOH0.G0rS7AuSzWQJCEUllYDLRBDeXG-mDCq9uepxSCDANRc';

// 2. Production (Prod Database)
// const supabaseUrl = 'https://kzjtserfhbkgzvcfpoyx.supabase.co';
// const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6anRzZXJmaGJrZ3p2Y2Zwb3l4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTQ4NjAsImV4cCI6MjA5MjMzMDg2MH0.JL3YNBYMq7j8zhA3ZBgq_hTRH87jYHVNSWo1tN01qls';

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
