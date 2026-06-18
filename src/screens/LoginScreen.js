import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
  Dimensions, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../utils/supabase';
import { useAuthStore } from '../store/useAuthStore';
import apiClient from '../api/apiClient';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  // Web-specific OAuth hash listener
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const hash = window.location.hash || window.location.search;
      if (hash) {
        const params = new URLSearchParams(hash.replace('#', '?'));
        const access_token = params.get('access_token');
        if (access_token) {
          // Clear hash so it doesn't trigger again
          window.history.replaceState(null, null, ' ');
          handleGoogleCallback(access_token);
        }
      }
    }
  }, []);

  const handleGoogleCallback = async (access_token) => {
    setLoading(true);
    let user = null;
    try {
      const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(access_token);
      if (userError) throw userError;
      user = supabaseUser;

      // Sync with backend
      const backendRes = await apiClient.post('/auth/google-sync', {
        access_token,
        email: user.email,
        full_name: user.user_metadata.full_name,
      });
      
      const { user: userData } = backendRes.data;
      await login(access_token, userData);
    } catch (error) {
      if (error.response?.status === 404 && user) {
        // User exists in Supabase but not in our DB -> New Google User
        navigation.navigate('Register', { 
          email: user.email, 
          full_name: user.user_metadata.full_name,
          isGoogle: true,
          supabaseUid: user.id
        });
      } else {
        console.error(error);
        Alert.alert('Google Sync Failed', error.message || 'An error occurred during authentication.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const redirectUri = Platform.OS === 'web' 
        ? window.location.origin
        : makeRedirectUri({
            scheme: 'buddybloom',
            path: 'auth-callback',
          });

      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
          },
        });
        if (error) throw error;
        return; // Redirects automatically on Web
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (res.type === 'success') {
        const { url } = res;
        
        // Robust parameter parser that extracts both access_token and code from search and hash params
        const params = {};
        const regex = /[?&#]([^=#]+)=([^&#]*)/g;
        let match;
        while ((match = regex.exec(url)) !== null) {
          params[match[1]] = decodeURIComponent(match[2]);
        }

        let access_token = params.access_token || null;
        const code = params.code || null;

        if (code) {
          // Exchange PKCE authorization code for session
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          access_token = exchangeData.session?.access_token || null;
        }

        if (access_token) {
          await handleGoogleCallback(access_token);
        } else {
          Alert.alert('Authentication Failed', 'No access token or authorization code found in redirect URL.');
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Google Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });

      const { access_token, user: userData } = response.data;
      await login(access_token, userData);

    } catch (error) {
      console.error(error);
      Alert.alert('Login Failed', error.response?.data?.detail || 'An error occurred');
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
        <View style={styles.headerSection}>
          <View style={styles.logoCircle}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logoImage} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>BuddyBloom</Text>
          <Text style={styles.subtitle}>Nurturing Minds, Together.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign In</Text>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="abcxyz@gmail.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginBtnText}>{loading ? 'Signing in...' : 'Continue to Dashboard'}</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} 
              style={styles.googleIcon} 
            />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.googleBtn, { marginTop: 12, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
            onPress={() => navigation.navigate('MobileLogin')}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 20, marginRight: 12 }}>📱</Text>
            <Text style={[styles.googleBtnText, { color: '#166534' }]}>Continue with Mobile</Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLinkText}>Create Account →</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Version 1.0.0 • Vasanth Academy</Text>
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
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
    marginBottom: 24,
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
  loginBtn: {
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
  loginBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  forgotText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  registerLinkText: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleBtnText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  }
});
