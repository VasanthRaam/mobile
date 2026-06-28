import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, SafeAreaView,
  Dimensions, Platform, Image, Animated
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../utils/supabase';
import { useAuthStore } from '../store/useAuthStore';
import apiClient, { warmupBackend } from '../api/apiClient';
import { useThemeStore } from '../store/useThemeStore';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { theme, isDark } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState('connecting'); // 'connecting' | 'cold' | 'ready'
  const bannerOpacity = useRef(new Animated.Value(1)).current;
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

  // ── Backend Warmup ─────────────────────────────────────────────────────────
  // Silently pings the backend as soon as the login screen mounts so the
  // free-tier Render server wakes up before the user actually tries to log in.
  useEffect(() => {
    let isMounted = true;
    const runWarmup = async () => {
      const result = await warmupBackend();
      if (!isMounted) return;
      if (result.coldStart) {
        setServerStatus('cold');
        // Server is cold — keep banner visible, it'll hide once server is ready
        // Re-ping after the cold-start delay
        setTimeout(async () => {
          if (!isMounted) return;
          await warmupBackend();
          if (isMounted) fadeBannerOut();
        }, 12000);
      } else {
        fadeBannerOut();
      }
    };

    const fadeBannerOut = () => {
      setServerStatus('ready');
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start();
    };

    runWarmup();
    return () => { isMounted = false; };
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.bgDecor1, { backgroundColor: isDark ? theme.accentLight : '#EEF2FF' }]} />
      <View style={[styles.bgDecor2, { backgroundColor: isDark ? theme.successLight : '#F0FDF4' }]} />

      <View style={[styles.content, { backgroundColor: 'transparent' }]}>
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

        <View style={[styles.formCard, { backgroundColor: theme.card, shadowColor: 'transparent', elevation: 0, borderWidth: 1, borderColor: theme.border }]}>
          <Text style={[styles.formTitle, { color: theme.text }]}>Sign In</Text>

          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} 
              style={styles.btnIcon} 
            />
            <Text style={[styles.authBtnText, { color: theme.text }]}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
            onPress={() => navigation.navigate('MobileLogin')}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiIcon}>📱</Text>
            <Text style={[styles.authBtnText, { color: theme.text }]}>Continue with Mobile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: theme.chipBg, borderColor: theme.border }]}
            onPress={() => navigation.navigate('EmailLogin')}
            activeOpacity={0.7}
          >
            <Text style={styles.emojiIcon}>✉️</Text>
            <Text style={[styles.authBtnText, { color: theme.text }]}>Continue with Email</Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={[styles.footerText, { color: theme.subText }]}>New to VHA EduTech?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={[styles.registerLinkText, { color: theme.accent }]}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerVersion, { color: theme.muted }]}>Version 1.0.0 • VHA EduTech</Text>
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
    textAlign: 'center',
  },
  authBtn: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  btnIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  emojiIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  authBtnText: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    color: '#64748B',
    fontWeight: '500',
    fontSize: 14,
    marginRight: 6,
  },
  registerLinkText: {
    color: '#6366F1',
    fontWeight: '700',
    fontSize: 14,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  serverBanner: {
    position: 'absolute',
    bottom: 12,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverBannerCold: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  serverBannerDot: {
    fontSize: 14,
  },
  serverBannerText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
});
