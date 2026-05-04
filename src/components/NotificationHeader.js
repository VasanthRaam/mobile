import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { useNotificationStore } from '../store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';

export default function NotificationHeader() {
  const { notifications, unreadCount, fetchNotifications, markAsRead } = useNotificationStore();
  const [showModal, setShowModal] = React.useState(false);
  const navigation = useNavigation();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationPress = (notification) => {
    markAsRead(notification.id);
    setShowModal(false);
    
    if (notification.link_to && notification.link_to.startsWith('Quiz:')) {
      const quizId = notification.link_to.split(':')[1];
      navigation.navigate('Quiz', { quizId, quizTitle: 'New Quiz' });
    } else if (notification.type === 'new_user_registration' || notification.message.toLowerCase().includes('register')) {
      navigation.navigate('PendingApprovals');
    }
  };

  return (
    <View style={styles.headerActions}>
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
          import('react-native').then(({ Platform }) => {
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
                  { text: "Logout", onPress: logout, style: 'destructive' }
                ]
              );
            }
          });
        }} 
        style={styles.logoutButton}
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
                  onPress={() => handleNotificationPress(item)}
                >
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  <Text style={styles.notifMessage}>{item.message}</Text>
                  <Text style={styles.notifTime}>{new Date(item.created_at).toLocaleTimeString()}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No notifications yet.</Text>
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
