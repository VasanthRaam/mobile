import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Modal, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function MyCoursesScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const [courses, setCourses] = useState(getCache('my_courses') || []);
  const [loading, setLoading] = useState(!getCache('my_courses'));
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [allCourses, setAllCourses] = useState(getCache('courses_batches') || []);
  const [loadingAll, setLoadingAll] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    fetchMyCourses();
  }, []);

  const fetchMyCourses = async () => {
    try {
      const response = await apiClient.get('/courses/');
      const coursesData = response.data;
      
      const detailedCourses = await Promise.all(coursesData.map(async (course) => {
        const batchRes = await apiClient.get(`/batches/?course_id=${course.id}`);
        return { ...course, batches: batchRes.data };
      }));
      
      setCourses(detailedCourses);
      setCache('my_courses', detailedCourses);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEnrollModal = async () => {
    setModalVisible(true);
    const cached = getCache('courses_batches');
    setLoadingAll(!cached);
    try {
      const res = await apiClient.get('/auth/courses-batches');
      setAllCourses(res.data);
      setCache('courses_batches', res.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load available courses.');
    } finally {
      setLoadingAll(false);
    }
  };

  const handleEnrollRequest = async () => {
    if (!selectedCourse || !selectedBatch) {
      Alert.alert('Selection Required', 'Please select a course and a batch.');
      return;
    }
    
    setEnrolling(true);
    try {
      await apiClient.post('/enrollments/request', {
        batch_id: selectedBatch
      });
      Alert.alert('Success', 'Enrollment request sent to Admin for approval!');
      setModalVisible(false);
      setSelectedCourse(null);
      setSelectedBatch(null);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading your programs...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>My Enrolled Courses</Text>
      </View>

      <FlatList
        style={{ backgroundColor: theme.bg }}
        showsVerticalScrollIndicator={false}
        data={courses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.courseCard, { backgroundColor: theme.card }]}>
            <View style={styles.courseHeader}>
              <View style={[styles.iconContainer, { backgroundColor: theme.accentLight }]}>
                <Text style={styles.courseIcon}>📚</Text>
              </View>
              <View style={styles.courseInfo}>
                <Text style={[styles.courseName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.courseDesc, { color: theme.subText }]} numberOfLines={2}>{item.description || 'Professional training program'}</Text>
              </View>
            </View>

            <View style={[styles.batchesSection, { borderTopColor: theme.border }]}>
              <Text style={[styles.sectionLabel, { color: theme.subText }]}>Active Batches:</Text>
              {item.batches && item.batches.length > 0 ? (
                item.batches.map(batch => (
                  <View key={batch.id} style={[styles.batchRow, { backgroundColor: theme.bg }]}>
                    <Text style={[styles.batchName, { color: theme.text }]}>📍 {batch.name}</Text>
                    <View style={[styles.activeBadge, { backgroundColor: theme.successLight }]}>
                      <Text style={[styles.activeText, { color: theme.success }]}>Enrolled</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.noBatches, { color: theme.muted }]}>No active batches found.</Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎓</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Courses Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.subText }]}>You haven't been enrolled in any courses yet.</Text>
          </View>
        }
      />
      
      {/* Floating Action Button for New Enrollment */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.accent }]} onPress={handleOpenEnrollModal}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Enroll Course Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enroll in a New Course</Text>
            
            {loadingAll ? (
              <Text style={{ textAlign: 'center', marginVertical: 20, color: theme.accent, fontWeight: '600' }}>Loading available courses...</Text>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <Text style={[styles.sectionLabel, { color: theme.subText }]}>Select a Course:</Text>
                {allCourses.map(course => {
                  const isSelected = selectedCourse === course.id;
                  return (
                    <TouchableOpacity 
                      key={course.id} 
                      style={[
                        styles.modalCard, 
                        { backgroundColor: theme.chipBg, borderColor: theme.border },
                        isSelected && { backgroundColor: theme.accentLight, borderColor: theme.accent }
                      ]}
                      onPress={() => { setSelectedCourse(course.id); setSelectedBatch(null); }}
                    >
                      <Text style={[
                        styles.modalCardText, 
                        { color: theme.text },
                        isSelected && { color: theme.accent }
                      ]}>
                        {course.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                
                {selectedCourse && (
                  <View style={{ marginTop: 20 }}>
                    <Text style={[styles.sectionLabel, { color: theme.subText }]}>Select a Batch:</Text>
                    {allCourses.find(c => c.id === selectedCourse)?.batches.map(batch => {
                      const isSelected = selectedBatch === batch.id;
                      return (
                        <TouchableOpacity 
                          key={batch.id} 
                          style={[
                            styles.modalCard, 
                            { backgroundColor: theme.chipBg, borderColor: theme.border },
                            isSelected && { backgroundColor: theme.accentLight, borderColor: theme.accent }
                          ]}
                          onPress={() => setSelectedBatch(batch.id)}
                        >
                          <Text style={[
                            styles.modalCardText, 
                            { color: theme.text },
                            isSelected && { color: theme.accent }
                          ]}>
                            {batch.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancel, { backgroundColor: theme.chipBg }]} onPress={() => { setModalVisible(false); setSelectedCourse(null); setSelectedBatch(null); }}>
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalSubmit, 
                  { backgroundColor: theme.accent },
                  (!selectedCourse || !selectedBatch || enrolling) && { backgroundColor: theme.muted }
                ]} 
                onPress={handleEnrollRequest}
                disabled={!selectedCourse || !selectedBatch || enrolling}
              >
                <Text style={styles.modalSubmitText}>{enrolling ? 'Requesting...' : 'Request Enrollment'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
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
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -4 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  modalScroll: { marginBottom: 20 },
  modalCard: { padding: 16, backgroundColor: '#F1F5F9', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  modalCardSelected: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  modalCardText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  modalCardTextSelected: { color: '#6366F1' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  modalSubmit: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#6366F1', alignItems: 'center' },
  modalSubmitDisabled: { backgroundColor: '#94A3B8' },
  modalSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff' }
});
