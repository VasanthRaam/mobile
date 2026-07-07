import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Animated,
  Alert, Modal, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import NotificationBar from '../components/NotificationBar';
import apiClient from '../api/apiClient';
import ChatFAB from '../components/ChatFAB';
import { getCache, setCache } from '../utils/cacheManager';
import { useSettingsStore } from '../store/useSettingsStore';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const { user } = useAuthStore();
  const role = user?.role;
  const { theme, isDark } = useThemeStore();

  const [stats, setStats] = useState(getCache('dashboard_stats'));
  const [loading, setLoading] = useState(!getCache('dashboard_stats'));
  const { aiAssistantEnabled, isInitialized, initSettings } = useSettingsStore();

  useEffect(() => {
    if (!isInitialized) {
      initSettings();
    }
  }, [isInitialized]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
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

      const checkFirstTimeWalkthrough = async () => {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const hasSeen = await AsyncStorage.getItem('buddybloom_walkthrough_seen');
          if (hasSeen !== 'true') {
            setShowWalkthrough(true);
          } else {
            setShowWalkthrough(false);
          }
        } catch (e) {
          console.warn('Error checking walkthrough status:', e);
        }
      };
      checkFirstTimeWalkthrough();
    }, [])
  );

  // Walkthrough state
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  useEffect(() => {
    const checkBiometricsPrompt = async () => {
      try {
        const { getBiometricsPrompted, saveBiometricsPrompted, saveBiometricsEnabled } = require('../utils/secureStore');
        const LocalAuthentication = require('expo-local-authentication');

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const alreadyPrompted = await getBiometricsPrompted();
          if (alreadyPrompted !== 'true') {
            Alert.alert(
              'Enable Biometric Login',
              'Would you like to use Face ID or Touch ID for faster login next time?',
              [
                {
                  text: 'No, thanks',
                  onPress: async () => {
                    await saveBiometricsPrompted(true);
                    await saveBiometricsEnabled(false);
                  },
                  style: 'cancel',
                },
                {
                  text: 'Enable',
                  onPress: async () => {
                    const result = await LocalAuthentication.authenticateAsync({
                      promptMessage: 'Confirm identity to enable Biometric Login',
                    });
                    await saveBiometricsPrompted(true);
                    if (result.success) {
                      await saveBiometricsEnabled(true);
                      Alert.alert('Success', 'Biometric login enabled successfully!');
                    } else {
                      await saveBiometricsEnabled(false);
                    }
                  },
                },
              ],
              { cancelable: false }
            );
          }
        }
      } catch (err) {
        console.warn('Error checking biometrics prompt:', err);
      }
    };

    checkBiometricsPrompt();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/dashboard/stats');
      setStats(response.data);
      setCache('dashboard_stats', response.data);
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
        style={[styles.card, { borderLeftColor: color, backgroundColor: theme.card }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.cardSubtitle, { color: theme.subText }]}>{subtitle}</Text>
        </View>
        <Text style={[styles.chevron, { color: theme.muted }]}>→</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderAdminStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>₹{stats?.admin?.total_revenue || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Revenue</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid, { borderColor: theme.border }]}>
        <Text style={[styles.statVal, { color: theme.danger }]}>₹{stats?.admin?.pending_fees || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Pending</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.admin?.total_students || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Students</Text>
      </View>
    </View>
  );

  const renderTeacherStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.teacher?.avg_performance || 0}%</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Avg Perf</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid, { borderColor: theme.border }]}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.teacher?.active_batches || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Batches</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.teacher?.pending_homeworks || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>HW Posts</Text>
      </View>
    </View>
  );

  const renderGenericStats = () => (
    <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.student?.avg_quiz_score || 0}%</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Avg Score</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxMid, { borderColor: theme.border }]}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.student?.completed_quizzes || 0}</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Quizzes</Text>
      </View>
      <View style={styles.statBox}>
        <Text style={[styles.statVal, { color: theme.text }]}>{stats?.student?.attendance_rate || 0}%</Text>
        <Text style={[styles.statLab, { color: theme.subText }]}>Attendance</Text>
      </View>
    </View>
  );

  const logout = useAuthStore(state => state.logout);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.bgDecor1, { backgroundColor: isDark ? theme.accentLight : '#E0E7FF' }]} />
      <View style={[styles.bgDecor2, { backgroundColor: isDark ? theme.successLight : '#F0FDF4' }]} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          {/* Centre: Greeting */}
          <View style={styles.headerCenter}>
            <Text style={[styles.welcomeText, { color: theme.subText }]}>Welcome back 👋</Text>
            <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
              {user?.full_name?.split(' ')[0] || 'User'}
            </Text>
          </View>

          {/* Right: Role Badge */}
          <View style={[styles.roleBadgeHeader, { backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF', borderColor: isDark ? '#4338CA' : '#C7D2FE' }]}>
            <Text style={[styles.roleBadgeText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>{role?.toUpperCase()}</Text>
          </View>
        </View>

        <NotificationBar />

        {loading && !stats ? (
          <View style={[styles.statsContainer, { justifyContent: 'center', backgroundColor: theme.card }]}>
            <Text style={{ color: theme.subText, fontWeight: '600' }}>Loading stats...</Text>
          </View>
        ) : (
          role === 'admin' ? renderAdminStats() :
            role === 'teacher' ? renderTeacherStats() :
              renderGenericStats()
        )}

        {role === 'teacher' && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Operations 📋</Text>
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
              {renderCard(
                'Leave Approvals', '🔔', '#F59E0B',
                () => navigation.navigate('PendingApprovals'),
                'Review student leave requests'
              )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24, color: theme.text }]}>Assessments & Tracking 📈</Text>
            <View style={styles.grid}>
              {renderCard(
                'Create Quiz', '➕', '#10B981',
                () => navigation.navigate('CreateQuiz'),
                'Build new tests and assignments'
              )}
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24, color: theme.text }]}>Management 🎓</Text>
            <View style={styles.grid}>
              {renderCard(
                'Teacher Console', '🖥️', '#7C3AED',
                () => navigation.navigate('TeacherConsole'),
                'Quizzes, analytics, and your students'
              )}
            </View>

          </>
        )}

        {(role === 'student' || role === 'parent' || role === 'admin') && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Access</Text>
            <View style={styles.grid}>
              {renderCard(
                'Attendance', '📅', '#4F46E5',
                () => navigation.navigate('Attendance'),
                'Track your daily presence'
              )}
              {(role === 'student' || role === 'admin') && (
                renderCard(
                  'Fees & Payments', '💸', '#10B981',
                  () => navigation.navigate('Fees'),
                  'Manage your fee records'
                )
              )}
              {role === 'admin' && (
                renderCard(
                  'Revenue Tracker', '📈', '#8B5CF6',
                  () => navigation.navigate('Revenue'),
                  'Income, expenses, and analytics'
                )
              )}
              {role === 'student' && (
                renderCard(
                  'Take a Quiz', '📝', '#F59E0B',
                  () => navigation.navigate('QuizList'),
                  'Challenge your knowledge'
                )
              )}
              {role === 'admin' && (
                renderCard(
                  'Admin Portal', '🛠️', '#F59E0B',
                  () => navigation.navigate('Admin'),
                  'Manage quizzes, results, and students'
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
              {role === 'admin' && (
                renderCard(
                  'Website Enquiries', '📬', '#3B82F6',
                  () => navigation.navigate('Enquiries'),
                  'View and manage website enquiries'
                )
              )}
              {role !== 'admin' && (
                renderCard(
                  role === 'parent' ? "Kid's Results" : "Quiz Results", '📊', '#8B5CF6',
                  () => navigation.navigate('QuizResults'),
                  'Monitor performance metrics'
                )
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

        {/* ── XP Profile & Leaderboard ─────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 8 }]}>⭐ XP System</Text>
        <View style={styles.grid}>
          {renderCard(
            'Leaderboard 🏆', '🏅', '#F59E0B',
            () => navigation.navigate('Leaderboard'),
            'See top students & rewards'
          )}
        </View>

      </ScrollView>
      {aiAssistantEnabled && <ChatFAB />}

      {/* ── First-Time User Walkthrough Overlay (Floating pointers near headers/cards) ───────────────────────── */}
      {showWalkthrough && (
        <Modal
          visible={showWalkthrough}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWalkthrough(false)}
        >
          <View style={styles.walkthroughOverlay}>
            {/* Step 0: Welcome Bubble (Center pointer) */}
            {walkthroughStep === 0 && (
              <View style={[styles.tooltipContainer, { backgroundColor: theme.card, shadowColor: '#000' }]}>
                <Text style={styles.tooltipEmoji}>👋</Text>
                <Text style={[styles.tooltipTitle, { color: theme.text }]}>Welcome to VHA Edutech!</Text>
                <Text style={[styles.tooltipText, { color: theme.subText }]}>Let's take a quick 1-minute tour of your dashboard to help you find your way around.</Text>
                <View style={styles.tooltipFooter}>
                  <TouchableOpacity onPress={() => setShowWalkthrough(false)}>
                    <Text style={{ color: theme.muted, fontSize: 13, fontWeight: '600' }}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tooltipBtn, { backgroundColor: theme.accent }]} onPress={() => setWalkthroughStep(1)}>
                    <Text style={styles.tooltipBtnText}>Start Tour</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 1: Profile Tooltip (Anchored top-left) */}
            {walkthroughStep === 1 && (
              <View style={styles.absoluteTooltipTopLeft}>
                <View style={styles.tooltipArrowUp} />
                <View style={[styles.tooltipContainer, { backgroundColor: theme.card }]}>
                  <Text style={styles.tooltipTitleSmall}>👤 Tap Profile Picture here!</Text>
                  <Text style={[styles.tooltipText, { color: theme.subText, fontSize: 13 }]}>
                    Tap your profile icon in the top left header to view stats, update your picture, or sign out.
                  </Text>
                  <View style={styles.tooltipFooter}>
                    <TouchableOpacity onPress={() => setShowWalkthrough(false)}>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tooltipBtn, { backgroundColor: theme.accent }]} onPress={() => setWalkthroughStep(2)}>
                      <Text style={styles.tooltipBtnText}>Next</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Step 2: Operations/Stats Tooltip (Anchored middle) */}
            {walkthroughStep === 2 && (
              <View style={styles.absoluteTooltipCenter}>
                <View style={[styles.tooltipContainer, { backgroundColor: theme.card }]}>
                  <Text style={styles.tooltipTitleSmall}>📅 Dashboard Operations</Text>
                  <Text style={[styles.tooltipText, { color: theme.subText, fontSize: 13 }]}>
                    Manage quizzes, attendance, fees, and homework assignments right from this operations panel.
                  </Text>
                  <View style={styles.tooltipFooter}>
                    <TouchableOpacity onPress={() => setShowWalkthrough(false)}>
                      <Text style={{ color: theme.muted, fontSize: 12 }}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tooltipBtn, { backgroundColor: theme.accent }]} onPress={() => setWalkthroughStep(3)}>
                      <Text style={styles.tooltipBtnText}>Next</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Step 3: Rewards/Console Tooltip (Anchored lower middle) */}
            {walkthroughStep === 3 && (
              <View style={styles.absoluteTooltipCenter}>
                <View style={[styles.tooltipContainer, { backgroundColor: theme.card }]}>
                  <Text style={styles.tooltipTitleSmall}>🎁 XP & Leaderboards</Text>
                  <Text style={[styles.tooltipText, { color: theme.subText, fontSize: 13 }]}>
                    Students earn XP and compete on the leaderboard! Teachers/Admins can award points using the gift console icon.
                  </Text>
                  <View style={styles.tooltipFooter}>
                    <View />
                    <TouchableOpacity
                      style={[styles.tooltipBtn, { backgroundColor: theme.accent }]}
                      onPress={async () => {
                        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                        await AsyncStorage.setItem('buddybloom_walkthrough_seen', 'true');
                        setShowWalkthrough(false);
                      }}
                    >
                      <Text style={styles.tooltipBtnText}>Got It!</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </Modal>
      )}
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
    padding: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
    gap: 12,
  },
  avatarBtn: {
    position: 'relative',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  headerAvatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  headerCenter: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
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
  },
  walkthroughOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltipContainer: {
    width: 280,
    borderRadius: 20,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tooltipEmoji: {
    fontSize: 32,
    marginBottom: 10,
    textAlign: 'center',
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  tooltipTitleSmall: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  tooltipText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  tooltipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  tooltipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tooltipBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  absoluteTooltipTopLeft: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 95 : 75,
    left: 20,
    zIndex: 9999,
  },
  tooltipArrowUp: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFF',
    marginLeft: 15,
  },
  absoluteTooltipCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
