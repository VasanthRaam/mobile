import { create } from 'zustand';

const lightTheme = {
  bg: '#f5f6fa',
  card: '#ffffff',
  text: '#2c3e50',
  subText: '#7f8c8d',
  textMid: '#5f6c7d',
  accent: '#4e73df',
  accentLight: '#eaecf4',
  success: '#2ecc71',
  successLight: '#e8f8f0',
  danger: '#e74c3c',
  dangerLight: '#fdedec',
  border: '#e2e8f0',
  headerBg: '#ffffff',
  muted: '#8a99ad',
  
  // Newly mapped properties
  tabBg: '#eaecf4',
  chipBg: '#e2e8f0',
  inputBg: '#ffffff',
  rowBorder: '#e2e8f0',
  warning: '#f39c12',
  warningLight: '#fef9e7',
};

const darkTheme = {
  bg: '#121212',
  card: '#1e1e1e',
  text: '#f5f6fa',
  subText: '#a0aec0',
  textMid: '#cbd5e1',
  accent: '#6c8bef',
  accentLight: '#2b3c58',
  success: '#2ecc71',
  successLight: '#1b382b',
  danger: '#e74c3c',
  dangerLight: '#3a2325',
  border: '#2d3748',
  headerBg: '#1a1a1a',
  muted: '#cbd5e1',
  
  // Newly mapped properties
  tabBg: '#1a1a1a',
  chipBg: '#2d3748',
  inputBg: '#2d3748',
  rowBorder: '#2d3748',
  warning: '#f1c40f',
  warningLight: '#2c2510',
};

export const useThemeStore = create((set) => ({
  isDark: false,
  theme: lightTheme,
  toggleDark: () => set((state) => {
    const nextDark = !state.isDark;
    return {
      isDark: nextDark,
      theme: nextDark ? darkTheme : lightTheme,
    };
  }),
  setDark: (val) => set({
    isDark: val,
    theme: val ? darkTheme : lightTheme,
  }),
}));
