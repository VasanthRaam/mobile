import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, 
  TouchableOpacity, ScrollView, SafeAreaView, 
  Alert, ActivityIndicator 
} from 'react-native';
import apiClient from '../api/apiClient';

export default function AssignHomeworkScreen({ navigation }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [targetType, setTargetType] = useState('batch'); // 'batch' or 'student'
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId && targetType === 'student') {
      fetchStudents(selectedBatchId);
    }
  }, [selectedBatchId, targetType]);

  const fetchBatches = async () => {
    try {
      const response = await apiClient.get('/batches/');
      setBatches(response.data);
      if (response.data.length > 0) {
        setSelectedBatchId(response.data[0].id);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>×</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assign Homework 📚</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>1. Select Batch</Text>
        <View style={styles.batchList}>
          {batches.map(batch => (
            <TouchableOpacity 
              key={batch.id} 
              style={[styles.batchItem, selectedBatchId === batch.id && styles.batchItemSelected]}
              onPress={() => setSelectedBatchId(batch.id)}
            >
              <Text style={[styles.batchText, selectedBatchId === batch.id && styles.batchTextSelected]}>
                {batch.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>2. Assign To</Text>
        <View style={styles.targetRow}>
          <TouchableOpacity 
            style={[styles.targetBtn, targetType === 'batch' && styles.targetBtnActive]}
            onPress={() => setTargetType('batch')}
          >
            <Text style={[styles.targetBtnText, targetType === 'batch' && styles.targetBtnTextActive]}>Full Batch</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.targetBtn, targetType === 'student' && styles.targetBtnActive]}
            onPress={() => setTargetType('student')}
          >
            <Text style={[styles.targetBtnText, targetType === 'student' && styles.targetBtnTextActive]}>Specific Student</Text>
          </TouchableOpacity>
        </View>

        {targetType === 'student' && (
          <View style={styles.studentSection}>
            <Text style={styles.label}>Select Student</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentList}>
              {students.map(student => (
                <TouchableOpacity 
                  key={student.id} 
                  style={[styles.studentCard, selectedStudentId === student.user_id && styles.studentCardActive]}
                  onPress={() => setSelectedStudentId(student.user_id)}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{student.first_name[0]}</Text>
                  </View>
                  <Text style={[styles.studentNameText, selectedStudentId === student.user_id && styles.studentNameTextActive]}>
                    {student.first_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.label}>{targetType === 'batch' ? '3.' : '4.'} Homework Details</Text>
        <TextInput 
          style={styles.input}
          placeholder="Homework Title"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput 
          style={[styles.input, styles.textArea, { marginTop: 12 }]}
          placeholder="Instructions..."
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
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
