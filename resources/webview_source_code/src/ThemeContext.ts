import * as React from 'react';
export enum ThemeStyle {
  // 深色主题
  Dark = 'dark',
  // 亮色主题
  Light = 'light',
  // 跟随系统主题
  System = 'system',
}

export const ThemeProviderContext = React.createContext<{
  activeTheme: ThemeStyle; // 实际应用的主题（只能是 light 或 dark）
  themePreference: ThemeStyle; // 用户的主题偏好设置（可以是 light/dark/system）
  switchTheme: (theme: ThemeStyle) => void;
  systemTheme: ThemeStyle;
  setSystemTheme: (theme: ThemeStyle) => void;
}>({} as any);
ThemeProviderContext.displayName = 'ThemeProviderContext';

export const useTheme = () => {
  const theme = React.useContext(ThemeProviderContext);
  if (!theme) throw new Error('useTheme must be used within a ThemeProvider');
  return theme;
};
