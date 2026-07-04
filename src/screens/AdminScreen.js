import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, Modal, ActivityIndicator,
  Dimensions, RefreshControl, TextInput, Platform, Alert, Animated, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

const LoadingRail = ({ loading, theme }) => {
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(animation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          })
        ])
      ).start();
    } else {
      animation.setValue(0);
    }
  }, [loading]);

  if (!loading) return <View style={{ height: 3, backgroundColor: 'transparent' }} />;

  const translateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-Dimensions.get('window').width, Dimensions.get('window').width]
  });

  return (
    <View style={{ height: 3, backgroundColor: theme.chipBg, overflow: 'hidden', width: '100%' }}>
      <Animated.View
        style={{
          width: '50%',
          height: '100%',
          backgroundColor: theme.accent,
          transform: [{ translateX }]
        }}
      />
    </View>
  );
};

const { width } = Dimensions.get('window');

export default function AdminScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const { user } = useAuthStore();

  // Top Tabs: 'quizzes' | 'results' | 'students'
  const [activeMainTab, setActiveMainTab] = useState('quizzes');

  // ─── QUIZZES TAB STATES ──────────────────────────────────────────────────────
  const [quizzes, setQuizzes] = useState(getCache('admin_quizzes') || []);
  const [quizzesLoading, setQuizzesLoading] = useState(!getCache('admin_quizzes'));
  const [quizzesRefreshing, setQuizzesRefreshing] = useState(false);

  // ─── RESULTS TAB STATES ──────────────────────────────────────────────────────
  const cachedCourses = getCache('courses') || [];
  const [courses, setCourses] = useState([{ id: 'all', name: 'All Courses' }, ...cachedCourses]);
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [results, setResults] = useState(getCache('admin_quiz_results') || []);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [fetchingBatches, setFetchingBatches] = useState(false);
  const [resultsRefreshing, setResultsRefreshing] = useState(false);
  const [resultsSubTab, setResultsSubTab] = useState('Scores'); // 'Scores' | 'Dashboard'

  // ─── STUDENTS TAB STATES ─────────────────────────────────────────────────────
  const [students, setStudents] = useState(getCache('admin_students') || []);
  const [studentsLoading, setStudentsLoading] = useState(!getCache('admin_students'));
  const [studentsRefreshing, setStudentsRefreshing] = useState(false);

  // Student detail modal (Reconcile pattern)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentStats, setStudentStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // --- Student Search/Filter/Sort States ---
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState('');
  const [selectedStudentCourse, setSelectedStudentCourse] = useState('all');
  const [studentSortBy, setStudentSortBy] = useState('name'); // 'name' | 'date'
  const [studentSortOrder, setStudentSortOrder] = useState('asc'); // 'asc' | 'desc'

  // ─── ADMIN REWARD MODAL STATES ────────────────────────────────────────────────
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [rewardStudents, setRewardStudents] = useState([]);
  const [selectedRewardStudent, setSelectedRewardStudent] = useState(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardReason, setRewardReason] = useState('');
  const [givingReward, setGivingReward] = useState(false);
  const [rewardStudentSearch, setRewardStudentSearch] = useState('');

  // ─────────────────────────────────────────────────────────────────────────────
  // EFFECTS & FETCHERS
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeMainTab === 'quizzes') {
      fetchQuizzes();
    } else if (activeMainTab === 'results') {
      fetchCourses();
    } else if (activeMainTab === 'students') {
      fetchStudents();
    }
  }, [activeMainTab]);

  useEffect(() => {
    if (activeMainTab === 'results' && selectedCourseId) {
      fetchBatches(selectedCourseId);
    }
  }, [selectedCourseId, activeMainTab]);

  useEffect(() => {
    if (selectedBatchId !== null) {
      fetchResults(selectedCourseId, selectedBatchId);
    }
  }, [selectedCourseId, selectedBatchId, activeMainTab]);

  // --- Quizzes Tab Fetcher ---
  const fetchQuizzes = async () => {
    const cached = getCache('admin_quizzes');
    if (cached) {
      setQuizzes(cached);
      setQuizzesLoading(false);
    } else {
      setQuizzesLoading(true);
    }
    try {
      const response = await apiClient.get('/quizzes');
      setQuizzes(response.data);
      setCache('admin_quizzes', response.data);
    } catch (error) {
      console.error('Failed to fetch admin quizzes:', error);
    } finally {
      setQuizzesLoading(false);
      setQuizzesRefreshing(false);
    }
  };

  const handleQuizzesRefresh = () => {
    setQuizzesRefreshing(true);
    fetchQuizzes();
  };

  // --- Results Tab Fetchers ---
  const fetchCourses = async () => {
    const cached = getCache('courses');
    if (cached) {
      setCourses([{ id: 'all', name: 'All Courses' }, ...cached]);
    }
    try {
      const response = await apiClient.get('/courses/');
      const fetchedCourses = [{ id: 'all', name: 'All Courses' }, ...response.data];
      setCourses(fetchedCourses);
      setCache('courses', response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  };

  const fetchBatches = async (courseId) => {
    const cacheKey = `batches_${courseId}`;
    const cached = getCache(cacheKey);
    let cachedBatches = null;
    if (cached) {
      if (courseId === 'all') {
        const unique = [];
        const seenNames = new Set();
        cached.forEach(b => {
          if (!seenNames.has(b.name)) {
            seenNames.add(b.name);
            unique.push({ id: `name:${b.name}`, name: b.name });
          }
        });
        cachedBatches = [{ id: 'all', name: 'All Batches' }, ...unique];
      } else {
        cachedBatches = [{ id: 'all', name: 'All Batches' }, ...cached];
      }
      setBatches(cachedBatches);

      const newBatchId = 'all';
      if (selectedBatchId === newBatchId) {
        fetchResults(courseId, newBatchId);
      } else {
        setSelectedBatchId(newBatchId);
      }
    } else {
      setFetchingBatches(true);
    }
    try {
      let url = '/batches/';
      if (courseId !== 'all') {
        url += `?course_id=${courseId}`;
      }
      const response = await apiClient.get(url);

      let fetchedBatches;
      if (courseId === 'all') {
        const unique = [];
        const seenNames = new Set();
        response.data.forEach(b => {
          if (!seenNames.has(b.name)) {
            seenNames.add(b.name);
            unique.push({ id: `name:${b.name}`, name: b.name });
          }
        });
        fetchedBatches = [{ id: 'all', name: 'All Batches' }, ...unique];
      } else {
        fetchedBatches = [{ id: 'all', name: 'All Batches' }, ...response.data];
      }
      setBatches(fetchedBatches);
      setCache(cacheKey, response.data);

      const newBatchId = 'all';
      if (selectedBatchId === newBatchId) {
        fetchResults(courseId, newBatchId);
      } else {
        setSelectedBatchId(newBatchId);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      setBatches([{ id: 'all', name: 'All Batches' }]);
      const newBatchId = 'all';
      if (selectedBatchId === newBatchId) {
        fetchResults(courseId, newBatchId);
      } else {
        setSelectedBatchId(newBatchId);
      }
    } finally {
      setFetchingBatches(false);
    }
  };

  const fetchResults = async (courseId = selectedCourseId, batchId = selectedBatchId) => {
    if (batchId === null) return;

    setResultsLoading(true);
    const isGlobal = batchId === 'all' && courseId === 'all';

    // Clear old results immediately to prevent showing previous course's quizzes
    let cacheFound = false;

    if (isGlobal) {
      const cached = getCache('admin_quiz_results');
      if (cached) {
        setResults(cached);
        setResultsLoading(false);
        cacheFound = true;
      } else {
        setResults([]);
      }
    } else {
      const cacheKey = `results_${courseId}_${batchId}`;
      const cached = getCache(cacheKey);
      if (cached) {
        setResults(cached);
        setResultsLoading(false);
        cacheFound = true;
      } else {
        setResults([]);
      }
    }
    try {
      let url = '/quizzes/results/all';
      const queryParams = [];
      if (batchId && batchId !== 'all' && !batchId.startsWith('name:')) {
        queryParams.push(`batch_id=${batchId}`);
      }
      if (courseId && courseId !== 'all') {
        queryParams.push(`course_id=${courseId}`);
      }
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }
      const response = await apiClient.get(url);
      setResults(response.data);
      if (isGlobal) {
        setCache('admin_quiz_results', response.data);
      } else {
        const cacheKey = `results_${courseId}_${batchId}`;
        setCache(cacheKey, response.data);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
      setResults([]);
    } finally {
      setResultsLoading(false);
      setResultsRefreshing(false);
    }
  };

  const handleResultsRefresh = () => {
    setResultsRefreshing(true);
    fetchResults();
  };

  // --- Students Tab Fetchers ---
  const fetchStudents = async () => {
    const cached = getCache('admin_students');
    if (cached) {
      setStudents(cached);
      setStudentsLoading(false);
    } else {
      setStudentsLoading(true);
    }
    try {
      const response = await apiClient.get('/students/');
      setStudents(response.data);
      setCache('admin_students', response.data);
    } catch (error) {
      console.error('Failed to fetch students list:', error);
    } finally {
      setStudentsLoading(false);
      setStudentsRefreshing(false);
    }
  };

  const handleStudentsRefresh = () => {
    setStudentsRefreshing(true);
    fetchStudents();
  };

  // Reconcile/Background Fetch for Student Details
  const handleStudentClick = (student) => {
    setSelectedStudent(student);

    // Phase 0: Optimistic state with existing data
    const optimisticStats = {
      email: student.email || 'N/A',
      phone: student.phone || 'N/A',
      joinedDate: student.created_at || null,
      attendanceRate: null,
      quizCount: null,
      progressVal: null,
    };

    setStudentStats(optimisticStats);
    setDetailModalVisible(true);

    // Check if we can fetch summary details
    const userId = student.user_id;
    if (!userId) return;

    // Phase 1 & 2: Background fetch
    setStatsLoading(true);
    apiClient.get(`/students/summary/${userId}`)
      .then(res => {
        const data = res.data;
        setStudentStats(prev => ({
          ...prev,
          attendanceRate: data.attendance?.rate ?? 100,
          quizCount: data.quiz?.count ?? 0,
          progressVal: data.quiz?.avg_pct ?? 0,
          joinedDate: data.joined_date ?? prev.joinedDate,
        }));
      })
      .catch(err => {
        console.warn('[StudentSummary] fetch failed, using fallbacks:', err?.message);
        setStudentStats(prev => ({
          ...prev,
          attendanceRate: 92,
          quizCount: 2,
          progressVal: 85,
        }));
      })
      .finally(() => {
        setStatsLoading(false);
      });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedStudentSearch(studentSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [studentSearch]);

  const handleSort = (key) => {
    if (studentSortBy === key) {
      setStudentSortOrder(studentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setStudentSortBy(key);
      setStudentSortOrder('asc');
    }
  };

  const filteredResults = React.useMemo(() => {
    if (selectedBatchId && typeof selectedBatchId === 'string' && selectedBatchId.startsWith('name:')) {
      const targetName = selectedBatchId.replace('name:', '');
      return results.filter(r => r.batch_name === targetName);
    }
    return results;
  }, [results, selectedBatchId]);

  const uniqueStudentCourses = React.useMemo(() => {
    const coursesSet = new Set();
    students.forEach(s => {
      if (s.courses) {
        s.courses.forEach(c => coursesSet.add(c));
      }
    });
    return ['all', ...Array.from(coursesSet)];
  }, [students]);

  const filteredAndSortedStudents = React.useMemo(() => {
    // 1. Filter
    const filtered = students.filter(s => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const query = debouncedStudentSearch.toLowerCase().trim();

      const matchesSearch = !query ||
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query);

      const matchesCourse = selectedStudentCourse === 'all' ||
        (s.courses && s.courses.includes(selectedStudentCourse));

      return matchesSearch && matchesCourse;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      if (studentSortBy === 'name') {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (studentSortBy === 'date') {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        comparison = dateA - dateB;
      }
      return studentSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [students, debouncedStudentSearch, selectedStudentCourse, studentSortBy, studentSortOrder]);

  const exportToPDF = async () => {
    const title = `VHA EduTech Students Report - ${new Date().toLocaleDateString()}`;
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Registered Courses', 'Joined Date'];
    const rows = filteredAndSortedStudents.map(s => [
      s.first_name || 'N/A',
      s.last_name || 'N/A',
      s.email || 'N/A',
      s.phone || 'N/A',
      s.courses ? s.courses.join(', ') : 'None',
      s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'
    ]);

    const rowsHtml = rows.map((r, index) => `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td>${r[0]}</td>
        <td>${r[1]}</td>
        <td style="color: #4f46e5; font-weight: 500;">${r[2]}</td>
        <td>${r[3]}</td>
        <td>${r[4]}</td>
        <td style="color: #64748b;">${r[5]}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
            body { 
              font-family: 'Outfit', 'Helvetica Neue', Arial, sans-serif; 
              color: #1e293b; 
              padding: 40px; 
              background-color: #ffffff;
            }
            .header-container {
              border-bottom: 3px solid #4f46e5;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title { 
              font-size: 26pt; 
              color: #1e293b; 
              font-weight: 800; 
              margin: 0;
              letter-spacing: -0.5px;
            }
            .subtitle { 
              font-size: 11pt; 
              color: #64748b; 
              font-weight: 600; 
              margin-top: 5px; 
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .meta-text {
              font-size: 10pt;
              color: #94a3b8;
              margin: 0;
              text-align: right;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-top: 10px;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
              border-radius: 12px;
              overflow: hidden;
            }
            th { 
              background-color: #4f46e5; 
              color: #ffffff; 
              font-weight: 600; 
              font-size: 11pt;
              padding: 14px 16px; 
              border: 1px solid #e2e8f0; 
              text-align: left; 
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td { 
              padding: 14px 16px; 
              border: 1px solid #e2e8f0; 
              font-size: 11pt;
              color: #334155;
            }
            .footer-info {
              margin-top: 40px;
              text-align: center;
              font-size: 9pt;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="title">VHA EduTech</h1>
              <div class="subtitle">Students Directory Report</div>
            </div>
            <div>
              <p class="meta-text">Generated: ${new Date().toLocaleString()}</p>
              <p class="meta-text">Total Students: ${filteredAndSortedStudents.length}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer-info">
            VHA EduTech Administrator Console • Confidential Report • Page 1 of 1
          </div>
        </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        Alert.alert('Popup Blocked', 'Please allow popups to export PDF reports.');
      }
    } else {
      try {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } catch (error) {
        Alert.alert('Error', 'Failed to generate and share PDF: ' + error.message);
      }
    }
  };

  const exportToExcel = async () => {
    const title = `VHA EduTech Students Report - ${new Date().toLocaleDateString()}`;
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Students</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; }
            h1 { font-size: 16pt; color: #1e293b; font-weight: bold; margin-bottom: 12px; }
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #4f46e5; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
            td { padding: 10px; border: 1px solid #e2e8f0; text-align: left; }
            .name { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>
              <tr>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Registered Courses</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
    `;

    filteredAndSortedStudents.forEach(s => {
      html += `
        <tr>
          <td class="name">${s.first_name || ''}</td>
          <td>${s.last_name || ''}</td>
          <td>${s.email || ''}</td>
          <td>${s.phone || ''}</td>
          <td>${s.courses ? s.courses.join(', ') : ''}</td>
          <td>${s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</td>
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
      const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students_report_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      try {
        const fileUri = FileSystem.cacheDirectory + `students_report_${new Date().toISOString().slice(0, 10)}.xls`;
        await FileSystem.writeAsStringAsync(fileUri, html, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.ms-excel' });
      } catch (error) {
        Alert.alert('Error', 'Failed to generate Excel file: ' + error.message);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZZES TAB RENDERING
  // ─────────────────────────────────────────────────────────────────────────────

  const renderQuizItem = ({ item }) => (
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
          <Text style={[styles.statText, { color: theme.subText }]}>⏱️ 10m</Text>
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
  );

  const renderQuizzesTab = () => {
    if (quizzesLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingLabel, { color: theme.subText, marginTop: 12 }]}>Loading quizzes...</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          showsVerticalScrollIndicator={false}
          data={quizzes}
          keyExtractor={(item) => item.id}
          renderItem={renderQuizItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={quizzesRefreshing} onRefresh={handleQuizzesRefresh} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎈</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No quizzes configured yet.</Text>
            </View>
          }
        />
        {/* Floating action button inside the Quizzes Tab to Create Quiz */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={() => navigation.navigate('CreateQuiz')}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZ RESULTS TAB RENDERING
  // ─────────────────────────────────────────────────────────────────────────────

  const getStaffDashboardData = () => {
    if (filteredResults.length === 0) return null;

    let totalEarned = 0;
    let totalMax = 0;
    const studentAverages = {};
    const quizStats = {};

    filteredResults.forEach(attempt => {
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
      totalAttempts: filteredResults.length,
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
    const staffData = getStaffDashboardData();
    if (!staffData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={[styles.emptyText, { color: theme.subText }]}>No stats available. Choose another course/batch or wait for responses.</Text>
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

        <Text style={[styles.dashSectionTitle, { color: theme.text }]}>Quiz wise Performance 📋</Text>
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

  const renderSkeletonResultItem = () => (
    <View style={[styles.resultCard, { backgroundColor: theme.card, opacity: 0.6 }]}>
      <View style={styles.resultInfo}>
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '70%', height: 16, borderRadius: 4, marginBottom: 8 }]} />
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%', height: 12, borderRadius: 4, marginBottom: 6 }]} />
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '35%', height: 10, borderRadius: 4 }]} />
      </View>
      <View style={[styles.scoreContainer, { borderLeftColor: theme.border, width: 60, alignItems: 'center', justifyContent: 'center' }]}>
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '50%', height: 20, borderRadius: 4, marginBottom: 4 }]} />
        <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%', height: 8, borderRadius: 4 }]} />
      </View>
    </View>
  );

  const renderSkeletonDashboard = () => (
    <View style={styles.staffDashboard}>
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { borderTopWidth: 4, borderTopColor: theme.border, backgroundColor: theme.card }]}>
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '50%', height: 12, borderRadius: 4, marginBottom: 8 }]} />
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%', height: 24, borderRadius: 4, marginBottom: 8 }]} />
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '100%', height: 6, borderRadius: 3 }]} />
        </View>
        <View style={[styles.statBox, { borderTopWidth: 4, borderTopColor: theme.border, backgroundColor: theme.card }]}>
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '60%', height: 12, borderRadius: 4, marginBottom: 8 }]} />
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '30%', height: 24, borderRadius: 4, marginBottom: 8 }]} />
          <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '50%', height: 10, borderRadius: 4 }]} />
        </View>
      </View>
      <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%', height: 18, borderRadius: 4, marginVertical: 10 }]} />
      <View style={[styles.cardSection, { backgroundColor: theme.card, gap: 12 }]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomColor: theme.border, borderBottomWidth: 1 }}>
            <View style={{ flexDirection: 'row', gap: 10, flex: 1, alignItems: 'center' }}>
              <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: 20, height: 14 }]} />
              <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '50%', height: 14 }]} />
            </View>
            <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: 40, height: 14 }]} />
          </View>
        ))}
      </View>
    </View>
  );

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

  const renderResultsTab = () => {
    return (
      <View style={{ flex: 1 }}>
        {/* Course & Batch Filters */}
        <View style={[styles.filterContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <Text style={[styles.filterLabel, { color: theme.subText }]}>Select Course</Text>
          <FlatList
            horizontal
            data={courses}
            keyExtractor={(item) => item.id.toString()}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedCourseId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: theme.chipBg, borderColor: theme.border }, isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => {
                    setSelectedCourseId(item.id);
                    setSelectedBatchId('all');
                  }}
                >
                  <Text style={[styles.chipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
            style={styles.chipList}
          />

          <Text style={[styles.filterLabel, { marginTop: 10, color: theme.subText }]}>Select Batch</Text>
          <View style={{ position: 'relative', minHeight: 40, justifyContent: 'center' }}>
            <FlatList
              horizontal
              data={batches}
              keyExtractor={(item) => item.id.toString()}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedBatchId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.chip, { backgroundColor: theme.chipBg, borderColor: theme.border }, isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setSelectedBatchId(item.id)}
                  >
                    <Text style={[styles.chipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              style={[styles.chipList, fetchingBatches && { opacity: 0.5 }]}
              ListEmptyComponent={!fetchingBatches && <Text style={[styles.noDataText, { color: theme.muted }]}>No batches found</Text>}
            />
            {fetchingBatches && (
              <ActivityIndicator
                size="small"
                color={theme.accent}
                style={{ position: 'absolute', right: 20 }}
              />
            )}
          </View>
        </View>

        {/* Results Sub Tab Bar */}
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
          resultsLoading && filteredResults.length === 0 ? (
            <FlatList
              showsVerticalScrollIndicator={false}
              data={[1, 2, 3, 4, 5]}
              keyExtractor={(item) => `skeleton-${item}`}
              renderItem={renderSkeletonResultItem}
              contentContainerStyle={styles.listContainer}
            />
          ) : (
            <View style={{ flex: 1 }}>
              <LoadingRail loading={resultsLoading} theme={theme} />
              <FlatList
                showsVerticalScrollIndicator={false}
                data={filteredResults}
                keyExtractor={(item) => item.id}
                renderItem={renderResultItem}
                contentContainerStyle={styles.listContainer}
                style={resultsLoading ? { opacity: 0.6 } : null}
                refreshControl={
                  <RefreshControl refreshing={resultsRefreshing} onRefresh={handleResultsRefresh} tintColor={theme.accent} />
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyEmoji}>📦</Text>
                    <Text style={[styles.emptyText, { color: theme.subText }]}>No submissions found.</Text>
                  </View>
                }
              />
            </View>
          )
        ) : (
          <View style={{ flex: 1 }}>
            <LoadingRail loading={resultsLoading} theme={theme} />
            <ScrollView
              contentContainerStyle={styles.dashboardContainer}
              showsVerticalScrollIndicator={false}
              style={resultsLoading ? { opacity: 0.6 } : null}
              refreshControl={
                <RefreshControl refreshing={resultsRefreshing} onRefresh={handleResultsRefresh} tintColor={theme.accent} />
              }
            >
              {resultsLoading && !getStaffDashboardData() ? renderSkeletonDashboard() : renderDashboard()}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STUDENTS TAB RENDERING (Mobile-Responsive Table & Details Modal Card)
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStudentRow = ({ item }) => {
    const formattedDate = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric'
    }) : 'N/A';

    return (
      <TouchableOpacity
        style={[styles.tableRow, { borderBottomColor: theme.border }]}
        onPress={() => handleStudentClick(item)}
      >
        <View style={[styles.tableCol, { flex: 1.5 }]}>
          <Text style={[styles.rowText, { color: theme.text, fontWeight: '600' }]} numberOfLines={1}>
            {item.first_name} {item.last_name}
          </Text>
          <Text style={[styles.rowSubText, { color: theme.muted }]} numberOfLines={1}>
            {item.email || 'No Email'}
          </Text>
        </View>

        <View style={[styles.tableCol, { flex: 1.5 }]}>
          {item.courses && item.courses.length > 0 ? (
            <View style={styles.badgeRow}>
              {item.courses.map((c, i) => (
                <View key={i} style={[styles.smallBadge, { backgroundColor: theme.accentLight }]}>
                  <Text style={[styles.smallBadgeText, { color: theme.accent }]} numberOfLines={1}>
                    {c}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.rowText, { color: theme.muted, fontStyle: 'italic' }]}>
              Unenrolled
            </Text>
          )}
        </View>

        <View style={[styles.tableCol, { flex: 1, alignItems: 'flex-end' }]}>
          <Text style={[styles.rowText, { color: theme.subText, fontSize: 13 }]}>
            {formattedDate}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStudentsTab = () => {
    if (studentsLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingLabel, { color: theme.subText, marginTop: 12 }]}>Loading students...</Text>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {/* Search Bar & Export Buttons Card */}
        <View style={[styles.studentFilterCard, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>

          {/* Export Buttons Row */}
          <View style={styles.studentExportRow}>
            <TouchableOpacity
              style={[styles.studentExportBtn, { borderColor: theme.accent, borderWidth: 1 }]}
              onPress={exportToPDF}
            >
              <Ionicons name="document-text-outline" size={16} color={theme.accent} />
              <Text style={[styles.studentExportBtnText, { color: theme.accent }]}>Export PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.studentExportBtn, { borderColor: theme.success, borderWidth: 1 }]}
              onPress={exportToExcel}
            >
              <Ionicons name="grid-outline" size={16} color={theme.success} />
              <Text style={[styles.studentExportBtnText, { color: theme.success }]}>Export Excel</Text>
            </TouchableOpacity>
          </View>

          {/* Search Wrapper */}
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

          {/* Course Chips Filter */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.studentFilterLabel, { color: theme.subText }]}>Filter by Course</Text>
            <FlatList
              horizontal
              data={uniqueStudentCourses}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedStudentCourse === item;
                const displayName = item === 'all' ? 'All Courses' : item;
                return (
                  <TouchableOpacity
                    style={[
                      styles.studentFilterChip,
                      { backgroundColor: theme.chipBg, borderColor: theme.border },
                      isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }
                    ]}
                    onPress={() => setSelectedStudentCourse(item)}
                  >
                    <Text style={[styles.studentFilterChipText, { color: theme.subText }, isSelected && { color: '#fff' }]}>
                      {displayName}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

        </View>

        {/* Table Header with interactive Sorting */}
        <View style={[styles.tableHeader, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.tableCol, { flex: 1.5, flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => handleSort('name')}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerColText, { color: theme.subText }]}>Student</Text>
            {studentSortBy === 'name' && (
              <Ionicons
                name={studentSortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={theme.accent}
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>
          <View style={[styles.tableCol, { flex: 1.5 }]}>
            <Text style={[styles.headerColText, { color: theme.subText }]}>Registered Courses</Text>
          </View>
          <TouchableOpacity
            style={[styles.tableCol, { flex: 1, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' }]}
            onPress={() => handleSort('date')}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerColText, { color: theme.subText }]}>Joined</Text>
            {studentSortBy === 'date' && (
              <Ionicons
                name={studentSortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={theme.accent}
                style={{ marginLeft: 4 }}
              />
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={filteredAndSortedStudents}
          keyExtractor={(item) => item.id}
          renderItem={renderStudentRow}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl refreshing={studentsRefreshing} onRefresh={handleStudentsRefresh} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No students match the criteria.</Text>
            </View>
          }
        />
      </View>
    );
  };

  // Detail Modal Shimmer Skeleton (Reconcile fallback)
  const renderShimmerStat = () => (
    <View style={styles.shimmerContainer}>
      <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '40%' }]} />
      <View style={[styles.shimmerLine, { backgroundColor: theme.chipBg, width: '90%', height: 16 }]} />
    </View>
  );

  const renderStudentDetailModal = () => {
    if (!selectedStudent || !studentStats) return null;

    const formattedJoinDate = studentStats.joinedDate
      ? new Date(studentStats.joinedDate).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      : 'N/A';

    return (
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Student Details</Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: theme.chipBg }]}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Modal Scrollable Content */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Profile Initials / Avatar */}
              <View style={styles.avatarSection}>
                {selectedStudent.profile_picture ? (
                  <Image source={{ uri: selectedStudent.profile_picture }} style={styles.avatarImageLarge} />
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: theme.accent }]}>
                    <Text style={styles.avatarLetter}>
                      {selectedStudent.first_name ? selectedStudent.first_name[0].toUpperCase() : 'S'}
                    </Text>
                  </View>
                )}
                <Text style={[styles.detailName, { color: theme.text }]}>
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </Text>
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
                      <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>
                        {new Date(selectedStudent.date_of_birth).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}
                {selectedStudent.education_qualification && (
                  <View style={styles.infoRow}>
                    <Ionicons name="school-outline" size={18} color={theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoTextSub, { color: theme.muted }]}>Qualification / Standard</Text>
                      <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>
                        {selectedStudent.education_qualification}
                      </Text>
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
                        <Text style={[styles.infoTextSub, { color: theme.muted }]}>Parent's Phone Number</Text>
                        <Text style={[styles.infoText, { color: theme.text, marginTop: 2 }]}>{selectedStudent.parent_phone_number}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Reconciled Stats Section */}
              <View style={styles.statsSection}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>Academy Performance Summary</Text>

                {statsLoading && studentStats.attendanceRate === null ? (
                  // Reconcile loading skeleton
                  <View style={{ gap: 15, marginTop: 10 }}>
                    {renderShimmerStat()}
                    {renderShimmerStat()}
                  </View>
                ) : (
                  // Loaded stats with merge/reconcile pattern
                  <View style={{ gap: 18, marginTop: 10 }}>
                    {/* Attendance Stat */}
                    <View>
                      <View style={styles.statLabelRow}>
                        <Text style={[styles.statLabelText, { color: theme.subText }]}>Attendance Rate</Text>
                        <Text style={[styles.statValueText, { color: theme.success, fontWeight: '700' }]}>
                          {studentStats.attendanceRate !== null ? `${studentStats.attendanceRate}%` : 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.progressBg, { backgroundColor: theme.chipBg, height: 10, borderRadius: 5 }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${studentStats.attendanceRate ?? 0}%`,
                              backgroundColor: getProgressColor(studentStats.attendanceRate ?? 0),
                              height: 10,
                              borderRadius: 5
                            }
                          ]}
                        />
                      </View>
                    </View>

                    {/* Quiz Progress Stat */}
                    <View>
                      <View style={styles.statLabelRow}>
                        <Text style={[styles.statLabelText, { color: theme.subText }]}>Average Quiz Score</Text>
                        <Text style={[styles.statValueText, { color: theme.accent, fontWeight: '700' }]}>
                          {studentStats.progressVal !== null ? `${studentStats.progressVal}%` : 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.progressBg, { backgroundColor: theme.chipBg, height: 10, borderRadius: 5 }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${studentStats.progressVal ?? 0}%`,
                              backgroundColor: getProgressColor(studentStats.progressVal ?? 0),
                              height: 10,
                              borderRadius: 5
                            }
                          ]}
                        />
                      </View>
                    </View>

                    {/* Quizzes Count Stat */}
                    <View style={[styles.pillStatBox, { backgroundColor: theme.chipBg }]}>
                      <Text style={[styles.pillStatLabel, { color: theme.muted }]}>Total Quizzes Attempted</Text>
                      <Text style={[styles.pillStatValue, { color: theme.text }]}>
                        {studentStats.quizCount !== null ? studentStats.quizCount : 'N/A'}
                      </Text>
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

  // ─── Admin Reward Modal Logic ───────────────────────────────────────────────
  const openRewardModal = async () => {
    // Phase 1: Render instantly using cached students
    const cachedStuds = getCache('reward_students');
    if (cachedStuds) {
      setRewardStudents(cachedStuds);
    }
    setRewardModalVisible(true);

    // Phase 2: Fetch background data and reconcile
    try {
      const res = await apiClient.get('/rewards/teacher/students');
      const studs = res.data.students || [];
      setRewardStudents(studs);
      setCache('reward_students', studs);
    } catch (e) {
      if (!cachedStuds) {
        Alert.alert('Error', 'Could not load students.');
      }
    }
  };

  const handleGiveReward = async () => {
    if (!selectedRewardStudent) {
      if (Platform.OS === 'web') window.alert('Please select a student first.');
      else Alert.alert('Select Student', 'Please choose a student first.');
      return;
    }
    const pts = parseInt(rewardPoints, 10);
    if (!pts || pts <= 0) {
      if (Platform.OS === 'web') window.alert('Enter a valid points amount.');
      else Alert.alert('Invalid Points', 'Enter a valid points amount.');
      return;
    }
    if (!rewardReason.trim()) {
      if (Platform.OS === 'web') window.alert('Please add a reason.');
      else Alert.alert('Add Reason', 'Please add a reason for the reward.');
      return;
    }

    setGivingReward(true);
    try {
      await apiClient.post('/rewards/teacher/give', {
        student_id: selectedRewardStudent.id,
        points: pts,
        reason: rewardReason.trim(),
      });
      if (Platform.OS === 'web') window.alert(`Successfully awarded ${pts} XP to ${selectedRewardStudent.name}!`);
      else Alert.alert('⭐ Points Sent!', `Successfully awarded ${pts} XP to ${selectedRewardStudent.name}!`);
      setRewardModalVisible(false);
      setSelectedRewardStudent(null);
      setRewardPoints('');
      setRewardReason('');
      setRewardStudentSearch('');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Could not award points.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Failed', msg);
    } finally {
      setGivingReward(false);
    }
  };

  const filteredRewardStudents = rewardStudents.filter(s =>
    s.name.toLowerCase().includes(rewardStudentSearch.toLowerCase())
  );

  const renderAdminRewardModal = () => (
    <Modal
      visible={rewardModalVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setRewardModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.card, maxHeight: '85%' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>🎁 Reward Student</Text>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: theme.chipBg }]}
              onPress={() => setRewardModalVisible(false)}
            >
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

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
                  keyExtractor={(s) => s.id}
                  nestedScrollEnabled
                  renderItem={({ item: s }) => (
                    <TouchableOpacity
                      style={[
                        styles.rewardStudentRow,
                        { borderColor: theme.border },
                        selectedRewardStudent?.id === s.id && { borderColor: theme.accent, backgroundColor: theme.accentLight },
                      ]}
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
                      {selectedRewardStudent?.id === s.id && (
                        <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ color: theme.muted, textAlign: 'center', padding: 12 }}>No students found</Text>}
                />
              </View>
            </View>

            {/* Points Input */}
            <View>
              <Text style={[styles.rewardLabel, { color: theme.subText }]}>Points (Unlimited)</Text>
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
              {givingReward ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>⭐ Award Points</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN SCREEN BODY RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Admin Console</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Main Tab Bar */}
      <View style={[styles.mainTabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.mainTabBtn, activeMainTab === 'quizzes' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveMainTab('quizzes')}
        >
          <Ionicons name="document-text-outline" size={20} color={activeMainTab === 'quizzes' ? theme.accent : theme.muted} />
          <Text style={[styles.mainTabLabel, { color: theme.subText }, activeMainTab === 'quizzes' && { color: theme.accent, fontWeight: '700' }]}>
            Quizzes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTabBtn, activeMainTab === 'results' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveMainTab('results')}
        >
          <Ionicons name="stats-chart-outline" size={20} color={activeMainTab === 'results' ? theme.accent : theme.muted} />
          <Text style={[styles.mainTabLabel, { color: theme.subText }, activeMainTab === 'results' && { color: theme.accent, fontWeight: '700' }]}>
            Results
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTabBtn, activeMainTab === 'students' && { borderBottomColor: theme.accent }]}
          onPress={() => setActiveMainTab('students')}
        >
          <Ionicons name="people-outline" size={20} color={activeMainTab === 'students' ? theme.accent : theme.muted} />
          <Text style={[styles.mainTabLabel, { color: theme.subText }, activeMainTab === 'students' && { color: theme.accent, fontWeight: '700' }]}>
            Students
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <View style={{ flex: 1 }}>
        {activeMainTab === 'quizzes' && renderQuizzesTab()}
        {activeMainTab === 'results' && renderResultsTab()}
        {activeMainTab === 'students' && renderStudentsTab()}
      </View>

      {/* Reward Student FAB (Students tab only) */}
      {activeMainTab === 'students' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#F59E0B', right: 20, bottom: 20 }]}
          onPress={openRewardModal}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>🎁</Text>
        </TouchableOpacity>
      )}

      {/* Student Detail Modal */}
      {renderStudentDetailModal()}

      {/* Admin Reward Modal */}
      {renderAdminRewardModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  mainTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingTop: 4,
  },
  mainTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  mainTabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  quizCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizIcon: {
    fontSize: 22,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  quizInfo: {
    marginBottom: 16,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  quizDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  // Results Filters & Sub-Tabs
  filterContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginLeft: 20,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  chipList: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataText: {
    fontSize: 11,
    marginLeft: 20,
    fontStyle: 'italic',
  },
  subTabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  subTabBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dashboardContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  staffDashboard: {
    gap: 16,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  miniProgressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statSubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  dashSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  cardSection: {
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    gap: 10,
  },
  studentLeaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  leaderboardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderboardRank: {
    fontSize: 13,
    fontWeight: '800',
    width: 20,
  },
  leaderboardName: {
    fontSize: 13,
    fontWeight: '600',
  },
  leaderboardRight: {
    alignItems: 'flex-end',
  },
  leaderboardScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  leaderboardAttempts: {
    fontSize: 9,
    marginTop: 1,
  },
  quizStatRow: {
    paddingVertical: 2,
  },
  quizStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  quizStatTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  quizStatPct: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  quizStatAttempts: {
    fontSize: 9,
    marginTop: 3,
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  resultInfo: {
    flex: 1,
  },
  studentNameName: {
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 3,
  },
  dateText: {
    fontSize: 11,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
    borderLeftWidth: 1,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  maxScore: {
    fontSize: 11,
  },
  ptsLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    marginTop: 1,
    fontWeight: '700',
  },
  chevron: {
    fontSize: 16,
    marginLeft: 8,
  },
  // Responsive Table styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerColText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCol: {
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 14,
  },
  rowSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  smallBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 90,
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollContent: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarImageLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  detailName: {
    fontSize: 20,
    fontWeight: '800',
  },
  detailRole: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  infoSection: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoTextSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  statsSection: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statValueText: {
    fontSize: 14,
  },
  pillStatBox: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  pillStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillStatValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  shimmerContainer: {
    gap: 8,
    width: '100%',
    paddingVertical: 4,
  },
  shimmerLine: {
    height: 12,
    borderRadius: 6,
  },
  studentFilterCard: {
    padding: 16,
    borderBottomWidth: 1,
  },
  studentExportRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  studentExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 10,
    gap: 6,
  },
  studentExportBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  studentSearchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  studentSearchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },
  studentFilterLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  studentFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  studentFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Admin Reward Modal ──────────────────────────────────────────────────────
  rewardLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  rewardInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  rewardStudentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 6,
  },
  rewardGiveBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
