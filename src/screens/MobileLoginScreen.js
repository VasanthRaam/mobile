import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/apiClient';

export default function MobileLoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/mobile-login-init', { phone });
      navigation.navigate('MobileOTPVerify', { phone });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgDecor1} />
      <View style={styles.bgDecor2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Mobile Login</Text>
          <Text style={styles.formSubtitle}>
            Enter your registered phone number to receive a one-time password.
          </Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 9876543210"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.disabledBtn]}
            onPress={handleSendOTP}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
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
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 32,
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
    fontSize: 16,
    color: '#1E293B',
  },
  actionBtn: {
    backgroundColor: '#166534',
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#166534',
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
