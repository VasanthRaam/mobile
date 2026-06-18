import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
  Dimensions, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import apiClient from '../api/apiClient';

const { width } = Dimensions.get('window');

export default function ResetPasswordScreen({ route, navigation }) {
  const { email } = route.params || { email: '' };

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/reset-password', {
        email,
        otp,
        new_password: newPassword,
      });

      Alert.alert('Success', response.data.message);
      // Navigate back to Login and clear the stack to prevent going back to Reset
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Reset Failed', error.response?.data?.detail || 'An error occurred while resetting the password.');
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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Secure Reset</Text>
          <Text style={styles.subtitle}>Create a new password for {email}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>6-Digit Reset Code</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94A3B8"
                editable={!loading}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              placeholderTextColor="#94A3B8"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.disabledBtn]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>{loading ? 'Resetting...' : 'Update Password'}</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    height: 56,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#1E293B',
  },
  eyeButton: {
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  eyeText: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 12,
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
