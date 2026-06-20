import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'buddybloom_jwt_token';
const USER_KEY = 'buddybloom_user_data';

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
      return await SecureStore.getItemAsync(TOKEN_KEY);
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
      await SecureStore.setItemAsync(USER_KEY, userStr);
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
      userStr = await SecureStore.getItemAsync(USER_KEY);
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
    }
  } catch (error) {
    console.error('Error deleting user', error);
  }
};

const BIOMETRICS_ENABLED_KEY = 'buddybloom_biometrics_enabled';
const BIOMETRICS_PROMPTED_KEY = 'buddybloom_biometrics_prompted';

export const saveBiometricsEnabled = async (enabled) => {
  try {
    const val = String(enabled);
    if (Platform.OS === 'web') {
      localStorage.setItem(BIOMETRICS_ENABLED_KEY, val);
    } else {
      await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, val);
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
      return await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
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
      return await SecureStore.getItemAsync(BIOMETRICS_PROMPTED_KEY);
    }
  } catch (error) {
    console.error('Error getting biometrics prompted preference', error);
    return null;
  }
};
