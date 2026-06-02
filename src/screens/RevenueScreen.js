import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, SafeAreaView, ScrollView
} from 'react-native';
import apiClient from '../api/apiClient';

export default function RevenueScreen() {
  const [activeTab, setActiveTab] = useState('Dashboard'); // 'Dashboard', 'Income', 'Expenses'
  const [loading, setLoading] = useState(true);
  
  // Dashboard Data
  const [dashboardData, setDashboardData] = useState(null);
  
  // Income Data
  const [incomes, setIncomes] = useState([]);
  
  // Expense Data
  const [expenses, setExpenses] = useState([]);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Salary'); // Default
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [addingExp, setAddingExp] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'Dashboard') {
        const res = await apiClient.get('/revenue/dashboard');
        setDashboardData(res.data);
      } else if (activeTab === 'Income') {
        const res = await apiClient.get('/fees');
        setIncomes(res.data.filter(f => f.status === 'paid'));
      } else if (activeTab === 'Expenses') {
        const res = await apiClient.get('/revenue/expenses');
        setExpenses(res.data);
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
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>₹{dashboardData.total_income}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <Text style={styles.summaryLabel}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>₹{dashboardData.total_expenses}</Text>
          </View>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#4F46E5', marginBottom: 24 }]}>
          <Text style={styles.summaryLabel}>Net Profit</Text>
          <Text style={[styles.summaryValue, { color: '#4F46E5', fontSize: 28 }]}>
            ₹{dashboardData.net_profit}
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
            <View style={styles.legendItem}><View style={[styles.dot, styles.incBar]}/><Text style={styles.legendText}>Income</Text></View>
            <View style={styles.legendItem}><View style={[styles.dot, styles.expBar]}/><Text style={styles.legendText}>Expense</Text></View>
          </View>
        </View>

        {/* Breakdown Sections */}
        <Text style={styles.sectionTitle}>Revenue by Course</Text>
        <View style={styles.breakdownCard}>
          {dashboardData.course_breakdown.map((item, idx) => (
            <View key={idx} style={styles.breakdownRow}>
              <View style={styles.breakdownInfo}>
                <Text style={styles.breakdownName}>{item.name}</Text>
                <Text style={styles.breakdownAmt}>₹{item.amount}</Text>
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
                <Text style={styles.breakdownAmt}>₹{item.amount}</Text>
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
    <FlatList 
      data={incomes}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      ListEmptyComponent={<Text style={styles.emptyText}>No income records.</Text>}
      renderItem={({item}) => (
        <View style={styles.recordCard}>
          <View style={styles.recLeft}>
            <Text style={styles.recTitle}>{item.user ? item.user.full_name : 'Unknown Student'}</Text>
            <Text style={styles.recSub}>Fee Payment • {item.paid_at ? item.paid_at.substring(0,10) : ''}</Text>
          </View>
          <Text style={[styles.recAmt, {color: '#10B981'}]}>+₹{item.amount}</Text>
        </View>
      )}
    />
  );

  const renderExpensesTab = () => (
    <View style={{flex: 1}}>
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
            style={[styles.input, {flex: 1, marginRight: 8}]} 
            placeholder="Amount" 
            keyboardType="numeric"
            value={expAmount}
            onChangeText={setExpAmount}
          />
          <TextInput 
            style={[styles.input, {flex: 1}]} 
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
        renderItem={({item}) => (
          <View style={styles.recordCard}>
            <View style={styles.recLeft}>
              <Text style={styles.recTitle}>{item.category} {item.description ? `- ${item.description}` : ''}</Text>
              <Text style={styles.recSub}>{item.expense_date}</Text>
            </View>
            <Text style={[styles.recAmt, {color: '#EF4444'}]}>-₹{item.amount}</Text>
          </View>
        )}
      />
    </View>
  );

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
          <ActivityIndicator size="large" color="#4F46E5" />
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
  }
});
