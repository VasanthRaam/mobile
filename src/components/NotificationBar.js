import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNotificationStore } from '../store/useNotificationStore';
import { useNavigation } from '@react-navigation/native';

export default function NotificationBar() {
  const { notifications, markAsRead } = useNotificationStore();
  const navigation = useNavigation();
  
  const latestUnread = notifications.find(n => !n.is_read);

  if (!latestUnread) return null;

  const handlePress = () => {
    markAsRead(latestUnread.id);
    if (latestUnread.link_to && latestUnread.link_to.startsWith('Quiz:')) {
      const quizId = latestUnread.link_to.split(':')[1];
      navigation.navigate('Quiz', { quizId, quizTitle: 'New Quiz' });
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Text style={styles.icon}>📢</Text>
      <Text style={styles.text} numberOfLines={1}>
        {latestUnread.message}
      </Text>
      <Text style={styles.link}>View →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9C4', // Light yellow
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFF176',
  },
  icon: {
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#5D4037',
    fontWeight: '600',
  },
  link: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: 'bold',
    marginLeft: 10,
  }
});
