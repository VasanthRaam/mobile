import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

export default function HomeworkListScreen({ navigation }) {
  const { user } = useAuthStore();
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const fetchHomework = async () => {
    try {
      const response = await apiClient.get('/homework');
      setHomework(response.data);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Homework</Text>
      </View>

      <FlatList
        data={homework}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={[styles.card, item.is_completed && styles.cardCompleted]}>
            <TouchableOpacity 
              style={styles.todoRow} 
              onPress={() => toggleComplete(item.id)}
              disabled={togglingId === item.id}
            >
              <View style={[styles.checkbox, item.is_completed && styles.checkboxChecked]}>
                {item.is_completed && <Text style={styles.checkMark}>✓</Text>}
                {togglingId === item.id && <ActivityIndicator size="small" color="#6366F1" />}
              </View>
              
              <View style={styles.content}>
                <View style={styles.cardHeader}>
                  <Text style={styles.courseBadge}>{item.batch?.name || 'Homework'}</Text>
                  <Text style={styles.date}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.hwTitle, item.is_completed && styles.textCompleted]}>{item.title}</Text>
                <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.teacherName}>By Teacher</Text>
              <TouchableOpacity onPress={() => Alert.alert(item.title, item.description)}>
                <Text style={styles.actionText}>Read More</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>No homework assigned yet!</Text>
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
