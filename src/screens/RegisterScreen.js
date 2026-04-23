import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, Animated, StatusBar,
} from 'react-native';
import apiClient from '../api/apiClient';

// ─── Role options ─────────────────────────────────────────────────────────────
const ROLES = [
  { label: 'Student', value: 'student', icon: '🎒', desc: 'I am enrolled in a class' },
  { label: 'Teacher', value: 'teacher', icon: '👩‍🏫', desc: 'I teach here' },
];

// ─── Validators ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{7,}$/;

function validateAll({ fullName, email, phone, password, confirmPassword, role, selectedBatches }) {
  if (!fullName.trim() || fullName.trim().length < 2)
    return 'Full name must be at least 2 characters.';
  if (!email.trim() || !EMAIL_RE.test(email.trim()))
    return 'Please enter a valid email address.';
  if (phone && !PHONE_RE.test(phone.trim()))
    return 'Phone number is not valid.';
  if (password.length < 6)
    return 'Password must be at least 6 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return 'Password must contain at least one letter and one number.';
  if (password !== confirmPassword)
    return 'Passwords do not match.';
  if (!role)
    return 'Please select your role.';
  if (selectedBatches.length === 0)
    return 'Please select at least one batch.';
  return null; 
}

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Courses & Batches Data
  const [availableData, setAvailableData] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [fetchingData, setFetchingData] = useState(true);

  const [errors, setErrors] = useState({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    fetchCoursesBatches();
  }, []);

  const fetchCoursesBatches = async () => {
    try {
      const res = await apiClient.get('/auth/courses-batches');
      setAvailableData(res.data);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load courses and batches.');
    } finally {
      setFetchingData(false);
    }
  };

  const toggleCourse = (courseId) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses(selectedCourses.filter(id => id !== courseId));
      // Also remove its batches
      const course = availableData.find(c => c.id === courseId);
      const batchIdsToRemove = course.batches.map(b => b.id);
      setSelectedBatches(selectedBatches.filter(id => !batchIdsToRemove.includes(id)));
    } else {
      setSelectedCourses([...selectedCourses, courseId]);
    }
  };

  const toggleBatch = (batchId) => {
    if (selectedBatches.includes(batchId)) {
      setSelectedBatches(selectedBatches.filter(id => id !== batchId));
    } else {
      setSelectedBatches([...selectedBatches, batchId]);
    }
  };

  const handleRegister = async () => {
    const err = validateAll({ fullName, email, phone, password, confirmPassword, role, selectedBatches });
    if (err) {
      Alert.alert('Incomplete Form', err);
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        password,
        role,
        course_ids: selectedCourses,
        batch_ids: selectedBatches,
      });
      setSubmitted(true);
    } catch (error) {
      const detail = error.response?.data?.detail || 'Registration failed.';
      Alert.alert('Registration Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <Animated.View style={[styles.successCard, { opacity: fadeAnim }]}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.successTitle}>Request Submitted!</Text>
          <Text style={styles.successMsg}>
            Your registration is being reviewed by an admin. You will be able to login once approved.
          </Text>
          <TouchableOpacity style={styles.backToLoginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.heading}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Fill in your details to join BuddyBloom</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Select Your Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleChip, role === r.value && styles.roleChipActive]}
                  onPress={() => setRole(r.value)}
                >
                  <Text style={styles.roleChipIcon}>{r.icon}</Text>
                  <Text style={[styles.roleChipLabel, role === r.value && styles.roleChipLabelActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Enter your full name" />
            <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 9876543210" keyboardType="phone-pad" />
            
            {/* Courses & Batches Selection */}
            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>Select Courses & Batches</Text>
            {fetchingData ? (
              <ActivityIndicator color="#6366F1" style={{ marginVertical: 10 }} />
            ) : (
              <View style={styles.selectionArea}>
                {availableData.map(course => (
                  <View key={course.id} style={styles.courseBlock}>
                    <TouchableOpacity 
                      style={[styles.courseHeader, selectedCourses.includes(course.id) && styles.courseHeaderActive]}
                      onPress={() => toggleCourse(course.id)}
                    >
                      <Text style={[styles.courseName, selectedCourses.includes(course.id) && styles.courseNameActive]}>{course.name}</Text>
                      <Text style={styles.checkIcon}>{selectedCourses.includes(course.id) ? '✅' : '⬜'}</Text>
                    </TouchableOpacity>
                    
                    {selectedCourses.includes(course.id) && (
                      <View style={styles.batchList}>
                        {course.batches.map(batch => (
                          <TouchableOpacity 
                            key={batch.id} 
                            style={[styles.batchChip, selectedBatches.includes(batch.id) && styles.batchChipActive]}
                            onPress={() => toggleBatch(batch.id)}
                          >
                            <Text style={[styles.batchText, selectedBatches.includes(batch.id) && styles.batchTextActive]}>{batch.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry={!showPassword} />
            <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry={!showConfirmPassword} />

            <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Registration Request</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, ...props }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  backBtn: { marginBottom: 20 },
  backBtnText: { color: '#6366F1', fontWeight: '700' },
  heading: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleChip: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  roleChipActive: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  roleChipIcon: { fontSize: 20, marginBottom: 4 },
  roleChipLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  roleChipLabelActive: { color: '#6366F1' },
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  input: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: '#E2E8F0', color: '#1E293B' },
  selectionArea: { marginBottom: 20 },
  courseBlock: { marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#F8FAFC' },
  courseHeaderActive: { backgroundColor: '#EEF2FF' },
  courseName: { fontSize: 15, fontWeight: '700', color: '#475569' },
  courseNameActive: { color: '#6366F1' },
  checkIcon: { fontSize: 16 },
  batchList: { padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#fff' },
  batchChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  batchChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  batchText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  batchTextActive: { color: '#fff' },
  submitBtn: { backgroundColor: '#6366F1', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successContainer: { flex: 1, justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center', elevation: 10 },
  successIcon: { fontSize: 50, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 12 },
  successMsg: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  backToLoginBtn: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backToLoginText: { color: '#fff', fontWeight: '700' },
});
