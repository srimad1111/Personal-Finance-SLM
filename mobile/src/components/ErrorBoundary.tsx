import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CRITICAL_UNCAUGHT_ERROR]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred during rendering. Details are provided below:
            </Text>
            <ScrollView style={styles.errorBox}>
              <Text style={styles.errorText}>
                {this.state.error ? this.state.error.toString() : 'Unknown Error'}
              </Text>
              {this.state.errorInfo?.componentStack && (
                <Text style={styles.stackText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.button} onPress={this.handleReload}>
              <Text style={styles.buttonText}>Reload Application</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    maxWidth: 600,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#EF4444',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    marginBottom: 20,
  },
  errorText: {
    color: '#F87171',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  stackText: {
    color: '#64748B',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});

