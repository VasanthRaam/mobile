import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, SafeAreaView,
  RefreshControl
} from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function QuizListScreen({ navigation }) {
  const [quizzes, setQuizzes] = useState(getCache('quiz_list') || []);
  const [loading, setLoading] = useState(!getCache('quiz_list'));
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();
  const role = user?.role;
  const { theme, isDark } = useThemeStore();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await apiClient.get('/quizzes/');
      console.log('Fetched quizzes:', response.data.length);
      setQuizzes(response.data);
      setCache('quiz_list', response.data);
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchQuizzes();
  };

  const renderItem = ({ item }) => {
    const isStudent = role === 'student';
    const isStaff = role === 'teacher' || role === 'admin';
    
    return (
      <TouchableOpacity 
        style={[
          styles.quizCard, 
          { backgroundColor: theme.card, borderColor: theme.border },
          item.is_completed && { backgroundColor: isDark ? '#1e293b' : '#FAFAFA', borderColor: theme.border }
        ]}
        onPress={() => {
          if (isStudent) {
            if (item.is_completed) {
              navigation.navigate('SubmissionDetail', { attemptId: item.attempt_id });
            } else {
              navigation.navigate('Quiz', { quizId: item.id, quizTitle: item.title });
            }
          } else if (isStaff) {
            navigation.navigate('QuizResults', { quizId: item.id });
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconContainer, 
            { backgroundColor: theme.accentLight },
            item.is_completed && { backgroundColor: theme.chipBg }
          ]}>
            <Text style={styles.quizIcon}>{item.is_completed ? '✅' : (isStudent ? '📝' : '📊')}</Text>
          </View>
          <View style={[
            styles.badge, 
            item.is_completed ? { backgroundColor: theme.chipBg } : (isStudent ? { backgroundColor: theme.accentLight } : { backgroundColor: theme.successLight })
          ]}>
            <Text style={[
              styles.badgeText, 
              item.is_completed ? { color: theme.subText } : (isStudent ? { color: theme.accent } : { color: theme.success })
            ]}>
              {item.is_completed ? 'COMPLETED' : (isStudent ? 'NEW' : 'ACTIVE')}
            </Text>
          </View>
        </View>

        <View style={styles.quizInfo}>
          <Text style={[styles.quizTitle, { color: theme.text }]}>{item.title}</Text>
          <Text style={[styles.quizDescription, { color: theme.subText }]} numberOfLines={2}>
            {item.description || 'Test your knowledge and grow your skills! 🌟'}
          </Text>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <View style={styles.statsRow}>
            <Text style={[styles.statText, { color: theme.subText }]}>⏱️ 10m</Text>
            <Text style={[styles.statText, { color: theme.subText }]}>❓ {item.questions?.length || 0} Qs</Text>
          </View>
          <View style={[
            styles.actionBtn, 
            { backgroundColor: theme.accent }, 
            item.is_completed && { backgroundColor: theme.chipBg }
          ]}>
            <Text style={[
              styles.actionBtnText,
              { color: '#fff' },
              item.is_completed && { color: theme.text }
            ]}>
              {item.is_completed ? 'View Score' : (isStudent ? 'Start Quiz' : 'View Results')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Learning Quizzes</Text>
          <View style={[styles.roleBadge, { backgroundColor: theme.chipBg }]}>
            <Text style={[styles.roleText, { color: theme.subText }]}>{role?.toUpperCase()}</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={[styles.centered, { backgroundColor: theme.bg }]}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Fetching your challenges...</Text>
        </View>
      ) : (
        <FlatList
        showsVerticalScrollIndicator={false}
          data={quizzes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🎈</Text>
              <Text style={[styles.emptyText, { color: theme.subText }]}>No quizzes available right now. Check back later!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 24,
    color: '#475569',
    fontWeight: 'bold',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  roleBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  listContainer: {
    padding: 20,
  },
  quizCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quizIcon: {
    fontSize: 24,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadge: { backgroundColor: '#EFF6FF' },
  activeBadge: { backgroundColor: '#F0FDF4' },
  completedBadge: { backgroundColor: '#F1F5F9' },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  newBadgeText: { color: '#2563EB' },
  activeBadgeText: { color: '#16A34A' },
  completedBadgeText: { color: '#64748B' },
  completedCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E2E8F0',
  },
  completedIconContainer: {
    backgroundColor: '#F1F5F9',
  },
  completedBtn: {
    backgroundColor: '#64748B',
  },
  quizInfo: {
    marginBottom: 20,
  },
  quizTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  quizDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  staffBtn: {
    backgroundColor: '#64748B',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
    fontWeight: '600',
  },
});
