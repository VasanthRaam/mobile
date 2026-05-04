import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import apiClient from '../api/apiClient';
import { useDebugStore } from '../store/useDebugStore';

export async function registerForPushNotificationsAsync() {
  let token;
  const { addLog, setPushToken, setPermissionStatus } = useDebugStore.getState();

  addLog('Starting push notification registration...');

  if (Platform.OS === 'web') {
    addLog('Platform is web, skipping push registration.');
    return null;
  }

  if (Device.isDevice) {
    addLog('Checking notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    addLog(`Existing permission status: ${existingStatus}`);
    
    if (existingStatus !== 'granted') {
      addLog('Requesting permissions from user...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      addLog(`New permission status: ${finalStatus}`);
    }
    
    setPermissionStatus(finalStatus);
    
    if (finalStatus !== 'granted') {
      addLog('Failed: User denied push notification permissions!');
      return null;
    }
    
    // Get the token from Expo
    try {
      addLog('Fetching Expo Push Token...');
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || 'bcdae01d-74c3-45c4-8f8f-a170446f806f';
      addLog(`Using Project ID: ${projectId}`);
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      addLog(`Success! Token: ${token.substring(0, 15)}...`);
      setPushToken(token);
    } catch (e) {
      addLog(`ERROR getting token: ${e.message}`);
    }
  } else {
    addLog('ERROR: Must use physical device for Push Notifications');
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

export async function syncPushTokenWithBackend(token) {
  if (!token) return;
  const { addLog } = useDebugStore.getState();
  addLog('Syncing token with backend...');
  try {
    await apiClient.post('/users/push-token', {
      push_token: token,
      device_type: Platform.OS
    });
    addLog('SUCCESS: Push token synced with backend!');
    console.log('Push token synced with backend');
  } catch (error) {
    addLog(`ERROR syncing token: ${error.message}`);
    console.error('Failed to sync push token:', error);
  }
}
