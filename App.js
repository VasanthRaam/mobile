import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from './src/utils/notifications';
import { navigationRef } from './src/navigation/AppNavigator';

import { Platform } from 'react-native';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

export default function App() {
  const { restoreSession, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setTimeout(() => {
            syncPushTokenWithBackend(token);
          }, 2000);
        }
      });

      const handleRedirect = (data) => {
        if (!data) return;
        const type = data.type || data.action || '';
        const isRegistration = type.includes('registration') || type.includes('approval') || data.screen === 'PendingApprovals';

        if (isRegistration) {
          if (navigationRef.isReady()) {
            navigationRef.navigate('PendingApprovals');
          }
        } else if (type === 'quiz' || type === 'new_quiz') {
          if (navigationRef.isReady()) {
            navigationRef.navigate('QuizList');
          }
        }
      };

      Notifications.getLastNotificationResponseAsync().then(response => {
        if (response?.notification?.request?.content?.data) {
          handleRedirect(response.notification.request.content.data);
        }
      });

      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        handleRedirect(response.notification.request.content.data);
      });

      return () => {
        Notifications.removeNotificationSubscription(responseListener);
      };
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
