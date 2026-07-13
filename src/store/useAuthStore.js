import { create } from 'zustand';
import { Platform } from 'react-native';
import { saveToken, deleteToken, getToken, saveUser, getUser, deleteUser, getBiometricsEnabled } from '../utils/secureStore';
import { supabase } from '../utils/supabase';
import * as LocalAuthentication from 'expo-local-authentication';

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payloadStr = parts[1];
    let base64 = payloadStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    
    let decodedStr = '';
    if (Platform.OS === 'web') {
      decodedStr = atob(base64);
    } else {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output = '';
      let buffer = 0;
      let bc = 0;
      for (let i = 0; i < base64.length; i++) {
        const char = base64.charAt(i);
        const charIdx = chars.indexOf(char);
        if (charIdx === -1) continue;
        buffer = bc % 4 ? buffer * 64 + charIdx : charIdx;
        if (bc++ % 4) {
          output += String.fromCharCode(255 & (buffer >> ((-2 * bc) & 6)));
        }
      }
      decodedStr = output;
    }
    
    const payload = JSON.parse(decodedStr);
    const exp = payload.exp;
    if (exp) {
      const expDate = exp * 1000;
      const extendedAllowance = 30 * 24 * 60 * 60 * 1000; // 30 days
      return Date.now() >= expDate + extendedAllowance;
    }
    return false;
  } catch (e) {
    console.warn('Failed to parse token expiration:', e);
    return true;
  }
};

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  requiresUnlock: false,
  isLoading: true, // Used to show a splash screen while checking secure storage

  // Call this function when the app starts to restore the session
  restoreSession: async () => {
    try {
      const [storedToken, user, biometricsEnabled] = await Promise.all([
        getToken(),
        getUser(),
        getBiometricsEnabled()
      ]);

      let token = storedToken;

      // Attempt to retrieve fresh Supabase session (Google/Email login)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.access_token) {
          token = session.access_token;
          await saveToken(token);
        }
      } catch (sbError) {
        console.warn('Supabase getSession failed:', sbError);
      }

      if (token && !isTokenExpired(token)) {
        // If biometrics are not explicitly enabled, bypass and restore session directly
        if (biometricsEnabled !== 'true') {
          set({ token, user, isAuthenticated: true, requiresUnlock: false, isLoading: false });
          return;
        }

        // Token exists and biometrics are enabled, now prompt for Biometrics
        let biometricSuccess = false;
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
            biometricSuccess = result.success;
          } else {
            // No biometrics on device, or not enrolled. Allow entry.
            biometricSuccess = true;
          }
        } catch (authError) {
          console.warn('Biometric auth error:', authError);
          // If biometric APIs throw an error (e.g. on web or unsupported devices),
          // fallback to true so we don't lock the user out of their session.
          biometricSuccess = true;
        }

        if (biometricSuccess) {
          set({ token, user, isAuthenticated: true, requiresUnlock: false, isLoading: false });
        } else {
          // Failed biometric (e.g. canceled). Do not wipe token, just don't authenticate for this session
          // so they can choose to try again or log in via other means.
          set({ isAuthenticated: false, requiresUnlock: true, isLoading: false, user, token });
        }
      } else {
        // Token is missing or expired -> clean up storage to prevent stale logins
        try {
          const { clearCache } = require('../utils/cacheManager');
          await Promise.all([deleteToken(), deleteUser(), clearCache()]);
        } catch (cleanupErr) {
          console.warn('Storage cleanup failed during restoreSession:', cleanupErr);
        }
        set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false, isLoading: false });
      }
    } catch (e) {
      set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false, isLoading: false });
    }
  },

  // Call this function upon successful login
  login: async (token, userData) => {
    await Promise.all([saveToken(token), saveUser(userData)]);
    set({ token, user: userData, isAuthenticated: true });
  },

  // Call this function to log out
  logout: async () => {
    try {
      await supabase.auth.signOut().catch(error => {
        console.warn('Supabase signout failed during logout:', error);
      });
    } catch (e) {
      console.warn('Supabase signout exception during logout:', e);
    }

    try {
      const { clearCache } = require('../utils/cacheManager');
      await Promise.all([deleteToken(), deleteUser(), clearCache()]);
    } catch (error) {
      console.warn('Storage/Cache cleanup failed during logout:', error);
    }
    
    set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false });
  },

  updateUser: async (updatedData) => {
    const { user } = useAuthStore.getState();
    const newUser = { ...user, ...updatedData };
    await saveUser(newUser);
    set({ user: newUser });
  },
}));

// Listen for Supabase token refreshes and keep both secure storage and Zustand store in sync
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session && session.access_token) {
    await saveToken(session.access_token);
    useAuthStore.setState({ token: session.access_token });
  } else if (event === 'SIGNED_OUT' || !session) {
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      await state.logout();
    }
  }
});

