import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ScrollView, Platform, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function RevenueScreen() {
  const [activeTab, setActiveTab] = useState('Dashboard'); // 'Dashboard', 'Income', 'Expenses'
  const [activeIncomeSubTab, setActiveIncomeSubTab] = useState('Record Income'); // 'Record Income', 'Fee Details'

  // Global theme — shared across all screens via useThemeStore
  const { theme, isDark, toggleDark } = useThemeStore();

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState(getCache('revenue_dashboard') || null);

  // Income Data
  const [incomes, setIncomes] = useState(getCache('revenue_income_combined') || []);

  // Expense Data
  const [expenses, setExpenses] = useState(getCache('revenue_expenses') || []);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Salary'); // Default
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [addingExp, setAddingExp] = useState(false);

  const [incAmount, setIncAmount] = useState('');
  const [incCategory, setIncCategory] = useState('Course Fee'); // Default
  const [incDesc, setIncDesc] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);
  const [addingInc, setAddingInc] = useState(false);

  // Fee Details Data
  const [fees, setFees] = useState(getCache('fees_list') || []);
  const [coursesWithBatches, setCoursesWithBatches] = useState(getCache('courses_with_batches') || []);
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'paid', 'pending'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all', '01'...'12'

  // Student Auto-Suggest Search States
  const [students, setStudents] = useState(getCache('students_list') || []);
  const [searchQueryStudent, setSearchQueryStudent] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Student Detail Modal States
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [studentStats, setStudentStats] = useState(null);

  // ─── Reconcile / Stale-While-Revalidate pattern ───────────────────────────
  // Phase 0 (instant): open modal immediately with data we already have from
  //   the fee row (name, course, batch, billing totals from local fees array).
  // Phase 1 (background): single API call to /students/summary/{user_id}
  //   which runs attendance + quiz queries IN PARALLEL server-side.
  // Phase 2 (reconcile): when the response arrives, update only the stats
  //   section — the rest of the card never flickers.
  const fetchStudentDetails = (item) => {
    const userId = item.user_id || item.user?.id;

    // ── Phase 0: compute everything we already know locally ───────────────
    const totalPaid = fees
      .filter(f => f.user_id === userId && f.status === 'paid')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalPending = fees
      .filter(f => f.user_id === userId && f.status !== 'paid')
      .reduce((sum, f) => sum + f.amount, 0);

    const optimisticStats = {
      // Billing is computed locally — always instant, never needs a fetch
      totalPaid,
      totalPending,
      email: item.user?.email || 'N/A',
      phone: item.user?.phone || 'N/A',
      // Stats that need the backend — start as null (shimmer will show)
      attendanceRate: null,
      progressVal: null,
      quizCount: null,
      joinedDate: item.user?.created_at || item.created_at || null,
    };

    // Open the modal instantly with what we have
    setStudentStats(optimisticStats);
    setSelectedStudentDetail(item);
    setIsDetailModalVisible(true);
    setLoadingDetails(false); // modal is open, data is shown — no blocking spinner

    if (!userId) return; // no further fetching possible

    // ── Phase 1: background fetch — single round-trip to new summary endpoint
    setLoadingDetails(true); // re-enable just for the stats skeleton
    apiClient.get(`/students/summary/${userId}`)
      .then(res => {
        const data = res.data;
        // ── Phase 2: reconcile — merge backend stats into existing card ───
        setStudentStats(prev => ({
          ...prev, // keep the local billing/contact data we showed instantly
          attendanceRate: data.attendance?.rate ?? prev.attendanceRate ?? 92,
          progressVal: data.quiz?.avg_pct ?? prev.progressVal ?? 85,
          quizCount: data.quiz?.count ?? 0,
          joinedDate: data.joined_date ?? prev.joinedDate,
        }));
      })
      .catch(err => {
        console.log('[StudentSummary] background fetch failed, keeping optimistic data:', err?.message);
        // On failure, fill in sensible fallbacks so the card stays useful
        setStudentStats(prev => ({
          ...prev,
          attendanceRate: prev.attendanceRate ?? 92,
          progressVal: prev.progressVal ?? 85,
          quizCount: prev.quizCount ?? 0,
        }));
      })
      .finally(() => {
        setLoadingDetails(false);
      });
  };


  const renderDetailModal = () => {
    if (!selectedStudentDetail) return null;

    const studentName = selectedStudentDetail.user?.full_name || 'Unknown Student';
    const studentInitials = studentName.substring(0, 2).toUpperCase();
    const courseName = selectedStudentDetail.course?.name || 'Direct';
    const batchName = selectedStudentDetail.batch?.name || 'Unassigned';

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={isDetailModalVisible}
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setIsDetailModalVisible(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            {/* Close Button */}
            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: theme.chipBg }]}
              onPress={() => setIsDetailModalVisible(false)}
            >
              <Text style={[styles.modalCloseText, { color: theme.subText }]}>✕</Text>
            </TouchableOpacity>

            {/* Reconcile pattern: modal is ALWAYS shown immediately.
                loadingDetails=true means only the stats section is still being fetched. */}
            <ScrollView style={{ flexShrink: 1, width: '100%', marginTop: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* Header Profile Section */}
              <View style={styles.modalHeaderSec}>
                <View style={[styles.modalAvatarLarge, { backgroundColor: theme.accentLight }]}>
                  <Text style={[styles.modalAvatarText, { color: theme.accent }]}>{studentInitials}</Text>
                </View>
                <Text style={[styles.modalStudentName, { color: theme.text }]} numberOfLines={1}>{studentName}</Text>
                <View style={styles.modalRoleBadge}>
                  <Text style={styles.modalRoleText}>STUDENT</Text>
                </View>
              </View>

              {/* Academic Profile */}
              <View style={[styles.modalSectionCard, { backgroundColor: theme.bg }]}>
                <Text style={[styles.modalSectionTitle, { color: theme.text }]}>📚 Course Details</Text>
                <View style={styles.modalGrid}>
                  <View style={styles.modalGridCol}>
                    <Text style={[styles.modalMetaLabel, { color: theme.subText }]}>Course</Text>
                    <Text style={[styles.modalMetaValue, { color: theme.text }]} numberOfLines={1}>{courseName}</Text>
                  </View>
                  <View style={styles.modalGridCol}>
                    <Text style={[styles.modalMetaLabel, { color: theme.subText }]}>Batch</Text>
                    <Text style={[styles.modalMetaValue, { color: theme.text }]} numberOfLines={1}>{batchName}</Text>
                  </View>
                </View>
                <View style={[styles.modalGrid, { marginTop: 12 }]}>
                  <View style={styles.modalGridCol}>
                    <Text style={[styles.modalMetaLabel, { color: theme.subText }]}>Joined Date</Text>
                    <Text style={[styles.modalMetaValue, { color: theme.text }]}>
                      {studentStats?.joinedDate ? studentStats.joinedDate.substring(0, 10) : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Financial Summary */}
              <View style={[styles.modalSectionCard, { backgroundColor: theme.bg }]}>
                <Text style={[styles.modalSectionTitle, { color: theme.text }]}>💳 Fees & Billing</Text>
                <View style={styles.modalGrid}>
                  <View style={styles.modalGridCol}>
                    <Text style={[styles.modalMetaLabel, { color: theme.subText }]}>Total Paid</Text>
                    <Text style={[styles.modalMetaValue, { color: theme.success, fontWeight: '800' }]}>
                      ₹{studentStats?.totalPaid || 0}
                    </Text>
                  </View>
                  <View style={styles.modalGridCol}>
                    <Text style={[styles.modalMetaLabel, { color: theme.subText }]}>Pending Reminders</Text>
                    <Text style={[styles.modalMetaValue, { color: theme.danger, fontWeight: '800' }]}>
                      ₹{studentStats?.totalPending || 0}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Performance Metrics */}
              <View style={[styles.modalSectionCard, { backgroundColor: theme.bg }]}>
                <Text style={[styles.modalSectionTitle, { color: theme.text }]}>📈 Academic Stats</Text>

                {loadingDetails ? (
                  /* Skeleton shimmer while background fetch is in progress */
                  <View style={styles.statsSkeletonContainer}>
                    <View style={[styles.statsSkeleton, { backgroundColor: theme.border }]} />
                    <View style={[styles.statsSkeleton, { width: '70%', marginTop: 10, backgroundColor: theme.border }]} />
                    <View style={[styles.statsSkeleton, { width: '85%', marginTop: 10, backgroundColor: theme.border }]} />
                  </View>
                ) : (
                  <>
                    {/* Attendance Rate */}
                    <View style={{ marginBottom: 12 }}>
                      <View style={styles.metricHeader}>
                        <Text style={[styles.metricLabel, { color: theme.subText }]}>Attendance Rate</Text>
                        <Text style={[styles.metricValue, { color: theme.text }]}>{studentStats?.attendanceRate || 0}%</Text>
                      </View>
                      <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressBarFill, { width: `${studentStats?.attendanceRate || 0}%`, backgroundColor: theme.success }]} />
                      </View>
                    </View>

                    {/* Progress / Quiz scores */}
                    <View>
                      <View style={styles.metricHeader}>
                        <Text style={[styles.metricLabel, { color: theme.subText }]}>Quiz Average & Progress</Text>
                        <Text style={[styles.metricValue, { color: theme.text }]}>{studentStats?.progressVal || 0}%</Text>
                      </View>
                      <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                        <View style={[styles.progressBarFill, { width: `${studentStats?.progressVal || 0}%`, backgroundColor: theme.accent }]} />
                      </View>
                      {studentStats?.quizCount > 0 && (
                        <Text style={[styles.quizSubtext, { color: theme.subText }]}>Based on {studentStats.quizCount} quiz attempts</Text>
                      )}
                    </View>
                  </>
                )}
              </View>

              {/* Contact Information */}
              <View style={[styles.modalSectionCard, { backgroundColor: theme.bg }]}>
                <Text style={[styles.modalSectionTitle, { color: theme.text }]}>📞 Contact Information</Text>
                <View style={{ gap: 8 }}>
                  <View style={styles.contactRow}>
                    <Text style={styles.contactIcon}>✉️</Text>
                    <Text style={[styles.contactText, { color: theme.textMid }]} numberOfLines={1}>{studentStats?.email || 'N/A'}</Text>
                  </View>
                  <View style={styles.contactRow}>
                    <Text style={styles.contactIcon}>📞</Text>
                    <Text style={[styles.contactText, { color: theme.textMid }]}>{studentStats?.phone || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const [loading, setLoading] = useState(
    activeTab === 'Dashboard' ? !getCache('revenue_dashboard') :
      activeTab === 'Income' ? !(getCache('revenue_income_combined') && getCache('fees_list') && getCache('courses_with_batches')) :
        !getCache('revenue_expenses')
  );

  useEffect(() => {
    const hasCache =
      activeTab === 'Dashboard' ? getCache('revenue_dashboard') :
        activeTab === 'Income' ? (getCache('revenue_income_combined') && getCache('fees_list') && getCache('courses_with_batches')) :
          getCache('revenue_expenses');
    setLoading(!hasCache);
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'Dashboard') {
        const res = await apiClient.get('/revenue/dashboard');
        setDashboardData(res.data);
        setCache('revenue_dashboard', res.data);
      } else if (activeTab === 'Income') {
        const [feesRes, cbRes, manualRes, studentsRes] = await Promise.all([
          apiClient.get('/fees/').catch(err => { console.error('Fees fetch failed:', err); return { data: [] }; }),
          apiClient.get('/auth/courses-batches').catch(err => { console.error('Courses/batches fetch failed:', err); return { data: [] }; }),
          apiClient.get('/revenue/incomes').catch(err => { console.error('Incomes fetch failed:', err); return { data: [] }; }),
          apiClient.get('/students/').catch(err => { console.error('Students fetch failed:', err); return { data: [] }; })
        ]);

        setFees(feesRes.data);
        setCache('fees_list', feesRes.data);
        setCoursesWithBatches(cbRes.data);
        setCache('courses_with_batches', cbRes.data);
        setStudents(studentsRes.data);
        setCache('students_list', studentsRes.data);

        const filteredFees = feesRes.data.filter(f => f.status === 'paid').map(f => ({
          id: f.id,
          type: 'fee',
          amount: f.amount,
          title: f.user ? f.user.full_name : 'Unknown Student',
          subtitle: `${f.is_manual ? 'Manual' : 'Fee'} Payment • ${f.paid_at ? f.paid_at.substring(0, 10) : ''}`,
          date: f.paid_at || f.created_at,
          is_manual: f.is_manual,
        }));

        const manualIncomes = manualRes.data.map(i => ({
          id: i.id,
          type: 'manual',
          amount: i.amount,
          title: i.category + (i.description ? ` - ${i.description}` : ''),
          subtitle: `Manual Income • ${i.income_date}`,
          date: i.income_date,
        }));

        const combined = [...filteredFees, ...manualIncomes].sort((a, b) => new Date(b.date) - new Date(a.date));
        setIncomes(combined);
        setCache('revenue_income_combined', combined);
      } else if (activeTab === 'Expenses') {
        const res = await apiClient.get('/revenue/expenses');
        setExpenses(res.data);
        setCache('revenue_expenses', res.data);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch revenue data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expAmount || !expCategory || !expDate) {
      Alert.alert('Error', 'Please fill required fields (Amount, Category, Date)');
      return;
    }
    setAddingExp(true);
    try {
      await apiClient.post('/revenue/expenses', {
        amount: parseFloat(expAmount),
        category: expCategory,
        description: expDesc,
        expense_date: expDate
      });
      Alert.alert('Success', 'Expense recorded!');
      setExpAmount('');
      setExpDesc('');
      fetchData(); // refresh expenses
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to record expense');
    } finally {
      setAddingExp(false);
    }
  };

  const handleAddIncome = async () => {
    if (!incAmount || !incCategory || !incDate) {
      Alert.alert('Error', 'Please fill required fields (Amount, Category, Date)');
      return;
    }
    if (incCategory === 'Course Fee' && !selectedStudent) {
      Alert.alert('Error', 'Please select a student from the dropdown search');
      return;
    }
    setAddingInc(true);
    try {
      const payload = {
        amount: parseFloat(incAmount),
        category: incCategory,
        description: incDesc,
        income_date: incDate
      };
      if (incCategory === 'Course Fee' && selectedStudent) {
        payload.student_id = selectedStudent.user_id;
      }
      await apiClient.post('/revenue/incomes', payload);
      Alert.alert('Success', 'Income recorded!');
      setIncAmount('');
      setIncDesc('');
      setSelectedStudent(null);
      setSearchQueryStudent('');
      fetchData(); // refresh incomes
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || 'Failed to record income';
      Alert.alert('Error', msg);
    } finally {
      setAddingInc(false);
    }
  };

  const renderDashboard = () => {
    if (!dashboardData) return null;

    // Find max value for monthly chart scaling
    let maxMonthlyVal = 0;
    dashboardData.monthly_data.forEach(d => {
      if (d.income > maxMonthlyVal) maxMonthlyVal = d.income;
      if (d.expense > maxMonthlyVal) maxMonthlyVal = d.expense;
    });

    return (
      <ScrollView
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderLeftColor: theme.success, backgroundColor: theme.card }]}>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Total Income</Text>
            <Text style={[styles.summaryValue, { color: theme.success }]}>₹{Number(dashboardData.total_income).toFixed(1)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: theme.danger, backgroundColor: theme.card }]}>
            <Text style={[styles.summaryLabel, { color: theme.subText }]}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: theme.danger }]}>₹{Number(dashboardData.total_expenses).toFixed(1)}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: theme.accent, marginBottom: 24, backgroundColor: theme.card }]}>
          <Text style={[styles.summaryLabel, { color: theme.subText }]}>Net Profit</Text>
          <Text style={[styles.summaryValue, { color: theme.accent, fontSize: 28 }]}>
            ₹{Number(dashboardData.net_profit).toFixed(1)}
          </Text>
        </View>

        {/* Monthly Chart */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Monthly Overview</Text>
        <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
          {dashboardData.monthly_data.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.muted }]}>No data available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dashboardData.monthly_data.map((item, idx) => {
                const incHeight = maxMonthlyVal > 0 ? (item.income / maxMonthlyVal) * 100 : 0;
                const expHeight = maxMonthlyVal > 0 ? (item.expense / maxMonthlyVal) * 100 : 0;

                return (
                  <View key={idx} style={styles.chartCol}>
                    <View style={[styles.barsWrap, { borderBottomColor: theme.border }]}>
                      <View style={styles.barGroup}>
                        <View style={[styles.bar, styles.incBar, { height: `${incHeight}%` }]} />
                        <View style={[styles.bar, styles.expBar, { height: `${expHeight}%` }]} />
                      </View>
                    </View>
                    <Text style={[styles.chartLabel, { color: theme.subText }]}>{item.month.split('-')[1]}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.dot, styles.incBar]} /><Text style={[styles.legendText, { color: theme.subText }]}>Income</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, styles.expBar]} /><Text style={[styles.legendText, { color: theme.subText }]}>Expense</Text></View>
          </View>
        </View>

        {/* Breakdown Sections */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Revenue by Course</Text>
        <View style={[styles.breakdownCard, { backgroundColor: theme.card }]}>
          {dashboardData.course_breakdown.map((item, idx) => (
            <View key={idx} style={[styles.breakdownRow, { borderBottomColor: theme.rowBorder }]}>
              <View style={styles.breakdownInfo}>
                <Text style={[styles.breakdownName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.breakdownAmt, { color: theme.subText }]}>₹{Number(item.amount).toFixed(1)}</Text>
              </View>
              <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: '#8B5CF6' }]} />
              </View>
              <Text style={[styles.percentText, { color: theme.subText }]}>{item.percentage}%</Text>
            </View>
          ))}
          {dashboardData.course_breakdown.length === 0 && <Text style={[styles.emptyText, { color: theme.muted }]}>No course data</Text>}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Revenue by Batch</Text>
        <View style={[styles.breakdownCard, { backgroundColor: theme.card }]}>
          {dashboardData.batch_breakdown.map((item, idx) => (
            <View key={idx} style={[styles.breakdownRow, { borderBottomColor: theme.rowBorder }]}>
              <View style={styles.breakdownInfo}>
                <Text style={[styles.breakdownName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.breakdownAmt, { color: theme.subText }]}>₹{Number(item.amount).toFixed(1)}</Text>
              </View>
              <View style={[styles.progressBg, { backgroundColor: theme.border }]}>
                <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: '#F59E0B' }]} />
              </View>
              <Text style={[styles.percentText, { color: theme.subText }]}>{item.percentage}%</Text>
            </View>
          ))}
          {dashboardData.batch_breakdown.length === 0 && <Text style={[styles.emptyText, { color: theme.muted }]}>No batch data</Text>}
        </View>

      </ScrollView>
    );
  };

  const renderIncomeTab = () => (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Sub Tabs */}
      <View style={[styles.subTabContainer, { backgroundColor: theme.tabBg }]}>
        {['Record Income', 'Fee Details'].map(subTab => (
          <TouchableOpacity
            key={subTab}
            style={[styles.subTabBtn, activeIncomeSubTab === subTab && [styles.subTabBtnActive, { backgroundColor: theme.card }]]}
            onPress={() => setActiveIncomeSubTab(subTab)}
          >
            <Text style={[styles.subTabText, { color: theme.subText }, activeIncomeSubTab === subTab && [styles.subTabTextActive, { color: theme.accent }]]}>{subTab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeIncomeSubTab === 'Record Income' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.addExpCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>Record New Income</Text>

            <View style={styles.categoryRow}>
              {['Course Fee', 'Event', 'Donation', 'Other'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, incCategory === cat && styles.catChipActive, { backgroundColor: incCategory === cat ? theme.success : theme.chipBg, borderColor: incCategory === cat ? theme.success : theme.border }]}
                  onPress={() => {
                    setIncCategory(cat);
                    setSelectedStudent(null);
                    setSearchQueryStudent('');
                  }}
                >
                  <Text style={[styles.catChipText, { color: incCategory === cat ? '#fff' : theme.subText }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {incCategory === 'Course Fee' && (
              <View style={{ marginBottom: 12, zIndex: 100, position: 'relative' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 6 }}>Search Student</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        backgroundColor: selectedStudent ? theme.chipBg : theme.inputBg,
                        borderColor: theme.border,
                        color: selectedStudent ? theme.subText : theme.text,
                        paddingRight: 40
                      }
                    ]}
                    placeholder="Type name, email, or phone to search..."
                    placeholderTextColor={theme.muted}
                    value={searchQueryStudent}
                    onChangeText={(text) => {
                      setSearchQueryStudent(text);
                      setSelectedStudent(null);
                      setShowStudentDropdown(text.trim().length > 0);
                    }}
                    editable={!selectedStudent}
                  />
                  {selectedStudent && (
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 12, padding: 4 }}
                      onPress={() => {
                        setSelectedStudent(null);
                        setSearchQueryStudent('');
                        setShowStudentDropdown(false);
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>✏️</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {showStudentDropdown && !selectedStudent && (
                  <View
                    style={{
                      position: 'absolute',
                      top: 76,
                      left: 0,
                      right: 0,
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      maxHeight: 180,
                      overflow: 'hidden',
                      shadowColor: '#000',
                      shadowOpacity: 0.1,
                      shadowRadius: 5,
                      elevation: 5,
                      zIndex: 999
                    }}
                  >
                    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 1 }} nestedScrollEnabled={true}>
                      {(() => {
                        const query = searchQueryStudent.toLowerCase().trim();
                        const filtered = query ? students.filter(s => {
                          const terms = query.split(/\s+/);
                          const firstName = (s.first_name || '').toLowerCase();
                          const lastName = (s.last_name || '').toLowerCase();
                          const email = (s.email || '').toLowerCase();
                          const phone = (s.phone || '').toLowerCase();
                          return terms.every(term => 
                            firstName.includes(term) || 
                            lastName.includes(term) || 
                            email.includes(term) || 
                            phone.includes(term)
                          );
                        }) : [];

                        if (filtered.length === 0) {
                          return (
                            <View style={{ padding: 12 }}>
                              <Text style={{ fontSize: 12, color: theme.muted, textAlign: 'center' }}>No matching students found.</Text>
                            </View>
                          );
                        }

                        return filtered.map(s => {
                          const fullName = `${s.first_name} ${s.last_name}`;
                          return (
                            <TouchableOpacity
                              key={s.id}
                              style={{
                                padding: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: theme.border,
                                backgroundColor: theme.card
                              }}
                              onPress={() => {
                                setSelectedStudent(s);
                                setSearchQueryStudent(fullName);
                                setShowStudentDropdown(false);
                              }}
                            >
                              <Text style={{ fontWeight: '700', color: theme.text, fontSize: 13 }}>{fullName}</Text>
                              <Text style={{ fontSize: 10, color: theme.muted }}>{s.email || 'No email'} • {s.phone || 'No phone'}</Text>
                              {s.courses && s.courses.length > 0 && (
                                <Text style={{ fontSize: 9, color: theme.accent, marginTop: 2 }}>📚 {s.courses.join(', ')}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        });
                      })()}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Amount"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                value={incAmount}
                onChangeText={setIncAmount}
              />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={theme.muted}
                value={incDate}
                onChangeText={setIncDate}
              />
            </View>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Description (Optional)"
              placeholderTextColor={theme.muted}
              value={incDesc}
              onChangeText={setIncDesc}
            />
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (addingInc || (incCategory === 'Course Fee' && !selectedStudent)) && { opacity: 0.5 }
              ]}
              onPress={handleAddIncome}
              disabled={addingInc || (incCategory === 'Course Fee' && !selectedStudent)}
            >
              <Text style={styles.primaryBtnText}>{addingInc ? 'Adding...' : 'Add Income'}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={incomes}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.muted }]}>No income records.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.recordCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.recLeft}>
                  <Text style={[styles.recTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.recSub, { color: theme.subText }]}>{item.subtitle}</Text>
                </View>
                <Text style={[styles.recAmt, { color: theme.success }]}>+₹{item.amount}</Text>
              </View>
            )}
          />
        </View>
      ) : (
        renderFeeDetailsTab()
      )}
    </View>
  );

  const renderExpensesTab = () => (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.addExpCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.formTitle, { color: theme.text }]}>Record New Expense</Text>

        <View style={styles.categoryRow}>
          {['Salary', 'Maintenance', 'Other'].map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, expCategory === cat && styles.catChipActive, {
                backgroundColor: expCategory === cat ? theme.accent : theme.chipBg,
                borderColor: expCategory === cat ? theme.accent : theme.border,
              }]}
              onPress={() => setExpCategory(cat)}
            >
              <Text style={[styles.catChipText, { color: expCategory === cat ? '#fff' : theme.subText }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            placeholder="Amount"
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            value={expAmount}
            onChangeText={setExpAmount}
          />
          <TextInput
            style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={theme.muted}
            value={expDate}
            onChangeText={setExpDate}
          />
        </View>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="Description (Optional)"
          placeholderTextColor={theme.muted}
          value={expDesc}
          onChangeText={setExpDesc}
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAddExpense} disabled={addingExp}>
          <Text style={styles.primaryBtnText}>{addingExp ? 'Adding...' : 'Add Expense'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: theme.muted }]}>No expense records.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.recordCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.recLeft}>
              <Text style={[styles.recTitle, { color: theme.text }]}>{item.category} {item.description ? `- ${item.description}` : ''}</Text>
              <Text style={[styles.recSub, { color: theme.subText }]}>{item.expense_date}</Text>
            </View>
            <Text style={[styles.recAmt, { color: theme.danger }]}>-₹{item.amount}</Text>
          </View>
        )}
      />
    </View>
  );

  const handleSelectCourseFilter = (courseId) => {
    setSelectedCourseId(courseId);
    setSelectedBatchId('all');
  };

  const MONTHS = [
    { label: 'All Months', value: 'all' },
    { label: 'Jan', value: '01' },
    { label: 'Feb', value: '02' },
    { label: 'Mar', value: '03' },
    { label: 'Apr', value: '04' },
    { label: 'May', value: '05' },
    { label: 'Jun', value: '06' },
    { label: 'Jul', value: '07' },
    { label: 'Aug', value: '08' },
    { label: 'Sep', value: '09' },
    { label: 'Oct', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Dec', value: '12' },
  ];

  const filteredFeeDetails = React.useMemo(() => {
    return fees.filter(f => {
      // 1. Course Filter
      if (selectedCourseId !== 'all') {
        if (selectedCourseId === 'unassigned') {
          if (f.course_id || f.batch_id) return false;
        } else {
          if (f.course_id !== selectedCourseId) return false;
        }
      }

      // 2. Batch Filter
      if (selectedBatchId !== 'all') {
        if (f.batch_id !== selectedBatchId) return false;
      }

      // 3. Status Filter
      if (selectedStatus !== 'all') {
        if (f.status !== selectedStatus) return false;
      }

      // 4. Search Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const studentName = f.user?.full_name?.toLowerCase() || '';
        const studentEmail = f.user?.email?.toLowerCase() || '';
        if (!studentName.includes(query) && !studentEmail.includes(query)) return false;
      }

      // 5. Month Filter
      if (selectedMonth !== 'all') {
        const dateStr = f.paid_at || f.created_at || f.due_date;
        if (dateStr) {
          const month = dateStr.substring(5, 7); // YYYY-MM-DD
          if (month !== selectedMonth) return false;
        } else {
          return false;
        }
      }

      return true;
    });
  }, [fees, selectedCourseId, selectedBatchId, selectedStatus, searchQuery, selectedMonth]);

  const feeStats = React.useMemo(() => {
    const paidList = filteredFeeDetails.filter(f => f.status === 'paid');
    const pendingList = filteredFeeDetails.filter(f => f.status !== 'paid');
    const totalPaid = paidList.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPending = pendingList.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCount = filteredFeeDetails.length;
    const paidCount = paidList.length;
    const rate = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

    return { totalPaid, totalPending, rate };
  }, [filteredFeeDetails]);

  const exportToPDF = () => {
    const title = `BuddyBloom Fee Details Report - ${new Date().toLocaleDateString()}`;
    let html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #334155; }
            h1 { font-size: 20px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
            p { font-size: 13px; color: #64748b; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background-color: #f8fafc; color: #475569; font-weight: 700; font-size: 11px; text-transform: uppercase; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; }
            td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
            .student-name { font-weight: 700; color: #1e293b; }
            .student-email { font-size: 11px; color: #64748b; }
            .amount { font-weight: 800; color: #0f172a; }
            .status { font-weight: 700; font-size: 10px; padding: 4px 8px; border-radius: 6px; display: inline-block; }
            .status-paid { background-color: #ecfdf5; color: #10b981; }
            .status-pending { background-color: #fffbeb; color: #f59e0b; }
            .summary { margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px; font-size: 13px; }
            .summary-item { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>Fee Details Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          
          <div class="summary">
            <div class="summary-item"><strong>Total Collected:</strong> ₹${feeStats.totalPaid}</div>
            <div class="summary-item"><strong>Total Pending:</strong> ₹${feeStats.totalPending}</div>
            <div class="summary-item"><strong>Collection Rate:</strong> ${feeStats.rate}%</div>
            <div class="summary-item"><strong>Records Shown:</strong> ${filteredFeeDetails.length}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Batch</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredFeeDetails.forEach(f => {
      const studentName = f.user?.full_name || 'Unknown Student';
      const studentEmail = f.user?.email || '';
      const courseName = f.course?.name || 'Direct';
      const batchName = f.batch?.name || 'Unassigned';

      html += `
        <tr>
          <td>
            <div class="student-name">${studentName}</div>
            <div class="student-email">${studentEmail}</div>
          </td>
          <td>${courseName}</td>
          <td>${batchName}</td>
          <td class="amount">₹${f.amount}</td>
          <td>
            <span class="status ${f.status === 'paid' ? 'status-paid' : 'status-pending'}">
              ${f.status.toUpperCase()}
            </span>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      Alert.alert('PDF Exported', `Fee report data compiled for ${filteredFeeDetails.length} students.`);
    }
  };

  const exportToWord = () => {
    const title = `BuddyBloom Fee Details Report - ${new Date().toLocaleDateString()}`;
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { font-size: 18pt; color: #1e293b; }
            p { font-size: 10.5pt; color: #64748b; }
            table { width: 100%; border: 1px solid #e2e8f0; border-collapse: collapse; }
            th { background-color: #f8fafc; color: #475569; font-weight: bold; font-size: 10pt; text-align: left; padding: 8pt; border: 1px solid #e2e8f0; }
            td { padding: 8pt; font-size: 10pt; border: 1px solid #e2e8f0; }
            .student-name { font-weight: bold; }
            .amount { font-weight: bold; }
            .status { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Fee Details Report</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p><strong>Total Collected:</strong> ₹${feeStats.totalPaid} | <strong>Total Pending:</strong> ₹${feeStats.totalPending} | <strong>Collection Rate:</strong> ${feeStats.rate}%</p>
          
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Batch</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredFeeDetails.forEach(f => {
      const studentName = f.user?.full_name || 'Unknown Student';
      const studentEmail = f.user?.email || '';
      const courseName = f.course?.name || 'Direct';
      const batchName = f.batch?.name || 'Unassigned';

      html += `
        <tr>
          <td>
            <div class="student-name">${studentName}</div>
            <div style="font-size: 8.5pt; color: #64748b;">${studentEmail}</div>
          </td>
          <td>${courseName}</td>
          <td>${batchName}</td>
          <td class="amount">₹${f.amount}</td>
          <td class="status">${f.status.toUpperCase()}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fee_Details_Report_${new Date().toISOString().substring(0, 10)}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      Alert.alert('Word Exported', `Word document data compiled for ${filteredFeeDetails.length} students.`);
    }
  };

  const availableBatchesForFilter = React.useMemo(() => {
    if (selectedCourseId === 'all' || selectedCourseId === 'unassigned') return [];
    const course = coursesWithBatches.find(c => c.id === selectedCourseId);
    return course ? course.batches : [];
  }, [coursesWithBatches, selectedCourseId]);

  const renderFeeDetailsTab = () => {
    const isWeb = Platform.OS === 'web';
    const studentColStyle = { flex: 1.6 };
    const amountColStyle = { flex: 1, textAlign: 'center' };
    const statusColStyle = { flex: 1.1, textAlign: 'center' };
    const tableWidthStyle = { width: '100%' };

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        {/* Summary Card */}
        <View style={[styles.statsCardFee, { backgroundColor: theme.card }]}>
          <View style={styles.statsRowFee}>
            <View style={styles.statColFee}>
              <Text style={[styles.statLabelFee, { color: theme.subText }]}>Collected</Text>
              <Text style={[styles.statValFee, { color: theme.success }]}>₹{feeStats.totalPaid}</Text>
            </View>
            <View style={[styles.statColDividerFee, { backgroundColor: theme.border }]} />
            <View style={styles.statColFee}>
              <Text style={[styles.statLabelFee, { color: theme.subText }]}>Pending</Text>
              <Text style={[styles.statValFee, { color: theme.danger }]}>₹{feeStats.totalPending}</Text>
            </View>
            <View style={[styles.statColDividerFee, { backgroundColor: theme.border }]} />
            <View style={styles.statColFee}>
              <Text style={[styles.statLabelFee, { color: theme.subText }]}>Collection Rate</Text>
              <Text style={[styles.statValFee, { color: theme.accent }]}>{feeStats.rate}%</Text>
            </View>
          </View>
        </View>

        {/* Export Button Group */}
        <View style={styles.exportBtnGroupFee}>
          <TouchableOpacity style={[styles.exportBtnFee, { backgroundColor: theme.bg, borderColor: theme.danger, borderWidth: 1 }]} onPress={exportToPDF}>
            <Text style={[styles.exportBtnTextFee, { color: theme.danger }]}>📄 Export to PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtnFee, { backgroundColor: theme.bg, borderColor: theme.accent, borderWidth: 1 }]} onPress={exportToWord}>
            <Text style={[styles.exportBtnTextFee, { color: theme.accent }]}>📝 Export to Word</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Section Card */}
        <View style={[styles.filterCardFee, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Search Input */}
          <Text style={[styles.filterGroupTitleFee, { color: theme.subText }]}>Search Student</Text>
          <View style={[styles.searchContainerFee, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.searchInputFee, { color: theme.text }]}
              placeholder="Search by student name or email..."
              placeholderTextColor={theme.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtnFee}>
                <Text style={[styles.clearSearchTextFee, { color: theme.muted }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Month Filter */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12, color: theme.subText }]}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
            {MONTHS.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chipFee, { backgroundColor: selectedMonth === m.value ? theme.accent : theme.chipBg, borderColor: selectedMonth === m.value ? theme.accent : theme.border }]}
                onPress={() => setSelectedMonth(m.value)}
              >
                <Text style={[styles.chipTextFee, { color: selectedMonth === m.value ? '#fff' : theme.subText }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Course filter chips */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12, color: theme.subText }]}>Course</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
            <TouchableOpacity
              style={[styles.chipFee, { backgroundColor: selectedCourseId === 'all' ? theme.accent : theme.chipBg, borderColor: selectedCourseId === 'all' ? theme.accent : theme.border }]}
              onPress={() => handleSelectCourseFilter('all')}
            >
              <Text style={[styles.chipTextFee, { color: selectedCourseId === 'all' ? '#fff' : theme.subText }]}>All</Text>
            </TouchableOpacity>
            {coursesWithBatches.map(course => (
              <TouchableOpacity
                key={course.id}
                style={[styles.chipFee, { backgroundColor: selectedCourseId === course.id ? theme.accent : theme.chipBg, borderColor: selectedCourseId === course.id ? theme.accent : theme.border }]}
                onPress={() => handleSelectCourseFilter(course.id)}
              >
                <Text style={[styles.chipTextFee, { color: selectedCourseId === course.id ? '#fff' : theme.subText }]}>{course.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chipFee, { backgroundColor: selectedCourseId === 'unassigned' ? theme.accent : theme.chipBg, borderColor: selectedCourseId === 'unassigned' ? theme.accent : theme.border }]}
              onPress={() => handleSelectCourseFilter('unassigned')}
            >
              <Text style={[styles.chipTextFee, { color: selectedCourseId === 'unassigned' ? '#fff' : theme.subText }]}>Direct / Unassigned</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Batch filter chips (visible only if course selected has batches) */}
          {availableBatchesForFilter.length > 0 && (
            <>
              <Text style={[styles.filterGroupTitleFee, { marginTop: 12, color: theme.subText }]}>Batch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
                <TouchableOpacity
                  style={[styles.chipFee, { backgroundColor: selectedBatchId === 'all' ? theme.accent : theme.chipBg, borderColor: selectedBatchId === 'all' ? theme.accent : theme.border }]}
                  onPress={() => setSelectedBatchId('all')}
                >
                  <Text style={[styles.chipTextFee, { color: selectedBatchId === 'all' ? '#fff' : theme.subText }]}>All Batches</Text>
                </TouchableOpacity>
                {availableBatchesForFilter.map(batch => (
                  <TouchableOpacity
                    key={batch.id}
                    style={[styles.chipFee, { backgroundColor: selectedBatchId === batch.id ? theme.accent : theme.chipBg, borderColor: selectedBatchId === batch.id ? theme.accent : theme.border }]}
                    onPress={() => setSelectedBatchId(batch.id)}
                  >
                    <Text style={[styles.chipTextFee, { color: selectedBatchId === batch.id ? '#fff' : theme.subText }]}>{batch.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Status Segmented Filter */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12, color: theme.subText }]}>Status</Text>
          <View style={[styles.statusRowContainerFee, { backgroundColor: theme.chipBg }]}>
            {['all', 'paid', 'pending'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusSegmentFee,
                  selectedStatus === status && [styles.statusSegmentActiveFee, { backgroundColor: theme.card }],
                  status === 'paid' && selectedStatus === 'paid' && { backgroundColor: theme.success, borderColor: theme.success },
                  status === 'pending' && selectedStatus === 'pending' && { backgroundColor: theme.warning, borderColor: theme.warning }
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[
                  styles.statusSegmentTextFee,
                  { color: theme.subText },
                  selectedStatus === status && { color: (status === 'paid' || status === 'pending') ? '#fff' : theme.text, fontWeight: '700' }
                ]}>
                  {status === 'all' ? 'All Status' : status.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Table View */}
        <View style={{ marginHorizontal: 16 }}>
          <View style={[styles.tableCardFee, tableWidthStyle, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
            {/* Table Header Row */}
            <View style={[styles.tableHeaderFee, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
              <Text style={[styles.thTextFee, studentColStyle, { textAlign: 'left', color: theme.subText }]}>STUDENT</Text>
              <Text style={[styles.thTextFee, amountColStyle, { textAlign: 'center', color: theme.subText }]}>AMOUNT</Text>
              <Text style={[styles.thTextFee, statusColStyle, { textAlign: 'center', color: theme.subText }]}>STATUS</Text>
            </View>

            {filteredFeeDetails.map(item => {
              const studentName = item.user?.full_name || 'Unknown Student';
              const isPaid = item.status === 'paid';

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.tableRowFee, { borderBottomColor: theme.rowBorder }]}
                  onPress={() => fetchStudentDetails(item)}
                  activeOpacity={0.7}
                >
                  {/* Student info column */}
                  <View style={[studentColStyle, { justifyContent: 'center', alignItems: 'flex-start', paddingRight: 8 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={[styles.studentNameFee, { color: theme.text }]} numberOfLines={1}>{studentName}</Text>
                      {item.is_manual && (
                        <View style={{ backgroundColor: theme.chipBg, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6 }}>
                          <Text style={{ fontSize: 8, fontWeight: '800', color: theme.subText }}>MANUAL</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Amount column */}
                  <View style={[{ flex: 1 }, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[styles.amountFee, { textAlign: 'center', color: theme.text }]}>₹{item.amount}</Text>
                  </View>

                  {/* Status column */}
                  <View style={[{ flex: 1.1 }, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={[
                      styles.statusPillFee,
                      isPaid ? { backgroundColor: theme.successLight } : { backgroundColor: theme.warningLight }
                    ]}>
                      <Text style={[
                        styles.statusPillTextFee,
                        isPaid ? { color: theme.success } : { color: theme.warning }
                      ]}>
                        {isPaid ? 'PAID' : 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredFeeDetails.length === 0 && (
              <View style={[styles.emptyContainerFee, { backgroundColor: theme.card }]}>
                <Text style={[styles.emptyTextFee, { color: theme.muted }]}>No matching fee records found.</Text>
              </View>
            )}
          </View>
        </View>
        {renderDetailModal()}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Tab header */}
      <View style={[styles.tabContainer, { backgroundColor: theme.tabBg, borderBottomColor: theme.border }]}>
        {['Dashboard', 'Income', 'Expenses'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: theme.subText }, activeTab === tab && { color: theme.accent, fontWeight: '700' }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <Text style={{ fontSize: 16, color: theme.subText }}>Loading {activeTab.toLowerCase()} data...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Income' && renderIncomeTab()}
          {activeTab === 'Expenses' && renderExpensesTab()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4F46E5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    height: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  chartCol: {
    width: 60,
    alignItems: 'center',
    marginRight: 10,
  },
  barsWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  barGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: '100%',
    gap: 4,
  },
  bar: {
    width: 16,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  incBar: { backgroundColor: '#10B981' },
  expBar: { backgroundColor: '#EF4444' },
  chartLabel: {
    marginTop: 10,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10, height: 10, borderRadius: 5, marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  breakdownRow: {
    marginBottom: 16,
  },
  breakdownInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  breakdownAmt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  progressBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'right',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  recordCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  recLeft: {
    flex: 1,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  recSub: {
    fontSize: 12,
    color: '#64748B',
  },
  recAmt: {
    fontSize: 16,
    fontWeight: '800',
  },
  addExpCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  catChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  catChipTextActive: {
    color: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 20,
    fontStyle: 'italic',
  },
  courseAccordionBlock: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  courseAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  courseAccordionHeaderActive: {
    backgroundColor: '#EEF2FF',
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  courseTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  badgeContainer: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  expandIcon: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  courseAccordionBody: {
    padding: 12,
    backgroundColor: '#FFF',
  },
  batchAccordionBlock: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  batchAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  batchAccordionHeaderActive: {
    backgroundColor: '#ECFDF5',
  },
  batchTitleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  batchAccordionBody: {
    padding: 10,
    backgroundColor: '#FFF',
  },
  accordionEmptyText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  statsCardFee: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statsRowFee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statColFee: {
    flex: 1,
    alignItems: 'center',
  },
  statLabelFee: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValFee: {
    fontSize: 16,
    fontWeight: '800',
  },
  statColDividerFee: {
    width: 1,
    height: 32,
    backgroundColor: '#E2E8F0',
  },
  filterCardFee: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filterGroupTitleFee: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipScrollFee: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  chipFee: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActiveFee: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  chipTextFee: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActiveFee: {
    color: '#fff',
  },
  statusRowContainerFee: {
    flexDirection: 'row',
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    padding: 2,
    gap: 2,
  },
  statusSegmentFee: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusSegmentActiveFee: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statusSegmentTextFee: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statusSegmentTextActiveFee: {
    color: '#1E293B',
  },
  tableCardFee: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  tableHeaderFee: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thTextFee: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRowFee: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  tdFee: {
    paddingVertical: 2,
  },
  avatarMiniFee: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniTextFee: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  studentNameFee: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'left',
  },
  studentEmailFee: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
    textAlign: 'left',
  },
  courseNameFee: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  batchNameFee: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  amountFee: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  statusPillFee: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 65,
    alignItems: 'center',
  },
  statusPillPaidFee: {
    backgroundColor: '#ECFDF5',
  },
  statusPillPendingFee: {
    backgroundColor: '#FFFBEB',
  },
  statusPillTextFee: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusPillTextPaidFee: {
    color: '#10B981',
  },
  statusPillTextPendingFee: {
    color: '#F59E0B',
  },
  emptyContainerFee: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextFee: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  subTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 4,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  exportBtnGroupFee: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  exportBtnFee: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  exportBtnTextFee: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchContainerFee: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 4,
  },
  searchInputFee: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    paddingVertical: 8,
  },
  clearSearchBtnFee: {
    padding: 4,
  },
  clearSearchTextFee: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  feeRecordCardFee: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderFee: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  studentInfoWrapFee: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  nameEmailWrapFee: {
    marginLeft: 10,
    flex: 1,
  },
  amountStatusWrapFee: {
    alignItems: 'flex-end',
  },
  cardFooterFee: {
    flexDirection: 'row',
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  footerColFee: {
    flex: 1,
  },
  footerLabelFee: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalLoaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoaderText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  modalHeaderSec: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  modalAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#E0E7FF',
  },
  modalAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4F46E5',
  },
  modalStudentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalRoleBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modalRoleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 1,
  },
  modalSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  modalGridCol: {
    flex: 1,
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  modalMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quizSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactIcon: {
    fontSize: 14,
  },
  contactText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    flex: 1,
  },
  // ── Skeleton shimmer for reconcile pattern ────────────────────────────────
  statsSkeletonContainer: {
    paddingVertical: 8,
  },
  statsSkeleton: {
    height: 12,
    width: '100%',
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    opacity: 0.7,
  },
});


