import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  ActivityIndicator, SafeAreaView, TouchableOpacity 
} from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

export default function QuizResultsScreen({ navigation }) {
  const [results, setResults] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isStaff = user?.role === 'teacher' || user?.role === 'admin';

  useEffect(() => {
    if (isStaff) {
      fetchBatches();
    }
    fetchResults();
  }, [selectedBatchId]);

  const fetchBatches = async () => {
    try {
      const response = await apiClient.get('/batches/');
      setBatches(response.data);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    }
  };

  const fetchResults = async () => {
    try {
      let url = '/quizzes/results/all';
      if (selectedBatchId) {
        url += `?batch_id=${selectedBatchId}`;
      }
      const response = await apiClient.get(url);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
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

      {isStaff && batches.length > 0 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={[{ id: null, name: 'All Batches' }, ...batches]}
            keyExtractor={(item) => (item.id ? item.id.toString() : 'all')}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.batchChip, selectedBatchId === item.id && styles.batchChipActive]}
                onPress={() => setSelectedBatchId(item.id)}
              >
                <Text style={[styles.batchChipText, selectedBatchId === item.id && styles.batchChipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            style={styles.chipList}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Loading scores...</Text>
        </View>
      ) : (
        <FlatList
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  chipList: {
    paddingHorizontal: 15,
  },
  batchChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
    marginRight: 10,
  },
  batchChipActive: {
    backgroundColor: '#007AFF',
  },
  batchChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  batchChipTextActive: {
    color: '#fff',
  },
});
