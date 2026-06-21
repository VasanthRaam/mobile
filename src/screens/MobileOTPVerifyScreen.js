import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';
import { useThemeStore } from '../store/useThemeStore';

export default function MobileOTPVerifyScreen({ route, navigation }) {
  const { theme, isDark } = useThemeStore();
  const { phone } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/mobile-login-verify', { phone, otp });
      
      if (response.data.type === 'multiple_profiles') {
        navigation.navigate('ProfileSelection', {
          profiles: response.data.profiles,
          phone,
          otp,
        });
      } else if (response.data.type === 'login_success') {
        const { access_token, user: userData } = response.data;
        await login(access_token, userData);
        // Navigation is handled automatically by the auth state change in AppNavigator
      } else {
        throw new Error('Unexpected response format.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.bgDecor1, { backgroundColor: isDark ? theme.accentLight : '#EEF2FF' }]} />
      <View style={[styles.bgDecor2, { backgroundColor: isDark ? theme.successLight : '#F0FDF4' }]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.card }]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>BuddyBloom</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>Nurturing Minds, Together.</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>Verify OTP</Text>
          <Text style={[styles.formSubtitle, { color: theme.subText }]}>
            We have sent a 6-digit verification code to {phone}.
          </Text>

          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Verification Code</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="000000"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={theme.muted}
              letterSpacing={8}
              textAlign="center"
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }, loading && styles.disabledBtn]}
            onPress={handleVerifyOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
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
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
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
    fontSize: 36,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
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
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 56,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 24,
    color: '#1E293B',
    fontWeight: '600',
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
  },
  disabledBtn: {
    backgroundColor: '#94A3B8',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
