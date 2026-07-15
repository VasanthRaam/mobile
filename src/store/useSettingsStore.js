import { create } from 'zustand';
import { getCache, setCache } from '../utils/cacheManager';
import { getBiometricsEnabled, saveBiometricsEnabled } from '../utils/secureStore';
import * as LocalAuthentication from 'expo-local-authentication';
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from '../utils/notifications';
import { Alert } from 'react-native';

export const useSettingsStore = create((set, get) => ({
  notificationsEnabled: true,
  aiAssistantEnabled: true,
  biometricsEnabled: false,
  isInitialized: false,

  initSettings: async () => {
    // 1. Fetch cache for notifications and AI assistant
    const notifs = getCache('settings_notifications');
    const ai = getCache('settings_ai_assistant');
    
    // 2. Fetch secure store for biometrics
    const bioStr = await getBiometricsEnabled();
    const biometricsEnabled = bioStr === 'true';

    set({
      notificationsEnabled: notifs !== null ? notifs : true,
      aiAssistantEnabled: ai !== null ? ai : true,
      biometricsEnabled,
      isInitialized: true,
    });
  },

  setNotificationsEnabled: async (val) => {
    if (val) {
      // Enabling notifications: Request permission and register
      const token = await registerForPushNotificationsAsync();
      if (token) {
        await syncPushTokenWithBackend(token);
        set({ notificationsEnabled: true });
        setCache('settings_notifications', true);
        Alert.alert('Success', 'Push notifications enabled successfully!');
      } else {
        set({ notificationsEnabled: false });
        setCache('settings_notifications', false);
        Alert.alert(
          'Permission Denied',
          'Could not enable push notifications. Please check your device system settings.'
        );
      }
    } else {
      // Disabling notifications
      set({ notificationsEnabled: false });
      setCache('settings_notifications', false);
      Alert.alert('Notifications Disabled', 'You will no longer receive push notifications on this device.');
    }
  },

  setAIAssistantEnabled: (val) => {
    set({ aiAssistantEnabled: val });
    setCache('settings_ai_assistant', val);
  },

  setBiometricsEnabled: async (val) => {
    if (val) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware) {
          Alert.alert('Not Supported', 'This device does not support biometric authentication.');
          set({ biometricsEnabled: false });
          return;
        }

        if (!isEnrolled) {
          Alert.alert(
            'Not Set Up',
            'No fingerprint or face records found. Please set them up in your device settings first.'
          );
          set({ biometricsEnabled: false });
          return;
        }

        // Prompt user to verify identity before enabling Face ID / Touch ID
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm identity to enable Biometric Login',
          fallbackLabel: 'Use Passcode',
          disableDeviceFallback: false,
        });

        if (result.success) {
          set({ biometricsEnabled: true });
          await saveBiometricsEnabled(true);
          Alert.alert('Enabled', 'Biometric login has been enabled successfully!');
        } else {
          set({ biometricsEnabled: false });
          await saveBiometricsEnabled(false);
        }
      } catch (err) {
        console.error('Failed to enable biometrics:', err);
        Alert.alert('Error', 'Failed to configure biometric login.');
        set({ biometricsEnabled: false });
      }
    } else {
      // Disabling biometrics
      set({ biometricsEnabled: false });
      await saveBiometricsEnabled(false);
      Alert.alert('Disabled', 'Biometric login has been disabled.');
    }
  }
}));
