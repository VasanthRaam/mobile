import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  ActivityIndicator, SafeAreaView, TouchableOpacity 
} from 'react-native';
import apiClient from '../api/apiClient';

export default function SubmissionDetailScreen({ route, navigation }) {
  const { attemptId } = route.params;
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const response = await apiClient.get(`/quizzes/attempts/${attemptId}/details`);
      setDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch submission details:', err);
      setError(err.response?.data?.detail || 'Failed to load submission review.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing results...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetails}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Submission</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{details.quiz_title}</Text>
        <Text style={styles.studentName}>{details.student_name}</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Final Score:</Text>
          <Text style={styles.scoreValue}>{details.total_score} / {details.max_score}</Text>
        </View>
      </View>

      <FlatList
        showsVerticalScrollIndicator={false}
        data={details.answers}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={[styles.answerCard, item.is_correct ? styles.correctCard : styles.wrongCard]}>
            <Text style={styles.questionText}>{item.question_text}</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.label}>Selected:</Text>
              <Text style={[styles.value, item.is_correct ? styles.correctText : styles.wrongText]}>
                {item.selected_option_text}
              </Text>
            </View>

            {!item.is_correct && (
              <View style={styles.infoRow}>
                <Text style={styles.label}>Correct Answer:</Text>
                <Text style={[styles.value, styles.correctText]}>{item.correct_option_text}</Text>
              </View>
            )}

            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>
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
