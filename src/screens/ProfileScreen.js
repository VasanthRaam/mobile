import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Animated, RefreshControl, ActivityIndicator, Alert,
  Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 100;

// ── Level colour mapping ──────────────────────────────────────────────────────
const LEVEL_COLORS = {
  Beginner: '#94A3B8',
  Explorer: '#60A5FA',
  Achiever: '#34D399',
  Scholar: '#A78BFA',
  Champion: '#F59E0B',
  Legend: '#F97316',
  'Grand Master': '#EF4444',
  'StarSpark Elite': '#EC4899',
};

// ── Skeleton Component ────────────────────────────────────────────────────────
function Skeleton({ width: w, height: h, style }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: 8, backgroundColor: '#CBD5E1', opacity }, style]}
    />
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children, theme }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.sectionCardHeader}>
        <Text style={styles.sectionCardIcon}>{icon}</Text>
        <Text style={[styles.sectionCardTitle, { color: theme.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ label, value, theme, editable = false, onEdit }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.infoLabel, { color: theme.subText }]}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
          {value || '—'}
        </Text>
        {editable && (
          <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
            <Text style={{ color: '#6366F1', fontSize: 12, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user } = useAuthStore();
  const { theme, isDark } = useThemeStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

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
      console.error('Profile fetch error:', e);
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

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile(true);
  };

  const handlePhotoChange = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) return;

      const imageUri = result.assets[0].uri;
      setUploadingPhoto(true);

      // Get signed upload URL from backend
      const urlRes = await apiClient.post('/profile/photo-upload-url');
      const { upload_url, public_url } = urlRes.data;

      // Upload directly to Supabase Storage
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      });

      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');

      // Save public URL to profile
      await apiClient.put('/profile/me', { profile_picture: public_url });
      setProfile(prev => ({ ...prev, profile_picture: public_url }));
      Alert.alert('✅ Success', 'Profile photo updated!');
    } catch (err) {
      Alert.alert('Upload Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const levelColor = profile ? (LEVEL_COLORS[profile.level_label] || '#6366F1') : '#6366F1';
  const progressWidth = profile ? Math.round((profile.progress_pct || 0) * 100) : 0;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.skeletonHeader}>
          <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} style={{ borderRadius: AVATAR_SIZE / 2 }} />
          <View style={{ marginLeft: 16 }}>
            <Skeleton width={140} height={18} style={{ marginBottom: 8 }} />
            <Skeleton width={100} height={14} />
          </View>
        </View>
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={120} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={160} style={{ marginBottom: 16 }} />
          <Skeleton width="100%" height={120} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* ── Gradient Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={[StyleSheet.absoluteFill, styles.headerGradient]} />

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={{ color: '#fff', fontSize: 22 }}>←</Text>
          </TouchableOpacity>

          <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Avatar */}
            <TouchableOpacity onPress={handlePhotoChange} style={styles.avatarContainer} activeOpacity={0.8}>
              {uploadingPhoto ? (
                <View style={[styles.avatar, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : profile?.profile_picture ? (
                <Image source={{ uri: profile.profile_picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: levelColor + '33', justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 36, color: '#fff' }}>
                    {profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.cameraOverlay}>
                <Text style={{ color: '#fff', fontSize: 14 }}>📷</Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.headerName}>{profile?.full_name || user?.full_name}</Text>
            <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
              <Text style={styles.levelBadgeText}>⭐ {profile?.level_label || 'Beginner'}</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], padding: 20 }}>

          {/* ── StarSpark Summary ──────────────────────────────────────────── */}
          <SectionCard title="StarSpark Points" icon="⭐" theme={theme}>
            <View style={styles.starsparkGrid}>
              <View style={[styles.starsparkStat, { backgroundColor: isDark ? '#1E293B' : '#F8FAFF' }]}>
                <Text style={[styles.starsparkVal, { color: levelColor }]}>{profile?.current_points?.toLocaleString() || 0}</Text>
                <Text style={[styles.starsparkLabel, { color: theme.subText }]}>Current</Text>
              </View>
              <View style={[styles.starsparkStat, { backgroundColor: isDark ? '#1E293B' : '#F8FAFF' }]}>
                <Text style={[styles.starsparkVal, { color: '#10B981' }]}>{profile?.lifetime_points?.toLocaleString() || 0}</Text>
                <Text style={[styles.starsparkLabel, { color: theme.subText }]}>Lifetime</Text>
              </View>
              <View style={[styles.starsparkStat, { backgroundColor: isDark ? '#1E293B' : '#F8FAFF' }]}>
                <Text style={[styles.starsparkVal, { color: '#F59E0B' }]}>#{profile?.rank || '—'}</Text>
                <Text style={[styles.starsparkLabel, { color: theme.subText }]}>Rank</Text>
              </View>
            </View>

            {/* Points breakdown */}
            <View style={styles.pointsBreakdown}>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.subText }]}>📝 Quiz Points</Text>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{profile?.quiz_points?.toLocaleString() || 0}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: theme.subText }]}>🎁 Teacher Bonus</Text>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{profile?.teacher_bonus_points?.toLocaleString() || 0}</Text>
              </View>
            </View>

            {/* Level progress bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={[styles.progressLabel, { color: theme.subText }]}>Level {profile?.level || 1}</Text>
                <Text style={[styles.progressLabel, { color: theme.subText }]}>{progressWidth}% to Level {(profile?.level || 1) + 1}</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                <View style={[styles.progressFill, { width: `${progressWidth}%`, backgroundColor: levelColor }]} />
              </View>
              <Text style={[styles.nextLevelText, { color: theme.muted }]}>
                {profile?.next_level_points?.toLocaleString()} pts to next level
              </Text>
            </View>

            {/* Leaderboard button */}
            <TouchableOpacity
              style={[styles.leaderboardBtn, { backgroundColor: levelColor + '1A', borderColor: levelColor }]}
              onPress={() => navigation.navigate('Leaderboard')}
            >
              <Text style={[styles.leaderboardBtnText, { color: levelColor }]}>🏆 View Leaderboard</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* ── Personal Details ───────────────────────────────────────────── */}
          <SectionCard title="Personal Details" icon="👤" theme={theme}>
            <InfoRow label="Full Name" value={profile?.full_name} theme={theme} />
            <InfoRow label="Email" value={profile?.email} theme={theme} editable onEdit={() =>
              Alert.prompt('Edit Email', 'Enter new email:', async (val) => {
                if (!val) return;
                await apiClient.put('/profile/me', { email: val });
                setProfile(prev => ({ ...prev, email: val }));
              })
            } />
            <InfoRow label="Phone" value={profile?.phone} theme={theme} editable onEdit={() =>
              Alert.prompt('Edit Phone', 'Enter new phone number:', async (val) => {
                if (!val) return;
                await apiClient.put('/profile/me', { phone: val });
                setProfile(prev => ({ ...prev, phone: val }));
              })
            } />
            <InfoRow label="Date of Birth" value={profile?.dob} theme={theme} />
            <InfoRow label="Education" value={profile?.education_qualification} theme={theme} />
          </SectionCard>

          {/* ── Family Details ─────────────────────────────────────────────── */}
          {(profile?.mother_name || profile?.father_name || profile?.parent_phone_number) && (
            <SectionCard title="Family Details" icon="👨‍👩‍👧" theme={theme}>
              <InfoRow label="Mother's Name" value={profile?.mother_name} theme={theme} />
              <InfoRow label="Father's Name" value={profile?.father_name} theme={theme} />
              <InfoRow label="Parent Phone" value={profile?.parent_phone_number} theme={theme} />
            </SectionCard>
          )}

          {/* ── Academic Details ───────────────────────────────────────────── */}
          {profile?.enrollments?.length > 0 && (
            <SectionCard title="Academic Details" icon="🏛️" theme={theme}>
              {profile.enrollments.map((enr, idx) => (
                <View key={idx} style={[styles.enrollCard, { backgroundColor: isDark ? '#1E293B' : '#F0F4FF', borderColor: '#6366F130' }]}>
                  <View style={[styles.enrollDot, { backgroundColor: '#6366F1' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.enrollCourse, { color: theme.text }]}>{enr.course_name}</Text>
                    <Text style={[styles.enrollBatch, { color: theme.subText }]}>Batch: {enr.batch_name}</Text>
                  </View>
                </View>
              ))}
            </SectionCard>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    height: 260,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  headerGradient: {
    backgroundColor: '#4F46E5',
    // Simulated gradient with overlay (no linear-gradient dependency)
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 16 : 12,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  headerContent: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#1E293B',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  levelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Section Card ─────────────────────────────────────────────────────────
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F010',
  },
  sectionCardIcon: { fontSize: 18, marginRight: 10 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700' },

  // ── Info Row ──────────────────────────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', flex: 2, justifyContent: 'flex-end' },
  infoValue: { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1 },
  editBtn: { marginLeft: 10, padding: 4 },

  // ── StarSpark ─────────────────────────────────────────────────────────────
  starsparkGrid: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  starsparkStat: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  starsparkVal: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  starsparkLabel: { fontSize: 11, fontWeight: '600' },
  pointsBreakdown: { paddingHorizontal: 16, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabel: { fontSize: 13 },
  breakdownVal: { fontSize: 13, fontWeight: '600' },
  progressSection: { paddingHorizontal: 16, marginBottom: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  nextLevelText: { fontSize: 11, marginTop: 4 },
  leaderboardBtn: {
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  leaderboardBtnText: { fontSize: 14, fontWeight: '700' },

  // ── Enrollment ────────────────────────────────────────────────────────────
  enrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  enrollDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  enrollCourse: { fontSize: 14, fontWeight: '700' },
  enrollBatch: { fontSize: 12, marginTop: 2 },

  // ── Skeleton ─────────────────────────────────────────────────────────────
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#4F46E5',
    height: 160,
  },
});
