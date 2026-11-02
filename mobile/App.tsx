import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const MainApp: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
