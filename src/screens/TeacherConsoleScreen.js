import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator, Animated,
  Dimensions, RefreshControl, TextInput, Platform, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { getCache, setCache } from '../utils/cacheManager';

const { width } = Dimensions.get('window');

// ── Loading Rail (same as AdminScreen) ───────────────────────────────────────
const LoadingRail = ({ loading, theme }) => {
  const [animation] = useState(new Animated.Value(0));
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animation, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(animation, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      ).start();
    } else {
      animation.setValue(0);
    }
  }, [loading]);
  if (!loading) return <View style={{ height: 3, backgroundColor: 'transparent' }} />;
  const translateX = animation.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });
  return (
    <View style={{ height: 3, backgroundColor: theme.chipBg, overflow: 'hidden', width: '100%' }}>
      <Animated.View style={{ width: '50%', height: '100%', backgroundColor: theme.accent, transform: [{ translateX }] }} />
    </View>
  );
};

export default function TeacherConsoleScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('quizzes');

  // ── Quizzes Tab ─────────────────────────────────────────────────────────────
  const [quizzes, setQuizzes] = useState(getCache('teacher_quizzes') || []);
  const [quizzesLoading, setQuizzesLoading] = useState(!getCache('teacher_quizzes'));
  const [quizzesRefreshing, setQuizzesRefreshing] = useState(false);

  // ── Performance Tab ─────────────────────────────────────────────────────────
  const [results, setResults] = useState(getCache('teacher_results') || []);
  const [resultsLoading, setResultsLoading] = useState(!getCache('teacher_results'));
  const [resultsRefreshing, setResultsRefreshing] = useState(false);
  const [resultsSubTab, setResultsSubTab] = useState('Scores');

  // ── Students Tab ────────────────────────────────────────────────────────────
  const [students, setStudents] = useState(getCache('teacher_students_list') || []);
  const [studentsLoading, setStudentsLoading] = useState(!getCache('teacher_students_list'));
  const [studentsRefreshing, setStudentsRefreshing] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');
  const [selectedStudentCourse, setSelectedStudentCourse] = useState('all');
  const [studentSortBy, setStudentSortBy] = useState('name');
  const [studentSortOrder, setStudentSortOrder] = useState('asc');

  // Student detail modal (Reconcile)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStats, setStudentStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // ── Reward Modal ─────────────────────────────────────────────────────────────
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [rewardStudents, setRewardStudents] = useState([]);
  const [selectedRewardStudent, setSelectedRewardStudent] = useState(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardReason, setRewardReason] = useState('');
  const [givingReward, setGivingReward] = useState(false);
  const [rewardStudentSearch, setRewardStudentSearch] = useState('');
  const [teacherWalletBalance, setTeacherWalletBalance] = useState(null);
  const [rewardModalLoading, setRewardModalLoading] = useState(false);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'performance') fetchResults();
    else if (activeTab === 'students') fetchStudents();
  }, [activeTab]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedStudentSearch(studentSearch), 300);
    return () => clearTimeout(h);
  }, [studentSearch]);

  // ── Fetchers ─────────────────────────────────────────────────────────────────
  const fetchQuizzes = async () => {
    const cached = getCache('teacher_quizzes');
    if (cached) { setQuizzes(cached); setQuizzesLoading(false); }
    else setQuizzesLoading(true);
    try {
      const res = await apiClient.get('/quizzes');
      setQuizzes(res.data);
      setCache('teacher_quizzes', res.data);
    } catch (e) { console.error('Quizzes fetch error:', e); }
    finally { setQuizzesLoading(false); setQuizzesRefreshing(false); }
  };

  const fetchResults = async () => {
    const cached = getCache('teacher_results');
    if (cached) { setResults(cached); setResultsLoading(false); }
    else setResultsLoading(true);
    try {
      const res = await apiClient.get('/quizzes/results/all');
      setResults(res.data);
      setCache('teacher_results', res.data);
    } catch (e) { console.error('Results fetch error:', e); }
    finally { setResultsLoading(false); setResultsRefreshing(false); }
  };

  const fetchStudents = async () => {
    const cached = getCache('teacher_students_list');
    if (cached) { setStudents(cached); setStudentsLoading(false); }
    else setStudentsLoading(true);
    try {
      const res = await apiClient.get('/students/teacher-students');
      setStudents(res.data);
      setCache('teacher_students_list', res.data);
    } catch (e) { console.error('Students fetch error:', e); }
    finally { setStudentsLoading(false); setStudentsRefreshing(false); }
  };

  // ── Reconcile Student Detail (identical to AdminScreen) ─────────────────────
  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    const optimistic = {
      email: student.email || 'N/A',
      phone: student.phone || 'N/A',
      joinedDate: student.created_at || null,
      attendanceRate: null,
      quizCount: null,
      progressVal: null,
    };
    setStudentStats(optimistic);
    setDetailModalVisible(true);

    const userId = student.user_id;
    if (!userId) return;
    setStatsLoading(true);

    apiClient.get(`/students/summary/${userId}`)
      .then(res => {
        const d = res.data;
        setStudentStats(prev => ({
          ...prev,
          attendanceRate: d.attendance?.rate ?? null,
          quizCount: d.quiz?.count ?? 0,
          progressVal: d.quiz?.avg_pct ?? null,
          joinedDate: d.joined_date ?? prev.joinedDate,
        }));
      })
      .catch(() => {
        setStudentStats(prev => ({
          ...prev,
          attendanceRate: null,
          quizCount: 0,
          progressVal: null,
        }));
      })
      .finally(() => setStatsLoading(false));
  };

  const handleSort = (key) => {
    if (studentSortBy === key) {
      setStudentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setStudentSortBy(key);
      setStudentSortOrder('asc');
    }
  };

  // ── Performance Dashboard Data ───────────────────────────────────────────────
  const getDashboardData = () => {
    if (results.length === 0) return null;
    let totalEarned = 0, totalMax = 0;
    const studentAverages = {};
    const quizStats = {};

    results.forEach(a => {
      totalEarned += a.total_score; totalMax += a.max_score;
      const sName = a.student_name;
      if (!studentAverages[sName]) studentAverages[sName] = { name: sName, earned: 0, max: 0, count: 0 };
      studentAverages[sName].earned += a.total_score;
      studentAverages[sName].max += a.max_score;
      studentAverages[sName].count += 1;
      const qTitle = a.quiz_title;
      if (!quizStats[qTitle]) quizStats[qTitle] = { title: qTitle, earned: 0, max: 0, count: 0 };
      quizStats[qTitle].earned += a.total_score;
      quizStats[qTitle].max += a.max_score;
      quizStats[qTitle].count += 1;
    });

    const classAverage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
    const topStudents = Object.values(studentAverages).map(s => ({
      name: s.name, percentage: s.max > 0 ? (s.earned / s.max) * 100 : 0, count: s.count,
    })).sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    const quizzesSummary = Object.values(quizStats).map(q => ({
      title: q.title, percentage: q.max > 0 ? (q.earned / q.max) * 100 : 0, count: q.count,
    }));
    return { classAverage, totalAttempts: results.length, topStudents, quizzesSummary };
  };

  const getProgressColor = (p) => p >= 75 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444';

  // ── Filtered & Sorted Students ───────────────────────────────────────────────
  const uniqueStudentCourses = useMemo(() => {
    const all = new Set();
    students.forEach(s => s.courses?.forEach(c => all.add(c)));
    return ['all', ...Array.from(all)];
  }, [students]);

  const filteredAndSortedStudents = useMemo(() => {
    let list = [...students];
    const q = debouncedStudentSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(s => {
        const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
        const email = (s.email || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });
    }
    if (selectedStudentCourse !== 'all') {
      list = list.filter(s => s.courses?.includes(selectedStudentCourse));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (studentSortBy === 'name') {
        const na = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        const nb = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
        cmp = na.localeCompare(nb);
      } else {
        cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      return studentSortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [students, debouncedStudentSearch, selectedStudentCourse, studentSortBy, studentSortOrder]);

  // ── Reward Modal Logic ────────────────────────────────────────────────────────
  const openRewardModal = async () => {
    // Phase 1: Render instantly using cached data
    const cachedStuds = getCache('reward_students');
    const cachedWallet = getCache('teacher_wallet');
    if (cachedStuds) {
      setRewardStudents(cachedStuds);
    }
    if (cachedWallet) {
      setTeacherWalletBalance(cachedWallet.remaining_points ?? null);
    }
    setRewardModalVisible(true);
    setRewardModalLoading(true);

    // Phase 2: Fetch background data and reconcile
    try {
      const [studRes, walletRes] = await Promise.all([
        apiClient.get('/rewards/teacher/students'),
        apiClient.get('/rewards/teacher/wallet'),
      ]);
      const studs = studRes.data.students || [];
      const wallet = walletRes.data;
      setRewardStudents(studs);
      setTeacherWalletBalance(wallet.remaining_points ?? null);
      setCache('reward_students', studs);
      setCache('teacher_wallet', wallet);
    } catch (e) {
      if (!cachedStuds) {
        Alert.alert('Error', 'Could not load student list.');
      }
    } finally {
      setRewardModalLoading(false);
    }
  };

  const handleGiveReward = async () => {
    if (!selectedRewardStudent) {
      Alert.alert('Select Student', 'Please choose a student first.');
      return;
    }
    const pts = parseInt(rewardPoints, 10);
    if (!pts || pts <= 0) {
      Alert.alert('Invalid Points', 'Enter a valid points amount.');
      return;
    }
    if (!rewardReason.trim()) {
      Alert.alert('Add Reason', 'Please add a reason for the reward.');
      return;
    }
    if (teacherWalletBalance !== null && pts > teacherWalletBalance) {
      Alert.alert('Insufficient Balance', `You only have ${teacherWalletBalance} pts remaining in your wallet.`);
      return;
    }

    setGivingReward(true);
    try {
      await apiClient.post('/rewards/teacher/give', {
        student_id: selectedRewardStudent.id,
        points: pts,
        reason: rewardReason.trim(),
      });
      Alert.alert('⭐ Points Sent!', `Successfully awarded ${pts} XP to ${selectedRewardStudent.name}!`);
      if (teacherWalletBalance !== null) setTeacherWalletBalance(prev => (prev ?? 0) - pts);
      setRewardModalVisible(false);
      setSelectedRewardStudent(null);
      setRewardPoints('');
      setRewardReason('');
      setRewardStudentSearch('');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Could not award points.';
      Alert.alert('Failed', msg);
    } finally {
      setGivingReward(false);
    }
  };

  const filteredRewardStudents = rewardStudents.filter(s =>
    s.name.toLowerCase().includes(rewardStudentSearch.toLowerCase())
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: QUIZZES TAB
  // ══════════════════════════════════════════════════════════════════════════════
  const renderQuizzesTab = () => {
    if (quizzesLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingLabel, { color: theme.subText }]}>Loading quizzes...</Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={quizzes}
          keyExtractor={i => i.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={quizzesRefreshing} onRefresh={() => { setQuizzesRefreshing(true); fetchQuizzes(); }} tintColor={theme.accent} />}
          renderItem={({ item }) => (
            <View style={[styles.quizCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: theme.accentLight }]}>
                  <Text style={styles.quizIcon}>📝</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: theme.successLight }]}>
                  <Text style={[styles.badgeText, { color: theme.success }]}>ACTIVE</Text>
                </View>
              </View>
              <View style={styles.quizInfo}>
                <Text style={[styles.quizTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.quizDescription, { color: theme.subText }]} numberOfLines={2}>
                  {item.description || 'Test student knowledge and track performance stats.'}
                </Text>
              </View>
              <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
                <View style={styles.statsRow}>
                  <Text style={[styles.statText, { color: theme.subText }]}>❓ {item.questions?.length || 0} Qs</Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => navigation.navigate('QuizResults', { quizId: item.id })}
                >
                  <Text style={styles.actionBtnText}>View Results</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎈</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No quizzes yet.</Text>
            </View>
          }
        />
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={() => navigation.navigate('CreateQuiz')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: PERFORMANCE TAB
  // ══════════════════════════════════════════════════════════════════════════════
  const renderResultItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.resultCard, { backgroundColor: theme.card }]}
      onPress={() => navigation.navigate('SubmissionDetail', { attemptId: item.id })}
    >
      <View style={styles.resultInfo}>
        <Text style={[styles.quizTitle, { color: theme.text, fontSize: 16 }]}>{item.quiz_title}</Text>
        <Text style={[styles.studentNameName, { color: theme.accent }]}>👤 {item.student_name}</Text>
        <Text style={[styles.dateText, { color: theme.muted }]}>📅 {new Date(item.attempted_at).toLocaleDateString()}</Text>
      </View>
      <View style={[styles.scoreContainer, { borderLeftColor: theme.border }]}>
        <Text style={[styles.scoreText, { color: theme.success }]}>
          {item.total_score} <Text style={[styles.maxScore, { color: theme.muted }]}>/ {item.max_score}</Text>
        </Text>
        <Text style={[styles.ptsLabel, { color: theme.muted }]}>Score</Text>
      </View>
      <Text style={[styles.chevron, { color: theme.muted }]}>→</Text>
    </TouchableOpacity>
  );

  const renderDashboard = () => {
    const staffData = getDashboardData();
    if (!staffData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>No stats available yet.</Text>
        </View>
      );
    }
    const avgColor = getProgressColor(staffData.classAverage);
    return (
      <View style={styles.staffDashboard}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderTopColor: avgColor, borderTopWidth: 4, backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Class Average</Text>
            <Text style={[styles.statVal, { color: avgColor }]}>{staffData.classAverage.toFixed(1)}%</Text>
            <View style={[styles.miniProgressBg, { backgroundColor: theme.chipBg }]}>
              <View style={[styles.miniProgressFill, { width: `${staffData.classAverage}%`, backgroundColor: avgColor }]} />
            </View>
          </View>
          <View style={[styles.statBox, { borderTopColor: theme.accent, borderTopWidth: 4, backgroundColor: theme.card }]}>
            <Text style={[styles.statLabel, { color: theme.subText }]}>Total Submissions</Text>
            <Text style={[styles.statVal, { color: theme.accent }]}>{staffData.totalAttempts}</Text>
            <Text style={[styles.statSubText, { color: theme.muted }]}>attempts recorded</Text>
          </View>
        </View>
        <Text style={[styles.dashSectionTitle, { color: theme.text }]}>Top Performers 🌟</Text>
        <View style={[styles.cardSection, { backgroundColor: theme.card }]}>
          {staffData.topStudents.map((s, idx) => (
            <View key={idx} style={[styles.studentLeaderboardRow, { borderBottomColor: theme.border }]}>
              <View style={styles.leaderboardLeft}>
                <Text style={[styles.leaderboardRank, { color: theme.text }, idx === 0 && { color: '#FFD700' }, idx === 1 && { color: '#C0C0C0' }, idx === 2 && { color: '#CD7F32' }]}>#{idx + 1}</Text>
                <Text style={[styles.leaderboardName, { color: theme.text }]}>{s.name}</Text>
              </View>
              <View style={styles.leaderboardRight}>
                <Text style={styles.leaderboardScore}>{s.percentage.toFixed(0)}%</Text>
                <Text style={[styles.leaderboardAttempts, { color: theme.subText }]}>{s.count} quizzes</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.dashSectionTitle, { color: theme.text }]}>Quiz Performance 📋</Text>
        <View style={[styles.cardSection, { backgroundColor: theme.card }]}>
          {staffData.quizzesSummary.map((q, idx) => {
            const color = getProgressColor(q.percentage);
            return (
              <View key={idx} style={styles.quizStatRow}>
                <View style={styles.quizStatHeader}>
                  <Text style={[styles.quizStatTitle, { color: theme.text }]} numberOfLines={1}>{q.title}</Text>
                  <Text style={[styles.quizStatPct, { color }]}>{q.percentage.toFixed(0)}%</Text>
                </View>
                <View style={[styles.progressBg, { backgroundColor: theme.chipBg }]}>
                  <View style={[styles.progressFill, { width: `${q.percentage}%`, backgroundColor: color }]} />
                </View>
                <Text style={[styles.quizStatAttempts, { color: theme.subText }]}>{q.count} submissions</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPerformanceTab = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.subTabContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.subTabBtn, resultsSubTab === 'Scores' && { borderBottomColor: theme.accent }]}
          onPress={() => setResultsSubTab('Scores')}
        >
          <Text style={[styles.subTabBtnText, { color: theme.subText }, resultsSubTab === 'Scores' && { color: theme.accent, fontWeight: '700' }]}>Quiz Scores</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.subTabBtn, resultsSubTab === 'Dashboard' && { borderBottomColor: theme.accent }]}
          onPress={() => setResultsSubTab('Dashboard')}
        >
          <Text style={[styles.subTabBtnText, { color: theme.subText }, resultsSubTab === 'Dashboard' && { color: theme.accent, fontWeight: '700' }]}>Analytics</Text>
        </TouchableOpacity>
      </View>
      {resultsSubTab === 'Scores' ? (
        resultsLoading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={theme.accent} /></View>
        ) : (
          <View style={{ flex: 1 }}>
            <LoadingRail loading={resultsLoading} theme={theme} />
            <FlatList
              showsVerticalScrollIndicator={false}
              data={results}
              keyExtractor={i => i.id}
              renderItem={renderResultItem}
              contentContainerStyle={styles.listContainer}
              refreshControl={<RefreshControl refreshing={resultsRefreshing} onRefresh={() => { setResultsRefreshing(true); fetchResults(); }} tintColor={theme.accent} />}
              ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyEmoji}>📦</Text><Text style={[styles.emptyText, { color: theme.subText }]}>No submissions found.</Text></View>}
            />
          </View>
        )
      ) : (
        <View style={{ flex: 1 }}>
          <LoadingRail loading={resultsLoading} theme={theme} />
          <ScrollView
            contentContainerStyle={styles.dashboardContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={resultsRefreshing} onRefresh={() => { setResultsRefreshing(true); fetchResults(); }} tintColor={theme.accent} />}
          >
            {renderDashboard()}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: STUDENTS TAB (identical layout to AdminScreen)
  // ══════════════════════════════════════════════════════════════════════════════
  const renderStudentRow = ({ item }) => {
    const formattedDate = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'N/A';
    return (
      <TouchableOpacity
        style={[styles.tableRow, { borderBottomColor: theme.border }]}
        onPress={() => handleStudentClick(item)}
      >
        <View style={[styles.tableCol, { flex: 1.5 }]}>
          <Text style={[styles.rowText, { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={[styles.rowSubText, { color: theme.muted }]} numberOfLines={1}>{item.email || 'No Email'}</Text>
        </View>
        <View style={[styles.tableCol, { flex: 1.5 }]}>
          {item.courses?.length > 0 ? (
            <View style={styles.badgeRow}>
              {item.courses.map((c, i) => (
                <View key={i} style={[styles.smallBadge, { backgroundColor: theme.accentLight }]}>
                  <Text style={[styles.smallBadgeText, { color: theme.accent }]} numberOfLines={1}>{c}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.rowText, { color: theme.muted, fontStyle: 'italic' }]}>Unenrolled</Text>
          )}
        </View>
        <View style={[styles.tableCol, { flex: 1, alignItems: 'flex-end' }]}>
          <Text style={[styles.rowText, { color: theme.subText, fontSize: 13 }]}>{formattedDate}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStudentsTab = () => {
    if (studentsLoading) {
      return (<View style={styles.centered}><ActivityIndicator size="large" color={theme.accent} /><Text style={[styles.loadingLabel, { color: theme.subText, marginTop: 12 }]}>Loading students...</Text></View>);
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Search & Filter Card */}
        <View style={[styles.studentFilterCard, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={[styles.studentSearchWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.studentSearchInput, { color: theme.text }]}
              placeholder="Search by name, email or phone..."
              placeholderTextColor={theme.muted}
              value={studentSearch}
              onChangeText={setStudentSearch}
            />
            {studentSearch !== '' && (
              <TouchableOpacity onPress={() => setStudentSearch('')}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.studentFilterLabel, { color: theme.subText }]}>Filter by Course</Text>
            <FlatList
              horizontal
              data={uniqueStudentCourses}
              keyExtractor={i => i}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedStudentCourse === item;
                return (
                  <TouchableOpacity
                    style={[styles.studentFilterChip, { backgroundColor: theme.chipBg, borderColor: theme.border }, isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setSelectedStudentCourse(item)}
                  >
                    <Text style={[styles.studentFilterChipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>
                      {item === 'all' ? 'All Courses' : item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>

        {/* Table Header */}
        <View style={[styles.tableHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={[styles.tableCol, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]} onPress={() => handleSort('name')} activeOpacity={0.7}>
            <Text style={[styles.headerColText, { color: theme.subText }]}>Student</Text>
            {studentSortBy === 'name' && <Ionicons name={studentSortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} color={theme.accent} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
          <View style={[styles.tableCol, { flex: 1.5 }]}>
            <Text style={[styles.headerColText, { color: theme.subText }]}>Courses</Text>
          </View>
          <TouchableOpacity style={[styles.tableCol, { flex: 1, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' }]} onPress={() => handleSort('date')} activeOpacity={0.7}>
            <Text style={[styles.headerColText, { color: theme.subText }]}>Joined</Text>
            {studentSortBy === 'date' && <Ionicons name={studentSortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} color={theme.accent} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        </View>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={filteredAndSortedStudents}
          keyExtractor={i => i.id}
          renderItem={renderStudentRow}
          contentContainerStyle={{ paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={studentsRefreshing} onRefresh={() => { setStudentsRefreshing(true); fetchStudents(); }} tintColor={theme.accent} />}
          ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyEmoji}>👥</Text><Text style={[styles.emptyText, { color: theme.subText }]}>No students in your batches.</Text></View>}
        />
      </View>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: STUDENT DETAIL MODAL (identical to AdminScreen)
  // ══════════════════════════════════════════════════════════════════════════════
  const renderShimmerStat = () => (
    <View style={styles.shimmerContainer}>
      <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%' }]} />
      <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '90%', height: 16 }]} />
    </View>
  );

  const renderStudentDetailModal = () => {
    if (!selectedStudent || !studentStats) return null;
    const formattedJoinDate = studentStats.joinedDate
      ? new Date(studentStats.joinedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    return (
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Student Details</Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.chipBg }]} onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Avatar */}
              <View style={styles.avatarSection}>
                {selectedStudent.profile_picture ? (
                  <Image source={{ uri: selectedStudent.profile_picture }} style={styles.avatarImageLarge} />
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: theme.accent }]}>
                    <Text style={styles.avatarLetter}>{selectedStudent.first_name?.[0]?.toUpperCase() || 'S'}</Text>
                  </View>
                )}
                <Text style={[styles.detailName, { color: theme.text }]}>{selectedStudent.first_name} {selectedStudent.last_name}</Text>
                <Text style={[styles.detailRole, { color: theme.accent }]}>Student Profile</Text>
              </View>

              {/* Basic Info */}
              <View style={[styles.infoSection, { borderBottomColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={theme.muted} />
                  <Text style={[styles.infoText, { color: theme.text }]}>{studentStats.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={18} color={theme.muted} />
                  <Text style={[styles.infoText, { color: theme.text }]}>{studentStats.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={18} color={theme.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoTextSub, { color: theme.muted }]}>Joined VHA EduTech</Text>
                    <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{formattedJoinDate}</Text>
                  </View>
                </View>
                {selectedStudent.date_of_birth && (
                  <View style={styles.infoRow}>
                    <Ionicons name="gift-outline" size={18} color={theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoTextSub, { color: theme.muted }]}>Date of Birth</Text>
                      <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{new Date(selectedStudent.date_of_birth).toLocaleDateString()}</Text>
                    </View>
                  </View>
                )}
                {selectedStudent.education_qualification && (
                  <View style={styles.infoRow}>
                    <Ionicons name="school-outline" size={18} color={theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoTextSub, { color: theme.muted }]}>Qualification / Standard</Text>
                      <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{selectedStudent.education_qualification}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Parent Details */}
              {(selectedStudent.mother_name || selectedStudent.father_name || selectedStudent.parent_phone_number) && (
                <View style={[styles.infoSection, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: 12 }]}>Parent Details</Text>
                  {selectedStudent.mother_name && (
                    <View style={styles.infoRow}>
                      <Ionicons name="woman-outline" size={18} color={theme.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTextSub, { color: theme.muted }]}>Mother's Name</Text>
                        <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{selectedStudent.mother_name}</Text>
                      </View>
                    </View>
                  )}
                  {selectedStudent.father_name && (
                    <View style={styles.infoRow}>
                      <Ionicons name="man-outline" size={18} color={theme.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTextSub, { color: theme.muted }]}>Father's Name</Text>
                        <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{selectedStudent.father_name}</Text>
                      </View>
                    </View>
                  )}
                  {selectedStudent.parent_phone_number && (
                    <View style={styles.infoRow}>
                      <Ionicons name="call-outline" size={18} color={theme.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoTextSub, { color: theme.muted }]}>Parent's Phone</Text>
                        <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{selectedStudent.parent_phone_number}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Performance Stats */}
              <View style={styles.statsSection}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Academy Performance Summary</Text>
                {statsLoading && studentStats.attendanceRate === null ? (
                  <View style={{ gap: 15, marginTop: 10 }}>
                    {renderShimmerStat()}
                    {renderShimmerStat()}
                  </View>
                ) : (
                  <View style={{ gap: 18, marginTop: 10 }}>
                    <View>
                      <View style={styles.statLabelRow}>
                        <Text style={[styles.statLabelText, { color: theme.subText }]}>Attendance Rate</Text>
                        <Text style={[styles.statValueText, { color: theme.success, fontWeight: '700' }]}>
                          {studentStats.attendanceRate !== null ? `${studentStats.attendanceRate}%` : 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.progressBg, { backgroundColor: theme.chipBg, height: 10, borderRadius: 5 }]}>
                        <View style={[styles.progressFill, { width: `${studentStats.attendanceRate ?? 0}%`, backgroundColor: getProgressColor(studentStats.attendanceRate ?? 0), height: 10, borderRadius: 5 }]} />
                      </View>
                    </View>
                    <View>
                      <View style={styles.statLabelRow}>
                        <Text style={[styles.statLabelText, { color: theme.subText }]}>Average Quiz Score</Text>
                        <Text style={[styles.statValueText, { color: theme.accent, fontWeight: '700' }]}>
                          {studentStats.progressVal !== null ? `${studentStats.progressVal}%` : 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.progressBg, { backgroundColor: theme.chipBg, height: 10, borderRadius: 5 }]}>
                        <View style={[styles.progressFill, { width: `${studentStats.progressVal ?? 0}%`, backgroundColor: getProgressColor(studentStats.progressVal ?? 0), height: 10, borderRadius: 5 }]} />
                      </View>
                    </View>
                    <View style={[styles.pillStatBox, { backgroundColor: theme.chipBg }]}>
                      <Text style={[styles.pillStatLabel, { color: theme.muted }]}>Total Quizzes Attempted</Text>
                      <Text style={[styles.pillStatValue, { color: theme.text }]}>{studentStats.quizCount !== null ? studentStats.quizCount : 'N/A'}</Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER: REWARD MODAL (same as AdminScreen, but shows wallet balance)
  // ══════════════════════════════════════════════════════════════════════════════
  const renderRewardModal = () => (
    <Modal visible={rewardModalVisible} transparent animationType="slide" onRequestClose={() => setRewardModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '85%' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>🎁 Reward Student</Text>
              {teacherWalletBalance !== null && (
                <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>Wallet: ⭐ {teacherWalletBalance} pts remaining</Text>
              )}
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.chipBg }]} onPress={() => setRewardModalVisible(false)}>
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
          <LoadingRail loading={rewardModalLoading} theme={theme} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Student Search */}
            <View>
              <Text style={[styles.rewardLabel, { color: theme.subText }]}>Select Student</Text>
              <View style={[styles.studentSearchWrapper, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={16} color={theme.muted} style={{ marginRight: 6 }} />
                <TextInput
                  style={[styles.studentSearchInput, { color: theme.text }]}
                  placeholder="Search students..."
                  placeholderTextColor={theme.muted}
                  value={rewardStudentSearch}
                  onChangeText={setRewardStudentSearch}
                />
              </View>
              <View style={{ maxHeight: 160, marginTop: 8 }}>
                <FlatList
                  data={filteredRewardStudents}
                  keyExtractor={s => s.id}
                  nestedScrollEnabled
                  renderItem={({ item: s }) => (
                    <TouchableOpacity
                      style={[styles.rewardStudentRow, { borderColor: theme.border }, selectedRewardStudent?.id === s.id && { borderColor: theme.accent, backgroundColor: theme.accentLight }]}
                      onPress={() => setSelectedRewardStudent(s)}
                    >
                      {s.profile_picture ? (
                        <Image source={{ uri: s.profile_picture }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      ) : (
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent + '20', justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>{s.name?.[0] || '?'}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{s.name}</Text>
                        <Text style={{ color: theme.subText, fontSize: 11 }}>⭐ {s.current_points?.toLocaleString() || 0} pts</Text>
                      </View>
                      {selectedRewardStudent?.id === s.id && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', padding: 12 }}>No students found</Text>}
                />
              </View>
            </View>

            {/* Points Input */}
            <View>
              <Text style={[styles.rewardLabel, { color: theme.subText }]}>
                Points {teacherWalletBalance !== null ? `(Max: ${teacherWalletBalance})` : ''}
              </Text>
              <TextInput
                style={[styles.rewardInput, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border }]}
                value={rewardPoints}
                onChangeText={setRewardPoints}
                keyboardType="number-pad"
                placeholder="e.g. 50"
                placeholderTextColor={theme.muted}
              />
            </View>

            {/* Reason Input */}
            <View>
              <Text style={[styles.rewardLabel, { color: theme.subText }]}>Reason</Text>
              <TextInput
                style={[styles.rewardInput, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.border, minHeight: 70, textAlignVertical: 'top' }]}
                value={rewardReason}
                onChangeText={setRewardReason}
                placeholder="e.g. Excellent participation in class"
                placeholderTextColor={theme.muted}
                multiline
              />
            </View>

            {/* Give Button */}
            <TouchableOpacity
              style={[styles.rewardGiveBtn, { backgroundColor: theme.accent, opacity: givingReward ? 0.6 : 1 }]}
              onPress={handleGiveReward}
              disabled={givingReward}
            >
              {givingReward ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>⭐ Award Points</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Teacher Console</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.mainTabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {[
          { key: 'quizzes', icon: 'document-text-outline', label: 'Quizzes' },
          { key: 'performance', icon: 'stats-chart-outline', label: 'Performance' },
          { key: 'students', icon: 'people-outline', label: 'Students' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.mainTabBtn, activeTab === t.key && { borderBottomColor: theme.accent }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons name={t.icon} size={20} color={activeTab === t.key ? theme.accent : theme.muted} />
            <Text style={[styles.mainTabLabel, { color: theme.subText }, activeTab === t.key && { color: theme.accent, fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'quizzes' && renderQuizzesTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
        {activeTab === 'students' && renderStudentsTab()}
      </View>

      {/* Reward FAB (Students tab only) */}
      {activeTab === 'students' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#F59E0B', right: 20, bottom: 20 }]}
          onPress={openRewardModal}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>🎁</Text>
        </TouchableOpacity>
      )}

      {renderStudentDetailModal()}
      {renderRewardModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  mainTabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingTop: 4 },
  mainTabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  mainTabLabel: { fontSize: 14, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 8 },
  loadingLabel: { fontSize: 14, fontWeight: '600' },
  listContainer: { padding: 20, paddingBottom: 80 },
  dashboardContainer: { padding: 20, paddingBottom: 40 },

  // ── Quizzes ──────────────────────────────────────────────────────────────────
  quizCard: { borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  quizIcon: { fontSize: 22 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  quizInfo: { marginBottom: 16 },
  quizTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  quizDescription: { fontSize: 13, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statText: { fontSize: 12, fontWeight: '600' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 6 },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', fontWeight: '600' },

  // ── Performance Dashboard ─────────────────────────────────────────────────────
  subTabContainer: { flexDirection: 'row', borderBottomWidth: 1 },
  subTabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  subTabBtnText: { fontSize: 13, fontWeight: '600' },
  staffDashboard: { gap: 0 },
  statBox: { flex: 1, borderRadius: 16, padding: 16, gap: 6 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 28, fontWeight: '800' },
  statSubText: { fontSize: 10 },
  miniProgressBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  miniProgressFill: { height: 6, borderRadius: 3 },
  dashSectionTitle: { fontSize: 15, fontWeight: '700', marginVertical: 14 },
  cardSection: { borderRadius: 16, padding: 16 },
  studentLeaderboardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  leaderboardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  leaderboardRank: { fontSize: 16, fontWeight: '800', width: 30 },
  leaderboardName: { fontSize: 14, fontWeight: '600', flex: 1 },
  leaderboardRight: { alignItems: 'flex-end' },
  leaderboardScore: { fontSize: 16, fontWeight: '800', color: '#6366F1' },
  leaderboardAttempts: { fontSize: 11 },
  quizStatRow: { marginBottom: 16 },
  quizStatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quizStatTitle: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  quizStatPct: { fontSize: 14, fontWeight: '700' },
  progressBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  quizStatAttempts: { fontSize: 11, marginTop: 4 },
  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 12 },
  resultInfo: { flex: 1 },
  studentNameName: { fontSize: 13, marginTop: 4 },
  dateText: { fontSize: 11, marginTop: 4 },
  scoreContainer: { borderLeftWidth: 1, paddingLeft: 12, alignItems: 'center', minWidth: 70 },
  scoreText: { fontSize: 20, fontWeight: '800' },
  maxScore: { fontSize: 13 },
  ptsLabel: { fontSize: 10, marginTop: 2 },
  chevron: { fontSize: 18, marginLeft: 8 },

  // ── Students Table ────────────────────────────────────────────────────────────
  studentFilterCard: { padding: 16, borderBottomWidth: 1 },
  studentSearchWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, height: 48 },
  studentSearchInput: { flex: 1, height: '100%', fontSize: 14 },
  studentFilterLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 12, letterSpacing: 0.5 },
  studentFilterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8, borderWidth: 1 },
  studentFilterChipText: { fontSize: 12, fontWeight: '600' },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, alignItems: 'center' },
  tableCol: { justifyContent: 'center' },
  headerColText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowText: { fontSize: 14 },
  rowSubText: { fontSize: 11, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  smallBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  smallBadgeText: { fontSize: 10, fontWeight: '600' },

  // ── Student Detail Modal ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalScrollContent: { padding: 20, paddingBottom: 32 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarImageLarge: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, borderWidth: 3, borderColor: '#6366F1' },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '800' },
  detailName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  detailRole: { fontSize: 13, fontWeight: '600' },
  infoSection: { borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoText: { fontSize: 14, flex: 1 },
  infoTextSub: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  sectionHeading: { fontSize: 15, fontWeight: '700' },
  statsSection: { gap: 12 },
  statLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statLabelText: { fontSize: 13 },
  statValueText: { fontSize: 14 },
  pillStatBox: { borderRadius: 12, padding: 14, alignItems: 'center' },
  pillStatLabel: { fontSize: 12 },
  pillStatValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  shimmerContainer: { gap: 6 },
  shimmerLine: { height: 12, borderRadius: 4 },

  // ── Reward Modal ──────────────────────────────────────────────────────────────
  rewardLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  rewardInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  rewardStudentRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1.5, borderRadius: 12, marginBottom: 6 },
  rewardGiveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
