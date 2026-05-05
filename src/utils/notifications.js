import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/apiClient';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') {
    return null;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }
    
    // Get the token from Expo
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || 'bcdae01d-74c3-45c4-8f8f-a170446f806f';
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.error('ERROR getting token:', e.message);
    }
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

export async function syncPushTokenWithBackend(token, retryCount = 0) {
  if (!token) return;
  try {
    await apiClient.post('/users/push-token', {
      push_token: token,
      device_type: Platform.OS
    });
    console.log('Push token synced with backend');
  } catch (error) {
    if (error.response?.status === 401 && retryCount < 2) {
      console.log('Unauthorized (401) during token sync. Retrying...');
      setTimeout(() => syncPushTokenWithBackend(token, retryCount + 1), 3000);
    } else {
      console.error('Failed to sync push token:', error.message);
    }
  }
}
