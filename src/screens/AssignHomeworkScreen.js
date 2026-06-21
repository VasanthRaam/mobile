import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, 
  TouchableOpacity, ScrollView, 
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function AssignHomeworkScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const [courses, setCourses] = useState(getCache('courses') || []);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [targetType, setTargetType] = useState('batch'); // 'batch' or 'student'
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!getCache('courses'));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchBatches(selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedBatchId && targetType === 'student') {
      fetchStudents(selectedBatchId);
    }
  }, [selectedBatchId, targetType]);

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/');
      setCourses(response.data);
      setCache('courses', response.data);
      if (response.data.length > 0) {
        setSelectedCourseId(response.data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
      setLoading(false);
    }
  };

  const fetchBatches = async (courseId) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/batches/?course_id=${courseId}`);
      setBatches(response.data);
      if (response.data.length > 0) {
        setSelectedBatchId(response.data[0].id);
      } else {
        setSelectedBatchId('');
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      Alert.alert('Error', 'Could not load batches');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (batchId) => {
    try {
      const response = await apiClient.get(`/batches/${batchId}/students`);
      setStudents(response.data);
      if (response.data.length > 0) {
        // We need the user_id for notification, but the endpoint might return student record.
        // Let's assume response.data[0].user_id exists.
        setSelectedStudentId(response.data[0].user_id);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  };

  const handleCreate = async () => {
    console.log('Attempting to create homework...', { selectedBatchId, targetType, selectedStudentId, title });

    if (!title || !selectedBatchId) {
      Alert.alert('Error', 'Please fill in title and select a batch');
      return;
    }

    if (targetType === 'student' && !selectedStudentId) {
      Alert.alert('Error', 'Please select a student');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        batch_id: selectedBatchId,
        student_id: (targetType === 'student' && selectedStudentId) ? selectedStudentId : null,
        title: title,
        description: description,
        due_date: new Date(Date.now() + 86400000 * 2).toISOString()
      };
      
      console.log('Sending payload:', payload);
      
      const response = await apiClient.post('/homework', payload);
      console.log('Assignment response:', response.data);
      
      Alert.alert('Success', 'Homework assigned and notified! 🔔');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to assign homework:', error);
      const msg = error.response?.data?.detail || error.message || 'Unknown error';
      Alert.alert('Error', `Failed to assign homework: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && courses.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backIcon, { color: theme.danger }]}>×</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Assign Homework 📚</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.label, { color: theme.text }]}>1. Select Course</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {courses.map(course => {
            const isSelected = selectedCourseId === course.id;
            return (
              <TouchableOpacity 
                key={course.id}
                style={[
                  styles.batchItem, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => setSelectedCourseId(course.id)}
              >
                <Text style={[
                  styles.batchText, 
                  { color: theme.subText },
                  isSelected && { color: '#fff' }
                ]}>
                  {course.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {courses.length === 0 && <Text style={[styles.noDataText, { color: theme.muted }]}>No courses available</Text>}
        </ScrollView>

        <Text style={[styles.label, { color: theme.text }]}>2. Select Batch</Text>
        <View style={styles.batchList}>
          {batches.map(batch => {
            const isSelected = selectedBatchId === batch.id;
            return (
              <TouchableOpacity 
                key={batch.id} 
                style={[
                  styles.batchItem, 
                  { backgroundColor: theme.card, borderColor: theme.border },
                  isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => setSelectedBatchId(batch.id)}
              >
                <Text style={[
                  styles.batchText, 
                  { color: theme.subText },
                  isSelected && { color: '#fff' }
                ]}>
                  {batch.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {batches.length === 0 && <Text style={[styles.noDataText, { color: theme.muted }]}>No batches available</Text>}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>3. Assign To</Text>
        <View style={styles.targetRow}>
          <TouchableOpacity 
            style={[
              styles.targetBtn, 
              { backgroundColor: theme.card, borderColor: theme.border },
              targetType === 'batch' && { backgroundColor: theme.accentLight, borderColor: theme.accent }
            ]}
            onPress={() => setTargetType('batch')}
          >
            <Text style={[
              styles.targetBtnText, 
              { color: theme.subText },
              targetType === 'batch' && { color: theme.accent }
            ]}>Full Batch</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.targetBtn, 
              { backgroundColor: theme.card, borderColor: theme.border },
              targetType === 'student' && { backgroundColor: theme.accentLight, borderColor: theme.accent }
            ]}
            onPress={() => setTargetType('student')}
          >
            <Text style={[
              styles.targetBtnText, 
              { color: theme.subText },
              targetType === 'student' && { color: theme.accent }
            ]}>Specific Student</Text>
          </TouchableOpacity>
        </View>

        {targetType === 'student' && (
          <View style={styles.studentSection}>
            <Text style={[styles.label, { color: theme.text }]}>Select Student</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentList}>
              {students.map(student => {
                const isSelected = selectedStudentId === student.user_id;
                return (
                  <TouchableOpacity 
                    key={student.id} 
                    style={styles.studentCard}
                    onPress={() => setSelectedStudentId(student.user_id)}
                  >
                    <View style={[
                      styles.avatar, 
                      { backgroundColor: theme.accentLight, borderColor: isSelected ? theme.accent : 'transparent', borderWidth: 3 }
                    ]}>
                      <Text style={[styles.avatarText, { color: theme.accent }]}>{student.first_name[0]}</Text>
                    </View>
                    <Text style={[
                      styles.studentNameText, 
                      { color: theme.subText },
                      isSelected && { color: theme.text, fontWeight: '800' }
                    ]}>
                      {student.first_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>{targetType === 'batch' ? '4.' : '5.'} Homework Details</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="Homework Title"
          placeholderTextColor={theme.muted}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput 
          style={[styles.input, styles.textArea, { marginTop: 12, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="Instructions..."
          placeholderTextColor={theme.muted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity 
          style={[styles.submitBtn, { backgroundColor: theme.accent }, submitting && { opacity: 0.7 }]}
          onPress={handleCreate}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Sending Notifications...' : 'Assign & Notify Students 🔔'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#475569',
    fontWeight: '600',
  },
  content: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  batchList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  batchItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  batchItemSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  batchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  batchTextSelected: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    color: '#1E293B',
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#4F46E5',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  targetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  targetBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  targetBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  targetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  targetBtnTextActive: {
    color: '#4F46E5',
  },
  studentSection: {
    marginTop: 8,
  },
  studentList: {
    paddingVertical: 12,
    gap: 16,
  },
  studentCard: {
    alignItems: 'center',
    width: 80,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  studentCardActive: {
    // scale effect or something
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  studentNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  studentNameTextActive: {
    color: '#1E293B',
    fontWeight: '800',
  }
});
