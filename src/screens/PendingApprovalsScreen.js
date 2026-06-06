import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl,
  Modal, TextInput, Alert, StatusBar, Platform, ScrollView
} from 'react-native';
import apiClient from '../api/apiClient';
import { useAuthStore } from '../store/useAuthStore';

const ROLE_COLORS = {
  teacher: '#6366F1',
  student: '#10B981',
  parent: '#F59E0B',
};

export default function PendingApprovalsScreen({ navigation }) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState(isAdmin ? 'registrations' : 'leaves'); // registrations, enrollments, leaves
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // In-screen confirm modal state
  const [confirmModal, setConfirmModal] = useState(null);
  // { type: 'approve'|'reject', item, tab: 'registrations'|'enrollments'|'leaves', rejectReason: '' }

  const fetchData = useCallback(async () => {
    try {
      let res;
      if (activeTab === 'registrations') {
        res = await apiClient.get('/auth/pending');
      } else if (activeTab === 'enrollments') {
        res = await apiClient.get('/enrollments/pending');
      } else if (activeTab === 'leaves') {
        res = await apiClient.get('/attendance/leave_requests');
      }
      setData(res.data);
    } catch (e) {
      console.error(e);
      const msg = e.response?.data?.detail || 'Network error. Please check your connection.';
      Alert.alert('Could not load requests', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { 
    setLoading(true);
    fetchData(); 
  }, [fetchData]);

  // ── Actions ───────────────────────────────────
  const doApprove = async (item, tab) => {
    setConfirmModal(null);
    setActionLoading(item.id);
    try {
      if (tab === 'registrations') {
        await apiClient.post(`/auth/approve/${item.id}`);
        Alert.alert('✅ Approved!', `${item.full_name} can now log in to BuddyBloom.`);
      } else if (tab === 'enrollments') {
        await apiClient.post(`/enrollments/${item.id}/approve`);
        Alert.alert('✅ Approved!', `Enrollment for ${item.student_name} approved.`);
      } else if (tab === 'leaves') {
        await apiClient.post(`/attendance/leave_requests/${item.id}/approve`);
        Alert.alert('✅ Approved!', `Leave request for ${item.student_name} approved.`);
      }
      await fetchData();
    } catch (e) {
      const detail = e.response?.data?.detail || 'Approval failed. Please try again.';
      Alert.alert('Approval Failed', detail);
    } finally {
      setActionLoading(null);
    }
  };

  const doReject = async (item, tab, reason) => {
    setConfirmModal(null);
    setActionLoading(item.id);
    try {
      if (tab === 'registrations') {
        await apiClient.post(`/auth/reject/${item.id}`, { reason: reason?.trim() || 'Rejected by admin.' });
        Alert.alert('Rejected', `${item.full_name}'s registration has been rejected.`);
      } else if (tab === 'enrollments') {
        await apiClient.post(`/enrollments/${item.id}/reject`);
        Alert.alert('Rejected', `Enrollment for ${item.student_name} rejected.`);
      } else if (tab === 'leaves') {
        await apiClient.post(`/attendance/leave_requests/${item.id}/reject`);
        Alert.alert('Rejected', `Leave request for ${item.student_name} rejected.`);
      }
      await fetchData();
    } catch (e) {
      const detail = e.response?.data?.detail || 'Rejection failed. Please try again.';
      Alert.alert('Rejection Failed', detail);
    } finally {
      setActionLoading(null);
    }
  };

  // ── Render Items ───────────────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const isProcessing = actionLoading === item.id;
    
    let title, subtitle, extra1, extra2, initials, dateStr;

    if (activeTab === 'registrations') {
      title = item.full_name;
      subtitle = item.email;
      extra1 = item.phone || '';
      extra2 = `Role: ${item.role.toUpperCase()}`;
      initials = item.full_name.substring(0, 2).toUpperCase();
    } else if (activeTab === 'enrollments') {
      title = item.student_name;
      subtitle = `Course: ${item.course_name}`;
      extra1 = `Batch: ${item.batch_name}`;
      extra2 = ``;
      initials = item.student_name ? item.student_name.substring(0, 2).toUpperCase() : 'ST';
    } else if (activeTab === 'leaves') {
      title = item.student_name;
      subtitle = `From ${item.start_date} to ${item.end_date}`;
      extra1 = `Reason: ${item.reason}`;
      extra2 = ``;
      initials = item.student_name ? item.student_name.substring(0, 2).toUpperCase() : 'ST';
    }

    dateStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Unknown date';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[styles.avatarText, { color: '#6366F1' }]}>{initials}</Text>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{title}</Text>
            <Text style={styles.cardSubtitle}>{subtitle}</Text>
            {extra1 ? <Text style={styles.cardExtra}>{extra1}</Text> : null}
            <Text style={styles.cardDate}>Requested on {dateStr}</Text>
          </View>
          
          {extra2 ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{extra2}</Text>
            </View>
          ) : null}
        </View>

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
              onPress={() => setConfirmModal({ type: 'reject', item, tab: activeTab, rejectReason: '' })}
            >
              <Text style={styles.rejectBtnText}>❌  Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              activeOpacity={0.8}
              onPress={() => setConfirmModal({ type: 'approve', item, tab: activeTab })}
            >
              <Text style={styles.approveBtnText}>✅  Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnWrapper}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Approvals</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
          {isAdmin && (
            <>
              <TouchableOpacity style={[styles.tab, activeTab === 'registrations' && styles.activeTab]} onPress={() => setActiveTab('registrations')}>
                <Text style={[styles.tabText, activeTab === 'registrations' && styles.activeTabText]}>Registrations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'enrollments' && styles.activeTab]} onPress={() => setActiveTab('enrollments')}>
                <Text style={[styles.tabText, activeTab === 'enrollments' && styles.activeTabText]}>Enrollments</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={[styles.tab, activeTab === 'leaves' && styles.activeTab]} onPress={() => setActiveTab('leaves')}>
            <Text style={[styles.tabText, activeTab === 'leaves' && styles.activeTabText]}>Leave Requests</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingLabel}>Loading requests...</Text>
        </SafeAreaView>
      ) : data.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>No pending {activeTab} requests.</Text>
        </View>
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(); }}
              tintColor="#6366F1"
            />
          }
        />
      )}

      {/* Modal */}
      {confirmModal && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setConfirmModal(null)}>
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              {confirmModal.type === 'approve' ? (
                <>
                  <Text style={styles.modalIcon}>✅</Text>
                  <Text style={styles.modalTitle}>Approve Request?</Text>
                  <Text style={styles.modalBody}>
                    Are you sure you want to approve this {confirmModal.tab} request?
                  </Text>
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModal(null)}>
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnApprove]} onPress={() => doApprove(confirmModal.item, confirmModal.tab)}>
                      <Text style={styles.modalBtnApproveText}>Approve →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalIcon}>❌</Text>
                  <Text style={styles.modalTitle}>Reject Request?</Text>
                  {confirmModal.tab === 'registrations' && (
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="Reason (optional)"
                      placeholderTextColor="#94A3B8"
                      value={confirmModal.rejectReason}
                      onChangeText={(t) => setConfirmModal({ ...confirmModal, rejectReason: t })}
                      multiline
                      numberOfLines={3}
                    />
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmModal(null)}>
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnReject]} onPress={() => doReject(confirmModal.item, confirmModal.tab, confirmModal.rejectReason)}>
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
  tabsContainer: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 10 },
  activeTab: { backgroundColor: '#6366F1' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 5, marginBottom: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 2 },
  cardExtra: { fontSize: 13, color: '#64748B', marginBottom: 2 },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#F1F5F9' },
  roleBadgeText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FECACA' },
  approveBtn: { backgroundColor: '#6366F1' },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 },
  processingText: { fontSize: 14, color: '#6366F1', fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 28, padding: 28, width: '100%', maxWidth: 400, alignItems: 'center' },
  modalIcon: { fontSize: 44, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 12, textAlign: 'center' },
  modalBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 20, fontWeight: '500' },
  rejectInput: { width: '100%', minHeight: 80, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, padding: 14, fontSize: 14, textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
  modalBtnApprove: { backgroundColor: '#6366F1' },
  modalBtnReject: { backgroundColor: '#EF4444' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  modalBtnApproveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modalBtnRejectText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
