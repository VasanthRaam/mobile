import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ScrollView, Platform, Modal, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';

export default function RevenueScreen() {
  const [activeTab, setActiveTab] = useState('Dashboard'); // 'Dashboard', 'Income', 'Expenses'
  const [activeIncomeSubTab, setActiveIncomeSubTab] = useState('Record Income'); // 'Record Income', 'Fee Details'

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

  // Student Detail Modal States
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [studentStats, setStudentStats] = useState(null);

  const fetchStudentDetails = async (item) => {
    setLoadingDetails(true);
    setStudentStats(null);
    setSelectedStudentDetail(item);
    setIsDetailModalVisible(true);
    
    const userId = item.user_id || item.user?.id;
    if (!userId) {
      setStudentStats({
        attendanceRate: 100,
        progressVal: 100,
        quizCount: 0,
        joinedDate: item.created_at || new Date().toISOString(),
        totalPaid: item.amount,
        totalPending: 0,
        phone: 'N/A',
        email: 'N/A'
      });
      setLoadingDetails(false);
      return;
    }

    try {
      const studentsRes = await apiClient.get('/students/');
      const studentProfile = (studentsRes.data || []).find(s => s.user_id === userId);
      
      let attendanceRate = 92;
      let progressVal = 85;
      let quizCount = 0;
      let joinedDate = item.user?.created_at || item.created_at || new Date().toISOString();

      if (studentProfile) {
        joinedDate = studentProfile.created_at;
        
        try {
          const attRes = await apiClient.get(`/attendance/?student_id=${studentProfile.id}`);
          const records = attRes.data || [];
          if (records.length > 0) {
            const present = records.filter(r => r.status === 'present').length;
            attendanceRate = Math.round((present / records.length) * 100);
          }
        } catch (attErr) {
          console.log('Error fetching attendance for detail modal:', attErr);
        }

        try {
          const quizRes = await apiClient.get('/quizzes/results/all');
          const myAttempts = (quizRes.data || []).filter(a => a.student_id === studentProfile.id);
          if (myAttempts.length > 0) {
            const sumScores = myAttempts.reduce((acc, curr) => acc + (curr.total_score / (curr.max_score || 1)), 0);
            progressVal = Math.round((sumScores / myAttempts.length) * 100);
            quizCount = myAttempts.length;
          }
        } catch (quizErr) {
          console.log('Error fetching quiz attempts for detail modal:', quizErr);
        }
      }

      const totalPaid = fees
        .filter(f => f.user_id === userId && f.status === 'paid')
        .reduce((sum, curr) => sum + curr.amount, 0);

      const totalPending = fees
        .filter(f => f.user_id === userId && f.status !== 'paid')
        .reduce((sum, curr) => sum + curr.amount, 0);

      setStudentStats({
        attendanceRate,
        progressVal,
        quizCount,
        joinedDate,
        totalPaid,
        totalPending,
        phone: item.user?.phone || 'N/A',
        email: item.user?.email || 'N/A'
      });
    } catch (err) {
      console.error(err);
      const totalPaid = fees
        .filter(f => f.user_id === userId && f.status === 'paid')
        .reduce((sum, curr) => sum + curr.amount, 0);

      const totalPending = fees
        .filter(f => f.user_id === userId && f.status !== 'paid')
        .reduce((sum, curr) => sum + curr.amount, 0);

      setStudentStats({
        attendanceRate: 90,
        progressVal: 85,
        quizCount: 0,
        joinedDate: item.user?.created_at || item.created_at || new Date().toISOString(),
        totalPaid,
        totalPending,
        phone: item.user?.phone || 'N/A',
        email: item.user?.email || 'N/A'
      });
    } finally {
      setLoadingDetails(false);
    }
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
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDetailModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalCard}
            activeOpacity={1}
          >
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setIsDetailModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            {loadingDetails ? (
              <View style={styles.modalLoaderContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.modalLoaderText}>Fetching student details...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                {/* Header Profile Section */}
                <View style={styles.modalHeaderSec}>
                  <View style={styles.modalAvatarLarge}>
                    <Text style={styles.modalAvatarText}>{studentInitials}</Text>
                  </View>
                  <Text style={styles.modalStudentName} numberOfLines={1}>{studentName}</Text>
                  <View style={styles.modalRoleBadge}>
                    <Text style={styles.modalRoleText}>STUDENT</Text>
                  </View>
                </View>

                {/* Academic Profile */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>📚 Course Details</Text>
                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridCol}>
                      <Text style={styles.modalMetaLabel}>Course</Text>
                      <Text style={styles.modalMetaValue} numberOfLines={1}>{courseName}</Text>
                    </View>
                    <View style={styles.modalGridCol}>
                      <Text style={styles.modalMetaLabel}>Batch</Text>
                      <Text style={styles.modalMetaValue} numberOfLines={1}>{batchName}</Text>
                    </View>
                  </View>
                  <View style={[styles.modalGrid, { marginTop: 12 }]}>
                    <View style={styles.modalGridCol}>
                      <Text style={styles.modalMetaLabel}>Joined Date</Text>
                      <Text style={styles.modalMetaValue}>
                        {studentStats?.joinedDate ? studentStats.joinedDate.substring(0, 10) : 'N/A'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Financial Summary */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>💳 Fees & Billing</Text>
                  <View style={styles.modalGrid}>
                    <View style={styles.modalGridCol}>
                      <Text style={styles.modalMetaLabel}>Total Paid</Text>
                      <Text style={[styles.modalMetaValue, { color: '#10B981', fontWeight: '800' }]}>
                        ₹{studentStats?.totalPaid || 0}
                      </Text>
                    </View>
                    <View style={styles.modalGridCol}>
                      <Text style={styles.modalMetaLabel}>Pending Reminders</Text>
                      <Text style={[styles.modalMetaValue, { color: '#EF4444', fontWeight: '800' }]}>
                        ₹{studentStats?.totalPending || 0}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Performance Metrics */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>📈 Academic Stats</Text>
                  
                  {/* Attendance Rate */}
                  <View style={{ marginBottom: 12 }}>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricLabel}>Attendance Rate</Text>
                      <Text style={styles.metricValue}>{studentStats?.attendanceRate || 0}%</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${studentStats?.attendanceRate || 0}%`, backgroundColor: '#10B981' }]} />
                    </View>
                  </View>

                  {/* Progress / Quiz scores */}
                  <View>
                    <View style={styles.metricHeader}>
                      <Text style={styles.metricLabel}>Quiz Average & Progress</Text>
                      <Text style={styles.metricValue}>{studentStats?.progressVal || 0}%</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${studentStats?.progressVal || 0}%`, backgroundColor: '#4F46E5' }]} />
                    </View>
                    {studentStats?.quizCount > 0 && (
                      <Text style={styles.quizSubtext}>Based on {studentStats.quizCount} quiz attempts</Text>
                    )}
                  </View>
                </View>

                {/* Contact Information */}
                <View style={styles.modalSectionCard}>
                  <Text style={styles.modalSectionTitle}>📞 Contact Information</Text>
                  <View style={{ gap: 8 }}>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactIcon}>✉️</Text>
                      <Text style={styles.contactText} numberOfLines={1}>{studentStats?.email || 'N/A'}</Text>
                    </View>
                    <View style={styles.contactRow}>
                      <Text style={styles.contactIcon}>📞</Text>
                      <Text style={styles.contactText}>{studentStats?.phone || 'N/A'}</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
        const feesRes = await apiClient.get('/fees/');
        const cbRes = await apiClient.get('/auth/courses-batches');
        const manualRes = await apiClient.get('/revenue/incomes');

        setFees(feesRes.data);
        setCache('fees_list', feesRes.data);
        setCoursesWithBatches(cbRes.data);
        setCache('courses_with_batches', cbRes.data);

        const filteredFees = feesRes.data.filter(f => f.status === 'paid').map(f => ({
          id: f.id,
          type: 'fee',
          amount: f.amount,
          title: f.user ? f.user.full_name : 'Unknown Student',
          subtitle: `Fee Payment • ${f.paid_at ? f.paid_at.substring(0, 10) : ''}`,
          date: f.paid_at || f.created_at,
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
    setAddingInc(true);
    try {
      await apiClient.post('/revenue/incomes', {
        amount: parseFloat(incAmount),
        category: incCategory,
        description: incDesc,
        income_date: incDate
      });
      Alert.alert('Success', 'Income recorded!');
      setIncAmount('');
      setIncDesc('');
      fetchData(); // refresh incomes
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to record income');
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.summaryLabel}>Total Income</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>₹{Number(dashboardData.total_income).toFixed(1)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>₹{Number(dashboardData.total_expenses).toFixed(1)}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#4F46E5', marginBottom: 24 }]}>
          <Text style={styles.summaryLabel}>Net Profit</Text>
          <Text style={[styles.summaryValue, { color: '#4F46E5', fontSize: 28 }]}>
            ₹{Number(dashboardData.net_profit).toFixed(1)}
          </Text>
        </View>

        {/* Monthly Chart */}
        <Text style={styles.sectionTitle}>Monthly Overview</Text>
        <View style={styles.chartContainer}>
          {dashboardData.monthly_data.length === 0 ? (
            <Text style={styles.emptyText}>No data available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dashboardData.monthly_data.map((item, idx) => {
                const incHeight = maxMonthlyVal > 0 ? (item.income / maxMonthlyVal) * 100 : 0;
                const expHeight = maxMonthlyVal > 0 ? (item.expense / maxMonthlyVal) * 100 : 0;

                return (
                  <View key={idx} style={styles.chartCol}>
                    <View style={styles.barsWrap}>
                      <View style={styles.barGroup}>
                        <View style={[styles.bar, styles.incBar, { height: `${incHeight}%` }]} />
                        <View style={[styles.bar, styles.expBar, { height: `${expHeight}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.chartLabel}>{item.month.split('-')[1]}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <View style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.dot, styles.incBar]} /><Text style={styles.legendText}>Income</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, styles.expBar]} /><Text style={styles.legendText}>Expense</Text></View>
          </View>
        </View>

        {/* Breakdown Sections */}
        <Text style={styles.sectionTitle}>Revenue by Course</Text>
        <View style={styles.breakdownCard}>
          {dashboardData.course_breakdown.map((item, idx) => (
            <View key={idx} style={styles.breakdownRow}>
              <View style={styles.breakdownInfo}>
                <Text style={styles.breakdownName}>{item.name}</Text>
                <Text style={styles.breakdownAmt}>₹{Number(item.amount).toFixed(1)}</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: '#8B5CF6' }]} />
              </View>
              <Text style={styles.percentText}>{item.percentage}%</Text>
            </View>
          ))}
          {dashboardData.course_breakdown.length === 0 && <Text style={styles.emptyText}>No course data</Text>}
        </View>

        <Text style={styles.sectionTitle}>Revenue by Batch</Text>
        <View style={styles.breakdownCard}>
          {dashboardData.batch_breakdown.map((item, idx) => (
            <View key={idx} style={styles.breakdownRow}>
              <View style={styles.breakdownInfo}>
                <Text style={styles.breakdownName}>{item.name}</Text>
                <Text style={styles.breakdownAmt}>₹{Number(item.amount).toFixed(1)}</Text>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${item.percentage}%`, backgroundColor: '#F59E0B' }]} />
              </View>
              <Text style={styles.percentText}>{item.percentage}%</Text>
            </View>
          ))}
          {dashboardData.batch_breakdown.length === 0 && <Text style={styles.emptyText}>No batch data</Text>}
        </View>

      </ScrollView>
    );
  };

  const renderIncomeTab = () => (
    <View style={{ flex: 1 }}>
      {/* Sub Tabs */}
      <View style={styles.subTabContainer}>
        {['Record Income', 'Fee Details'].map(subTab => (
          <TouchableOpacity
            key={subTab}
            style={[styles.subTabBtn, activeIncomeSubTab === subTab && styles.subTabBtnActive]}
            onPress={() => setActiveIncomeSubTab(subTab)}
          >
            <Text style={[styles.subTabText, activeIncomeSubTab === subTab && styles.subTabTextActive]}>{subTab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeIncomeSubTab === 'Record Income' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.addExpCard}>
            <Text style={styles.formTitle}>Record New Income</Text>

            <View style={styles.categoryRow}>
              {['Course Fee', 'Event', 'Donation', 'Other'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, incCategory === cat && styles.catChipActive, { backgroundColor: incCategory === cat ? '#10B981' : '#F1F5F9', borderColor: incCategory === cat ? '#10B981' : '#E2E8F0' }]}
                  onPress={() => setIncCategory(cat)}
                >
                  <Text style={[styles.catChipText, incCategory === cat && styles.catChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                placeholder="Amount"
                keyboardType="numeric"
                value={incAmount}
                onChangeText={setIncAmount}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Date (YYYY-MM-DD)"
                value={incDate}
                onChangeText={setIncDate}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Description (Optional)"
              value={incDesc}
              onChangeText={setIncDesc}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAddIncome} disabled={addingInc}>
              <Text style={styles.primaryBtnText}>{addingInc ? 'Adding...' : 'Add Income'}</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={incomes}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No income records.</Text>}
            renderItem={({ item }) => (
              <View style={styles.recordCard}>
                <View style={styles.recLeft}>
                  <Text style={styles.recTitle}>{item.title}</Text>
                  <Text style={styles.recSub}>{item.subtitle}</Text>
                </View>
                <Text style={[styles.recAmt, { color: '#10B981' }]}>+₹{item.amount}</Text>
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
    <View style={{ flex: 1 }}>
      <View style={styles.addExpCard}>
        <Text style={styles.formTitle}>Record New Expense</Text>

        <View style={styles.categoryRow}>
          {['Salary', 'Maintenance', 'Other'].map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, expCategory === cat && styles.catChipActive]}
              onPress={() => setExpCategory(cat)}
            >
              <Text style={[styles.catChipText, expCategory === cat && styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="Amount"
            keyboardType="numeric"
            value={expAmount}
            onChangeText={setExpAmount}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Date (YYYY-MM-DD)"
            value={expDate}
            onChangeText={setExpDate}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Description (Optional)"
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
        ListEmptyComponent={<Text style={styles.emptyText}>No expense records.</Text>}
        renderItem={({ item }) => (
          <View style={styles.recordCard}>
            <View style={styles.recLeft}>
              <Text style={styles.recTitle}>{item.category} {item.description ? `- ${item.description}` : ''}</Text>
              <Text style={styles.recSub}>{item.expense_date}</Text>
            </View>
            <Text style={[styles.recAmt, { color: '#EF4444' }]}>-₹{item.amount}</Text>
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
    const studentColStyle = isWeb ? { flex: 2 } : { width: 200 };
    const courseColStyle = isWeb ? { flex: 1.5 } : { width: 120 };
    const amountColStyle = isWeb ? { flex: 1.2, textAlign: 'center' } : { width: 100, textAlign: 'center' };
    const statusColStyle = isWeb ? { flex: 1.3, textAlign: 'center' } : { width: 100, textAlign: 'center' };
    const tableWidthStyle = isWeb ? { width: '100%' } : { width: 520 };

    return (
      <ScrollView 
        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={true}
      >
        {/* Summary Card */}
        <View style={styles.statsCardFee}>
          <View style={styles.statsRowFee}>
            <View style={styles.statColFee}>
              <Text style={styles.statLabelFee}>Collected</Text>
              <Text style={[styles.statValFee, { color: '#10B981' }]}>₹{feeStats.totalPaid}</Text>
            </View>
            <View style={styles.statColDividerFee} />
            <View style={styles.statColFee}>
              <Text style={styles.statLabelFee}>Pending</Text>
              <Text style={[styles.statValFee, { color: '#EF4444' }]}>₹{feeStats.totalPending}</Text>
            </View>
            <View style={styles.statColDividerFee} />
            <View style={styles.statColFee}>
              <Text style={styles.statLabelFee}>Collection Rate</Text>
              <Text style={[styles.statValFee, { color: '#6366F1' }]}>{feeStats.rate}%</Text>
            </View>
          </View>
        </View>

        {/* Export Button Group */}
        <View style={styles.exportBtnGroupFee}>
          <TouchableOpacity style={[styles.exportBtnFee, { backgroundColor: '#EF4444' }]} onPress={exportToPDF}>
            <Text style={styles.exportBtnTextFee}>📄 Export to PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtnFee, { backgroundColor: '#4F46E5' }]} onPress={exportToWord}>
            <Text style={styles.exportBtnTextFee}>📝 Export to Word</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Section Card */}
        <View style={styles.filterCardFee}>
          {/* Search Input */}
          <Text style={styles.filterGroupTitleFee}>Search Student</Text>
          <View style={styles.searchContainerFee}>
            <TextInput
              style={styles.searchInputFee}
              placeholder="Search by student name or email..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtnFee}>
                <Text style={styles.clearSearchTextFee}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Month Filter */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12 }]}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
            {MONTHS.map(m => (
              <TouchableOpacity
                key={m.value}
                style={[styles.chipFee, selectedMonth === m.value && styles.chipActiveFee]}
                onPress={() => setSelectedMonth(m.value)}
              >
                <Text style={[styles.chipTextFee, selectedMonth === m.value && styles.chipTextActiveFee]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Course filter chips */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12 }]}>Course</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
            <TouchableOpacity 
              style={[styles.chipFee, selectedCourseId === 'all' && styles.chipActiveFee]}
              onPress={() => handleSelectCourseFilter('all')}
            >
              <Text style={[styles.chipTextFee, selectedCourseId === 'all' && styles.chipTextActiveFee]}>All</Text>
            </TouchableOpacity>
            {coursesWithBatches.map(course => (
              <TouchableOpacity 
                key={course.id}
                style={[styles.chipFee, selectedCourseId === course.id && styles.chipActiveFee]}
                onPress={() => handleSelectCourseFilter(course.id)}
              >
                <Text style={[styles.chipTextFee, selectedCourseId === course.id && styles.chipTextActiveFee]}>{course.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={[styles.chipFee, selectedCourseId === 'unassigned' && styles.chipActiveFee]}
              onPress={() => handleSelectCourseFilter('unassigned')}
            >
              <Text style={[styles.chipTextFee, selectedCourseId === 'unassigned' && styles.chipTextActiveFee]}>Direct / Unassigned</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Batch filter chips (visible only if course selected has batches) */}
          {availableBatchesForFilter.length > 0 && (
            <>
              <Text style={[styles.filterGroupTitleFee, { marginTop: 12 }]}>Batch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollFee}>
                <TouchableOpacity 
                  style={[styles.chipFee, selectedBatchId === 'all' && styles.chipActiveFee]}
                  onPress={() => setSelectedBatchId('all')}
                >
                  <Text style={[styles.chipTextFee, selectedBatchId === 'all' && styles.chipTextActiveFee]}>All Batches</Text>
                </TouchableOpacity>
                {availableBatchesForFilter.map(batch => (
                  <TouchableOpacity 
                    key={batch.id}
                    style={[styles.chipFee, selectedBatchId === batch.id && styles.chipActiveFee]}
                    onPress={() => setSelectedBatchId(batch.id)}
                  >
                    <Text style={[styles.chipTextFee, selectedBatchId === batch.id && styles.chipTextActiveFee]}>{batch.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Status Segmented Filter */}
          <Text style={[styles.filterGroupTitleFee, { marginTop: 12 }]}>Status</Text>
          <View style={styles.statusRowContainerFee}>
            {['all', 'paid', 'pending'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusSegmentFee, 
                  selectedStatus === status && styles.statusSegmentActiveFee,
                  status === 'paid' && selectedStatus === 'paid' && { backgroundColor: '#10B981', borderColor: '#10B981' },
                  status === 'pending' && selectedStatus === 'pending' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }
                ]}
                onPress={() => setSelectedStatus(status)}
              >
                <Text style={[
                  styles.statusSegmentTextFee, 
                  selectedStatus === status && styles.statusSegmentTextActiveFee
                ]}>
                  {status === 'all' ? 'All Status' : status.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Scrollable Table View */}
        <ScrollView 
          horizontal={true} 
          showsHorizontalScrollIndicator={isWeb} 
          style={{ marginHorizontal: 16 }}
          contentContainerStyle={isWeb ? { flexGrow: 1 } : null}
        >
          <View style={[styles.tableCardFee, tableWidthStyle]}>
            {/* Table Header Row */}
            <View style={styles.tableHeaderFee}>
              <Text style={[styles.thTextFee, studentColStyle, { textAlign: 'left' }]}>STUDENT</Text>
              <Text style={[styles.thTextFee, courseColStyle, { textAlign: 'center' }]}>COURSE</Text>
              <Text style={[styles.thTextFee, amountColStyle, { textAlign: 'center' }]}>AMOUNT</Text>
              <Text style={[styles.thTextFee, statusColStyle, { textAlign: 'center' }]}>STATUS</Text>
            </View>

            {filteredFeeDetails.map(item => {
              const studentName = item.user?.full_name || 'Unknown Student';
              const studentInitials = studentName.substring(0, 2).toUpperCase();
              const courseName = item.course?.name || 'Direct';
              const isPaid = item.status === 'paid';

              return (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.tableRowFee} 
                  onPress={() => fetchStudentDetails(item)}
                  activeOpacity={0.7}
                >
                  {/* Student info column */}
                  <View style={[studentColStyle, { justifyContent: 'center', alignItems: 'flex-start' }]}>
                    <Text style={styles.studentNameFee} numberOfLines={1}>{studentName}</Text>
                  </View>

                  {/* Course info column */}
                  <View style={[courseColStyle, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[styles.courseNameFee, { textAlign: 'center' }]} numberOfLines={1}>{courseName}</Text>
                  </View>

                  {/* Amount column */}
                  <View style={[isWeb ? { flex: 1.2 } : { width: 100 }, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={[styles.amountFee, { textAlign: 'center' }]}>₹{item.amount}</Text>
                  </View>

                  {/* Status column */}
                  <View style={[isWeb ? { flex: 1.3 } : { width: 100 }, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={[
                      styles.statusPillFee, 
                      isPaid ? styles.statusPillPaidFee : styles.statusPillPendingFee
                    ]}>
                      <Text style={[
                        styles.statusPillTextFee, 
                        isPaid ? styles.statusPillTextPaidFee : styles.statusPillTextPendingFee
                      ]}>
                        {isPaid ? 'PAID' : 'PENDING'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {filteredFeeDetails.length === 0 && (
              <View style={styles.emptyContainerFee}>
                <Text style={styles.emptyTextFee}>No matching fee records found.</Text>
              </View>
            )}
          </View>
        </ScrollView>
        {renderDetailModal()}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Tabs */}
      <View style={styles.tabContainer}>
        {['Dashboard', 'Income', 'Expenses'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <Text style={{ fontSize: 16, color: '#64748B' }}>Loading {activeTab.toLowerCase()} data...</Text>
        </View>
      ) : (
        <>
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'Income' && renderIncomeTab()}
          {activeTab === 'Expenses' && renderExpensesTab()}
        </>
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
});
