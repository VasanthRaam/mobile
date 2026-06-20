import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Text } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/store/useAuthStore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, syncPushTokenWithBackend } from './src/utils/notifications';
import { navigationRef } from './src/navigation/AppNavigator';
import { initCache } from './src/utils/cacheManager';
import { Ionicons } from '@expo/vector-icons';
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
    const initialize = async () => {
      await initCache();
      await restoreSession();
    };
    initialize();
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
            setTimeout(() => {
              navigationRef.navigate('PendingApprovals');
            }, 100);
          }
        } else if (type === 'quiz' || type === 'new_quiz') {
          if (navigationRef.isReady()) {
            setTimeout(() => {
              navigationRef.navigate('Quiz', { quizId: data.id, quizTitle: 'New Quiz' });
            }, 100);
          }
        } else if (type === 'homework' || type === 'new_homework') {
          if (navigationRef.isReady()) {
            setTimeout(() => {
              navigationRef.navigate('HomeworkList');
            }, 100);
          }
        } else if (type === 'fee' || type === 'fee_payment' || data.screen === 'Fees') {
          if (navigationRef.isReady()) {
            setTimeout(() => {
              navigationRef.navigate('Fees');
            }, 100);
          }
        } else if (type === 'holiday' || type.startsWith('leave') || data.screen === 'Attendance') {
          if (navigationRef.isReady()) {
            setTimeout(() => {
              navigationRef.navigate('Attendance');
            }, 100);
          }
        } else if (type.startsWith('enrollment') || data.screen === 'MyCourses') {
          if (navigationRef.isReady()) {
            setTimeout(() => {
              navigationRef.navigate('MyCourses');
            }, 100);
          }
        }
      };

      let responseListener;
      if (Platform.OS !== 'web') {
        Notifications.getLastNotificationResponseAsync().then(response => {
          if (response?.notification?.request?.content?.data) {
            handleRedirect(response.notification.request.content.data);
          }
        }).catch(err => {
          console.warn("Failed to get last notification response:", err);
        });

        responseListener = Notifications.addNotificationResponseReceivedListener(response => {
          handleRedirect(response.notification.request.content.data);
        });
      }

      return () => {
        if (responseListener) {
          Notifications.removeNotificationSubscription(responseListener);
        }
      };
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={48} color="#166534" />
        </View>
        <Text style={styles.loadingText}>Securing BuddyBloom...</Text>
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
    backgroundColor: '#F8FAFC',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
});
