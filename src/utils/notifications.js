import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import apiClient from '../api/apiClient';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') {
    return null;
  }

  // Support both physical devices and emulators with Play Services for testing
  const isPhysical = Device.isDevice;
  
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Notification Permission', 'Push notification permission was denied. Please enable notifications in your app settings.');
      return null;
    }
    
    // Get the token from Expo
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || '82ce1a25-8ad1-4016-a55c-63dba49ed567';
    console.log('[PUSH-DIAG] Registering token for project ID:', projectId);
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[PUSH-DIAG] Token retrieved successfully:', token);
  } catch (e) {
    console.error('[PUSH-DIAG] ERROR getting token:', e.message);
    Alert.alert('Push Token Error', `Failed to generate Expo token: ${e.message}`);
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
    // Success alert for verification
    Alert.alert('Push Registered', 'Successfully linked this device for real-time notifications!');
  } catch (error) {
    const errMsg = error.response?.data?.detail || error.message;
    console.error('[PUSH-DIAG] Failed to sync push token:', errMsg);
    
    if (error.response?.status === 401 && retryCount < 2) {
      setTimeout(() => syncPushTokenWithBackend(token, retryCount + 1), 3000);
    } else {
      Alert.alert('Sync Token Failed', `Could not save push token to backend: ${errMsg}`);
    }
  }
}
