import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Animated, RefreshControl, Modal, TextInput,
  FlatList, Alert, ActivityIndicator, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 70;

function Skeleton({ width: w, height: h, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return <Animated.View style={[{ width: w, height: h, borderRadius: 8, backgroundColor: '#475569', opacity }, style]} />;
}

export default function TeacherProfileScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const { theme, isDark } = useThemeStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardModalVisible, setRewardModalVisible] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardReason, setRewardReason] = useState('');
  const [giving, setGiving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const fetchProfile = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await apiClient.get('/profile/me');
      setProfile(res.data);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    } catch (e) {
      console.error('Teacher profile fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    fetchProfile();
  }, []));

  const openRewardModal = async () => {
    try {
      const res = await apiClient.get('/rewards/teacher/students');
      setStudents(res.data.students || []);
      setRewardModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Could not load students.');
    }
  };

  const handleGivePoints = async () => {
    if (!selectedStudent) return Alert.alert('Select a Student', 'Please choose a student first.');
    const pts = parseInt(rewardPoints, 10);
    if (!pts || pts <= 0) return Alert.alert('Invalid Points', 'Enter a valid points amount.');
    if (!rewardReason.trim()) return Alert.alert('Add Reason', 'Please add a reason for the reward.');

    setGiving(true);
    try {
      await apiClient.post('/rewards/teacher/give', {
        student_id: selectedStudent.id,
        points: pts,
        reason: rewardReason.trim(),
      });
      Alert.alert('⭐ Points Sent!', `Successfully awarded ${pts} XP to ${selectedStudent.name}!`);
      setRewardModalVisible(false);
      setSelectedStudent(null);
      setRewardPoints('');
      setRewardReason('');
      fetchProfile(true); // Refresh wallet
    } catch (e) {
      Alert.alert('Failed', e.response?.data?.detail || 'Could not award points.');
    } finally {
      setGiving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: '#7C3AED' }]}>
          <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} style={{ borderRadius: AVATAR_SIZE / 2 }} />
          <View style={{ marginLeft: 16 }}>
            <Skeleton width={130} height={18} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={13} />
          </View>
        </View>
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={140} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={120} />
        </View>
      </SafeAreaView>
    );
  }

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const walletPct = profile ? Math.round((profile.wallet_remaining / profile.wallet_total) * 100) : 100;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(true); }} tintColor="#7C3AED" />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
          </TouchableOpacity>
          <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={[styles.avatar, { backgroundColor: '#ffffff30', justifyContent: 'center', alignItems: 'center' }]}>
              {profile?.profile_picture ? (
                <Image source={{ uri: profile.profile_picture }} style={[StyleSheet.absoluteFill, { borderRadius: AVATAR_SIZE / 2 }]} />
              ) : (
                <Text style={{ fontSize: 34, color: '#fff' }}>{profile?.full_name?.[0] || '?'}</Text>
              )}
            </View>
            <View style={styles.headerInfoCol}>
              <Text style={styles.headerName} numberOfLines={2}>{profile?.full_name || user?.full_name}</Text>
              <Text style={styles.headerRole}>👩‍🏫 Teacher</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], padding: 20 }}>

          {/* ── Contact Info ──────────────────────────────────────────────── */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>📋 Contact Info</Text>
            <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Email</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.email || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.subText }]}>Phone</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{profile?.phone || '—'}</Text>
            </View>
          </View>

          {/* ── Assigned Batches ──────────────────────────────────────────── */}
          {profile?.assigned_batches?.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>🏫 Assigned Batches</Text>
              {profile.assigned_batches.map((b, idx) => (
                <View key={idx} style={[styles.batchRow, { backgroundColor: isDark ? '#1E293B' : '#F0F4FF' }]}>
                  <View style={[styles.batchDot, { backgroundColor: '#7C3AED' }]} />
                  <View>
                    <Text style={[styles.batchCourse, { color: theme.text }]}>{b.course_name}</Text>
                    <Text style={[styles.batchName, { color: theme.subText }]}>Batch: {b.batch_name}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── XP Monthly Wallet ─────────────────────────────────────────── */}
          <View style={[styles.card, styles.walletCard, { backgroundColor: '#7C3AED' }]}>
            <View style={styles.walletHeader}>
              <Text style={styles.walletTitle}>⭐ XP Monthly Wallet</Text>
              <View style={styles.walletBadge}>
                <Text style={styles.walletBadgeText}>{profile?.wallet_month || '—'}</Text>
              </View>
            </View>

            <View style={styles.walletStats}>
              <View style={styles.walletStat}>
                <Text style={styles.walletStatVal}>{profile?.wallet_remaining ?? 1000}</Text>
                <Text style={styles.walletStatLabel}>Remaining</Text>
              </View>
              <View style={styles.walletDivider} />
              <View style={styles.walletStat}>
                <Text style={styles.walletStatVal}>{profile?.wallet_distributed ?? 0}</Text>
                <Text style={styles.walletStatLabel}>Distributed</Text>
              </View>
              <View style={styles.walletDivider} />
              <View style={styles.walletStat}>
                <Text style={styles.walletStatVal}>{profile?.wallet_total ?? 1000}</Text>
                <Text style={styles.walletStatLabel}>Monthly Total</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.walletProgressTrack}>
              <View style={[styles.walletProgressFill, { width: `${walletPct}%` }]} />
            </View>
            <Text style={styles.walletExpiry}>
              Expires: {profile?.wallet_expires_at ? new Date(profile.wallet_expires_at).toLocaleDateString() : '—'}
            </Text>

            <TouchableOpacity style={styles.rewardBtn} onPress={openRewardModal} activeOpacity={0.8}>
              <Text style={styles.rewardBtnText}>🎁 Reward a Student</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>

        {/* ── Account Actions ────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 20, paddingBottom: 40 }}>
          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: isDark ? '#ef444415' : '#fef2f2', borderColor: '#ef4444' }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={[styles.appVersion, { color: theme.muted }]}>BuddyBloom Academy · v1.0</Text>
        </Animated.View>

      </ScrollView>

      {/* ── Reward Student Modal ────────────────────────────────────────────── */}
      <Modal visible={rewardModalVisible} transparent animationType="slide" onRequestClose={() => setRewardModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🌟 Reward a Student</Text>
            <Text style={[styles.modalSub, { color: theme.subText }]}>You have {profile?.wallet_remaining || 0} pts remaining</Text>

            {/* Student picker */}
            <Text style={[styles.fieldLabel, { color: theme.subText }]}>Select Student</Text>
            <ScrollView style={styles.studentPicker} showsVerticalScrollIndicator={false}>
              {students.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.studentRow,
                    { borderColor: selectedStudent?.id === s.id ? '#7C3AED' : theme.border },
                    selectedStudent?.id === s.id && { backgroundColor: '#7C3AED15' },
                  ]}
                  onPress={() => setSelectedStudent(s)}
                >
                  <View style={[styles.studentAvatar, { backgroundColor: '#7C3AED30' }]}>
                    <Text style={{ color: '#7C3AED', fontWeight: '700' }}>{s.name[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{s.name}</Text>
                    <Text style={[styles.studentPts, { color: theme.subText }]}>⭐ {s.current_points} pts</Text>
                  </View>
                  {selectedStudent?.id === s.id && <Text style={{ color: '#7C3AED' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Points input */}
            <Text style={[styles.fieldLabel, { color: theme.subText }]}>Points to Award</Text>
            <TextInput
              style={[styles.textInput, { borderColor: theme.border, color: theme.text, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
              value={rewardPoints}
              onChangeText={setRewardPoints}
              placeholder="e.g. 50"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
            />

            {/* Reason input */}
            <Text style={[styles.fieldLabel, { color: theme.subText }]}>Reason</Text>
            <TextInput
              style={[styles.textInput, { borderColor: theme.border, color: theme.text, backgroundColor: isDark ? '#1E293B' : '#F8FAFC', height: 80 }]}
              value={rewardReason}
              onChangeText={setRewardReason}
              placeholder="e.g. Excellent performance in today's class"
              placeholderTextColor={theme.muted}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setRewardModalVisible(false)}>
                <Text style={{ color: theme.subText, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, { opacity: giving ? 0.7 : 1 }]} onPress={handleGivePoints} disabled={giving}>
                {giving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Send Points ⭐</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#7C3AED',
    paddingBottom: 16,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 16 : 12,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#ffffff60',
    overflow: 'hidden',
  },
  headerInfoCol: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerName: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerRole: { fontSize: 13, color: '#ffffff90' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    padding: 16,
    paddingBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginTop: 0,
    padding: 12,
    borderRadius: 12,
  },
  batchDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  batchCourse: { fontSize: 14, fontWeight: '700' },
  batchName: { fontSize: 12, marginTop: 2 },

  // ── Wallet ────────────────────────────────────────────────────────────────
  walletCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  walletTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  walletBadge: { backgroundColor: '#ffffff25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  walletBadgeText: { color: '#fff', fontSize: 11 },
  walletStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  walletStat: { alignItems: 'center' },
  walletStatVal: { color: '#fff', fontSize: 24, fontWeight: '800' },
  walletStatLabel: { color: '#ffffff90', fontSize: 11, marginTop: 2 },
  walletDivider: { width: 1, backgroundColor: '#ffffff30' },
  walletProgressTrack: { height: 6, backgroundColor: '#ffffff30', borderRadius: 3, marginBottom: 8 },
  walletProgressFill: { height: 6, backgroundColor: '#fff', borderRadius: 3 },
  walletExpiry: { color: '#ffffff80', fontSize: 11, marginBottom: 16 },
  rewardBtn: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  rewardBtnText: { color: '#7C3AED', fontSize: 15, fontWeight: '700' },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#94A3B8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  fieldLabel: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  studentPicker: { maxHeight: 180, marginBottom: 14 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  studentName: { fontSize: 14, fontWeight: '600' },
  studentPts: { fontSize: 11, marginTop: 1 },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  submitBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 8,
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  appVersion: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
