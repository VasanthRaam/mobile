import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from './src/utils/notifications';
import { navigationRef } from './src/navigation/AppNavigator';

// Configure how notifications are handled when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const { restoreSession, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().then(token => {
        if (token) syncPushTokenWithBackend(token);
      });

      // Listen for notifications tapped by the user
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data;
        console.log('Notification Tapped:', data);

        if (data?.type === 'registration') {
          // Use navigationRef to jump to the approvals screen
          if (navigationRef.isReady()) {
            navigationRef.navigate('PendingApprovals');
          }
        } else if (data?.type === 'quiz') {
          if (navigationRef.isReady()) {
            navigationRef.navigate('QuizList');
          }
        }
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
