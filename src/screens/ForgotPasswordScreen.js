import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
  Dimensions, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import apiClient from '../api/apiClient';

import { useThemeStore } from '../store/useThemeStore';

const { width } = Dimensions.get('window');

export default function ForgotPasswordScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      Alert.alert('Success', response.data.message);
      navigation.navigate('ResetPassword', { email });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.detail || 'An error occurred. Please try again.');
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: theme.accent }]}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={[styles.logoCircle, { backgroundColor: theme.card }]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Forgot Password</Text>
          <Text style={[styles.subtitle, { color: theme.subText }]}>Enter your email to receive a reset code.</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: theme.card }]}>
          <View style={styles.inputWrapper}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="abcxyz@gmail.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={theme.muted}
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.accent }, loading && styles.disabledBtn]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>{loading ? 'Sending...' : 'Send Reset Code'}</Text>
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
    justifyContent: 'center',
    padding: 24,
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
    top: 40,
    left: 20,
    padding: 10,
    zIndex: 10,
  },
  backText: {
    color: '#6366F1',
    fontWeight: '600',
    fontSize: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
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
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
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
  inputWrapper: {
    marginBottom: 20,
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
    fontSize: 16,
    color: '#1E293B',
  },
  actionBtn: {
    backgroundColor: '#2563EB',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
