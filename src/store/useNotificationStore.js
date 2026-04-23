import { create } from 'zustand';
import apiClient from '../api/apiClient';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const response = await apiClient.get('/notifications');
      const notifications = response.data;
      const unreadCount = notifications.filter(n => !n.is_read).length;
      set({ notifications, unreadCount, loading: false });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ loading: false });
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await apiClient.post(`/notifications/${notificationId}/read`);
      const { notifications } = get();
      const updatedNotifications = notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      );
      const unreadCount = updatedNotifications.filter(n => !n.is_read).length;
      set({ notifications: updatedNotifications, unreadCount });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }
}));
