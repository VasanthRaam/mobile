import { create } from 'zustand';
import { getCache, setCache } from '../utils/cacheManager';
import { getBiometricsEnabled, saveBiometricsEnabled } from '../utils/secureStore';

export const useSettingsStore = create((set, get) => ({
  notificationsEnabled: true,
  aiAssistantEnabled: true,
  biometricsEnabled: false,
  isInitialized: false,

  initSettings: async () => {
    // 1. Fetch cache for notifications and AI assistant
    const notifs = getCache('settings_notifications');
    const ai = getCache('settings_ai_assistant');
    
    // 2. Fetch secure store for biometrics
    const bioStr = await getBiometricsEnabled();
    const biometricsEnabled = bioStr === 'true';

    set({
      notificationsEnabled: notifs !== null ? notifs : true,
      aiAssistantEnabled: ai !== null ? ai : true,
      biometricsEnabled,
      isInitialized: true,
    });
  },

  setNotificationsEnabled: (val) => {
    set({ notificationsEnabled: val });
    setCache('settings_notifications', val);
  },

  setAIAssistantEnabled: (val) => {
    set({ aiAssistantEnabled: val });
    setCache('settings_ai_assistant', val);
  },

  setBiometricsEnabled: async (val) => {
    set({ biometricsEnabled: val });
    await saveBiometricsEnabled(val);
  }
}));
