import React, { useEffect, useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, SafeAreaView, Dimensions, Animated,
  ActivityIndicator, Alert
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import NotificationBar from '../components/NotificationBar';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user } = useAuthStore();
  const role = user?.role;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fetchStats();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (type) => {
    Alert.alert("Success", `${type} reminder sent to all pending parents! 🔔`);
  };

  const renderCard = (title, icon, color, onPress, subtitle) => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity 
        style={[styles.card, { borderLeftColor: color }]} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAdminStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>₹{stats?.admin?.total_revenue || 0}</Text>
        <Text style={styles.statLab}>Revenue</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid]}>
        <Text style={[styles.statVal, { color: '#EF4444' }]}>₹{stats?.admin?.pending_fees || 0}</Text>
        <Text style={styles.statLab}>Pending</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>{stats?.admin?.total_students || 0}</Text>
        <Text style={styles.statLab}>Students</Text>
      </View>
    </View>
  );

  const renderTeacherStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>{stats?.teacher?.avg_performance || 0}%</Text>
        <Text style={styles.statLab}>Avg Perf</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid]}>
        <Text style={styles.statVal}>{stats?.teacher?.active_batches || 0}</Text>
        <Text style={styles.statLab}>Batches</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>{stats?.teacher?.pending_homeworks || 0}</Text>
        <Text style={styles.statLab}>HW Posts</Text>
      </View>
    </View>
  );

  const renderGenericStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>85%</Text>
        <Text style={styles.statLab}>Progress</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid]}>
        <Text style={styles.statVal}>12</Text>
        <Text style={styles.statLab}>Quizzes</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={styles.statVal}>98%</Text>
        <Text style={styles.statLab}>Attendance</Text>
      </View>
    </View>
  );

  const logout = useAuthStore(state => state.logout);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgDecor1} />
      <View style={styles.bgDecor2} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Academy Hub</Text>
            <Text style={styles.nameText}>{user?.full_name || 'Teacher'} 👋</Text>
          </View>
          <View style={styles.roleBadgeHeader}>
            <Text style={styles.roleBadgeText}>{role?.toUpperCase()}</Text>
          </View>
        </View>

        <NotificationBar />

        {loading ? (
          <View style={[styles.statsContainer, { justifyContent: 'center' }]}>
            <ActivityIndicator color="#4F46E5" />
          </View>
        ) : (
          role === 'admin' ? renderAdminStats() : 
          role === 'teacher' ? renderTeacherStats() : 
          renderGenericStats()
        )}

        {role === 'teacher' && (
          <>
            <View style={styles.perfSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Weekly Engagement 📊</Text>
                <Text style={styles.viewAllText}>Live View</Text>
              </View>
              
              <View style={styles.chartContainer}>
                <View style={styles.chartYAxis}>
                  <Text style={styles.yAxisText}>100%</Text>
                  <Text style={styles.yAxisText}>50%</Text>
                  <Text style={styles.yAxisText}>0%</Text>
                </View>
                
                <View style={styles.chartContent}>
                  {[
                    { day: 'Mon', val: 65, color: '#6366F1' },
                    { day: 'Tue', val: 82, color: '#8B5CF6' },
                    { day: 'Wed', val: 45, color: '#EC4899' },
                    { day: 'Thu', val: 91, color: '#10B981' },
                    { day: 'Fri', val: 75, color: '#F59E0B' },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.barWrapper}>
                      <View style={[styles.barValue, { bottom: `${item.val}%` }]}>
                        <Text style={styles.barValueText}>{item.val}%</Text>
                      </View>
                      <View style={[styles.bar, { height: `${item.val}%`, backgroundColor: item.color }]}>
                        <View style={styles.barHighlight} />
                      </View>
                      <Text style={styles.barLabel}>{item.day}</Text>
                    </View>
                  ))}
                </View>
              </View>
              
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: '#6366F1' }]} />
                  <Text style={styles.legendText}>Avg Performance</Text>
                </View>
                <Text style={styles.chartNote}>* Based on recent quiz attempts</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Daily Operations 📋</Text>
            <View style={styles.grid}>
              {renderCard(
                'Mark Attendance', '✅', '#6366F1', 
                () => navigation.navigate('Attendance'),
                'Check in your students for today'
              )}
              {renderCard(
                'Assign Homework', '📚', '#EC4899', 
                () => navigation.navigate('AssignHomework'),
                'Send new tasks to students/batches'
              )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Assessments & Tracking 📈</Text>
            <View style={styles.grid}>
              {renderCard(
                'Create Quiz', '➕', '#10B981', 
                () => navigation.navigate('CreateQuiz'),
                'Build new tests and assignments'
              )}
              {renderCard(
                'View All Quizzes', '📝', '#F59E0B', 
                () => navigation.navigate('QuizList'),
                'Manage existing questionnaires'
              )}
              {renderCard(
                'Performance Results', '📊', '#8B5CF6', 
                () => navigation.navigate('QuizResults'),
                'Analyze student marks and trends'
              )}
            </View>

          </>
        )}

        {(role === 'student' || role === 'parent' || role === 'admin') && (
          <>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.grid}>
              {renderCard(
                'Attendance', '📅', '#4F46E5', 
                () => navigation.navigate('Attendance'),
                'Track your daily presence'
              )}
              {(role === 'student' || role === 'admin') && (
                renderCard(
                  role === 'student' ? 'Take a Quiz' : 'View Quizzes', '📝', '#F59E0B', 
                  () => navigation.navigate('QuizList'),
                  'Challenge your knowledge'
                )
              )}
              {role === 'student' && (
                renderCard(
                  'My Homework', '📚', '#EC4899', 
                  () => navigation.navigate('HomeworkList'),
                  'View and submit your assignments'
                )
              )}
              {role === 'admin' && (
                renderCard(
                  'Create Quiz', '➕', '#10B981', 
                  () => navigation.navigate('CreateQuiz'),
                  'Design new assessments'
                )
              )}
              {role === 'admin' && (
                renderCard(
                  'Pending Approvals', '🔔', '#EF4444', 
                  () => navigation.navigate('PendingApprovals'),
                  'Review new registration requests'
                )
              )}
              {renderCard(
                role === 'parent' ? "Kid's Results" : "Quiz Results", '📊', '#8B5CF6', 
                () => navigation.navigate('QuizResults'),
                'Monitor performance metrics'
              )}
              {role === 'student' && (
                renderCard(
                  'My Courses', '🏛️', '#10B981', 
                  () => navigation.navigate('MyCourses'),
                  'Enrolled programs and batches'
                )
              )}
            </View>
          </>
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
  bgDecor1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E0E7FF',
    opacity: 0.5,
  },
  bgDecor2: {
    position: 'absolute',
    bottom: 100,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F0FDF4',
    opacity: 0.5,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    marginTop: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  nameText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  roleBadgeHeader: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#4F46E5',
    letterSpacing: 0.5,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#F1F5F9',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  statLab: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 20,
  },
  grid: {
    gap: 16,
    marginBottom: 40,
  },
  adminActionRow: {
    marginBottom: 32,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  perfSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  viewAllText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 180,
    marginTop: 10,
  },
  chartYAxis: {
    justifyContent: 'space-between',
    paddingBottom: 25,
    marginRight: 10,
  },
  yAxisText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  chartContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 5,
  },
  barWrapper: {
    alignItems: 'center',
    width: 40,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  barHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  barLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '700',
  },
  barValue: {
    position: 'absolute',
    alignItems: 'center',
    width: 40,
  },
  barValueText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  chartNote: {
    fontSize: 10,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIcon: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  mockGraphLabel: {
    position: 'absolute',
    bottom: -25,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  }
});
