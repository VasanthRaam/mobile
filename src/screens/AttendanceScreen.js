import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

export default function AttendanceScreen({ navigation }) {
  const { user } = useAuthStore();
  const role = user?.role;

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]); // for viewing mode
  const [loading, setLoading] = useState(true);
  const [fetchingBatches, setFetchingBatches] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendance, setAttendance] = useState({});

  const isViewMode = role === 'parent' || role === 'student';

  useEffect(() => {
    if (isViewMode) {
      fetchViewAttendance();
    } else {
      fetchCourses();
    }
  }, [role]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/courses/');
      const fetchedCourses = response.data;
      setCourses(fetchedCourses);
      if (fetchedCourses.length > 0) {
        setSelectedCourseId(fetchedCourses[0].id);
        fetchBatches(fetchedCourses[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      Alert.alert('Error', 'Failed to load courses.');
      setLoading(false);
    }
  };

  const fetchBatches = async (courseId) => {
    setFetchingBatches(true);
    setSelectedBatchId(null);
    setStudents([]);
    try {
      const response = await apiClient.get(`/batches/?course_id=${courseId}`);
      const fetchedBatches = response.data;
      setBatches(fetchedBatches);
      if (fetchedBatches.length > 0) {
        setSelectedBatchId(fetchedBatches[0].id);
        fetchStudentsToMark(fetchedBatches[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setFetchingBatches(false);
      setLoading(false);
    }
  };

  const fetchViewAttendance = async () => {
    setLoading(true);
    try {
      if (role === 'parent') {
        const stRes = await apiClient.get('/parents/students');
        const myStudents = stRes.data;
        if (myStudents && myStudents.length > 0) {
          const attRes = await apiClient.get(`/parents/${myStudents[0].id}/attendance`);
          setAttendanceRecords(attRes.data.records || []);
        }
      } else {
        const res = await apiClient.get(`/attendance/?student_id=${user.id}`);
        setAttendanceRecords(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsToMark = async (batchId) => {
    setFetchingStudents(true);
    try {
      const studentsResponse = await apiClient.get(`/batches/${batchId}/students`);
      const fetchedStudents = studentsResponse.data;
      setStudents(fetchedStudents);
      
      const today = new Date().toISOString().split('T')[0];
      const attendanceResponse = await apiClient.get(`/attendance/?batch_id=${batchId}&start_date=${today}&end_date=${today}`);
      const existingRecords = attendanceResponse.data;
      
      const recordsMap = {};
      existingRecords.forEach(rec => {
        recordsMap[rec.student_id] = rec.status === 'present';
      });

      const initialState = {};
      fetchedStudents.forEach(student => {
        initialState[student.id] = recordsMap.hasOwnProperty(student.id) 
          ? recordsMap[student.id] 
          : true;
      });
      setAttendance(initialState);
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setFetchingStudents(false);
    }
  };

  const handleToggleAttendance = (studentId) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSubmitAttendance = async () => {
    if (!selectedBatchId) return;
    setSubmitting(true);
    try {
      const payload = {
        batch_id: selectedBatchId,
        date: new Date().toISOString().split('T')[0],
        records: Object.keys(attendance).map(studentId => ({
          student_id: studentId,
          status: attendance[studentId] ? 'present' : 'absent'
        }))
      };

      await apiClient.post('/attendance/bulk', payload);
      Alert.alert('Success', 'Attendance marked successfully');
    } catch (error) {
      console.error('Failed to submit attendance:', error);
      Alert.alert('Error', 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (isViewMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Attendance</Text>
        </View>
        <FlatList
          data={attendanceRecords}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.recordItem}>
              <Text style={styles.recordDate}>{item.date}</Text>
              <Text style={[styles.recordStatus, { color: item.status === 'present' ? '#10B981' : '#EF4444' }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No attendance records found.</Text>}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mark Attendance</Text>
        <Text style={styles.subtitle}>{new Date().toDateString()}</Text>
      </View>

      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Course:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {courses.map(course => (
            <TouchableOpacity 
              key={course.id}
              style={[styles.chip, selectedCourseId === course.id && styles.chipActive]}
              onPress={() => {
                setSelectedCourseId(course.id);
                fetchBatches(course.id);
              }}
            >
              <Text style={[styles.chipText, selectedCourseId === course.id && styles.chipTextActive]}>{course.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Batch:</Text>
        {fetchingBatches ? (
          <ActivityIndicator size="small" color="#6366F1" />
        ) : batches.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {batches.map(batch => (
              <TouchableOpacity 
                key={batch.id}
                style={[styles.chip, selectedBatchId === batch.id && styles.chipActive]}
                onPress={() => {
                  setSelectedBatchId(batch.id);
                  fetchStudentsToMark(batch.id);
                }}
              >
                <Text style={[styles.chipText, selectedBatchId === batch.id && styles.chipTextActive]}>{batch.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyFilterText}>No batches for this course.</Text>
        )}
      </View>

      {fetchingStudents ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Fetching students...</Text>
        </View>
      ) : students.length > 0 ? (
        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.studentItem}>
              <View>
                <Text style={styles.studentName}>{item.first_name} {item.last_name}</Text>
                <Text style={styles.statusText}>{attendance[item.id] ? 'Present' : 'Absent'}</Text>
              </View>
              <Switch
                value={attendance[item.id]}
                onValueChange={() => handleToggleAttendance(item.id)}
                trackColor={{ false: '#EF4444', true: '#10B981' }}
              />
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Select a batch to see students.</Text>
        </View>
      )}

      {students.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitBtn, submitting && styles.disabledBtn]} 
            onPress={handleSubmitAttendance}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Attendance</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 24, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748B' },
  filters: { padding: 15, backgroundColor: '#fff', gap: 10 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 5 },
  chipScroll: { paddingVertical: 5 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#fff' },
  emptyFilterText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 5 },
  list: { padding: 15 },
  studentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  studentName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  statusText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#64748B' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  submitBtn: { backgroundColor: '#6366F1', height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { backgroundColor: '#A5B4FC' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  recordItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', marginHorizontal: 15, marginTop: 12, borderRadius: 12, elevation: 1 },
  recordDate: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  recordStatus: { fontSize: 14, fontWeight: '800' }
});
