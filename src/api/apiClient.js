import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from '../utils/secureStore';

// For Android Emulator, use 10.0.2.2 instead of localhost
// For iOS Simulator, use localhost
// For physical devices, use your computer's local IP address (e.g., 192.168.1.x)
// Use your computer's local IP address so physical devices can connect
const BASE_URL = 'https://buddybloom.onrender.com/api/v1';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Response Interceptor for global error handling (e.g., 401 Unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized errors (e.g., clear token, redirect to login)
    }
    return Promise.reject(error);
  }
);

export default apiClient;
