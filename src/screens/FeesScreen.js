import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, Alert, Linking,
  ScrollView, Modal, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { getCache, setCache } from '../utils/cacheManager';

export default function FeesScreen() {
  const { user } = useAuthStore();
  const role = user?.role;
  const { theme, isDark } = useThemeStore();
  
  const [fees, setFees] = useState(getCache('fees_list') || []);
  const [loading, setLoading] = useState(!getCache('fees_list'));
  const [refreshing, setRefreshing] = useState(false);
  
  // Admin specific states
  const [adminUpi, setAdminUpi] = useState(getCache('admin_upi') || '');
  const [showUpi, setShowUpi] = useState(false);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  
  const [courses, setCourses] = useState(getCache('courses') || []);
  const [selectedCourse, setSelectedCourse] = useState(null);
  
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]); // array of user_ids
  
  const [savingUpi, setSavingUpi] = useState(false);
  const [creatingFee, setCreatingFee] = useState(false);

  // Filter state
  const [selectedFeeStatusTab, setSelectedFeeStatusTab] = useState('pending'); // 'pending' or 'paid'

  useEffect(() => {
    fetchFees();
    fetchCourses();
    fetchAdminUpi();
  }, [role]);

  const fetchFees = async () => {
    try {
      const res = await apiClient.get('/fees/');
      setFees(res.data);
      setCache('fees_list', res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch fees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAdminUpi = async () => {
    try {
      const res = await apiClient.get('/fees/admin-upi');
      setAdminUpi(res.data.upi_id);
      setCache('admin_upi', res.data.upi_id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await apiClient.get('/courses/');
      setCourses(res.data);
      setCache('courses', res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBatches = async (courseId) => {
    try {
      const res = await apiClient.get(`/batches/?course_id=${courseId}`);
      setBatches(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStudents = async (batchId) => {
    try {
      const res = await apiClient.get(`/batches/${batchId}/students`);
      setStudents(res.data);
      // Reset selected students when batch changes
      setSelectedStudents([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCourseSelect = (courseId) => {
    setSelectedCourse(courseId);
    setSelectedBatch(null);
    setBatches([]);
    setStudents([]);
    setSelectedStudents([]);
    fetchBatches(courseId);
  };

  const handleBatchSelect = (batchId) => {
    setSelectedBatch(batchId);
    setStudents([]);
    setSelectedStudents([]);
    fetchStudents(batchId);
  };

  const toggleStudentSelection = (userId) => {
    if (selectedStudents.includes(userId)) {
      setSelectedStudents(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedStudents(prev => [...prev, userId]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      // Deselect all
      setSelectedStudents([]);
    } else {
      // Select all
      setSelectedStudents(students.map(s => s.user_id));
    }
  };

  const handleUpdateUpi = async () => {
    setSavingUpi(true);
    try {
      await apiClient.put('/fees/admin-upi', { upi_id: adminUpi });
      Alert.alert('Success', 'UPI ID updated successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update UPI');
    } finally {
      setSavingUpi(false);
    }
  };

  const handleCreateFee = async () => {
    if (selectedStudents.length === 0 || !amount || !dueDate) {
      Alert.alert('Error', 'Please fill all fields and select at least one student');
      return;
    }
    
    // basic date validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dueDate)) {
      Alert.alert('Error', 'Please use YYYY-MM-DD format for date');
      return;
    }

    setCreatingFee(true);
    try {
      const payload = {
        user_ids: selectedStudents,
        amount: parseFloat(amount),
        due_date: new Date(dueDate).toISOString(),
        course_id: selectedCourse,
        batch_id: selectedBatch
      };
      await apiClient.post('/fees/', payload);
      Alert.alert('Success', 'Fee reminder notifications sent!');
      setAmount('');
      setDueDate('');
      setSelectedStudents([]);
      fetchFees();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send fee reminders');
    } finally {
      setCreatingFee(false);
    }
  };

  const handleMarkReceived = async (feeId) => {
    try {
      await apiClient.put(`/fees/${feeId}/receive`);
      Alert.alert('Success', 'Fee marked as received');
      fetchFees();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to mark as received');
    }
  };

  const handleSendReminder = async (feeId) => {
    try {
      await apiClient.post(`/fees/${feeId}/remind`);
      Alert.alert('Success', 'Fee reminder notification sent successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to send fee reminder');
    }
  };

  const handlePay = async (fee) => {
    if (!adminUpi) {
      Alert.alert('Error', 'Admin UPI not set. Cannot proceed with payment.');
      return;
    }
    const upiUrl = `upi://pay?pa=${adminUpi}&pn=AcademyHub&am=${fee.amount}&cu=INR`;
    try {
      // Call openURL directly since canOpenURL fails on Android 11+ due to package visibility rules
      await Linking.openURL(upiUrl);
    } catch (err) {
      console.error('Failed to launch UPI app:', err);
      Alert.alert(
        'Manual Payment Info',
        `Could not launch UPI app automatically.\n\nPlease copy the UPI ID below to pay ₹${fee.amount} in your preferred UPI app:\n\nUPI ID: ${adminUpi}`
      );
    }
  };

  const renderDatePickerModal = () => {
    const displayMonth = pickerDate.getMonth();
    const displayYear = pickerDate.getFullYear();
    
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(displayYear, displayMonth, 1).getDay();

    const changeMonth = (offset) => {
      const next = new Date(pickerDate.getFullYear(), pickerDate.getMonth() + offset, 1);
      setPickerDate(next);
    };
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const handleSelectDay = (day) => {
      if (!day) return;
      const selectedStr = `${displayYear}-${(displayMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      setDueDate(selectedStr);
      setShowDatePicker(false);
    };

    return (
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarModalCard, { backgroundColor: theme.card }]}>
            <View style={styles.calendarModalHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={[styles.arrowBtn, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.arrowText, { color: theme.text }]}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: theme.text }]}>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][displayMonth]} {displayYear}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={[styles.arrowBtn, { backgroundColor: theme.chipBg }]}>
                <Text style={[styles.arrowText, { color: theme.text }]}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekDays}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <Text key={idx} style={[styles.weekDayText, { color: theme.subText }]}>{d}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {days.map((day, idx) => {
                if (!day) return <View key={`empty-${idx}`} style={styles.dayBox} />;
                
                const dateStr = `${displayYear}-${(displayMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const isSelected = dateStr === dueDate;
                
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[
                      styles.dayBox, 
                      isSelected ? { backgroundColor: theme.accent } : null
                    ]}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: isSelected ? '#fff' : theme.text }
                    ]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={[styles.closeModalBtn, { backgroundColor: theme.chipBg }]} 
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.closeModalBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAdminView = () => (
    <View style={styles.adminSection}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Admin Settings</Text>
      <View style={styles.upiContainer}>
        <View style={[styles.upiInputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <TextInput 
            style={[styles.upiInput, { color: theme.text }]} 
            placeholder="Enter Admin UPI ID" 
            placeholderTextColor={theme.muted}
            value={adminUpi}
            onChangeText={setAdminUpi}
            secureTextEntry={!showUpi}
          />
          <TouchableOpacity 
            style={styles.eyeButton} 
            onPress={() => setShowUpi(!showUpi)}
          >
            <Text style={[styles.eyeText, { color: theme.accent }]}>{showUpi ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleUpdateUpi} disabled={savingUpi}>
          <Text style={styles.saveBtnText}>{savingUpi ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Send Fee Reminder & Notifications</Text>
      <View style={[styles.createCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        
        {/* Course Selection */}
        <View style={styles.pickerContainer}>
          <Text style={[styles.label, { color: theme.text }]}>1. Select Course:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {courses.map(course => (
              <TouchableOpacity 
                key={course.id}
                style={[
                  styles.chip, 
                  { backgroundColor: theme.chipBg, borderColor: theme.border },
                  selectedCourse === course.id && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}
                onPress={() => handleCourseSelect(course.id)}
              >
                <Text style={[
                  styles.chipText, 
                  { color: theme.subText },
                  selectedCourse === course.id && { color: '#fff' }
                ]}>
                  {course.name}
                </Text>
              </TouchableOpacity>
            ))}
            {courses.length === 0 && <Text style={[styles.noDataText, { color: theme.muted }]}>No courses available</Text>}
          </ScrollView>
        </View>

        {/* Batch Selection */}
        {selectedCourse && (
          <View style={styles.pickerContainer}>
            <Text style={[styles.label, { color: theme.text }]}>2. Select Batch:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {batches.map(batch => (
                <TouchableOpacity 
                  key={batch.id}
                  style={[
                    styles.chip, 
                    { backgroundColor: theme.chipBg, borderColor: theme.border },
                    selectedBatch === batch.id && { backgroundColor: theme.accent, borderColor: theme.accent }
                  ]}
                  onPress={() => handleBatchSelect(batch.id)}
                >
                  <Text style={[
                    styles.chipText, 
                    { color: theme.subText },
                    selectedBatch === batch.id && { color: '#fff' }
                  ]}>
                    {batch.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {batches.length === 0 && <Text style={[styles.noDataText, { color: theme.muted }]}>No batches available</Text>}
            </ScrollView>
          </View>
        )}

        {/* Student Multi-Selection */}
        {selectedBatch && (
          <View style={styles.pickerContainer}>
            <View style={styles.multiSelectHeader}>
              <Text style={[styles.label, { color: theme.text }]}>3. Select Students:</Text>
              {students.length > 0 && (
                <TouchableOpacity onPress={toggleSelectAll}>
                  <Text style={[styles.selectAllText, { color: theme.accent }]}>
                    {selectedStudents.length === students.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.studentWrap}>
              {students.map(student => {
                const isSelected = selectedStudents.includes(student.user_id);
                return (
                  <TouchableOpacity 
                    key={student.id}
                    style={[
                      styles.studentPill, 
                      { backgroundColor: theme.chipBg, borderColor: theme.border },
                      isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => toggleStudentSelection(student.user_id)}
                  >
                    <Text style={[
                      styles.studentPillText, 
                      { color: theme.subText },
                      isSelected && { color: '#fff' }
                    ]}>
                      {student.first_name} {student.last_name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {students.length === 0 && <Text style={[styles.noDataText, { color: theme.muted }]}>No students in this batch</Text>}
            </View>
          </View>
        )}

        {/* Amount & Date Input */}
        <TextInput 
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]} 
          placeholder="Amount (e.g. 5000)" 
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TouchableOpacity 
          style={[styles.datePickerTrigger, { backgroundColor: theme.inputBg, borderColor: theme.border }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[styles.datePickerTriggerText, { color: theme.text }, !dueDate && { color: theme.muted }]}>
            {dueDate ? `Due Date: ${dueDate}` : 'Select Due Date (YYYY-MM-DD)'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.primaryBtn, 
            { backgroundColor: theme.accent },
            (creatingFee || selectedStudents.length === 0) && { backgroundColor: theme.chipBg }
          ]} 
          onPress={handleCreateFee} 
          disabled={creatingFee || selectedStudents.length === 0}
        >
          <Text style={[
            styles.primaryBtnText,
            { color: '#fff' },
            (creatingFee || selectedStudents.length === 0) && { color: theme.subText }
          ]}>
            {creatingFee ? 'Sending...' : `Send Reminder (${selectedStudents.length})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeeItem = ({ item }) => {
    const isPaid = item.status === 'paid';
    const dueDateStr = item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A';
    
    return (
      <View style={[styles.feeCard, { backgroundColor: theme.card, borderLeftColor: isPaid ? theme.success : '#4F46E5' }]}>
        <View style={styles.feeHeader}>
          <Text style={[styles.feeAmount, { color: theme.text }]}>₹{item.amount}</Text>
          <View style={[
            styles.statusBadge, 
            isPaid ? { backgroundColor: theme.successLight } : { backgroundColor: theme.warningLight }
          ]}>
            <Text style={[
              styles.statusText, 
              isPaid ? { color: theme.success } : { color: theme.warning }
            ]}>
              {isPaid ? 'PAID' : 'PENDING'}
            </Text>
          </View>
        </View>
        
        {item.course?.name && item.batch?.name && (
          <Text style={[styles.feeCourseBatch, { color: theme.accent }]}>📚 {item.course.name} • {item.batch.name}</Text>
        )}

        {(role === 'admin' || role === 'teacher') && item.user && (
          <Text style={[styles.feeStudentName, { color: theme.textMid }]}>Student: {item.user.full_name}</Text>
        )}
        
        <Text style={[styles.feeDate, { color: theme.subText }]}>Due: {dueDateStr}</Text>
        
        {!isPaid && (
          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            {role === 'admin' ? (
              <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: theme.accentLight, flex: 1 }]} 
                  onPress={() => handleMarkReceived(item.id)}
                >
                  <Text style={[styles.actionBtnText, { color: theme.accent }]} numberOfLines={1}>Mark Received</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: theme.warningLight, flex: 1 }]} 
                  onPress={() => handleSendReminder(item.id)}
                >
                  <Text style={[styles.actionBtnText, { color: theme.warning }]} numberOfLines={1}>Send Reminder</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.payBtn, { backgroundColor: theme.accent }]} onPress={() => handlePay(item)}>
                <Text style={styles.payBtnText}>Pay Now via UPI</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const filteredFees = React.useMemo(() => {
    if (selectedFeeStatusTab === 'paid') {
      return fees.filter(f => f.status === 'paid');
    }
    return fees.filter(f => f.status !== 'paid');
  }, [fees, selectedFeeStatusTab]);

  const totalPaid = fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPending = fees.filter(f => f.status !== 'paid').reduce((acc, curr) => acc + curr.amount, 0);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchFees();
    fetchCourses();
    fetchAdminUpi();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {renderDatePickerModal()}
      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />
        }
      >
        {role === 'admin' && renderAdminView()}
        
        {(role === 'student' || role === 'parent') && (
           <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>Fee Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryBox}>
                  <Text style={[styles.summaryLabel, { color: theme.subText }]}>Total Paid</Text>
                  <Text style={[styles.summaryValuePaid, { color: theme.success }]}>₹{totalPaid}</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={[styles.summaryLabel, { color: theme.subText }]}>Total Pending</Text>
                  <Text style={[styles.summaryValuePending, { color: theme.danger }]}>₹{totalPending}</Text>
                </View>
              </View>
           </View>
        )}
        
        <Text style={[styles.sectionTitle, {marginTop: 20, color: theme.text}]}>
          {role === 'student' || role === 'parent' ? 'My Fees' : 'Fee Records'}
        </Text>

        {/* Fee Status Tabs */}
        <View style={[styles.feeTabsContainer, { backgroundColor: theme.tabBg }]}>
          <TouchableOpacity
            style={[
              styles.feeTabBtn, 
              selectedFeeStatusTab === 'pending' && [styles.feeTabBtnActivePending, { backgroundColor: theme.card, borderColor: theme.border }]
            ]}
            onPress={() => setSelectedFeeStatusTab('pending')}
          >
            <Text style={[
              styles.feeTabText, 
              { color: theme.subText },
              selectedFeeStatusTab === 'pending' && { color: theme.danger, fontWeight: '700' }
            ]}>
              Pending ({fees.filter(f => f.status !== 'paid').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.feeTabBtn, 
              selectedFeeStatusTab === 'paid' && [styles.feeTabBtnActivePaid, { backgroundColor: theme.card, borderColor: theme.border }]
            ]}
            onPress={() => setSelectedFeeStatusTab('paid')}
          >
            <Text style={[
              styles.feeTabText, 
              { color: theme.subText },
              selectedFeeStatusTab === 'paid' && { color: theme.success, fontWeight: '700' }
            ]}>
              Paid ({fees.filter(f => f.status === 'paid').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fees list matching selection */}
        {loading ? (
          <Text style={{ textAlign: 'center', marginVertical: 20, color: theme.subText }}>Loading fees...</Text>
        ) : (
          <View style={styles.feesList}>
            {filteredFees.map(fee => renderFeeItem({ item: fee }))}
            {filteredFees.length === 0 && (
              <Text style={styles.emptyText}>No fee records found.</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  adminSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  upiContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 10,
  },
  upiInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 48,
  },
  upiInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  eyeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  createCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 10,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  chipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  noDataText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  multiSelectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectAllText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
  },
  studentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  studentPill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  studentPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  studentPillText: {
    fontSize: 13,
    color: '#64748B',
  },
  studentPillTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledBtn: {
    backgroundColor: '#A7F3D0',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValuePaid: {
    fontSize: 22,
    fontWeight: '800',
    color: '#10B981',
  },
  summaryValuePending: {
    fontSize: 22,
    fontWeight: '800',
    color: '#EF4444',
  },
  feeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextPaid: {
    color: '#059669',
  },
  statusTextPending: {
    color: '#DC2626',
  },
  feeStudentName: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 4,
    fontWeight: '500',
  },
  feeDate: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  actionRow: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  actionBtn: {
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 13,
  },
  payBtn: {
    backgroundColor: '#10B981',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  payBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
  },
  feeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  feeTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  feeTabBtnActivePending: {
    backgroundColor: '#FFF',
    borderColor: '#FCA5A5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  feeTabBtnActivePaid: {
    backgroundColor: '#FFF',
    borderColor: '#6EE7B7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  feeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  feeTabTextActivePending: {
    color: '#DC2626',
  },
  feeTabTextActivePaid: {
    color: '#059669',
  },
  feesList: {
    marginTop: 8,
  },
  feeCourseBatch: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  datePickerTrigger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    height: 48,
    justifyContent: 'center',
    marginBottom: 12,
  },
  datePickerTriggerText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarModalCard: {
    width: width * 0.9,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  arrowBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  arrowText: {
    fontSize: 18,
    color: '#1E293B',
    fontWeight: 'bold',
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  weekDayText: {
    width: 40,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 8,
  },
  dayBox: {
    width: (width * 0.9 - 40) / 7,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  dayText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  selectedDayBox: {
    backgroundColor: '#4F46E5',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  closeModalBtn: {
    marginTop: 15,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  }
});
