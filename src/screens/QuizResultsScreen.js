import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { getCache, setCache } from '../utils/cacheManager';

export default function QuizResultsScreen({ navigation }) {
  const { user } = useAuthStore();
  const isStaff = user?.role === 'teacher' || user?.role === 'admin';

  const cachedCourses = getCache('courses') || [];
  const [courses, setCourses] = useState(isStaff ? [{ id: 'all', name: 'All Courses' }, ...cachedCourses] : []);
  const [selectedCourseId, setSelectedCourseId] = useState(isStaff && courses.length > 0 ? courses[0].id : null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  
  const [results, setResults] = useState(getCache('quiz_results') || []);
  const [loading, setLoading] = useState(isStaff ? !getCache('courses') : !getCache('quiz_results'));
  const [fetchingBatches, setFetchingBatches] = useState(false);
  const [activeTab, setActiveTab] = useState('Scores');

  useEffect(() => {
    if (isStaff) {
      fetchCourses();
    } else {
      fetchResults();
    }
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchBatches(selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedBatchId !== null) {
      fetchResults();
    }
  }, [selectedBatchId]);

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/');
      const fetchedCourses = [{ id: 'all', name: 'All Courses' }, ...response.data];
      setCourses(fetchedCourses);
      setCache('courses', response.data);
      if (fetchedCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(fetchedCourses[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatches = async (courseId) => {
    setFetchingBatches(true);
    setSelectedBatchId(null);
    try {
      let url = '/batches/';
      if (courseId !== 'all') {
        url += `?course_id=${courseId}`;
      }
      const response = await apiClient.get(url);
      const fetchedBatches = [{ id: 'all', name: 'All Batches' }, ...response.data];
      setBatches(fetchedBatches);
      if (fetchedBatches.length > 0) {
        setSelectedBatchId(fetchedBatches[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setFetchingBatches(false);
    }
  };

  const fetchResults = async () => {
    try {
      let url = '/quizzes/results/all';
      if (selectedBatchId && selectedBatchId !== 'all') {
        url += `?batch_id=${selectedBatchId}`;
      } else if (selectedCourseId && selectedCourseId !== 'all') {
        url += `?course_id=${selectedCourseId}`;
      }
      const response = await apiClient.get(url);
      setResults(response.data);
      if (!selectedBatchId && !selectedCourseId) {
        setCache('quiz_results', response.data);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentDashboardData = () => {
    const courseStats = {};

    results.forEach(attempt => {
      const courseName = attempt.course_name || 'General / Other';
      const courseId = attempt.course_id || 'general';

      if (!courseStats[courseId]) {
        courseStats[courseId] = {
          courseId,
          courseName,
          totalQuizzes: 0,
          totalEarned: 0,
          totalMax: 0,
          highestPct: 0,
          attempts: []
        };
      }

      const stat = courseStats[courseId];
      stat.totalQuizzes += 1;
      stat.totalEarned += attempt.total_score;
      stat.totalMax += attempt.max_score;

      const pct = attempt.max_score > 0 ? (attempt.total_score / attempt.max_score) * 100 : 0;
      if (pct > stat.highestPct) {
        stat.highestPct = pct;
      }

      stat.attempts.push({
        ...attempt,
        percentage: pct
      });
    });

    return Object.values(courseStats).map(stat => {
      const avgPct = stat.totalMax > 0 ? (stat.totalEarned / stat.totalMax) * 100 : 0;
      return {
        ...stat,
        averagePercentage: avgPct
      };
    });
  };

  const getStaffDashboardData = () => {
    if (results.length === 0) return null;

    let totalEarned = 0;
    let totalMax = 0;
    const studentAverages = {};
    const quizStats = {};

    results.forEach(attempt => {
      totalEarned += attempt.total_score;
      totalMax += attempt.max_score;

      const sName = attempt.student_name;
      if (!studentAverages[sName]) {
        studentAverages[sName] = { name: sName, earned: 0, max: 0, count: 0 };
      }
      studentAverages[sName].earned += attempt.total_score;
      studentAverages[sName].max += attempt.max_score;
      studentAverages[sName].count += 1;

      const qTitle = attempt.quiz_title;
      if (!quizStats[qTitle]) {
        quizStats[qTitle] = { title: qTitle, earned: 0, max: 0, count: 0 };
      }
      quizStats[qTitle].earned += attempt.total_score;
      quizStats[qTitle].max += attempt.max_score;
      quizStats[qTitle].count += 1;
    });

    const classAverage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;

    const topStudents = Object.values(studentAverages).map(s => {
      const pct = s.max > 0 ? (s.earned / s.max) * 100 : 0;
      return { name: s.name, percentage: pct, count: s.count };
    }).sort((a, b) => b.percentage - a.percentage).slice(0, 5);

    const quizzesSummary = Object.values(quizStats).map(q => {
      const pct = q.max > 0 ? (q.earned / q.max) * 100 : 0;
      return { title: q.title, percentage: pct, count: q.count };
    });

    return {
      classAverage,
      totalAttempts: results.length,
      topStudents,
      quizzesSummary
    };
  };

  const getProgressColor = (percent) => {
    if (percent >= 75) return '#10B981';
    if (percent >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const renderDashboard = () => {
    if (isStaff) {
      const staffData = getStaffDashboardData();
      if (!staffData) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No dashboard data available. Please select a different course/batch or wait for submissions.</Text>
          </View>
        );
      }

      const avgColor = getProgressColor(staffData.classAverage);

      return (
        <View style={styles.staffDashboard}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderTopColor: avgColor, borderTopWidth: 4 }]}>
              <Text style={styles.statLabel}>Class Average</Text>
              <Text style={[styles.statVal, { color: avgColor }]}>{staffData.classAverage.toFixed(1)}%</Text>
              <View style={styles.miniProgressBg}>
                <View style={[styles.miniProgressFill, { width: `${staffData.classAverage}%`, backgroundColor: avgColor }]} />
              </View>
            </View>
            <View style={[styles.statBox, { borderTopColor: '#007AFF', borderTopWidth: 4 }]}>
              <Text style={styles.statLabel}>Total Submissions</Text>
              <Text style={[styles.statVal, { color: '#007AFF' }]}>{staffData.totalAttempts}</Text>
              <Text style={styles.statSubText}>attempts recorded</Text>
            </View>
          </View>

          <Text style={styles.dashSectionTitle}>Top Performers 🌟</Text>
          <View style={styles.cardSection}>
            {staffData.topStudents.map((s, idx) => (
              <View key={idx} style={styles.studentLeaderboardRow}>
                <View style={styles.leaderboardLeft}>
                  <Text style={[styles.leaderboardRank, idx === 0 && { color: '#FFD700' }, idx === 1 && { color: '#C0C0C0' }, idx === 2 && { color: '#CD7F32' }]}>#{idx + 1}</Text>
                  <Text style={styles.leaderboardName}>{s.name}</Text>
                </View>
                <View style={styles.leaderboardRight}>
                  <Text style={styles.leaderboardScore}>{s.percentage.toFixed(0)}%</Text>
                  <Text style={styles.leaderboardAttempts}>{s.count} quizzes</Text>
                </View>
              </View>
            ))}
            {staffData.topStudents.length === 0 && (
              <Text style={styles.noDataText}>No students record available</Text>
            )}
          </View>

          <Text style={styles.dashSectionTitle}>Quiz wise Performance 📋</Text>
          <View style={styles.cardSection}>
            {staffData.quizzesSummary.map((q, idx) => {
              const color = getProgressColor(q.percentage);
              return (
                <View key={idx} style={styles.quizStatRow}>
                  <View style={styles.quizStatHeader}>
                    <Text style={styles.quizStatTitle} numberOfLines={1}>{q.title}</Text>
                    <Text style={[styles.quizStatPct, { color }]}>{q.percentage.toFixed(0)}%</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${q.percentage}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.quizStatAttempts}>{q.count} student submissions</Text>
                </View>
              );
            })}
            {staffData.quizzesSummary.length === 0 && (
              <Text style={styles.noDataText}>No quizzes attempts record available</Text>
            )}
          </View>
        </View>
      );
    } else {
      const studentData = getStudentDashboardData();
      if (studentData.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyText}>No quiz attempts found. Start attempting quizzes to see your dashboard!</Text>
          </View>
        );
      }

      return (
        <View style={styles.studentDashboard}>
          {studentData.map(course => {
            const avgColor = getProgressColor(course.averagePercentage);
            
            return (
              <View key={course.courseId} style={styles.courseDashCard}>
                <View style={styles.courseDashHeader}>
                  <Text style={styles.courseDashTitle}>📚 {course.courseName}</Text>
                  <View style={styles.courseQuizzesBadge}>
                    <Text style={styles.courseQuizzesBadgeText}>{course.totalQuizzes} Quizzes</Text>
                  </View>
                </View>

                <View style={styles.courseDashMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Average Score</Text>
                    <Text style={[styles.metricVal, { color: avgColor }]}>{course.averagePercentage.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Best Score</Text>
                    <Text style={[styles.metricVal, { color: '#10B981' }]}>{course.highestPct.toFixed(0)}%</Text>
                  </View>
                </View>

                <View style={styles.progressBgLarge}>
                  <View style={[styles.progressFillLarge, { width: `${course.averagePercentage}%`, backgroundColor: avgColor }]} />
                </View>

                <Text style={styles.attemptsSectionHeader}>Recent Submissions</Text>
                {course.attempts.slice(0, 3).map((attempt, idx) => (
                  <View key={idx} style={styles.miniAttemptRow}>
                    <Text style={styles.miniAttemptTitle} numberOfLines={1}>{attempt.quiz_title}</Text>
                    <Text style={styles.miniAttemptScore}>
                      {attempt.total_score} / {attempt.max_score} ({attempt.percentage.toFixed(0)}%)
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      );
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultCard}
      onPress={() => navigation.navigate('SubmissionDetail', { attemptId: item.id })}
    >
      <View style={styles.resultInfo}>
        <Text style={styles.quizTitle}>{item.quiz_title}</Text>
        <Text style={styles.studentName}>👤 {item.student_name}</Text>
        <Text style={styles.dateText}>📅 {new Date(item.attempted_at).toLocaleDateString()}</Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>
          {item.total_score} <Text style={styles.maxScore}>/ {item.max_score}</Text>
        </Text>
        <Text style={styles.ptsLabel}>Score</Text>
      </View>
      <Text style={styles.chevron}>→</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Achievements 🏆</Text>
        <View style={{ width: 40 }} />
      </View>

      {isStaff && courses.length > 0 && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Select Course</Text>
          <FlatList
            horizontal
            data={courses}
            keyExtractor={(item) => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.chip, selectedCourseId === item.id && styles.chipActive]}
                onPress={() => {
                  setSelectedCourseId(item.id);
                  fetchBatches(item.id);
                }}
              >
                <Text style={[styles.chipText, selectedCourseId === item.id && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.chipList}
          />

          <Text style={[styles.filterLabel, { marginTop: 10 }]}>Select Batch</Text>
          {fetchingBatches ? (
            <Text style={{ marginVertical: 10, color: '#64748B' }}>Fetching batches...</Text>
          ) : (
            <FlatList
              horizontal
              data={batches}
              keyExtractor={(item) => item.id.toString()}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.chip, selectedBatchId === item.id && styles.chipActive]}
                  onPress={() => setSelectedBatchId(item.id)}
                >
                  <Text style={[styles.chipText, selectedBatchId === item.id && styles.chipTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              style={styles.chipList}
              ListEmptyComponent={<Text style={styles.noDataText}>No batches found</Text>}
            />
          )}
        </View>
      )}

      {/* Top Tab Bar */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'Scores' && styles.tabBtnActive]}
          onPress={() => setActiveTab('Scores')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'Scores' && styles.tabBtnTextActive]}>Quiz Scores</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'Dashboard' && styles.tabBtnActive]}
          onPress={() => setActiveTab('Dashboard')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'Dashboard' && styles.tabBtnTextActive]}>Performance Dashboard</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <Text style={styles.loadingText}>Loading scores...</Text>
        </View>
      ) : activeTab === 'Scores' ? (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No results found yet. Check back soon!</Text>
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.dashboardContainer} showsVerticalScrollIndicator={false}>
          {renderDashboard()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
  },
  backText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  resultInfo: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  studentName: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#F0F0F0',
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  maxScore: {
    fontSize: 12,
    color: '#999',
  },
  ptsLabel: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    marginTop: 2,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 18,
    color: '#CCC',
    marginLeft: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginLeft: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chipList: {
    paddingHorizontal: 15,
    marginBottom: 5,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#fff',
  },
  noDataText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 20,
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingTop: 5,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#007AFF',
  },
  tabBtnText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#007AFF',
    fontWeight: '700',
  },
  dashboardContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  staffDashboard: {
    gap: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  miniProgressBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statSubText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  dashSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 10,
    marginBottom: 2,
  },
  cardSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    gap: 12,
  },
  studentLeaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaderboardRank: {
    fontSize: 14,
    fontWeight: '800',
    width: 25,
  },
  leaderboardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  leaderboardRight: {
    alignItems: 'flex-end',
  },
  leaderboardScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
  },
  leaderboardAttempts: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  quizStatRow: {
    paddingVertical: 4,
  },
  quizStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quizStatTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  quizStatPct: {
    fontSize: 13,
    fontWeight: '700',
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
  quizStatAttempts: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 4,
  },
  studentDashboard: {
    gap: 16,
  },
  courseDashCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  courseDashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  courseDashTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  courseQuizzesBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  courseQuizzesBadgeText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  courseDashMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBgLarge: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFillLarge: {
    height: '100%',
    borderRadius: 5,
  },
  attemptsSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8F9FA',
    paddingTop: 12,
  },
  miniAttemptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  miniAttemptTitle: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  miniAttemptScore: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
});
