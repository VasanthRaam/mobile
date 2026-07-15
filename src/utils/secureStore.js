import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'buddybloom_jwt_token';
const USER_KEY = 'buddybloom_user_data';
const BIOMETRICS_ENABLED_KEY = 'buddybloom_biometrics_enabled';
const BIOMETRICS_PROMPTED_KEY = 'buddybloom_biometrics_prompted';

/**
 * Saves the JWT token securely
 * @param {string} token 
 */
export const saveToken = async (token) => {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  } catch (error) {
    console.error('Error saving token', error);
  }
};

/**
 * Retrieves the JWT token
 * @returns {Promise<string|null>}
 */
export const getToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    } else {
      try {
        const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (secureToken) {
          await AsyncStorage.setItem(TOKEN_KEY, secureToken);
          return secureToken;
        }
      } catch (secureError) {
        console.warn('SecureStore getToken failed, trying fallback:', secureError);
      }
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error getting token', error);
    return null;
  }
};

/**
 * Deletes the JWT token (Logout)
 */
export const deleteToken = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (error) {
    console.error('Error deleting token', error);
  }
};

/**
 * Saves user data
 */
export const saveUser = async (user) => {
  try {
    const userStr = JSON.stringify(user);
    if (Platform.OS === 'web') {
      localStorage.setItem(USER_KEY, userStr);
    } else {
      try {
        await SecureStore.setItemAsync(USER_KEY, userStr);
      } catch (secureError) {
        console.warn('SecureStore saveUser failed:', secureError);
      }
      await AsyncStorage.setItem(USER_KEY, userStr);
    }
  } catch (error) {
    console.error('Error saving user', error);
  }
};

/**
 * Retrieves user data
 */
export const getUser = async () => {
  try {
    let userStr;
    if (Platform.OS === 'web') {
      userStr = localStorage.getItem(USER_KEY);
    } else {
      try {
        userStr = await SecureStore.getItemAsync(USER_KEY);
      } catch (secureError) {
        console.warn('SecureStore getUser failed, trying fallback:', secureError);
      }
      if (!userStr) {
        userStr = await AsyncStorage.getItem(USER_KEY);
      }
    }
    return userStr ? JSON.parse(userStr) : null;
  } catch (error) {
    console.error('Error getting user', error);
    return null;
  }
};

/**
 * Deletes user data
 */
export const deleteUser = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
      await AsyncStorage.removeItem(USER_KEY);
    }
  } catch (error) {
    console.error('Error deleting user', error);
  }
};

export const saveBiometricsEnabled = async (enabled) => {
  try {
    const val = String(enabled);
    if (Platform.OS === 'web') {
      localStorage.setItem(BIOMETRICS_ENABLED_KEY, val);
    } else {
      await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, val);
      await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, val);
    }
  } catch (error) {
    console.error('Error saving biometrics enabled preference', error);
  }
};

export const getBiometricsEnabled = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(BIOMETRICS_ENABLED_KEY);
    } else {
      try {
        const val = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
        if (val !== null) return val;
      } catch (e) {
        console.warn('SecureStore getBiometricsEnabled failed:', e);
      }
      return await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
    }
  } catch (error) {
    console.error('Error getting biometrics enabled preference', error);
    return null;
  }
};

export const saveBiometricsPrompted = async (prompted) => {
  try {
    const val = String(prompted);
    if (Platform.OS === 'web') {
      localStorage.setItem(BIOMETRICS_PROMPTED_KEY, val);
    } else {
      await SecureStore.setItemAsync(BIOMETRICS_PROMPTED_KEY, val);
      await AsyncStorage.setItem(BIOMETRICS_PROMPTED_KEY, val);
    }
  } catch (error) {
    console.error('Error saving biometrics prompted preference', error);
  }
};

export const getBiometricsPrompted = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(BIOMETRICS_PROMPTED_KEY);
    } else {
      try {
        const val = await SecureStore.getItemAsync(BIOMETRICS_PROMPTED_KEY);
        if (val !== null) return val;
      } catch (e) {
        console.warn('SecureStore getBiometricsPrompted failed:', e);
      }
      return await AsyncStorage.getItem(BIOMETRICS_PROMPTED_KEY);
    }
  } catch (error) {
    console.error('Error getting biometrics prompted preference', error);
    return null;
  }
};

/**
 * Clears all authentication preferences (biometrics settings and walkthrough status)
 */
export const clearAuthPreferences = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(BIOMETRICS_ENABLED_KEY);
      localStorage.removeItem(BIOMETRICS_PROMPTED_KEY);
      localStorage.removeItem('buddybloom_walkthrough_seen');
    } else {
      await Promise.all([
        SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(BIOMETRICS_PROMPTED_KEY).catch(() => {}),
        AsyncStorage.removeItem(BIOMETRICS_ENABLED_KEY).catch(() => {}),
        AsyncStorage.removeItem(BIOMETRICS_PROMPTED_KEY).catch(() => {}),
        AsyncStorage.removeItem('buddybloom_walkthrough_seen').catch(() => {})
      ]);
    }
  } catch (error) {
    console.error('Error clearing auth preferences', error);
  }
};
