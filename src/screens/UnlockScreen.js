import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView, Platform, Image
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../store/useAuthStore';

import { useThemeStore } from '../store/useThemeStore';

export default function UnlockScreen() {
  const { theme, isDark } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const logout = useAuthStore((state) => state.logout);

  const handleUnlock = async () => {
    setLoading(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock VHA EduTech',
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });
        
        if (result.success) {
          // Temporarily bypass the biometric check during restore
          useAuthStore.setState({ isAuthenticated: true, requiresUnlock: false });
        }
      } else {
        useAuthStore.setState({ isAuthenticated: true, requiresUnlock: false });
      }
    } catch (error) {
      console.warn('Biometric auth error:', error);
      useAuthStore.setState({ isAuthenticated: true, requiresUnlock: false });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.bgDecor1, { backgroundColor: isDark ? theme.accentLight : '#EEF2FF' }]} />
      <View style={[styles.bgDecor2, { backgroundColor: isDark ? theme.successLight : '#F0FDF4' }]} />

      <View style={styles.content}>
        <View style={styles.headerSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.card }]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Welcome Back</Text>
          {user?.full_name && <Text style={[styles.subtitle, { color: theme.subText }]}>{user.full_name}</Text>}
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>App Locked</Text>
          <Text style={[styles.formSubtitle, { color: theme.subText }]}>
            Please authenticate to continue using VHA EduTech.
          </Text>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }, loading && styles.disabledBtn]}
            onPress={handleUnlock}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>
              {loading ? 'Verifying...' : 'Unlock Now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Login with a different account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  bgDecor1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#EEF2FF',
  },
  bgDecor2: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F0FDF4',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    marginBottom: 20,
  },
  logoImage: {
    width: '65%',
    height: '65%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 16,
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '700',
  },
});
