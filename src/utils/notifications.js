import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/apiClient';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('[PUSH-DIAG] Push notification permission was denied by the user.');
      return null;
    }
    
    // Get the token from Expo
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || '82ce1a25-8ad1-4016-a55c-63dba49ed567';
    console.log('[PUSH-DIAG] Registering token for project ID:', projectId);

    // Retrieve the token with retries in case of transient network issues
    const maxRetries = 3;
    const retryDelay = 3000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('[PUSH-DIAG] Token retrieved successfully:', token);
        break;
      } catch (err) {
        console.warn(`[PUSH-DIAG] Fetch token attempt ${attempt} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  } catch (e) {
    console.error('[PUSH-DIAG] ERROR getting token:', e.message);
    // Logging internally instead of displaying an Alert.alert popup to avoid blocking the user flow.
  }

  return token;
}

export async function syncPushTokenWithBackend(token, retryCount = 0) {
  if (!token) return;
  try {
    console.log('[PUSH-DIAG] Sending token to backend:', token);
    const response = await apiClient.post('/users/push-token', {
      push_token: token,
      device_type: Platform.OS
    });
    console.log('[PUSH-DIAG] Token sync success:', response.data);
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message;
    console.error('[PUSH-DIAG] Failed to sync push token:', errMsg);
    
    if (error.response?.status === 401 && retryCount < 2) {
      setTimeout(() => syncPushTokenWithBackend(token, retryCount + 1), 3000);
    } else {
      console.warn('[PUSH-DIAG] Could not save push token to backend:', errMsg);
    }
  }
}
