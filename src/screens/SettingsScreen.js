import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Modal, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';

function SectionCard({ title, icon, children, theme }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {title && (
        <View style={styles.sectionCardHeader}>
          {icon && <Text style={styles.sectionCardIcon}>{icon}</Text>}
          <Text style={[styles.sectionCardTitle, { color: theme.text }]}>{title}</Text>
        </View>
      )}
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({ label, icon, theme, rightElement, onPress, danger = false }) {
  const rowContent = (
    <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
      <View style={styles.settingRowLeft}>
        {icon && <Text style={styles.settingIcon}>{icon}</Text>}
        <Text style={[styles.settingLabel, { color: danger ? '#EF4444' : theme.text }]}>
          {label}
        </Text>
      </View>
      <View style={styles.settingRowRight}>
        {rightElement ? rightElement : (
          onPress && <Text style={{ color: theme.subText }}>›</Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {rowContent}
      </TouchableOpacity>
    );
  }
  return rowContent;
}

export default function SettingsScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const { logout } = useAuthStore();
  const { 
    notificationsEnabled, setNotificationsEnabled,
    aiAssistantEnabled, setAIAssistantEnabled,
    biometricsEnabled, setBiometricsEnabled,
    isInitialized, initSettings 
  } = useSettingsStore();

  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState('');
  const [legalModalContent, setLegalModalContent] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initSettings();
    }
  }, [isInitialized]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              // Assuming this endpoint exists or will just fallback to logout if not
              await apiClient.delete('/profile/me');
              Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
              logout();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const openLegalModal = (type) => {
    if (type === 'privacy') {
      setLegalModalTitle('Privacy Policy');
      setLegalModalContent('This is a placeholder for the Privacy Policy. Please refer to the generated document for the full content.');
    } else {
      setLegalModalTitle('Terms of Service');
      setLegalModalContent('This is a placeholder for the Terms of Service. Please refer to the generated document for the full content.');
    }
    setLegalModalVisible(true);
  };

  const handleWalkthrough = () => {
    Alert.alert('App Walkthrough', 'The app walkthrough tour will be shown next time you visit the dashboard.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backIcon, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <SectionCard title="Preferences" icon="⚙️" theme={theme}>
          <SettingRow 
            label="Push Notifications" 
            icon="🔔" 
            theme={theme}
            rightElement={
              <Switch 
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <SettingRow 
            label="Biometric Login (Face ID/Touch ID)" 
            icon="🔒" 
            theme={theme}
            rightElement={
              <Switch 
                value={biometricsEnabled}
                onValueChange={setBiometricsEnabled}
                trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </SectionCard>

        <SectionCard title="AI Features" icon="✨" theme={theme}>
          <SettingRow 
            label="Academy AI Assistant" 
            icon="🤖" 
            theme={theme}
            rightElement={
              <Switch 
                value={aiAssistantEnabled}
                onValueChange={setAIAssistantEnabled}
                trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </SectionCard>

        <SectionCard title="General" icon="📱" theme={theme}>
          <SettingRow label="App Walkthrough Tour" icon="🗺️" theme={theme} onPress={handleWalkthrough} />
          <SettingRow label="Privacy Policy" icon="🛡️" theme={theme} onPress={() => openLegalModal('privacy')} />
          <SettingRow label="Terms of Service" icon="📝" theme={theme} onPress={() => openLegalModal('terms')} />
        </SectionCard>

        <SectionCard theme={theme}>
          <SettingRow 
            label={deleting ? "Deleting Account..." : "Delete Account"} 
            icon="🗑️" 
            theme={theme} 
            danger={true} 
            onPress={deleting ? null : handleDeleteAccount} 
          />
        </SectionCard>

      </ScrollView>

      {/* Legal Modal */}
      <Modal visible={legalModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{legalModalTitle}</Text>
              <TouchableOpacity onPress={() => setLegalModalVisible(false)} style={styles.closeBtn}>
                <Text style={{ color: theme.subText, fontSize: 18, fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContentScroll}>
              <Text style={[styles.modalText, { color: theme.subText }]}>{legalModalContent}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  backIcon: { fontSize: 24, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { width: 40 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F030',
  },
  sectionCardIcon: { fontSize: 18, marginRight: 10 },
  sectionCardTitle: { fontSize: 15, fontWeight: '700' },
  sectionContent: { paddingHorizontal: 16 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { fontSize: 15, fontWeight: '500' },
  settingRowRight: { minWidth: 40, alignItems: 'flex-end' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F030',
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  modalContentScroll: { padding: 20 },
  modalText: { fontSize: 15, lineHeight: 24 },
});
