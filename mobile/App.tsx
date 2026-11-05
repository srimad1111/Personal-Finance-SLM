import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const MainApp: React.FC = () => {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colors.background;
    }
  }, [colors.background]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor="transparent"
        translucent={true}
      />
      <AppNavigator />
    </View>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.root}>
        <ThemeProvider>
          <MainApp />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});
