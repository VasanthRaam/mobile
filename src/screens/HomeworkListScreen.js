import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function HomeworkListScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const { user } = useAuthStore();
  const [homework, setHomework] = useState(getCache('homework_list') || []);
  const [loading, setLoading] = useState(!getCache('homework_list'));
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchHomework = async () => {
    try {
      const response = await apiClient.get('/homework');
      setHomework(response.data);
      setCache('homework_list', response.data);
    } catch (error) {
      console.error('Failed to fetch homework:', error);
      // If 405 occurs, it might be the reloader hasn't finished or route mismatch
      if (error.response?.status === 405) {
        console.warn('GET /homework returned 405. Backend might still be restarting.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHomework();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHomework();
  };

  const toggleComplete = async (hwId) => {
    setTogglingId(hwId);
    try {
      const res = await apiClient.post(`/homework/${hwId}/toggle-complete`);
      const newStatus = res.data.success;
      
      setHomework(prev => prev.map(item => 
        item.id === hwId ? { ...item, is_completed: newStatus } : item
      ));
    } catch (error) {
      console.error('Toggle failed:', error);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading && homework.length === 0) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Loading homework...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>My Homework</Text>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={homework}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { backgroundColor: theme.bg }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={[
            styles.card, 
            { backgroundColor: theme.card, borderLeftColor: theme.accent }, 
            item.is_completed && { borderLeftColor: theme.success, opacity: 0.8 }
          ]}>
            <TouchableOpacity 
              style={styles.todoRow} 
              onPress={() => toggleComplete(item.id)}
              disabled={togglingId === item.id}
            >
              <View style={[
                styles.checkbox, 
                { backgroundColor: theme.chipBg, borderColor: theme.border },
                item.is_completed && { backgroundColor: theme.success, borderColor: theme.success }
              ]}>
                {togglingId === item.id ? (
                  <Text style={{ color: theme.accent, fontSize: 10 }}>...</Text>
                ) : (
                  item.is_completed && <Text style={styles.checkMark}>✓</Text>
                )}
              </View>
              
              <View style={styles.content}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.courseBadge, { backgroundColor: theme.accentLight, color: theme.accent }]}>{item.batch?.name || 'Homework'}</Text>
                  <Text style={[styles.date, { color: theme.muted }]}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
                </View>
                <Text style={[
                  styles.hwTitle, 
                  { color: theme.text },
                  item.is_completed && { textDecorationLine: 'line-through', color: theme.subText }
                ]}>{item.title}</Text>
                <Text style={[styles.description, { color: theme.subText }]} numberOfLines={1}>{item.description}</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              <Text style={[styles.teacherName, { color: theme.muted }]}>By Teacher</Text>
              <TouchableOpacity onPress={() => Alert.alert(item.title, item.description)}>
                <Text style={[styles.actionText, { color: theme.accent }]}>Read More</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={[styles.emptyText, { color: theme.subText }]}>No homework assigned yet!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { marginRight: 15 },
  backText: { fontSize: 16, color: '#6366F1', fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  list: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  cardCompleted: { borderLeftColor: '#10B981', opacity: 0.8 },
  todoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginTop: 4, marginRight: 12, backgroundColor: '#F8FAFC' },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkMark: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  content: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' },
  courseBadge: { backgroundColor: '#EEF2FF', color: '#6366F1', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  date: { fontSize: 11, color: '#94A3B8' },
  hwTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  textCompleted: { textDecorationLine: 'line-through', color: '#94A3B8' },
  description: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 12 },
  teacherName: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic' },
  actionText: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 50, marginBottom: 16 },
  emptyText: { fontSize: 16, color: '#64748B', fontWeight: '600' }
});
