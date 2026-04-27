import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from './src/utils/notifications';

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

      // Listen for notifications received while app is foregrounded
      const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification Tapped:', response.notification.request.content.data);
        // You can add navigation logic here based on data.type
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
