import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import apiClient from '../api/apiClient';

export default function MyCoursesScreen({ navigation }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyCourses();
  }, []);

  const fetchMyCourses = async () => {
    try {
      // The /courses/ endpoint already filters by role automatically
      const response = await apiClient.get('/courses/');
      // We also want to get batch names for each course
      const coursesData = response.data;
      
      const detailedCourses = await Promise.all(coursesData.map(async (course) => {
        const batchRes = await apiClient.get(`/batches/?course_id=${course.id}`);
        return { ...course, batches: batchRes.data };
      }));
      
      setCourses(detailedCourses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your programs...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Enrolled Courses</Text>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={courses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.courseCard}>
            <View style={styles.courseHeader}>
              <View style={styles.iconContainer}>
                <Text style={styles.courseIcon}>📚</Text>
              </View>
              <View style={styles.courseInfo}>
                <Text style={styles.courseName}>{item.name}</Text>
                <Text style={styles.courseDesc} numberOfLines={2}>{item.description || 'Professional training program'}</Text>
              </View>
            </View>

            <View style={styles.batchesSection}>
              <Text style={styles.sectionLabel}>Active Batches:</Text>
              {item.batches && item.batches.length > 0 ? (
                item.batches.map(batch => (
                  <View key={batch.id} style={styles.batchRow}>
                    <Text style={styles.batchName}>📍 {batch.name}</Text>
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>Enrolled</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noBatches}>No active batches found.</Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎓</Text>
            <Text style={styles.emptyTitle}>No Courses Yet</Text>
            <Text style={styles.emptySubtitle}>You haven't been enrolled in any courses yet.</Text>
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
  loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600' },
  list: { padding: 20 },
  courseCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconContainer: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  courseIcon: { fontSize: 24 },
  courseInfo: { flex: 1 },
  courseName: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  courseDesc: { fontSize: 13, color: '#64748B', marginTop: 2 },
  batchesSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  batchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 8 },
  batchName: { fontSize: 14, fontWeight: '600', color: '#475569' },
  activeBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeText: { color: '#166534', fontSize: 10, fontWeight: '800' },
  noBatches: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic' },
  empty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
});
