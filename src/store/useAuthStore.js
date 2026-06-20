import { create } from 'zustand';
import { saveToken, deleteToken, getToken, saveUser, getUser, deleteUser, getBiometricsEnabled } from '../utils/secureStore';
import { supabase } from '../utils/supabase';
import * as LocalAuthentication from 'expo-local-authentication';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Used to show a splash screen while checking secure storage

  // Call this function when the app starts to restore the session
  restoreSession: async () => {
    try {
      const [token, user, biometricsEnabled] = await Promise.all([
        getToken(),
        getUser(),
        getBiometricsEnabled()
      ]);

      if (token) {
        // If biometrics are not explicitly enabled, bypass and restore session directly
        if (biometricsEnabled !== 'true') {
          set({ token, user, isAuthenticated: true, isLoading: false });
          return;
        }

        // Token exists and biometrics are enabled, now prompt for Biometrics
        let biometricSuccess = false;
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();

          if (hasHardware && isEnrolled) {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock BuddyBloom',
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
          set({ token, user, isAuthenticated: true, isLoading: false });
        } else {
          // Failed biometric (e.g. canceled). Do not wipe token, just don't authenticate for this session
          // so they can choose to try again or log in via other means.
          set({ isAuthenticated: false, isLoading: false });
        }
      } else {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (e) {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
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
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('Supabase signout failed', error);
    }
    await Promise.all([deleteToken(), deleteUser()]);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
