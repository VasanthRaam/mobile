import { create } from 'zustand';
import { Platform } from 'react-native';
import { saveToken, deleteToken, getToken, saveUser, getUser, deleteUser, getBiometricsEnabled, clearAuthPreferences } from '../utils/secureStore';
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

      if (token) {
        // --- 🚀 BIOMETRIC FAST-TRACK ---
        // If biometrics are enabled, we bypass the synchronous backend /profile/me check.
        // We trust the locally stored user profile, allowing instant startup and offline capability.
        // Any true token expiration will be caught gracefully by the apiClient interceptor (401 -> logout) during regular app usage.
        if (biometricsEnabled === 'true') {
          console.log('[restoreSession] Biometrics enabled. Fast-tracking to lock screen...');
          set({ token, user, isAuthenticated: false, requiresUnlock: true, isLoading: false });
          return;
        }

        if (!isTokenExpired(token)) {
          // Verify token & fetch fresh user profile from backend
          let freshUser = null;
          try {
            const apiClient = require('../api/apiClient').default;
            console.log('[restoreSession] Verifying session with backend /profile/me...');
            
            // Explicitly pass authorization header to avoid race conditions with secure storage updates
            const res = await apiClient.get('/profile/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            freshUser = res.data;
            console.log('[restoreSession] Session is valid. User:', freshUser.email);
          } catch (apiErr) {
            console.warn('[restoreSession] Session verification with backend failed:', apiErr.message);
            
            // Check if the error is explicitly a 401 Unauthorized or 404 Not Found
            const isExplicitAuthFailure = apiErr.response && (apiErr.response.status === 401 || apiErr.response.status === 404);
            
            if (isExplicitAuthFailure) {
              console.log('[restoreSession] Explicit authorization failure (401/404). Wiping session credentials.');
              try {
                const { clearCache } = require('../utils/cacheManager');
                await Promise.all([
                  deleteToken(),
                  deleteUser(),
                  clearCache(),
                  clearAuthPreferences(),
                  supabase.auth.signOut().catch(() => {})
                ]);
              } catch (cleanupErr) {
                console.warn('Storage cleanup failed during invalid token restore:', cleanupErr);
              }
              set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false, isLoading: false });
              return;
            } else {
              console.log('[restoreSession] Network or server error. Bypassing validation and keeping local session.');
              freshUser = user; // Fall back to the cached user object
            }
          }

          if (freshUser) {
            // Save the fresh user profile
            await saveUser(freshUser);
            
            // Bypass and restore session directly
            set({ token, user: freshUser, isAuthenticated: true, requiresUnlock: false, isLoading: false });
            return;
          }
        }
      }

      // Token is missing, expired, or failed verification -> clean up storage to prevent stale logins
      try {
        const { clearCache } = require('../utils/cacheManager');
        await Promise.all([
          deleteToken(),
          deleteUser(),
          clearCache(),
          clearAuthPreferences(),
          supabase.auth.signOut().catch(() => {})
        ]);
      } catch (cleanupErr) {
        console.warn('Storage cleanup failed during restoreSession:', cleanupErr);
      }
      set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false, isLoading: false });
    } catch (e) {
      set({ token: null, user: null, isAuthenticated: false, requiresUnlock: false, isLoading: false });
    }
  },

  // Call this function upon successful login
  login: async (token, userData, refreshToken) => {
    await Promise.all([saveToken(token), saveUser(userData)]);
    if (refreshToken) {
      try {
        console.log('[login] Saving refresh_token and registering session in Supabase client...');
        await supabase.auth.setSession({ access_token: token, refresh_token: refreshToken });
      } catch (err) {
        console.warn('[login] Failed to set Supabase session with refresh_token:', err);
      }
    }
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
      await Promise.all([deleteToken(), deleteUser(), clearCache(), clearAuthPreferences()]);
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
  }
});

