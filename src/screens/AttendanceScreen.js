import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TouchableOpacity, Alert, ScrollView, Dimensions, Platform, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { getCache, setCache } from '../utils/cacheManager';

const { width } = Dimensions.get('window');

export default function AttendanceScreen({ navigation }) {
  const { user } = useAuthStore();
  const role = user?.role;
  const { theme, isDark } = useThemeStore();

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState(getCache('courses') || []);
  const [batches, setBatches] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState(getCache('attendance_records') || []); // for viewing mode
  const [loading, setLoading] = useState(role === 'student' || role === 'parent' ? !getCache('attendance_records') : !getCache('courses'));
  const [fetchingBatches, setFetchingBatches] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'weekly', 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [holidays, setHolidays] = useState(getCache('holidays') || []);
  const [isHoliday, setIsHoliday] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' }); // { text: '', type: 'success' | 'error' }

  // Leave Request State
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveViewDate, setLeaveViewDate] = useState(new Date());

  const isViewMode = role === 'parent' || role === 'student';
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (statusMsg.text) {
      const timer = setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  useEffect(() => {
    fetchHolidays();
    if (isViewMode) {
      fetchViewAttendance();
    } else {
      fetchCourses();
    }
  }, [role, filterMode, selectedDate, viewDate]);

  const fetchHolidays = async () => {
    try {
      const res = await apiClient.get('/attendance/holidays');
      setHolidays(res.data);
      setCache('holidays', res.data);
      const holidayDates = res.data.map(h => h.date);
      setIsHoliday(holidayDates.includes(selectedDate));
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/');
      const fetchedCourses = response.data;
      setCourses(fetchedCourses);
      setCache('courses', fetchedCourses);
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
    setAttendance({});
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
        startDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).toISOString().split('T')[0];
        url += `?start_date=${startDate}&end_date=${endDate}`;
      }

      if (role === 'parent') {
        const stRes = await apiClient.get('/parents/students');
        const myStudents = stRes.data;
        if (myStudents && myStudents.length > 0) {
          const separator = url.includes('?') ? '&' : '?';
          const attRes = await apiClient.get(`/parents/${myStudents[0].id}/attendance${url.replace('/attendance/', '')}`);
          setAttendanceRecords(attRes.data.records || []);
          setCache('attendance_records', attRes.data.records || []);
        }
      } else {
        const res = await apiClient.get(url);
        setAttendanceRecords(res.data);
        setCache('attendance_records', res.data);
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
      const [studentsResponse, attendanceResponse] = await Promise.all([
        apiClient.get(`/batches/${batchId}/students`),
        apiClient.get(`/attendance/?batch_id=${batchId}&start_date=${selectedDate}&end_date=${selectedDate}`)
      ]);
      const fetchedStudents = studentsResponse.data;
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
      setStudents(fetchedStudents);
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
    if (!selectedBatchId) {
      setStatusMsg({ text: '⚠️ Please select a batch first', type: 'error' });
      return;
    }
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
      setStatusMsg({ text: `✅ Attendance marked for ${selectedDate}`, type: 'success' });
    } catch (error) {
      console.error('❌ Attendance Submit Error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to submit attendance';
      setStatusMsg({ text: '❌ ' + errorMsg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHoliday = async () => {
    setSubmitting(true);
    try {
      if (isHoliday) {
        await apiClient.delete(`/attendance/holidays/${selectedDate}`);
        setStatusMsg({ 
          text: '✅ Academy holiday removed', 
          type: 'success' 
        });
      } else {
        await apiClient.post(`/attendance/holidays?holiday_date=${selectedDate}&description=Academy Holiday`);
        setStatusMsg({ 
          text: '✅ Academy holiday marked & students notified', 
          type: 'success' 
        });
      }
      await fetchHolidays();
    } catch (error) {
      console.error('❌ Holiday toggle error:', error);
      const errorMsg = error.response?.data?.detail || 'Action failed';
      setStatusMsg({ text: '❌ ' + errorMsg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestLeave = async () => {
    if (!leaveStartDate || !leaveEndDate || !leaveReason) {
      Alert.alert("Missing Fields", "Please fill in all leave details.");
      return;
    }
    
    setSubmittingLeave(true);
    try {
      await apiClient.post('/attendance/leave_requests', {
        start_date: leaveStartDate,
        end_date: leaveEndDate,
        reason: leaveReason
      });
      
      Alert.alert("Success", "Leave request submitted to your teacher and admin.");
      setLeaveModalVisible(false);
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveReason('');
    } catch (e) {
      const msg = e.response?.data?.detail || "Failed to submit leave request.";
      Alert.alert("Error", msg);
    } finally {
      setSubmittingLeave(false);
    }
  };

  if (loading && (isViewMode ? attendanceRecords.length === 0 : courses.length === 0)) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading attendance data...</Text>
      </View>
    );
  }

  if (isViewMode) {
    const renderCalendar = () => {
      const recordsMap = {};
      attendanceRecords.forEach(r => {
        recordsMap[r.date] = r.status;
      });
      const holidayDates = holidays.map(h => h.date);

      const displayMonth = viewDate.getMonth();
      const displayYear = viewDate.getFullYear();
      
      const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();

      const changeMonth = (offset) => {
        const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
        setViewDate(next);
      };
      
      const days = [];
      for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      return (
        <View style={[styles.calendarContainer, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.arrowBtn, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.arrowText, { color: theme.accent }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][displayMonth]} {displayYear}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.arrowBtn, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.arrowText, { color: theme.accent }]}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.weekDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
              <Text key={`weekday-${index}`} style={[styles.weekDayText, { color: theme.subText }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {days.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={styles.dayBox} />;
              
              const dateStr = `${displayYear}-${(displayMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              let status = recordsMap[dateStr];
              const isAcademyHoliday = holidayDates.includes(dateStr);
              
              if (!status && !isAcademyHoliday) {
                const dateObj = new Date(displayYear, displayMonth, day);
                const isWeekend = dateObj.getDay() === 0; // Assuming Sunday is a weekend/holiday
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const joinDate = user?.created_at ? new Date(user.created_at) : new Date();
                joinDate.setHours(0, 0, 0, 0);
                
                if (!isWeekend && dateObj <= today && dateObj >= joinDate) {
                  status = 'present';
                }
              }
              
              return (
                <View key={idx} style={[
                  styles.dayBox, 
                  status === 'present' && styles.presentDay,
                  status === 'absent' && styles.absentDay,
                  isAcademyHoliday && styles.holidayDay
                ]}>
                  <Text style={[
                    styles.dayText,
                    { color: theme.text },
                    (status || isAcademyHoliday) && [styles.statusDayText, { color: theme.text }]
                  ]}>{day}</Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.legend, { borderTopColor: theme.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendText, { color: theme.subText }]}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: theme.subText }]}>Absent</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#A855F7' }]} />
              <Text style={[styles.legendText, { color: theme.subText }]}>Holiday</Text>
            </View>
          </View>
        </View>
      );
    };

    const renderLeaveCalendar = () => {
      const displayMonth = leaveViewDate.getMonth();
      const displayYear = leaveViewDate.getFullYear();
      
      const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();

      const changeLeaveMonth = (offset) => {
        const next = new Date(leaveViewDate.getFullYear(), leaveViewDate.getMonth() + offset, 1);
        setLeaveViewDate(next);
      };
      
      const days = [];
      for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);

      const handleDatePress = (dateStr) => {
        if (!leaveStartDate || (leaveStartDate && leaveEndDate)) {
          setLeaveStartDate(dateStr);
          setLeaveEndDate('');
        } else {
          if (dateStr >= leaveStartDate) {
            setLeaveEndDate(dateStr);
          } else {
            setLeaveStartDate(dateStr);
            setLeaveEndDate('');
          }
        }
      };

      return (
        <View style={[styles.pickerCalendarContainer, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={styles.pickerCalendarHeader}>
            <TouchableOpacity onPress={() => changeLeaveMonth(-1)} style={[styles.pickerArrowBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}>
              <Text style={[styles.pickerArrowText, { color: theme.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.pickerMonthTitle, { color: theme.text }]}>
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][displayMonth]} {displayYear}
            </Text>
            <TouchableOpacity onPress={() => changeLeaveMonth(1)} style={[styles.pickerArrowBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}>
              <Text style={[styles.pickerArrowText, { color: theme.text }]}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerWeekDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
              <Text key={`picker-weekday-${index}`} style={[styles.pickerWeekDayText, { color: theme.subText }]}>{d}</Text>
            ))}
          </View>
          <View style={styles.pickerDaysGrid}>
            {days.map((day, idx) => {
              if (!day) return <View key={`picker-empty-${idx}`} style={styles.pickerDayBox} />;
              
              const dateStr = `${displayYear}-${(displayMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              
              const isSelectedStart = dateStr === leaveStartDate;
              const isSelectedEnd = dateStr === leaveEndDate;
              const isInRange = leaveStartDate && leaveEndDate && dateStr > leaveStartDate && dateStr < leaveEndDate;
              
              let dayBoxStyle = [styles.pickerDayBox, { backgroundColor: 'transparent' }];
              let dayTextStyle = [styles.pickerDayText, { color: theme.text }];
              
              if (isSelectedStart || isSelectedEnd) {
                dayBoxStyle = [styles.pickerDayBox, { backgroundColor: theme.accent }];
                dayTextStyle = [styles.pickerDayText, { color: '#fff', fontWeight: '800' }];
              } else if (isInRange) {
                dayBoxStyle = [styles.pickerDayBox, { backgroundColor: theme.accentLight }];
                dayTextStyle = [styles.pickerDayText, { color: theme.accent, fontWeight: '700' }];
              }
              
              return (
                <TouchableOpacity 
                  key={`picker-day-${day}-${idx}`} 
                  style={dayBoxStyle} 
                  onPress={() => handleDatePress(dateStr)}
                >
                  <Text style={dayTextStyle}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    };

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
          <Text style={[styles.title, { color: theme.text }]}>Attendance Insights</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>Track your learning consistency 📈</Text>
        </View>

        {statusMsg.text !== '' && (
          <View style={[
            styles.statusBanner,
            statusMsg.type === 'error'
              ? [styles.errorBanner, { backgroundColor: isDark ? '#3a1818' : '#FEE2E2', borderColor: isDark ? '#7f1d1d' : '#FECACA' }]
              : [styles.successBanner, { backgroundColor: isDark ? '#14311e' : '#DCFCE7', borderColor: isDark ? '#166534' : '#86EFAC' }]
          ]}>
            <Text style={[styles.statusBannerText, { color: statusMsg.type === 'error' ? theme.danger : theme.success }]}>{statusMsg.text}</Text>
          </View>
        )}
        
        <ScrollView 
          style={{ backgroundColor: theme.bg }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCalendar()}
          
          <View style={[styles.statsSection, { backgroundColor: theme.bg }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Logs</Text>
            {attendanceRecords.length > 0 ? (
              attendanceRecords.slice(0, 5).map(item => (
                <View key={item.id} style={[styles.recordItem, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                  <Text style={[styles.recordDate, { color: theme.text }]}>{item.date}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? theme.successLight : theme.dangerLight }]}>
                    <Text style={[styles.recordStatus, { color: item.status === 'present' ? theme.success : theme.danger }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyText, { color: theme.subText }]}>No recent records found.</Text>
            )}
          </View>
        </ScrollView>
        
        {/* Floating Action Button for Leave Requests */}
        <TouchableOpacity style={[styles.fab, { backgroundColor: theme.chipBg, borderColor: theme.border }]} onPress={() => setLeaveModalVisible(true)}>
          <Text style={styles.fabIcon}>🏖️</Text>
        </TouchableOpacity>

        <Modal visible={leaveModalVisible} animationType="slide" transparent={true} onRequestClose={() => setLeaveModalVisible(false)}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Request Leave</Text>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[styles.dateRangeDisplay, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                  <View style={styles.dateRangeBox}>
                    <Text style={[styles.dateRangeLabel, { color: theme.subText }]}>START DATE</Text>
                    <Text style={[styles.dateRangeValue, { color: theme.text }]}>{leaveStartDate || 'Select below'}</Text>
                  </View>
                  <Text style={[styles.dateRangeArrow, { color: theme.subText }]}>➔</Text>
                  <View style={styles.dateRangeBox}>
                    <Text style={[styles.dateRangeLabel, { color: theme.subText }]}>END DATE</Text>
                    <Text style={[styles.dateRangeValue, { color: theme.text }]}>{leaveEndDate || 'Select below'}</Text>
                  </View>
                </View>

                {renderLeaveCalendar()}

                <Text style={[styles.inputLabel, { color: theme.subText }]}>Reason</Text>
                <TextInput 
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top', marginBottom: 10, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]} 
                  placeholder="Why do you need a leave?" 
                  placeholderTextColor={theme.muted}
                  multiline
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalCancel, { backgroundColor: theme.chipBg }]} onPress={() => setLeaveModalVisible(false)}>
                  <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSubmit, submittingLeave && styles.disabledBtn]} 
                  onPress={handleRequestLeave}
                  disabled={submittingLeave}
                >
                  <Text style={styles.modalSubmitText}>
                    {submittingLeave ? 'Submitting Request...' : 'Submit Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const renderSkeletonStudentItem = () => (
    <View style={[styles.studentItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={{ gap: 6, flex: 1 }}>
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '60%', height: 16 }]} />
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '30%', height: 12 }]} />
      </View>
      <View style={{ width: 40, height: 24, borderRadius: 12, backgroundColor: theme.chipBg, opacity: 0.5 }} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Attendance Management</Text>
        <Text style={[styles.subtitle, { color: theme.subText }]}>Select a date to manage records</Text>
      </View>

      {statusMsg.text !== '' && (
        <View style={[
          styles.statusBanner,
          statusMsg.type === 'error'
            ? [styles.errorBanner, { backgroundColor: isDark ? '#3a1818' : '#FEE2E2', borderColor: isDark ? '#7f1d1d' : '#FECACA' }]
            : [styles.successBanner, { backgroundColor: isDark ? '#14311e' : '#DCFCE7', borderColor: isDark ? '#166534' : '#86EFAC' }]
        ]}>
          <Text style={[styles.statusBannerText, { color: statusMsg.type === 'error' ? theme.danger : theme.success }]}>{statusMsg.text}</Text>
        </View>
      )}

      <View style={[styles.dateSelection, { backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
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
                style={[styles.dateChip, { backgroundColor: theme.chipBg, borderColor: theme.border }, isSelected && [styles.dateChipActive, { backgroundColor: theme.accent, borderColor: theme.accent }]]}
                onPress={() => setSelectedDate(dStr)}
              >
                <Text style={[styles.dateChipDay, { color: theme.text }, isSelected && styles.dateChipTextActive]}>{d.getDate()}</Text>
                <Text style={[styles.dateChipMonth, { color: theme.subText }, isSelected && styles.dateChipTextActive]}>
                  {d.toLocaleString('default', { month: 'short' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.filters, { backgroundColor: theme.card }]}>
        <Text style={[styles.filterLabel, { color: theme.text }]}>Course:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {courses.map(course => {
            const isSelected = selectedCourseId === course.id;
            return (
              <TouchableOpacity 
                key={course.id}
                style={[
                  styles.chip, 
                  { backgroundColor: theme.chipBg, borderColor: theme.border },
                  isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => {
                  setSelectedCourseId(course.id);
                  setStudents([]);
                  setAttendance({});
                  fetchBatches(course.id);
                }}
              >
                <Text style={[styles.chipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>{course.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.filterLabel, { color: theme.text }]}>Batch:</Text>
        {fetchingBatches && batches.length === 0 ? (
          <Text style={[styles.emptyFilterText, { color: theme.muted }]}>Loading batches...</Text>
        ) : batches.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {batches.map(batch => {
              const isSelected = selectedBatchId === batch.id;
              return (
                <TouchableOpacity 
                  key={batch.id}
                  style={[
                    styles.chip, 
                    { backgroundColor: theme.chipBg, borderColor: theme.border },
                    isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                  ]}
                  onPress={() => {
                    setSelectedBatchId(batch.id);
                    setStudents([]);
                    setAttendance({});
                    fetchStudentsToMark(batch.id);
                  }}
                >
                  <Text style={[styles.chipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>{batch.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={[styles.emptyFilterText, { color: theme.muted }]}>No batches for this course.</Text>
        )}
      </View>

      {fetchingStudents ? (
        <FlatList
          style={{ flex: 1, backgroundColor: theme.bg }}
          data={[1, 2, 3, 4, 5]}
          keyExtractor={(item) => `skeleton-${item}`}
          contentContainerStyle={styles.list}
          renderItem={renderSkeletonStudentItem}
        />
      ) : students.length > 0 ? (
        <FlatList
          style={{ flex: 1, backgroundColor: theme.bg }}
          data={students}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => handleToggleAttendance(item.id)}
              style={[styles.studentItem, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View>
                <Text style={[styles.studentName, { color: theme.text }]}>{item.first_name} {item.last_name}</Text>
                <Text style={[styles.statusText, { color: theme.subText }]}>{attendance[item.id] ? 'Present' : 'Absent'}</Text>
              </View>
              <Switch
                value={attendance[item.id]}
                onValueChange={() => handleToggleAttendance(item.id)}
                trackColor={{ false: '#EF4444', true: '#10B981' }}
              />
            </TouchableOpacity>
          )}
        />
      ) : selectedBatchId ? (
        <View style={[styles.emptyState, { backgroundColor: theme.bg }]}>
          <Text style={[styles.emptyText, { color: theme.subText }]}>No students registered for this batch.</Text>
        </View>
      ) : (
        <View style={[styles.emptyState, { backgroundColor: theme.bg }]}>
          <Text style={[styles.emptyText, { color: theme.subText }]}>Select a batch to see students.</Text>
        </View>
      )}

      {((students.length > 0 && !isHoliday) || isAdmin) && (
        <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingVertical: 12 }]}>
          {students.length > 0 && !isHoliday && (
            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.disabledBtn]} 
              onPress={handleSubmitAttendance}
              disabled={submitting}
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Updating Attendance...' : `Update Attendance for ${selectedDate}`}
              </Text>
            </TouchableOpacity>
          )}
          {isAdmin && (
            <TouchableOpacity 
              style={[
                styles.holidayBtn, 
                { borderColor: theme.accent },
                isHoliday && { backgroundColor: theme.accent, borderColor: theme.accent },
                students.length > 0 && !isHoliday && { marginTop: 10 }
              ]} 
              onPress={handleMarkHoliday}
              disabled={submitting}
            >
              <Text style={[
                styles.holidayBtnText, 
                { color: theme.accent },
                isHoliday && { color: '#fff' }
              ]}>
                {isHoliday ? '🔔 Academy Holiday (Remove)' : '🔔 Mark as Academy Holiday'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  header: { paddingVertical: 10, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  loadingText: { marginTop: 8, fontSize: 13, color: '#64748B' },
  filters: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#fff', gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 3 },
  chipScroll: { paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  chipTextActive: { color: '#fff' },
  emptyFilterText: { fontSize: 13, color: '#94A3B8', fontStyle: 'italic', paddingVertical: 5 },
  list: { padding: 15 },
  studentItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  studentName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  statusText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowBtn: {
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  arrowText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6366F1',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    width: '14.28%',
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
    width: '14.28%',
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateList: {
    paddingVertical: 2,
  },
  dateListContent: {
    paddingHorizontal: 15,
    flexDirection: 'row',
  },
  dateChip: {
    width: 44,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dateChipDay: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  dateChipMonth: {
    fontSize: 8,
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
  statusBanner: {
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, borderWidth: 2, borderColor: '#E2E8F0' },
  fabIcon: { fontSize: 28, marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1E293B' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  modalSubmit: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#6366F1', alignItems: 'center' },
  modalSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 15,
  },
  dateRangeBox: {
    flex: 1,
    alignItems: 'center',
  },
  dateRangeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  dateRangeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  dateRangeArrow: {
    fontSize: 18,
    color: '#94A3B8',
    marginHorizontal: 10,
  },
  pickerCalendarContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 15,
  },
  pickerCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerArrowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  pickerMonthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  pickerWeekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerWeekDayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pickerDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerDayBox: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerSelectedDay: {
    backgroundColor: '#6366F1',
  },
  dateSelection: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dateList: {
    paddingVertical: 2,
  },
  dateListContent: {
    paddingHorizontal: 15,
    flexDirection: 'row',
  },
  dateChip: {
    width: 44,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  dateChipDay: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  dateChipMonth: {
    fontSize: 8,
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
  statusBanner: {
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, borderWidth: 2, borderColor: '#E2E8F0' },
  fabIcon: { fontSize: 28, marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 10 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1E293B' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  modalSubmit: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#6366F1', alignItems: 'center' },
  modalSubmitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 15,
  },
  dateRangeBox: {
    flex: 1,
    alignItems: 'center',
  },
  dateRangeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 4,
  },
  dateRangeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  dateRangeArrow: {
    fontSize: 18,
    color: '#94A3B8',
    marginHorizontal: 10,
  },
  pickerCalendarContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 15,
  },
  pickerCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerArrowBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerArrowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  pickerMonthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  pickerWeekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerWeekDayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pickerDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerDayBox: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  pickerDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pickerSelectedDay: {
    backgroundColor: '#6366F1',
  },
  pickerSelectedDayText: {
    color: '#fff',
    fontWeight: '800',
  },
  pickerInRangeDay: {
    backgroundColor: '#E0E7FF',
  },
  pickerInRangeDayText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  shimmerLine: {
    height: 12,
    borderRadius: 6,
  }
});
