import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  FlatList, Alert, SafeAreaView,
  Dimensions
} from 'react-native';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

const { width } = Dimensions.get('window');

export default function QuizScreen({ route, navigation }) {
  const { theme, isDark } = useThemeStore();
  const { quizId, quizTitle } = route.params;

  const cachedQuiz = getCache('quiz_detail_' + quizId);
  const [loading, setLoading] = useState(!cachedQuiz);
  const [quiz, setQuiz] = useState(cachedQuiz || null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(cachedQuiz?.questions ? cachedQuiz.questions.length * 60 : 600); // 10 minutes default
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
      setCache('quiz_detail_' + quizId, response.data);
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
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading Fun Quiz...</Text>
      </View>
    );
  }

  if (isFinished && results) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.resultContainer, { backgroundColor: theme.bg }]}>
          <Text style={[styles.congratsText, { color: theme.accent }]}>🎉 Great Job! 🎉</Text>
          <View style={[styles.scoreCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.scoreLabel, { color: theme.subText }]}>Your Score</Text>
            <Text style={[styles.scoreValue, { color: theme.text }]}>{results.total_score} / {results.max_score}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.finishButton, { backgroundColor: theme.accent }]}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={[styles.finishButtonText, { color: '#fff' }]}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.headerBack, { color: theme.danger }]}>← Quit</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{quizTitle}</Text>
        <View style={[styles.timerBadge, { backgroundColor: theme.warningLight, borderColor: theme.warning }]}>
          <Text style={[styles.timerText, { color: theme.warning }]}>⏳ {formatTime(timeLeft)}</Text>
        </View>
      </View>

      <View style={[styles.progressContainer, { backgroundColor: theme.chipBg }]}>
        <View 
          style={[
            styles.progressBar, 
            { backgroundColor: theme.success },
            { width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }
          ]} 
        />
      </View>

      <View style={styles.quizContent}>
        <Text style={[styles.questionNumber, { color: theme.subText }]}>Question {currentQuestionIndex + 1} of {quiz.questions.length}</Text>
        <Text style={[styles.questionText, { color: theme.text }]}>{currentQuestion.question_text}</Text>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={currentQuestion.options}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedAnswers[currentQuestion.id] === item.id;
            const isRevealed = revealedAnswers[currentQuestion.id];
            
            let backgroundColor = theme.card;
            let borderColor = theme.border;
            let textColor = theme.text;
            let dotColor = 'transparent';
            let dotBorderColor = theme.border;
            
            if (isRevealed) {
              if (item.is_correct) {
                backgroundColor = theme.successLight;
                borderColor = theme.success;
                textColor = isDark ? '#2ecc71' : '#059669';
                dotColor = theme.success;
                dotBorderColor = theme.success;
              } else if (isSelected && !item.is_correct) {
                backgroundColor = theme.dangerLight;
                borderColor = theme.danger;
                textColor = isDark ? '#e74c3c' : '#DC2626';
                dotColor = theme.danger;
                dotBorderColor = theme.danger;
              }
            } else if (isSelected) {
              backgroundColor = theme.accentLight;
              borderColor = theme.accent;
              textColor = theme.accent;
              dotColor = theme.accent;
              dotBorderColor = theme.accent;
            }

            return (
              <TouchableOpacity 
                style={[styles.optionButton, { backgroundColor, borderColor }]}
                onPress={() => handleSelectOption(currentQuestion.id, item.id)}
                disabled={isRevealed}
              >
                <View style={[
                  styles.optionDot,
                  { backgroundColor: dotColor, borderColor: dotBorderColor }
                ]} />
                <Text style={[styles.optionText, { color: textColor }]}>
                  {item.option_text}
                </Text>
              </TouchableOpacity>
            );
          }}
          style={styles.optionsList}
        />
      </View>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        {currentQuestionIndex > 0 ? (
          <TouchableOpacity 
            style={[styles.navButton, { backgroundColor: theme.chipBg }]}
            onPress={() => setCurrentQuestionIndex(prev => prev - 1)}
          >
            <Text style={[styles.navButtonText, { color: theme.text }]}>Previous</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 100 }} />}

        {isLastQuestion ? (
          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: theme.success }, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitButtonText}>{submitting ? 'Checking...' : 'Finish!'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.navButton, { backgroundColor: theme.chipBg }]}
            onPress={() => setCurrentQuestionIndex(prev => prev + 1)}
          >
            <Text style={[styles.navButtonText, { color: theme.text }]}>Next</Text>
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
