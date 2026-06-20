import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ScrollView
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
      
      return true;
    });
  }, [fees, selectedCourseId, selectedBatchId, selectedStatus]);

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

  const availableBatchesForFilter = React.useMemo(() => {
    if (selectedCourseId === 'all' || selectedCourseId === 'unassigned') return [];
    const course = coursesWithBatches.find(c => c.id === selectedCourseId);
    return course ? course.batches : [];
  }, [coursesWithBatches, selectedCourseId]);

  const renderFeeDetailsTab = () => {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
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

        {/* Filter Section Card */}
        <View style={styles.filterCardFee}>
          {/* Course filter chips */}
          <Text style={styles.filterGroupTitleFee}>Course</Text>
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

        {/* Table/Data List */}
        <View style={styles.tableCardFee}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderFee}>
            <Text style={[styles.thTextFee, { flex: 2 }]}>STUDENT</Text>
            <Text style={[styles.thTextFee, { flex: 1.8 }]}>COURSE/BATCH</Text>
            <Text style={[styles.thTextFee, { flex: 1.2, textAlign: 'right' }]}>AMOUNT</Text>
            <Text style={[styles.thTextFee, { flex: 1.2, textAlign: 'center' }]}>STATUS</Text>
          </View>

          <FlatList
            data={filteredFeeDetails}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainerFee}>
                <Text style={styles.emptyTextFee}>No matching fee records found.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const studentName = item.user?.full_name || 'Unknown Student';
              const studentInitials = studentName.substring(0, 2).toUpperCase();
              const courseName = item.course?.name || 'Direct';
              const batchName = item.batch?.name || 'Unassigned';
              const isPaid = item.status === 'paid';
              
              return (
                <View style={styles.tableRowFee}>
                  {/* Student info column */}
                  <View style={[styles.tdFee, { flex: 2, flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={styles.avatarMiniFee}>
                      <Text style={styles.avatarMiniTextFee}>{studentInitials}</Text>
                    </View>
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={styles.studentNameFee} numberOfLines={1}>{studentName}</Text>
                      <Text style={styles.studentEmailFee} numberOfLines={1}>{item.user?.email || ''}</Text>
                    </View>
                  </View>

                  {/* Course/Batch info column */}
                  <View style={[styles.tdFee, { flex: 1.8, justifyContent: 'center' }]}>
                    <Text style={styles.courseNameFee} numberOfLines={1}>{courseName}</Text>
                    <Text style={styles.batchNameFee} numberOfLines={1}>{batchName}</Text>
                  </View>

                  {/* Amount column */}
                  <View style={[styles.tdFee, { flex: 1.2, justifyContent: 'center', alignItems: 'flex-end' }]}>
                    <Text style={styles.amountFee}>₹{item.amount}</Text>
                  </View>

                  {/* Status column */}
                  <View style={[styles.tdFee, { flex: 1.2, justifyContent: 'center', alignItems: 'center' }]}>
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
                </View>
              );
            }}
          />
        </View>
      </View>
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
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  },
  studentEmailFee: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
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
});
