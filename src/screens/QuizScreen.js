import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  FlatList, ActivityIndicator, Alert, SafeAreaView,
  Dimensions
} from 'react-native';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');

export default function QuizScreen({ route, navigation }) {
  const { quizId, quizTitle } = route.params;

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default
  const [isFinished, setIsFinished] = useState(false);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState({}); // Track which questions have shown feedback

  const timerRef = useRef(null);

  useEffect(() => {
    fetchQuiz();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!loading && !isFinished && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [loading, isFinished]);

  const fetchQuiz = async () => {
    try {
      const response = await apiClient.get(`/quizzes/${quizId}`);
      setQuiz(response.data);
      // If quiz has questions, set a reasonable timer (e.g., 1 min per question)
      if (response.data.questions) {
        setTimeLeft(response.data.questions.length * 60);
      }
    } catch (error) {
      console.error('Failed to fetch quiz:', error);
      Alert.alert('Error', 'Could not load quiz details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId, optionId) => {
    if (revealedAnswers[questionId]) return; // Lock if already answered

    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionId
    });

    // Provide instant feedback
    setRevealedAnswers({
      ...revealedAnswers,
      [questionId]: true
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current);

    try {
      const answers = Object.entries(selectedAnswers).map(([qId, optId]) => ({
        question_id: qId,
        selected_option_id: optId
      }));

      const response = await apiClient.post(`/quizzes/${quizId}/submit`, {
        answers
      });

      setResults(response.data);
      setIsFinished(true);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit quiz.');
      // Restart timer if submission failed
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading Fun Quiz...</Text>
      </View>
    );
  }

  if (isFinished && results) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <Text style={styles.congratsText}>🎉 Great Job! 🎉</Text>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={styles.scoreValue}>{results.total_score} / {results.max_score}</Text>
          </View>
          <TouchableOpacity 
            style={styles.finishButton}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.finishButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerBack}>← Quit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{quizTitle}</Text>
        <View style={styles.timerBadge}>
          <Text style={styles.timerText}>⏳ {formatTime(timeLeft)}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View 
          style={[
            styles.progressBar, 
            { width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }
          ]} 
        />
      </View>

      <View style={styles.quizContent}>
        <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1} of {quiz.questions.length}</Text>
        <Text style={styles.questionText}>{currentQuestion.question_text}</Text>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={currentQuestion.options}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedAnswers[currentQuestion.id] === item.id;
            const isRevealed = revealedAnswers[currentQuestion.id];
            
            let backgroundColor = '#fff';
            let borderColor = '#E0E0E0';
            
            if (isRevealed) {
              if (item.is_correct) {
                backgroundColor = '#D1FAE5'; // Light green
                borderColor = '#10B981';
              } else if (isSelected && !item.is_correct) {
                backgroundColor = '#FEE2E2'; // Light red
                borderColor = '#EF4444';
              }
            } else if (isSelected) {
              backgroundColor = '#E3F2FD';
              borderColor = '#007AFF';
            }

            return (
              <TouchableOpacity 
                style={[styles.optionButton, { backgroundColor, borderColor }]}
                onPress={() => handleSelectOption(currentQuestion.id, item.id)}
                disabled={isRevealed}
              >
                <View style={[
                  styles.optionDot,
                  isSelected && { backgroundColor: isRevealed ? (item.is_correct ? '#10B981' : '#EF4444') : '#007AFF', borderColor: isRevealed ? (item.is_correct ? '#10B981' : '#EF4444') : '#007AFF' }
                ]} />
                <Text style={[styles.optionText, isSelected && { color: isRevealed ? (item.is_correct ? '#059669' : '#DC2626') : '#007AFF' }]}>
                  {item.option_text}
                </Text>
              </TouchableOpacity>
            );
          }}
          style={styles.optionsList}
        />
      </View>

      <View style={styles.footer}>
        {currentQuestionIndex > 0 ? (
          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => setCurrentQuestionIndex(prev => prev - 1)}
          >
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 100 }} />}

        {isLastQuestion ? (
          <TouchableOpacity 
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? 'Checking...' : 'Finish!'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => setCurrentQuestionIndex(prev => prev + 1)}
          >
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F8FF', // Alice Blue
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerBack: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timerBadge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  timerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F57F17',
  },
  progressContainer: {
    height: 10,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CD964', // Green
  },
  quizContent: {
    flex: 1,
    padding: 20,
  },
  questionNumber: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    lineHeight: 28,
  },
  optionsList: {
    flex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 15,
  },
  optionDotSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#007AFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  navButton: {
    backgroundColor: '#FFD700', // Yellow
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#4CD964', // Green
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  congratsText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 40,
    textAlign: 'center',
  },
  scoreCard: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 25,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 40,
  },
  scoreLabel: {
    fontSize: 18,
    color: '#8E8E93',
    marginBottom: 10,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  finishButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
  },
  finishButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
