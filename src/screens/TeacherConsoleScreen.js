import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // ── Students Tab ────────────────────────────────────────────────────────────
  const [students, setStudents] = useState(getCache('teacher_students_list') || []);
  const [studentsLoading, setStudentsLoading] = useState(!getCache('teacher_students_list'));
  const [studentsRefreshing, setStudentsRefreshing] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Student detail modal (Reconcile)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStats, setStudentStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'performance') fetchResults();
    else if (activeTab === 'students') fetchStudents();
  }, [activeTab]);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(studentSearch), 300);
    return () => clearTimeout(h);
  }, [studentSearch]);

  // ── Fetchers ────────────────────────────────────────────────────────────────
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

  // ── Reconcile Student Detail ────────────────────────────────────────────────
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

  // ── Performance Dashboard Data ──────────────────────────────────────────────
  const getDashboardData = () => {
    if (results.length === 0) return null;
    let totalEarned = 0, totalMax = 0;
    const studentAverages = {};
    const quizStats = {};

    results.forEach(a => {
      totalEarned += a.total_score;
      totalMax += a.max_score;
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

  // ── Filtered Students ───────────────────────────────────────────────────────
  const filteredStudents = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s => {
      const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const email = (s.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [students, debouncedSearch]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER SECTIONS
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Quizzes Tab ─────────────────────────────────────────────────────────────
  const renderQuizzesTab = () => {
    if (quizzesLoading) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accent} /><Text style={[styles.loadingLabel, { color: theme.subText }]}>Loading quizzes...</Text></View>;
    }
    return (
      <FlatList
        data={quizzes}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={quizzesRefreshing} onRefresh={() => { setQuizzesRefreshing(true); fetchQuizzes(); }} tintColor={theme.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.quizCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => navigation.navigate('QuizResults', { quizId: item.id })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.quizIconBox, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                <Text style={{ fontSize: 20 }}>📝</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.quizTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={{ color: theme.subText, fontSize: 12 }}>{item.questions?.length || 0} questions</Text>
              </View>
              <View style={[styles.activeBadge, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
                <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '700' }}>ACTIVE</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.centered}><Text style={{ fontSize: 36 }}>🎈</Text><Text style={{ color: theme.subText }}>No quizzes yet.</Text></View>}
      />
    );
  };

  // ── Performance Tab ─────────────────────────────────────────────────────────
  const renderPerformanceTab = () => {
    if (resultsLoading) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accent} /><Text style={[styles.loadingLabel, { color: theme.subText }]}>Loading analytics...</Text></View>;
    }
    const data = getDashboardData();
    if (!data) {
      return <View style={styles.centered}><Text style={{ fontSize: 36 }}>📊</Text><Text style={{ color: theme.subText }}>No performance data yet.</Text></View>;
    }
    const avgColor = getProgressColor(data.classAverage);
    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={resultsRefreshing} onRefresh={() => { setResultsRefreshing(true); fetchResults(); }} tintColor={theme.accent} />}
      >
        {/* Summary Cards */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderTopColor: avgColor }]}>
            <Text style={{ color: theme.subText, fontSize: 11, fontWeight: '600' }}>Class Average</Text>
            <Text style={{ color: avgColor, fontSize: 28, fontWeight: '800' }}>{data.classAverage.toFixed(1)}%</Text>
            <View style={[styles.miniBar, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
              <View style={[styles.miniBarFill, { width: `${data.classAverage}%`, backgroundColor: avgColor }]} />
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card, borderTopColor: theme.accent }]}>
            <Text style={{ color: theme.subText, fontSize: 11, fontWeight: '600' }}>Total Submissions</Text>
            <Text style={{ color: theme.accent, fontSize: 28, fontWeight: '800' }}>{data.totalAttempts}</Text>
            <Text style={{ color: theme.muted, fontSize: 10 }}>attempts recorded</Text>
          </View>
        </View>

        {/* Top Performers */}
        <Text style={[styles.dashTitle, { color: theme.text }]}>Top Performers 🌟</Text>
        <View style={[styles.dashCard, { backgroundColor: theme.card }]}>
          {data.topStudents.map((s, idx) => (
            <View key={idx} style={[styles.leaderRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.leaderRank, idx === 0 && { color: '#FFD700' }, idx === 1 && { color: '#C0C0C0' }, idx === 2 && { color: '#CD7F32' }, { color: theme.text }]}>#{idx + 1}</Text>
              <Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>{s.name}</Text>
              <Text style={{ color: theme.accent, fontWeight: '700' }}>{s.percentage.toFixed(0)}%</Text>
            </View>
          ))}
        </View>

        {/* Quiz-wise Performance */}
        <Text style={[styles.dashTitle, { color: theme.text }]}>Quiz Performance 📋</Text>
        <View style={[styles.dashCard, { backgroundColor: theme.card }]}>
          {data.quizzesSummary.map((q, idx) => {
            const color = getProgressColor(q.percentage);
            return (
              <View key={idx} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{q.title}</Text>
                  <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{q.percentage.toFixed(0)}%</Text>
                </View>
                <View style={[styles.miniBar, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <View style={[styles.miniBarFill, { width: `${q.percentage}%`, backgroundColor: color }]} />
                </View>
                <Text style={{ color: theme.subText, fontSize: 10, marginTop: 2 }}>{q.count} submissions</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // ── Students Tab ────────────────────────────────────────────────────────────
  const renderStudentsTab = () => {
    if (studentsLoading) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={theme.accent} /><Text style={[styles.loadingLabel, { color: theme.subText }]}>Loading students...</Text></View>;
    }
    return (
      <View style={{ flex: 1 }}>
        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <View style={[styles.searchInput, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Ionicons name="search-outline" size={16} color={theme.muted} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, color: theme.text, fontSize: 14 }}
              placeholder="Search by name or email..."
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
        </View>

        <FlatList
          data={filteredStudents}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={studentsRefreshing} onRefresh={() => { setStudentsRefreshing(true); fetchStudents(); }} tintColor={theme.accent} />}
          renderItem={({ item }) => {
            const name = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Student';
            const joined = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '';
            return (
              <TouchableOpacity
                style={[styles.studentRow, { borderBottomColor: theme.border }]}
                onPress={() => handleStudentClick(item)}
              >
                {item.profile_picture ? (
                  <Image source={{ uri: item.profile_picture }} style={styles.studentAvatar} />
                ) : (
                  <View style={[styles.studentAvatar, { backgroundColor: isDark ? '#334155' : '#E0E7FF', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 14 }}>{name[0]?.toUpperCase() || '?'}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{name}</Text>
                  <Text style={{ color: theme.subText, fontSize: 11 }}>{item.email || 'No email'}</Text>
                </View>
                {item.courses?.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', maxWidth: 120 }}>
                    {item.courses.slice(0, 2).map((c, i) => (
                      <View key={i} style={[styles.courseBadge, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                        <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '600' }} numberOfLines={1}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={{ color: theme.muted, fontSize: 11, marginLeft: 8 }}>{joined}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<View style={styles.centered}><Text style={{ fontSize: 36 }}>👥</Text><Text style={{ color: theme.subText }}>No students in your batches.</Text></View>}
        />
      </View>
    );
  };

  // ── Student Detail Modal ────────────────────────────────────────────────────
  const renderStudentDetailModal = () => {
    if (!selectedStudent || !studentStats) return null;
    const name = `${selectedStudent.first_name || ''} ${selectedStudent.last_name || ''}`.trim();
    const joinDate = studentStats.joinedDate ? new Date(studentStats.joinedDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

    return (
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Student Details</Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
              {/* Avatar + Name */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                {selectedStudent.profile_picture ? (
                  <Image source={{ uri: selectedStudent.profile_picture }} style={{ width: 64, height: 64, borderRadius: 32, marginBottom: 10 }} />
                ) : (
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{name[0]?.toUpperCase() || 'S'}</Text>
                  </View>
                )}
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{name}</Text>
                <Text style={{ color: theme.accent, fontSize: 13 }}>Student Profile</Text>
              </View>

              {/* Contact Info */}
              <View style={[styles.infoSection, { borderBottomColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color={theme.muted} />
                  <Text style={{ color: theme.text, marginLeft: 10, fontSize: 13 }}>{studentStats.email}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color={theme.muted} />
                  <Text style={{ color: theme.text, marginLeft: 10, fontSize: 13 }}>{studentStats.phone}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color={theme.muted} />
                  <Text style={{ color: theme.text, marginLeft: 10, fontSize: 13 }}>{joinDate}</Text>
                </View>
              </View>

              {/* Performance Stats (reconciled) */}
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 12 }}>Academy Performance</Text>
              {statsLoading && studentStats.attendanceRate === null ? (
                <View style={{ gap: 12 }}>
                  <View style={[styles.shimmer, { backgroundColor: isDark ? '#334155' : '#E2E8F0', width: '60%' }]} />
                  <View style={[styles.shimmer, { backgroundColor: isDark ? '#334155' : '#E2E8F0', width: '80%' }]} />
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {/* Attendance */}
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.subText, fontSize: 12 }}>Attendance Rate</Text>
                      <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13 }}>
                        {studentStats.attendanceRate !== null ? `${studentStats.attendanceRate}%` : 'N/A'}
                      </Text>
                    </View>
                    <View style={[styles.miniBar, { backgroundColor: isDark ? '#334155' : '#E2E8F0', height: 8, marginTop: 4 }]}>
                      <View style={[styles.miniBarFill, { width: `${studentStats.attendanceRate ?? 0}%`, backgroundColor: getProgressColor(studentStats.attendanceRate ?? 0), height: 8 }]} />
                    </View>
                  </View>
                  {/* Quiz Score */}
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.subText, fontSize: 12 }}>Avg Quiz Score</Text>
                      <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 13 }}>
                        {studentStats.progressVal !== null ? `${studentStats.progressVal}%` : 'N/A'}
                      </Text>
                    </View>
                    <View style={[styles.miniBar, { backgroundColor: isDark ? '#334155' : '#E2E8F0', height: 8, marginTop: 4 }]}>
                      <View style={[styles.miniBarFill, { width: `${studentStats.progressVal ?? 0}%`, backgroundColor: getProgressColor(studentStats.progressVal ?? 0), height: 8 }]} />
                    </View>
                  </View>
                  {/* Quiz count */}
                  <View style={[styles.pillStat, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={{ color: theme.muted, fontSize: 11 }}>Total Quizzes Attempted</Text>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{studentStats.quizCount ?? 'N/A'}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Teacher Console</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {[
          { key: 'quizzes', icon: 'document-text-outline', label: 'Quizzes' },
          { key: 'performance', icon: 'stats-chart-outline', label: 'Performance' },
          { key: 'students', icon: 'people-outline', label: 'Students' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && { borderBottomColor: theme.accent }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons name={t.icon} size={18} color={activeTab === t.key ? theme.accent : theme.muted} />
            <Text style={[styles.tabLabel, { color: activeTab === t.key ? theme.accent : theme.subText }, activeTab === t.key && { fontWeight: '700' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'quizzes' && renderQuizzesTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
        {activeTab === 'students' && renderStudentsTab()}
      </View>

      {renderStudentDetailModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingTop: 2 },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 3,
    borderBottomColor: 'transparent', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 8 },
  loadingLabel: { fontSize: 13, fontWeight: '600', marginTop: 8 },

  // Quizzes
  quizCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  quizIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quizTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  // Performance
  statCard: { flex: 1, borderRadius: 14, padding: 14, borderTopWidth: 4 },
  miniBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  miniBarFill: { height: 6, borderRadius: 3 },
  dashTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  dashCard: { borderRadius: 14, padding: 14, marginBottom: 16 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  leaderRank: { fontSize: 14, fontWeight: '700', width: 28 },

  // Students
  searchBar: { padding: 12, borderBottomWidth: 1 },
  searchInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, height: 42 },
  studentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  studentAvatar: { width: 38, height: 38, borderRadius: 19 },
  courseBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 20, maxHeight: '85%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoSection: { paddingBottom: 14, borderBottomWidth: 1, marginBottom: 8, gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  pillStat: { borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  shimmer: { height: 14, borderRadius: 4 },
});
