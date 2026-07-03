import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Animated, TextInput, ActivityIndicator, Dimensions,
  RefreshControl, Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');
const TABS = ['Overall', 'Monthly', 'Rewards'];
const LEVEL_COLORS = ['#F59E0B', '#94A3B8', '#CD7F32']; // Gold, Silver, Bronze for top 3

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w, h, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return <Animated.View style={[{ width: w, height: h, borderRadius: 8, backgroundColor: '#94A3B8', opacity }, style]} />;
}

// ── Podium (top 3) ────────────────────────────────────────────────────────────
function PodiumCard({ entry, position, theme }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const heights = [90, 70, 60]; // 1st tallest
  const colors = ['#F59E0B', '#94A3B8', '#CD7F32'];
  const emojis = ['🥇', '🥈', '🥉'];
  const color = colors[position - 1] || '#6366F1';

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: position * 100,
      useNativeDriver: true,
      tension: 100,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.podiumItem, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={{ fontSize: 10, color: theme.subText, marginBottom: 4 }} numberOfLines={1}>
        {entry.student_name.split(' ')[0]}
      </Text>
      {entry.profile_picture ? (
        <Image source={{ uri: entry.profile_picture }} style={[styles.podiumAvatar, { borderColor: color }]} />
      ) : (
        <View style={[styles.podiumAvatar, { backgroundColor: color + '30', borderColor: color, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color, fontSize: 18, fontWeight: '700' }}>{entry.student_name[0]}</Text>
        </View>
      )}
      <Text style={{ fontSize: 16 }}>{emojis[position - 1]}</Text>
      <View style={[styles.podiumBase, { height: heights[position - 1], backgroundColor: color + '25', borderTopColor: color }]}>
        <Text style={{ color, fontSize: 12, fontWeight: '800' }}>#{entry.rank}</Text>
        <Text style={{ color, fontSize: 11, fontWeight: '600' }}>⭐ {entry.current_points}</Text>
      </View>
    </Animated.View>
  );
}

// ── Leaderboard Row ───────────────────────────────────────────────────────────
function LeaderboardRow({ entry, index, theme, isDark }) {
  const isTop3 = entry.rank <= 3;
  const rowColor = isTop3 ? LEVEL_COLORS[entry.rank - 1] : null;

  return (
    <View style={[
      styles.leaderRow,
      { backgroundColor: isTop3 ? rowColor + '10' : theme.card, borderColor: isTop3 ? rowColor + '40' : theme.border }
    ]}>
      <Text style={[styles.rankNum, { color: isTop3 ? rowColor : theme.subText }]}>
        {isTop3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
      </Text>
      {entry.profile_picture ? (
        <Image source={{ uri: entry.profile_picture }} style={styles.rowAvatar} />
      ) : (
        <View style={[styles.rowAvatar, { backgroundColor: '#6366F120', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#6366F1', fontWeight: '700' }}>{entry.student_name?.[0] || '?'}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{entry.student_name}</Text>
        {entry.course_name && (
          <Text style={[styles.rowSub, { color: theme.subText }]} numberOfLines={1}>
            {entry.course_name} {entry.batch_name ? `· ${entry.batch_name}` : ''}
          </Text>
        )}
      </View>
      <View style={styles.rowPts}>
        <Text style={[styles.rowPtsVal, { color: isTop3 ? rowColor : '#6366F1' }]}>⭐ {entry.current_points.toLocaleString()}</Text>
      </View>
    </View>
  );
}

// ── Reward Catalog Item ───────────────────────────────────────────────────────
function RewardItem({ item, studentBalance, onRedeem, theme, isDark }) {
  const isUnlocked = studentBalance >= item.points_required;
  const progress = Math.min(1, studentBalance / item.points_required);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => isUnlocked && onRedeem(item));
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.rewardCard, { backgroundColor: theme.card, borderColor: isUnlocked ? '#6366F1' : theme.border, opacity: isUnlocked ? 1 : 0.75 }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={[styles.rewardIconBox, { backgroundColor: isUnlocked ? '#6366F115' : (isDark ? '#1E293B' : '#F1F5F9') }]}>
          <Text style={styles.rewardIcon}>{isUnlocked ? '🎁' : '🔒'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rewardTitle, { color: theme.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.rewardDesc, { color: theme.subText }]} numberOfLines={2}>{item.description}</Text>
          {/* Progress bar */}
          <View style={[styles.rewardTrack, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View style={[styles.rewardFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: isUnlocked ? '#10B981' : '#6366F1' }]} />
          </View>
          <Text style={[styles.rewardNeeded, { color: isUnlocked ? '#10B981' : theme.subText }]}>
            {isUnlocked ? '✅ Unlocked! Tap to redeem' : `${(item.points_required - studentBalance).toLocaleString()} pts needed`}
          </Text>
        </View>
        <View style={[styles.rewardBadge, { backgroundColor: isUnlocked ? '#6366F1' : (isDark ? '#334155' : '#E2E8F0') }]}>
          <Text style={{ color: isUnlocked ? '#fff' : theme.subText, fontSize: 11, fontWeight: '700' }}>
            ⭐ {item.points_required.toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState(0);
  const [entries, setEntries] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [studentBalance, setStudentBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const tabAnim = useRef(new Animated.Value(0)).current;
  const searchTimeout = useRef(null);

  useFocusEffect(useCallback(() => {
    fetchData(1, true);
  }, [activeTab, searchDebounce]));

  const onSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearchDebounce(text), 400);
  };

  const fetchData = useCallback(async (pageNum = 1, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      if (activeTab < 2) {
        const period = activeTab === 1 ? 'monthly' : 'all';
        const params = { page: pageNum, page_size: 20, period, search: searchDebounce };
        const res = await apiClient.get('/rewards/leaderboard', { params });
        const newEntries = res.data.entries || [];
        setEntries(reset ? newEntries : [...entries, ...newEntries]);
        setHasMore(newEntries.length === 20);
        setPage(pageNum);
      } else {
        // Rewards tab
        const catRes = await apiClient.get('/rewards/catalog');
        setCatalog(catRes.data.items || []);
        setStudentBalance(catRes.data.student_balance || 0);
      }
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, searchDebounce, entries]);

  const switchTab = (idx) => {
    setActiveTab(idx);
    setEntries([]);
    setPage(1);
    setLoading(true);
    Animated.timing(tabAnim, { toValue: idx, duration: 200, useNativeDriver: false }).start();
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && activeTab < 2) {
      fetchData(page + 1);
    }
  };

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#1E293B' : '#4F46E5' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏆 Leaderboard</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {TABS.map((tab, idx) => (
          <TouchableOpacity key={idx} style={styles.tab} onPress={() => switchTab(idx)}>
            <Text style={[styles.tabText, { color: activeTab === idx ? '#6366F1' : theme.subText }]}>{tab}</Text>
            {activeTab === idx && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search bar (only for leaderboard tabs) */}
      {activeTab < 2 && (
        <View style={[styles.searchBox, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
          <Text style={{ color: theme.subText, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search students..."
            placeholderTextColor={theme.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchDebounce(''); }}>
              <Text style={{ color: theme.subText }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Skeleton w={44} h={44} style={{ borderRadius: 22 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton w="70%" h={14} />
                <Skeleton w="50%" h={11} />
              </View>
              <Skeleton w={60} h={24} style={{ borderRadius: 12 }} />
            </View>
          ))}
        </View>
      ) : activeTab === 2 ? (
        // ── Rewards Tab ────────────────────────────────────────────────────────
        <FlatList
          data={catalog}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <RewardItem
              item={item}
              studentBalance={studentBalance}
              theme={theme}
              isDark={isDark}
              onRedeem={async (reward) => {
                try {
                  await apiClient.post(`/rewards/redeem/${reward.id}`);
                  fetchData(1, true);
                } catch (e) {
                  const msg = e.response?.data?.detail || 'Could not redeem reward.';
                  if (Platform.OS === 'web') window.alert(msg);
                  else require('react-native').Alert.alert('Redeem Failed', msg);
                }
              }}
            />
          )}
          ListHeaderComponent={() => (
            <View style={styles.rewardHeader}>
              <Text style={[styles.rewardHeaderTitle, { color: theme.text }]}>⭐ XP Rewards</Text>
              {user?.role === 'student' && (
                <Text style={[styles.rewardHeaderSub, { color: '#6366F1' }]}>Your balance: {studentBalance.toLocaleString()} pts</Text>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: theme.subText, textAlign: 'center', marginTop: 40 }}>No rewards available yet.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(1, true); }} tintColor="#6366F1" />}
        />
      ) : (
        // ── Leaderboard Tab ─────────────────────────────────────────────────────
        <FlatList
          data={rest}
          keyExtractor={i => i.student_id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(1, true); }} tintColor="#6366F1" />}
          ListHeaderComponent={() => (
            <>
              {/* Podium */}
              {top3.length > 0 && (
                <View style={styles.podiumContainer}>
                  {top3[1] && <PodiumCard entry={top3[1]} position={2} theme={theme} />}
                  {top3[0] && <PodiumCard entry={top3[0]} position={1} theme={theme} />}
                  {top3[2] && <PodiumCard entry={top3[2]} position={3} theme={theme} />}
                </View>
              )}
              <Text style={[styles.restTitle, { color: theme.subText }]}>All Rankings</Text>
            </>
          )}
          renderItem={({ item, index }) => (
            <LeaderboardRow entry={item} index={index} theme={theme} isDark={isDark} />
          )}
          ListFooterComponent={() => loadingMore ? <ActivityIndicator style={{ margin: 20 }} color="#6366F1" /> : null}
          ListEmptyComponent={<Text style={{ color: theme.subText, textAlign: 'center', marginTop: 40 }}>No students yet. Complete quizzes to earn points!</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabUnderline: { position: 'absolute', bottom: 0, width: '60%', height: 3, backgroundColor: '#6366F1', borderRadius: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // ── Podium ─────────────────────────────────────────────────────────────────
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 16,
    paddingVertical: 16,
    gap: 8,
  },
  podiumItem: { alignItems: 'center', width: 90 },
  podiumAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    marginBottom: 4,
  },
  podiumBase: {
    width: 80,
    borderTopWidth: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  restTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Leaderboard Row ────────────────────────────────────────────────────────
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  rankNum: { width: 32, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11, marginTop: 1 },
  rowPts: { alignItems: 'flex-end' },
  rowPtsVal: { fontSize: 13, fontWeight: '700' },

  // ── Reward Catalog ─────────────────────────────────────────────────────────
  rewardHeader: { marginBottom: 16 },
  rewardHeaderTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  rewardHeaderSub: { fontSize: 14, fontWeight: '600' },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  rewardIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardIcon: { fontSize: 26 },
  rewardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rewardDesc: { fontSize: 11, marginBottom: 8 },
  rewardTrack: { height: 5, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  rewardFill: { height: 5, borderRadius: 3 },
  rewardNeeded: { fontSize: 10, fontWeight: '600' },
  rewardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
});
