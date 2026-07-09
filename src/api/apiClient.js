import axios from 'axios';
import { Platform } from 'react-native';
import { getToken } from '../utils/secureStore';

// For Android Emulator, use 10.0.2.2 instead of localhost
// For iOS Simulator, use localhost
// For physical devices, use your computer's local IP address (e.g., 192.168.1.x)
// Use your computer's local IP address so physical devices can connect

// --- Backend API URL Toggle ---
// Uncomment the environment you want to build/run:
//const BASE_URL = 'https://buddybloom-dev-981707949514.asia-south1.run.app/api/v1'; // Development
const BASE_URL = 'https://buddybloom-prod-981707949514.asia-south1.run.app/api/v1'; // Production


const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches JWT token + cache-buster to every request.
// Also stamps a start timestamp on the config so the response interceptor
// can calculate total round-trip time.
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
    // Stamp start time for latency logging
    config.metadata = { startTime: Date.now() };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Logs total round-trip time for every API call.
// Read the X-Response-Time header (set by backend ResponseTimingMiddleware)
// to separately see server-processing vs network time.
apiClient.interceptors.response.use(
  (response) => {
    const startTime = response.config?.metadata?.startTime;
    if (startTime) {
      const totalMs = Date.now() - startTime;
      const serverMs = response.headers?.['x-response-time'] ?? '?';
      const method = (response.config?.method ?? 'GET').toUpperCase();
      const path = (response.config?.url ?? '').replace(BASE_URL, '');

      if (__DEV__) {
        console.log(
          `[API] ${method} ${path} → ${totalMs}ms total (server: ${serverMs})`
        );
      }
    }
    return response;
  },
  async (error) => {
    // Log failed requests too
    const startTime = error.config?.metadata?.startTime;
    if (startTime && __DEV__) {
      const totalMs = Date.now() - startTime;
      const method = (error.config?.method ?? 'GET').toUpperCase();
      const path = (error.config?.url ?? '').replace(BASE_URL, '');
      const status = error.response?.status ?? 'ERR';
      console.warn(`[API] ${method} ${path} → ${totalMs}ms [${status}]`);
    }

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

/**
 * warmupBackend()
 *
 * Call this once at app startup (e.g., in App.js or the root navigator) to
 * silently wake up a sleeping Render free-tier server BEFORE the user tries
 * to log in.  This turns a visible 5-30s cold-start freeze into a transparent
 * background pre-warm.
 *
 * Returns an object with:
 *   - coldStart: true if the server just woke up (uptime < 30s)
 *   - latencyMs: total round-trip time in milliseconds
 *   - serverTime: ISO timestamp from the server
 */
export const warmupBackend = async () => {
  const t0 = Date.now();
  try {
    const res = await axios.get(`${BASE_URL}/diagnostics/ping`, {
      timeout: 40000, // allow up to 40s for a cold start
    });
    const latencyMs = Date.now() - t0;
    const data = res.data ?? {};

    if (__DEV__) {
      if (data.cold_start) {
        console.warn(
          `[Warmup] ⚠️ Cold start detected — server uptime: ${data.uptime_seconds}s, latency: ${latencyMs}ms`
        );
      } else {
        console.log(
          `[Warmup] ✅ Server is warm — uptime: ${data.uptime_seconds}s, latency: ${latencyMs}ms`
        );
      }
    }

    return {
      coldStart: data.cold_start ?? false,
      latencyMs,
      serverTime: data.server_time,
      uptimeSeconds: data.uptime_seconds,
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    if (__DEV__) {
      console.warn(`[Warmup] ⚠️ Backend unreachable after ${latencyMs}ms:`, err?.message);
    }
    return { coldStart: true, latencyMs, serverTime: null, uptimeSeconds: null };
  }
};

export default apiClient;
