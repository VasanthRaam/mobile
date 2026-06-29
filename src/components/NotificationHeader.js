import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert, Platform } from 'react-native';
import { useNotificationStore } from '../store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

export default function NotificationHeader() {
  const { notifications, unreadCount, fetchNotifications, markAsRead } = useNotificationStore();
  const [showModal, setShowModal] = React.useState(false);
  const navigation = useNavigation();
  const logout = useAuthStore((state) => state.logout);
  const { isDark, theme, toggleDark } = useThemeStore();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    setShowModal(false);
    
    if (notification.link_to) {
      if (notification.link_to.startsWith('Quiz:')) {
        const quizId = notification.link_to.split(':')[1];
        navigation.navigate('Quiz', { quizId, quizTitle: 'New Quiz' });
      } else if (notification.link_to.startsWith('Homework:')) {
        navigation.navigate('HomeworkList');
      } else if (
        notification.link_to.startsWith('registration:') || 
        notification.link_to.startsWith('PendingApproval:') || 
        notification.link_to === 'PendingApprovals'
      ) {
        navigation.navigate('PendingApprovals');
      } else if (notification.link_to === 'Attendance') {
        navigation.navigate('Attendance');
      } else if (notification.link_to === 'MyCourses') {
        navigation.navigate('MyCourses');
      } else if (notification.link_to === 'Fees') {
        navigation.navigate('Fees');
      }
    }
  };

  return (
    <View style={styles.headerActions}>
      {/* Dark/Light mode toggle */}
      <TouchableOpacity 
        onPress={toggleDark} 
        style={[styles.themeButton, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
        activeOpacity={0.7}
      >
        <Text style={styles.themeEmoji}>{isDark ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowModal(true)} style={styles.bellButton}>
        <Text style={styles.bellEmoji}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => {
          if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to logout?")) {
              logout();
            }
          } else {
            Alert.alert(
              "Logout",
              "Are you sure you want to logout?",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", onPress: () => logout(), style: 'destructive' }
              ]
            );
          }
        }} 
        style={[styles.logoutButton, { backgroundColor: isDark ? '#4c1d24' : '#FFF1F2' }]}
      >
        <Text style={styles.logoutEmoji}>🚪</Text>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Notifications</Text>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.notificationItem, 
                    { borderBottomColor: theme.border },
                    !item.is_read && [styles.unreadItem, { backgroundColor: isDark ? '#1a2333' : '#F0F8FF' }]
                  ]}
                  onPress={() => handleNotificationPress(item)}
                >
                  <Text style={[styles.notifTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.notifMessage, { color: theme.subText }]}>{item.message}</Text>
                  <Text style={[styles.notifTime, { color: theme.muted }]}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: theme.subText }]}>No notifications yet.</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  themeButton: {
    padding: 8,
    borderRadius: 12,
    marginRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeEmoji: {
    fontSize: 18,
  },
  bellButton: {
    padding: 8,
    marginRight: 5,
  },
  bellEmoji: {
    fontSize: 22,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
  },
  logoutEmoji: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  modalContent: {
    width: 300,
    maxHeight: 400,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  notificationItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  unreadItem: {
    backgroundColor: '#F0F8FF',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  notifMessage: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  notifTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
  }
});
