import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, SafeAreaView, Image, Alert,
  ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Platform, TouchableWithoutFeedback,
  Keyboard, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';
import { sendFirebaseOTP, verifyFirebaseOTP } from '../utils/firebase';

export default function MobileLoginScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const login = useAuthStore((state) => state.login);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Enter Phone, 2: Enter OTP
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionToStep = (nextStep) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSendOTP = async () => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid mobile number.');
      return;
    }

    // Format phone number to E.164 (defaults to India +91 if country code is missing)
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+91${formattedPhone}`;
    }

    setLoading(true);
    try {
      const info = await sendFirebaseOTP(formattedPhone);
      setSessionInfo(info);
      Alert.alert('OTP Sent', 'A 6-digit verification code has been sent to your number.');
      transitionToStep(2);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to send OTP. Please check the number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP with Firebase and get ID Token
      const idToken = await verifyFirebaseOTP(sessionInfo, cleanOtp);

      // 2. Send Firebase ID Token to backend to match/sync user profiles
      const response = await apiClient.post('/auth/firebase-login-verify', {
        id_token: idToken,
      });

      if (response.data.type === 'login_success') {
        const { access_token, user: userData } = response.data;
        await login(access_token, userData);
        // Navigation is handled automatically by the auth state change
      } else if (response.data.type === 'multiple_profiles') {
        navigation.navigate('ProfileSelection', {
          profiles: response.data.profiles,
          phone: phone.trim(),
          otp: cleanOtp,
          isFirebase: true,
          idToken: idToken,
        });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Verification Failed', error.message || 'Invalid or expired OTP.');
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
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.card }]}
              onPress={() => (step === 2 ? transitionToStep(1) : navigation.goBack())}
            >
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
              <Text style={[styles.title, { color: theme.text }]}>VHA EduTech</Text>
              <Text style={[styles.subtitle, { color: theme.subText }]}>Nurturing Minds, Together.</Text>
            </View>

            <Animated.View style={[styles.formCard, { backgroundColor: theme.card, opacity: fadeAnim, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }]}>
              {step === 1 ? (
                // STEP 1: Enter Mobile Number
                <>
                  <Text style={[styles.formTitle, { color: theme.text }]}>Sign In with Mobile</Text>
                  <Text style={[styles.formSubtitle, { color: theme.subText }]}>
                    Enter your registered mobile number to receive a secure Firebase OTP.
                  </Text>

                  <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
                    <Ionicons name="call-outline" size={20} color={theme.muted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: theme.text }]}
                      placeholder="Mobile Number (e.g. 9876543210)"
                      placeholderTextColor={theme.muted}
                      keyboardType="phone-pad"
                      maxLength={15}
                      value={phone}
                      onChangeText={setPhone}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={handleSendOTP}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnText}>Send OTP</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                // STEP 2: Enter OTP Code
                <>
                  <Text style={[styles.formTitle, { color: theme.text }]}>Enter OTP</Text>
                  <Text style={[styles.formSubtitle, { color: theme.subText }]}>
                    We have sent a 6-digit verification code to your phone.
                  </Text>

                  <View style={[styles.inputContainer, { borderColor: theme.border, backgroundColor: theme.chipBg }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={theme.muted} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: theme.text }]}
                      placeholder="Enter 6-Digit OTP"
                      placeholderTextColor={theme.muted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                    onPress={handleVerifyOTP}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionBtnText}>Verify & Login</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleSendOTP}
                    disabled={loading}
                  >
                    <Text style={[styles.resendText, { color: theme.accent }]}>Resend OTP Code</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
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
    top: Platform.OS === 'ios' ? 20 : 40,
    left: 24,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginTop: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 32,
    padding: 32,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    height: 56,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  actionBtn: {
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resendBtn: {
    marginTop: 18,
    alignSelf: 'center',
    padding: 6,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
