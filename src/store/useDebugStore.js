import { create } from 'zustand';

export const useDebugStore = create((set) => ({
  logs: [],
  pushToken: null,
  permissionStatus: null,
  addLog: (message) => set((state) => ({ logs: [...state.logs, `${new Date().toLocaleTimeString()}: ${message}`] })),
  setPushToken: (token) => set({ pushToken: token }),
  setPermissionStatus: (status) => set({ permissionStatus: status }),
  clearLogs: () => set({ logs: [] }),
}));
