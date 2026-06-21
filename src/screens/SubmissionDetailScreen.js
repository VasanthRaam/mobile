import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  SafeAreaView, TouchableOpacity 
} from 'react-native';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function SubmissionDetailScreen({ route, navigation }) {
  const { theme, isDark } = useThemeStore();
  const { attemptId } = route.params;
  const [details, setDetails] = useState(getCache('submission_detail_' + attemptId) || null);
  const [loading, setLoading] = useState(!getCache('submission_detail_' + attemptId));
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const response = await apiClient.get(`/quizzes/attempts/${attemptId}/details`);
      setDetails(response.data);
      setCache('submission_detail_' + attemptId, response.data);
    } catch (err) {
      console.error('Failed to fetch submission details:', err);
      setError(err.response?.data?.detail || 'Failed to load submission review.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Analyzing results...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backText, { color: theme.accent }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Error</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={[styles.errorContainer, { backgroundColor: theme.bg }]}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.accent }]} onPress={fetchDetails}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnIcon, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Review Submission</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.summaryCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.summaryTitle, { color: theme.text }]}>{details.quiz_title}</Text>
        <Text style={[styles.studentName, { color: theme.accent }]}>{details.student_name}</Text>
        <View style={[styles.scoreRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.scoreLabel, { color: theme.text }]}>Final Score:</Text>
          <Text style={[styles.scoreValue, { color: theme.success }]}>{details.total_score} / {details.max_score}</Text>
        </View>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={details.answers}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.answerCard, 
            { backgroundColor: theme.card },
            item.is_correct ? { borderLeftColor: theme.success } : { borderLeftColor: theme.danger }
          ]}>
            <Text style={[styles.questionText, { color: theme.text }]}>{item.question_text}</Text>
            
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: theme.subText }]}>Selected:</Text>
              <Text style={[styles.value, item.is_correct ? { color: theme.success } : { color: theme.danger }]}>
                {item.selected_option_text}
              </Text>
            </View>

            {!item.is_correct && (
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: theme.subText }]}>Correct Answer:</Text>
                <Text style={[styles.value, { color: theme.success }]}>{item.correct_option_text}</Text>
              </View>
            )}

            <View style={[styles.pointsBadge, { backgroundColor: theme.chipBg }]}>
              <Text style={[styles.pointsText, { color: theme.text }]}>
                {item.points_earned} / {item.max_points} pts
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnIcon: {
    fontSize: 24,
    color: '#1E293B',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  studentName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#333',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CD964',
    marginLeft: 10,
  },
  listContainer: {
    padding: 20,
    paddingTop: 0,
  },
  answerCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 5,
  },
  correctCard: {
    borderLeftColor: '#4CD964',
  },
  wrongCard: {
    borderLeftColor: '#FF3B30',
  },
  questionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    color: '#999',
    width: 120,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  correctText: {
    color: '#2E7D32',
  },
  wrongText: {
    color: '#D32F2F',
  },
  pointsBadge: {
    alignSelf: 'flex-end',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 5,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  }
});
