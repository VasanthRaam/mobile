import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from '../utils/secureStore';

// For Android Emulator, use 10.0.2.2 instead of localhost
// For iOS Simulator, use localhost
// For physical devices, use your computer's local IP address (e.g., 192.168.1.x)
// Use your computer's local IP address so physical devices can connect
const BASE_URL = 'https://buddybloom.onrender.com/api/v1';
// const BASE_URL = 'http://localhost:8001/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token to every request if available
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add cache-busting to GET requests to prevent browser/network caching of stale list/auth states
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor for global error handling (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        // Dynamically require useAuthStore to prevent potential circular dependency issues
        const { useAuthStore } = require('../store/useAuthStore');
        await useAuthStore.getState().logout();
      } catch (logoutError) {
        console.error('Failed to log out on 401 Unauthorized:', logoutError);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
