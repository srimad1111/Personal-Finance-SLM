import React, { createContext, useContext, useState, useMemo } from 'react';
import { ColorTheme, darkColors, lightColors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

interface ThemeContextType {
  colors: ColorTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setDarkTheme: (isDark: boolean) => void;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(true); // Default to sleek dark fintech theme

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const setDarkTheme = (dark: boolean) => {
    setIsDark(dark);
  };

  const activeColors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(
    () => ({
      colors: activeColors,
      isDark,
      toggleTheme,
      setDarkTheme,
      typography,
      spacing,
      borderRadius,
      shadows,
    }),
    [activeColors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

