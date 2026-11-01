import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { getFinancialSummary, getDatabase, insertTransaction } from '../database';
import { FinancialSummary } from '../types';

export const HomeScreen: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    transactionCount: 0,
  });
  const [dbStatus, setDbStatus] = useState<'pending' | 'active' | 'offline'>('pending');
  const [loading, setLoading] = useState(true);

  const initApp = async () => {
    try {
      setLoading(true);
      await getDatabase();
      setDbStatus('active');
      const data = await getFinancialSummary();
      setSummary(data);
    } catch (err) {
      console.error('Initialization error:', err);
      setDbStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const handleSeedDemoTx = async () => {
    try {
      await insertTransaction({
        type: 'expense',
        category: 'groceries',
        amount: 45.5,
        description: 'Supermarket purchase',
        isAiCategorized: true,
      });
      const data = await getFinancialSummary();
      setSummary(data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>FinanceSLM</Text>
          <Text style={styles.subtitle}>On-Device AI Financial Assistant</Text>
        </View>

        {/* System & Architecture Status Cards */}
        <Card>
          <Text style={styles.sectionTitle}>System Architecture Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>SQLite Local Database</Text>
            <StatusBadge
              label={dbStatus === 'active' ? 'Connected (WAL)' : 'Initializing'}
              status={dbStatus}
            />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Privacy Mode</Text>
            <StatusBadge label="100% Offline" status="active" />
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Inference Runtime</Text>
            <StatusBadge label="llama.cpp / GGUF (Ready for model)" status="pending" />
          </View>
        </Card>

        {/* Financial Summary */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={styles.balanceValue}>${summary.netBalance.toFixed(2)}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Income</Text>
              <Text style={[styles.metricValue, styles.incomeText]}>
                +${summary.totalIncome.toFixed(2)}
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Expenses</Text>
              <Text style={[styles.metricValue, styles.expenseText]}>
                -${summary.totalExpenses.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Button for Database Verification */}
        <TouchableOpacity style={styles.button} onPress={handleSeedDemoTx}>
          <Text style={styles.buttonText}>+ Test Local SQLite Insert</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 12 }} />}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusLabel: {
    fontSize: 14,
    color: '#475569',
  },
  balanceCard: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  balanceLabel: {
    fontSize: 13,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    marginVertical: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  metricItem: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  incomeText: {
    color: '#4ade80',
  },
  expenseText: {
    color: '#f87171',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

