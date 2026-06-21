import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, 
  TouchableOpacity, ScrollView, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../api/apiClient';
import { getCache, setCache } from '../utils/cacheManager';
import { useThemeStore } from '../store/useThemeStore';

export default function CreateQuizScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const cachedCourses = getCache('courses') || [];
  const [courses, setCourses] = useState(cachedCourses);
  const [loading, setLoading] = useState(cachedCourses.length === 0);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(cachedCourses.length > 0 ? cachedCourses[0].id : null);
  
  const [questions, setQuestions] = useState([
    {
      question_text: '',
      points: 10,
      options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false }
      ]
    }
  ]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/');
      setCourses(response.data);
      setCache('courses', response.data);
      if (response.data.length > 0 && !selectedCourseId) {
        setSelectedCourseId(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        points: 10,
        options: [
          { option_text: '', is_correct: true },
          { option_text: '', is_correct: false }
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const handleAddOption = (qIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.push({ option_text: '', is_correct: false });
    setQuestions(newQuestions);
  };

  const handleUpdateOption = (qIndex, oIndex, text) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options[oIndex].option_text = text;
    setQuestions(newQuestions);
  };

  const handleToggleCorrect = (qIndex, oIndex) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.forEach((opt, idx) => {
      opt.is_correct = idx === oIndex;
    });
    setQuestions(newQuestions);
  };

  const handleCreateQuiz = async () => {
    if (!title || !selectedCourseId) {
      Alert.alert('Error', 'Please enter a title and select a course.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create Quiz Header
      const quizResponse = await apiClient.post('/quizzes/', {
        title,
        description,
        course_id: selectedCourseId
      });
      
      const quizId = quizResponse.data.id;

      // 2. Add Questions
      await apiClient.post(`/quizzes/${quizId}/questions`, questions);

      Alert.alert('Success', 'Quiz created successfully! 🦁');
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create quiz:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <Text style={{ fontSize: 16, color: theme.text }}>Loading courses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.chipBg }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnIcon, { color: theme.danger }]}>×</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New Quiz</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={[styles.form, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: theme.text }]}>Quiz Title</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Science Fun Quiz"
          placeholderTextColor={theme.muted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { color: theme.text }]}>Description</Text>
        <TextInput 
          style={[styles.input, { height: 80, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
          placeholder="What is this quiz about?"
          placeholderTextColor={theme.muted}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Text style={[styles.label, { color: theme.text }]}>Select Course</Text>
        <View style={styles.courseList}>
          {courses.map(course => {
            const isSelected = selectedCourseId === course.id;
            return (
              <TouchableOpacity 
                key={course.id}
                style={[
                  styles.courseBadge,
                  { backgroundColor: theme.chipBg },
                  isSelected && { backgroundColor: theme.accent }
                ]}
                onPress={() => setSelectedCourseId(course.id)}
              >
                <Text style={[
                  styles.courseBadgeText,
                  { color: theme.subText },
                  isSelected && { color: '#fff' }
                ]}>
                  {course.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {questions.map((q, qIndex) => (
          <View key={qIndex} style={[styles.questionCard, { backgroundColor: theme.card, shadowColor: 'transparent', borderWidth: 1, borderColor: theme.border, elevation: 0 }]}>
            <View style={styles.qHeader}>
              <Text style={[styles.qTitle, { color: theme.accent }]}>Question {qIndex + 1}</Text>
              {questions.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveQuestion(qIndex)}>
                  <Text style={[styles.removeText, { color: theme.danger }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput 
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Question text"
              placeholderTextColor={theme.muted}
              value={q.question_text}
              onChangeText={(text) => {
                const newQs = [...questions];
                newQs[qIndex].question_text = text;
                setQuestions(newQs);
              }}
            />

            <Text style={[styles.subLabel, { color: theme.subText }]}>Options (Select the correct one)</Text>
            {q.options.map((opt, oIndex) => (
              <View key={oIndex} style={styles.optionRow}>
                <TouchableOpacity 
                  style={[styles.radio, { borderColor: theme.accent }, opt.is_correct && { backgroundColor: theme.accent }]}
                  onPress={() => handleToggleCorrect(qIndex, oIndex)}
                />
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  placeholder={`Option ${oIndex + 1}`}
                  placeholderTextColor={theme.muted}
                  value={opt.option_text}
                  onChangeText={(text) => handleUpdateOption(qIndex, oIndex, text)}
                />
              </View>
            ))}

            <TouchableOpacity 
              style={styles.addOptionBtn}
              onPress={() => handleAddOption(qIndex)}
            >
              <Text style={[styles.addOptionText, { color: theme.accent }]}>+ Add Option</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity 
          style={[styles.addQuestionBtn, { backgroundColor: theme.successLight, borderColor: theme.success }]}
          onPress={handleAddQuestion}
        >
          <Text style={[styles.addQuestionText, { color: theme.success }]}>+ Add Another Question</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: theme.accent }, submitting && { opacity: 0.7 }]}
          onPress={handleCreateQuiz}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Creating Quiz...' : 'Create Quiz & Notify Students 🚀'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnIcon: {
    fontSize: 28,
    color: '#F43F5E',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F9FA',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 10,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  courseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  courseBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  courseBadgeSelected: {
    backgroundColor: '#007AFF',
  },
  courseBadgeText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  courseBadgeTextSelected: {
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 20,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  removeText: {
    color: '#FF3B30',
    fontSize: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 10,
  },
  radioSelected: {
    backgroundColor: '#007AFF',
  },
  addOptionBtn: {
    marginTop: 5,
  },
  addOptionText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  addQuestionBtn: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CD964',
    borderStyle: 'dashed',
  },
  addQuestionText: {
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
