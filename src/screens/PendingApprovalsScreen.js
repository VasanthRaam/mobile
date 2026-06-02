import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl,
  Modal, TextInput, Alert, StatusBar, Platform,
} from 'react-native';
import apiClient from '../api/apiClient';

const ROLE_COLORS = {
  teacher: '#6366F1',
  student: '#10B981',
  parent: '#F59E0B',
};

export default function PendingApprovalsScreen({ navigation }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // In-screen confirm modal state
  const [confirmModal, setConfirmModal] = useState(null);
  // { type: 'approve'|'reject', item, rejectReason: '' }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchPending = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/pending');
      setPending(res.data);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Network error. Please check your connection.';
      Alert.alert('Could not load requests', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // ── Actions (called after confirmation) ───────────────────────────────────
  const doApprove = async (item) => {
    setConfirmModal(null);
    setActionLoading(item.id);
    try {
      const res = await apiClient.post(`/auth/approve/${item.id}`);
      await fetchPending();
      Alert.alert('✅ Approved!', `${item.full_name} can now log in to BuddyBloom.`);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Approval failed. Please try again.';
      Alert.alert('Approval Failed', detail);
    } finally {
      setActionLoading(null);
    }
  };

  const doReject = async (item, reason) => {
    setConfirmModal(null);
    setActionLoading(item.id);
    try {
      await apiClient.post(`/auth/reject/${item.id}`, {
        reason: reason?.trim() || 'Rejected by admin.',
      });
      await fetchPending();
      Alert.alert('Rejected', `${item.full_name}'s registration has been rejected.`);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Rejection failed. Please try again.';
      Alert.alert('Rejection Failed', detail);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render item ───────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isProcessing = actionLoading === item.id;
    const roleColor = ROLE_COLORS[item.role] || '#64748B';
    const initials = item.full_name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
    const dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : 'Unknown date';

    return (
      <View style={styles.card}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.full_name}</Text>
            <Text style={styles.cardEmail}>{item.email}</Text>
            {item.phone ? <Text style={styles.cardPhone}>{item.phone}</Text> : null}
            <Text style={styles.cardDate}>Requested on {dateStr}</Text>
          </View>

          <View style={[
            styles.roleBadge,
            { backgroundColor: roleColor + '15', borderColor: roleColor + '40' },
          ]}>
            <Text style={[styles.roleBadgeText, { color: roleColor }]}>
              {item.role.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Action row */}
        {isProcessing ? (
          <View style={styles.processingRow}>
            <ActivityIndicator color="#6366F1" size="small" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              activeOpacity={0.8}
              onPress={() => setConfirmModal({ type: 'reject', item, rejectReason: '' })}
            >
              <Text style={styles.rejectBtnText}>❌  Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              activeOpacity={0.8}
              onPress={() => setConfirmModal({ type: 'approve', item })}
            >
              <Text style={styles.approveBtnText}>✅  Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingLabel}>Loading requests...</Text>
      </SafeAreaView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrapper}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        <View style={[styles.countBadge, pending.length === 0 && styles.countBadgeGreen]}>
          <Text style={styles.countBadgeText}>{pending.length}</Text>
        </View>
      </View>

      {/* List */}
      {pending.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending registration requests.</Text>
        </View>
      ) : (
        <FlatList
        showsVerticalScrollIndicator={false}
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPending(); }}
              tintColor="#6366F1"
            />
          }
        />
      )}

      {/* ── Confirmation Modal (works on Web + Native) ─────────────────── */}
      {confirmModal && (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => setConfirmModal(null)}
        >
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              {confirmModal.type === 'approve' ? (
                <>
                  <Text style={styles.modalIcon}>✅</Text>
                  <Text style={styles.modalTitle}>Approve Registration?</Text>
                  <Text style={styles.modalBody}>
                    <Text style={{ fontWeight: '800', color: '#1E293B' }}>
                      {confirmModal.item.full_name}
                    </Text>
                    {` will be registered as a `}
                    <Text style={{ fontWeight: '800', color: ROLE_COLORS[confirmModal.item.role] }}>
                      {confirmModal.item.role}
                    </Text>
                    {` and can log in immediately.`}
                  </Text>
                  <Text style={styles.modalEmail}>{confirmModal.item.email}</Text>
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnCancel]}
                      onPress={() => setConfirmModal(null)}
                    >
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnApprove]}
                      onPress={() => doApprove(confirmModal.item)}
                    >
                      <Text style={styles.modalBtnApproveText}>Approve →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalIcon}>❌</Text>
                  <Text style={styles.modalTitle}>Reject Registration?</Text>
                  <Text style={styles.modalBody}>
                    Optionally provide a reason for rejecting{' '}
                    <Text style={{ fontWeight: '800', color: '#1E293B' }}>
                      {confirmModal.item.full_name}
                    </Text>
                    .
                  </Text>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="Reason (optional)"
                    placeholderTextColor="#94A3B8"
                    value={confirmModal.rejectReason}
                    onChangeText={(t) => setConfirmModal({ ...confirmModal, rejectReason: t })}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnCancel]}
                      onPress={() => setConfirmModal(null)}
                    >
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalBtnReject]}
                      onPress={() => doReject(confirmModal.item, confirmModal.rejectReason)}
                    >
                      <Text style={styles.modalBtnRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingLabel: { marginTop: 12, fontSize: 14, color: '#64748B', fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  backBtnWrapper: { paddingRight: 12 },
  backText: { fontSize: 15, color: '#6366F1', fontWeight: '700' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1E293B' },
  countBadge: {
    backgroundColor: '#EF4444', borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 3, minWidth: 26, alignItems: 'center',
  },
  countBadgeGreen: { backgroundColor: '#10B981' },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 5,
    marginBottom: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  cardEmail: { fontSize: 13, color: '#64748B', marginBottom: 2 },
  cardPhone: { fontSize: 13, color: '#64748B', marginBottom: 2 },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA' },
  approveBtn: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  processingText: { fontSize: 14, color: '#6366F1', fontWeight: '600' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },

  // ── Modal ──
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 28, width: '100%',
    maxWidth: 400, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 32, elevation: 20,
  },
  modalIcon: { fontSize: 44, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 12, textAlign: 'center' },
  modalBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 10, fontWeight: '500' },
  modalEmail: { fontSize: 13, color: '#6366F1', fontWeight: '700', marginBottom: 22 },
  rejectInput: {
    width: '100%', minHeight: 80, backgroundColor: '#F8FAFC', borderWidth: 1.5,
    borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, color: '#1E293B',
    textAlignVertical: 'top', marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  modalBtnApprove: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  modalBtnReject: { backgroundColor: '#EF4444' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  modalBtnApproveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalBtnRejectText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
