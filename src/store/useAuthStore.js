import { create } from 'zustand';
import { saveToken, deleteToken, getToken, saveUser, getUser, deleteUser } from '../utils/secureStore';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // Used to show a splash screen while checking secure storage

  // Call this function when the app starts to restore the session
  restoreSession: async () => {
    try {
      const [token, user] = await Promise.all([getToken(), getUser()]);
      if (token) {
        set({ token, user, isAuthenticated: true, isLoading: false });
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
    await Promise.all([deleteToken(), deleteUser()]);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
