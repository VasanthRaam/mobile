import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, ScrollView, Dimensions, Platform } from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

const { width } = Dimensions.get('window');

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
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'weekly', 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [holidays, setHolidays] = useState([]);
  const [isHoliday, setIsHoliday] = useState(false);

  const isViewMode = role === 'parent' || role === 'student';
  const isAdmin = role === 'admin';
  console.log('🔍 [DEBUG] Attendance Role:', role, 'isViewMode:', isViewMode);

  useEffect(() => {
    fetchHolidays();
    if (isViewMode) {
      fetchViewAttendance();
    } else {
      fetchCourses();
    }
  }, [role, filterMode, selectedDate]);

  const fetchHolidays = async () => {
    try {
      const res = await apiClient.get('/attendance/holidays');
      setHolidays(res.data);
      const holidayDates = res.data.map(h => h.date);
      setIsHoliday(holidayDates.includes(selectedDate));
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

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
      let url = '/attendance/';
      const now = new Date();
      let startDate, endDate;

      if (filterMode === 'weekly') {
        const first = now.getDate() - now.getDay();
        startDate = new Date(now.setDate(first)).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        url += `?start_date=${startDate}&end_date=${endDate}`;
      } else if (filterMode === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }

      if (role === 'parent') {
        const stRes = await apiClient.get('/parents/students');
        const myStudents = stRes.data;
        if (myStudents && myStudents.length > 0) {
          const separator = url.includes('?') ? '&' : '?';
          const attRes = await apiClient.get(`/parents/${myStudents[0].id}/attendance${url.replace('/attendance/', '')}`);
          setAttendanceRecords(attRes.data.records || []);
        }
      } else {
        const res = await apiClient.get(url);
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
      
      const attendanceResponse = await apiClient.get(`/attendance/?batch_id=${batchId}&start_date=${selectedDate}&end_date=${selectedDate}`);
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
        date: selectedDate,
        records: Object.keys(attendance).map(studentId => ({
          student_id: studentId,
          status: attendance[studentId] ? 'present' : 'absent'
        }))
      };

      await apiClient.post('/attendance/bulk', payload);
      if (Platform.OS === 'web') {
        alert('✅ Attendance marked successfully for ' + selectedDate);
      } else {
        Alert.alert('Success', 'Attendance marked successfully');
      }
    } catch (error) {
      console.error('Failed to submit attendance:', error);
      if (Platform.OS === 'web') {
        alert('❌ Failed to submit attendance');
      } else {
        Alert.alert('Error', 'Failed to submit attendance');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHoliday = async () => {
    setSubmitting(true);
    try {
      if (Platform.OS === 'web') {
        alert(isHoliday ? '✅ Holiday removed' : '✅ Academy holiday marked');
      } else {
        Alert.alert('Success', isHoliday ? 'Holiday removed' : 'Academy holiday marked');
      }
      fetchHolidays();
    } catch (error) {
      if (Platform.OS === 'web') {
        alert('❌ Action failed');
      } else {
        Alert.alert('Error', 'Action failed');
      }
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
    const renderCalendar = () => {
      const recordsMap = {};
      attendanceRecords.forEach(r => {
        recordsMap[r.date] = r.status;
      });
      const holidayDates = holidays.map(h => h.date);

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
      
      const days = [];
      for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      return (
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthTitle}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][currentMonth]} {currentYear}
            </Text>
          </View>
          <View style={styles.weekDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
              <Text key={d} style={styles.weekDayText}>{d}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.dayBox} />;
              
              const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              const status = recordsMap[dateStr];
              const isAcademyHoliday = holidayDates.includes(dateStr);
              
              return (
                <View key={idx} style={[
                  styles.dayBox, 
                  status === 'present' && styles.presentDay,
                  status === 'absent' && styles.absentDay,
                  isAcademyHoliday && styles.holidayDay
                ]}>
                  <Text style={[
                    styles.dayText,
                    (status || isAcademyHoliday) && styles.statusDayText
                  ]}>{day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#A855F7' }]} />
              <Text style={styles.legendText}>Holiday</Text>
            </View>
          </View>
        </View>
      );
    };

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Attendance Insights</Text>
          <Text style={styles.subtitle}>Track your learning consistency 📈</Text>
        </View>
        
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {renderCalendar()}
          
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            {attendanceRecords.length > 0 ? (
              attendanceRecords.slice(0, 5).map(item => (
                <View key={item.id} style={styles.recordItem}>
                  <Text style={styles.recordDate}>{item.date}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? '#F0FDF4' : '#FEF2F2' }]}>
                    <Text style={[styles.recordStatus, { color: item.status === 'present' ? '#10B981' : '#EF4444' }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent records found.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance Management</Text>
        <Text style={styles.subtitle}>Select a date to manage records</Text>
      </View>

      <View style={styles.dateSelection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={Platform.OS === 'web'} 
          style={styles.dateList}
          contentContainerStyle={styles.dateListContent}
        >
          {Array.from({ length: 30 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const isSelected = dStr === selectedDate;
            return (
              <TouchableOpacity 
                key={dStr} 
                style={[styles.dateChip, isSelected && styles.dateChipActive]}
                onPress={() => setSelectedDate(dStr)}
              >
                <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextActive]}>{d.getDate()}</Text>
                <Text style={[styles.dateChipMonth, isSelected && styles.dateChipTextActive]}>
                  {d.toLocaleString('default', { month: 'short' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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

      {students.length > 0 && !isHoliday && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitBtn, submitting && styles.disabledBtn]} 
            onPress={handleSubmitAttendance}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Update Attendance for {selectedDate}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isAdmin && (
        <View style={[styles.footer, { paddingTop: 0 }]}>
          <TouchableOpacity 
            style={[styles.holidayBtn, isHoliday && styles.holidayBtnActive]} 
            onPress={handleMarkHoliday}
            disabled={submitting}
          >
            <Text style={[styles.holidayBtnText, isHoliday && styles.holidayBtnTextActive]}>
              {isHoliday ? '🔔 Academy Holiday (Remove)' : '🔔 Mark as Academy Holiday'}
            </Text>
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
  recordStatus: { fontSize: 14, fontWeight: '800' },
  filterRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  smallChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F1F5F9' },
  smallChipActive: { backgroundColor: '#6366F1' },
  smallChipText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  smallChipTextActive: { color: '#fff' },
  calendarContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 24,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  calendarHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekDayText: {
    width: (width - 110) / 7,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayBox: {
    width: (width - 110) / 7,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  presentDay: {
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
  },
  absentDay: {
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 12,
  },
  holidayDay: {
    borderWidth: 2,
    borderColor: '#A855F7',
    borderRadius: 12,
  },
  statusDayText: {
    color: '#1E293B',
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  statsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateSelection: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateList: {
    paddingVertical: 5,
  },
  dateListContent: {
    paddingHorizontal: 15,
    flexDirection: 'row',
  },
  dateChip: {
    width: 60,
    height: 70,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dateChipDay: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  dateChipMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  dateChipTextActive: {
    color: '#fff',
  },
  holidayBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#A855F7',
    marginTop: 10,
  },
  holidayBtnActive: {
    backgroundColor: '#A855F7',
  },
  holidayBtnText: {
    color: '#A855F7',
    fontSize: 15,
    fontWeight: '700',
  },
  holidayBtnTextActive: {
    color: '#fff',
  },
});
