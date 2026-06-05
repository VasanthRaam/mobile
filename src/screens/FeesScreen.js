import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, Linking, SafeAreaView,
  ScrollView, Modal, Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

export default function FeesScreen() {
  const { user } = useAuthStore();
  const role = user?.role;
  
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Admin specific states
  const [adminUpi, setAdminUpi] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]); // array of user_ids
  
  const [savingUpi, setSavingUpi] = useState(false);
  const [creatingFee, setCreatingFee] = useState(false);

  useEffect(() => {
    fetchFees();
    if (role === 'admin') {
      fetchAdminUpi();
      fetchCourses();
    } else if (role === 'student') {
      fetchAdminUpi(); // To get UPI ID for payment
    }
  }, [role]);

  const fetchFees = async () => {
    try {
      const res = await apiClient.get('/fees/');
      setFees(res.data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch fees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminUpi = async () => {
    try {
      const res = await apiClient.get('/fees/admin-upi');
      setAdminUpi(res.data.upi_id);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await apiClient.get('/courses/');
      setCourses(res.data);
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
          <View style={styles.calendarModalCard}>
            <View style={styles.calendarModalHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.arrowBtn}>
                <Text style={styles.arrowText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][displayMonth]} {displayYear}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.arrowBtn}>
                <Text style={styles.arrowText}>→</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekDays}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <Text key={idx} style={styles.weekDayText}>{d}</Text>
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
                      isSelected && styles.selectedDayBox
                    ]}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText
                    ]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.closeModalBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAdminView = () => (
    <View style={styles.adminSection}>
      <Text style={styles.sectionTitle}>Admin Settings</Text>
      <View style={styles.upiContainer}>
        <TextInput 
          style={styles.input} 
          placeholder="Enter Admin UPI ID" 
          value={adminUpi}
          onChangeText={setAdminUpi}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateUpi} disabled={savingUpi}>
          <Text style={styles.saveBtnText}>{savingUpi ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Send Fee Reminder & Notifications</Text>
      <View style={styles.createCard}>
        
        {/* Course Selection */}
        <View style={styles.pickerContainer}>
          <Text style={styles.label}>1. Select Course:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {courses.map(course => (
              <TouchableOpacity 
                key={course.id}
                style={[styles.chip, selectedCourse === course.id && styles.chipActive]}
                onPress={() => handleCourseSelect(course.id)}
              >
                <Text style={[styles.chipText, selectedCourse === course.id && styles.chipTextActive]}>
                  {course.name}
                </Text>
              </TouchableOpacity>
            ))}
            {courses.length === 0 && <Text style={styles.noDataText}>No courses available</Text>}
          </ScrollView>
        </View>

        {/* Batch Selection */}
        {selectedCourse && (
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>2. Select Batch:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {batches.map(batch => (
                <TouchableOpacity 
                  key={batch.id}
                  style={[styles.chip, selectedBatch === batch.id && styles.chipActive]}
                  onPress={() => handleBatchSelect(batch.id)}
                >
                  <Text style={[styles.chipText, selectedBatch === batch.id && styles.chipTextActive]}>
                    {batch.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {batches.length === 0 && <Text style={styles.noDataText}>No batches available</Text>}
            </ScrollView>
          </View>
        )}

        {/* Student Multi-Selection */}
        {selectedBatch && (
          <View style={styles.pickerContainer}>
            <View style={styles.multiSelectHeader}>
              <Text style={styles.label}>3. Select Students:</Text>
              {students.length > 0 && (
                <TouchableOpacity onPress={toggleSelectAll}>
                  <Text style={styles.selectAllText}>
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
                    style={[styles.studentPill, isSelected && styles.studentPillActive]}
                    onPress={() => toggleStudentSelection(student.user_id)}
                  >
                    <Text style={[styles.studentPillText, isSelected && styles.studentPillTextActive]}>
                      {student.first_name} {student.last_name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {students.length === 0 && <Text style={styles.noDataText}>No students in this batch</Text>}
            </View>
          </View>
        )}

        {/* Amount & Date Input */}
        <TextInput 
          style={styles.input} 
          placeholder="Amount (e.g. 5000)" 
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TouchableOpacity 
          style={styles.datePickerTrigger}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[styles.datePickerTriggerText, !dueDate && styles.placeholderText]}>
            {dueDate ? `Due Date: ${dueDate}` : 'Select Due Date (YYYY-MM-DD)'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.primaryBtn, selectedStudents.length === 0 && styles.disabledBtn]} 
          onPress={handleCreateFee} 
          disabled={creatingFee || selectedStudents.length === 0}
        >
          <Text style={styles.primaryBtnText}>{creatingFee ? 'Sending...' : `Send Reminder (${selectedStudents.length})`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFeeItem = ({ item }) => {
    const isPaid = item.status === 'paid';
    const dueDateStr = item.due_date ? new Date(item.due_date).toLocaleDateString() : 'N/A';
    
    return (
      <View style={styles.feeCard}>
        <View style={styles.feeHeader}>
          <Text style={styles.feeAmount}>₹{item.amount}</Text>
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusPending]}>
            <Text style={[styles.statusText, isPaid ? styles.statusTextPaid : styles.statusTextPending]}>
              {isPaid ? 'PAID' : 'PENDING'}
            </Text>
          </View>
        </View>
        
        {role === 'admin' && item.user && (
          <Text style={styles.feeStudentName}>Student: {item.user.full_name}</Text>
        )}
        
        <Text style={styles.feeDate}>Due: {dueDateStr}</Text>
        
        {!isPaid && (
          <View style={styles.actionRow}>
            {role === 'admin' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleMarkReceived(item.id)}>
                <Text style={styles.actionBtnText}>Mark as Received</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(item)}>
                <Text style={styles.payBtnText}>Pay Now via UPI</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const totalPaid = fees.filter(f => f.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
  const totalPending = fees.filter(f => f.status !== 'paid').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      {renderDatePickerModal()}
      <FlatList 
        data={fees}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {role === 'admin' && renderAdminView()}
            
            {(role === 'student' || role === 'parent') && (
               <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>Fee Summary</Text>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Total Paid</Text>
                      <Text style={styles.summaryValuePaid}>₹{totalPaid}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                      <Text style={styles.summaryLabel}>Total Pending</Text>
                      <Text style={styles.summaryValuePending}>₹{totalPending}</Text>
                    </View>
                  </View>
               </View>
            )}
            
            <Text style={[styles.sectionTitle, {marginTop: 20}]}>All Fee Records</Text>
          </View>
        }
        renderItem={renderFeeItem}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>No fee records found.</Text>
        }
        refreshing={loading}
        onRefresh={fetchFees}
      />
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
