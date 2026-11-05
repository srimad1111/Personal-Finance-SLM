import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { QuickActionButton } from '../components/QuickActionButton';
import { ExpenseBreakdownBar } from '../components/ExpenseBreakdownBar';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import { CATEGORIES } from '../data/mockData';
import { MainTabType, Transaction } from '../types';
import { getCategoryWiseTotals, getFinancialSummary } from '../database';
import { CategoryBreakdown } from '../types';
import { formatINR, formatTransactionAmount } from '../utils/currency';
import { isModelImported } from '../services/modelStorageService';

interface DashboardScreenProps {
  onNavigate: (tab: MainTabType) => void;
  onOpenAddModal: (type?: 'income' | 'expense') => void;
  onOpenDbDiagnostics?: () => void;
  transactions?: Transaction[];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigate,
  onOpenAddModal,
  onOpenDbDiagnostics,
  transactions = [],
}) => {
  const { colors, borderRadius } = useTheme();
  const [showBalance, setShowBalance] = useState(true);
  const [categoryBreakdowns, setCategoryBreakdowns] = useState<CategoryBreakdown[]>([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [isModelReady, setIsModelReady] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const monthStartDate = `${currentYear}-${currentMonthStr}-01`;

  const loadDashboardMetrics = useCallback(async () => {
    try {
      const summary = await getFinancialSummary(monthStartDate);
      setMonthlyIncome(summary.totalIncome);
      setMonthlyExpense(summary.totalExpenses);

      const catTotals = await getCategoryWiseTotals('expense', monthStartDate);
      const mappedBreakdowns: CategoryBreakdown[] = catTotals.map((c) => ({
        category: c.categoryId as any,
        name: c.categoryName,
        amount: c.totalAmount,
        percentage: c.percentage,
        color: c.color,
        icon: c.icon,
      }));
      setCategoryBreakdowns(mappedBreakdowns);

      const modelImported = await isModelImported();
      setIsModelReady(modelImported);
    } catch (err) {
      console.error('[LOAD_DASHBOARD_METRICS_ERROR]', err);
    }
  }, [monthStartDate]);

  useEffect(() => {
    loadDashboardMetrics();
  }, [loadDashboardMetrics, transactions]);

  const allTimeIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const allTimeExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = allTimeIncome - allTimeExpense;
  const currentMonthSavings = monthlyIncome - monthlyExpense;
  const savingsRate = monthlyIncome > 0 ? (currentMonthSavings / monthlyIncome) * 100 : 0;
  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Portfolio"
        subtitle="Offline SQLite Ledger"
        rightAction={
          <View style={styles.headerRightActions}>
            {onOpenDbDiagnostics && (
              <TouchableOpacity
                style={[
                  styles.headerActionBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={onOpenDbDiagnostics}
                accessibilityLabel="Database Health Diagnostics"
              >
                <Ionicons name="shield-checkmark-outline" size={15} color={colors.success} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => onNavigate('modelTest')}
              accessibilityLabel="Local Model Test Bench"
            >
              <Ionicons name="hardware-chip-outline" size={15} color={colors.aiAccent} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Net Balance Card (Revolut / Apple Wallet Inspired) */}
        <Card style={styles.heroBalanceCard}>
          <View style={styles.balanceHeader}>
            <View style={styles.balanceTag}>
              <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.balanceCaption, { color: colors.textMuted }]}>
                TOTAL NET BALANCE
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowBalance(!showBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                size={16}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.balanceAmount, { color: colors.textPrimary }]}>
            {showBalance ? formatINR(netBalance) : '••••••••'}
          </Text>

          {/* 3-Column Clean Secondary Metric Strip */}
          <View style={[styles.metricsStrip, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Inflow</Text>
              <Text style={[styles.metricNumber, { color: colors.success }]}>
                {monthlyIncome > 0 ? `+${formatINR(monthlyIncome)}` : formatINR(0)}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Outflow</Text>
              <Text style={[styles.metricNumber, { color: colors.danger }]}>
                {monthlyExpense > 0 ? `-${formatINR(monthlyExpense)}` : formatINR(0)}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Savings</Text>
              <Text
                style={[
                  styles.metricNumber,
                  { color: savingsRate >= 0 ? colors.textPrimary : colors.danger },
                ]}
              >
                {monthlyIncome > 0 ? `${savingsRate.toFixed(1)}%` : '0%'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          <QuickActionButton
            label="Expense"
            icon="arrow-up"
            accentColor={colors.danger}
            onPress={() => onOpenAddModal('expense')}
          />
          <QuickActionButton
            label="Income"
            icon="arrow-down"
            accentColor={colors.success}
            onPress={() => onOpenAddModal('income')}
          />
          <QuickActionButton
            label="Budgets"
            icon="pie-chart-outline"
            accentColor={colors.accent}
            onPress={() => onNavigate('budgets')}
          />
          <QuickActionButton
            label="Analytics"
            icon="bar-chart-outline"
            accentColor={colors.aiAccent}
            onPress={() => onNavigate('analytics')}
          />
        </View>

        {/* Local Model Status Card (Compact & Honest) */}
        <Card
          style={styles.modelFeatureCard}
          onPress={() => onNavigate('modelTest')}
        >
          <View style={styles.modelFeatureContent}>
            <View
              style={[
                styles.modelIconBox,
                {
                  backgroundColor: `${colors.aiAccent}16`,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <Ionicons name="hardware-chip-outline" size={17} color={colors.aiAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.modelTitleRow}>
                <Text style={[styles.modelFeatureTitle, { color: colors.textPrimary }]}>
                  Gemma 3 1B SLM
                </Text>
                <View
                  style={[
                    styles.modelStatusPill,
                    {
                      backgroundColor: isModelReady ? `${colors.success}18` : `${colors.textMuted}18`,
                      borderColor: isModelReady ? colors.success : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modelStatusPillText,
                      { color: isModelReady ? colors.success : colors.textMuted },
                    ]}
                  >
                    {isModelReady ? 'Ready' : 'Not Imported'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.modelFeatureSubtitle, { color: colors.textMuted }]}>
                {isModelReady
                  ? 'On-device private inference active via llama.rn'
                  : 'Tap to import GGUF model into local sandbox'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </Card>

        {/* Monthly Expense Breakdown Section */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Expense Breakdown
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Monthly category distribution
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => onNavigate('analytics')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.viewAllText, { color: colors.accent }]}>View All →</Text>
            </TouchableOpacity>
          </View>

          {categoryBreakdowns.length > 0 ? (
            <ExpenseBreakdownBar categories={categoryBreakdowns} />
          ) : (
            <View style={styles.emptyCardBox}>
              <Text style={[styles.emptyCardText, { color: colors.textMuted }]}>
                No expenses recorded this month
              </Text>
            </View>
          )}
        </Card>

        {/* Recent Transactions List */}
        <View style={styles.transactionsHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent Activity
          </Text>
          <TouchableOpacity
            onPress={() => onNavigate('transactions')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.viewAllText, { color: colors.accent }]}>
              See all ({transactions.length}) →
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.transactionListCard}>
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx, index) => {
              const categoryMeta = CATEGORIES[tx.category] || {
                id: tx.category,
                name: tx.category,
                icon: 'receipt-outline',
                color: colors.accent,
                type: tx.type,
              };
              const isIncome = tx.type === 'income';
              const isLast = index === recentTransactions.length - 1;

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => onNavigate('transactions')}
                  style={[
                    styles.txRow,
                    !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                  ]}
                >
                  {/* Category Icon */}
                  <View
                    style={[
                      styles.txIconContainer,
                      {
                        backgroundColor: `${categoryMeta.color}14`,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Ionicons
                      name={categoryMeta.icon as any}
                      size={16}
                      color={categoryMeta.color}
                    />
                  </View>

                  {/* Transaction Details */}
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tx.merchant || tx.description}
                    </Text>
                    <View style={styles.txMetaGroup}>
                      <Text style={[styles.txCategory, { color: colors.textSecondary }]}>
                        {categoryMeta.name}
                      </Text>
                      {tx.isAiCategorized && (
                        <StatusBadge
                          label="SLM"
                          status="ai"
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Amount & Date */}
                  <View style={styles.txAmountContainer}>
                    <Text
                      style={[
                        styles.txAmount,
                        {
                          color: isIncome ? colors.success : colors.textPrimary,
                        },
                      ]}
                    >
                      {formatTransactionAmount(tx.amount, tx.type)}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.textMuted }]}>{tx.date}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCardBox}>
              <Text style={[styles.emptyCardText, { color: colors.textMuted }]}>
                No transactions yet
              </Text>
            </View>
          )}
        </Card>

        {/* Security & Offline Engine Footer */}
        <View style={styles.footerNoteRow}>
          <Ionicons name="lock-closed-outline" size={11} color={colors.textMuted} style={{ marginRight: 4 }} />
          <Text style={[styles.footerNoteText, { color: colors.textMuted }]}>
            100% Offline · Local SQLite WAL Storage
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroBalanceCard: {
    padding: 16,
    marginTop: 2,
    marginBottom: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  balanceCaption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginVertical: 8,
  },
  metricsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metricColumn: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  metricNumber: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  metricDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modelFeatureCard: {
    padding: 12,
    marginBottom: 12,
  },
  modelFeatureContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modelIconBox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  modelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelFeatureTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  modelStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderRadius: 4,
  },
  modelStatusPillText: {
    fontSize: 9,
    fontWeight: '600',
  },
  modelFeatureSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  transactionListCard: {
    paddingVertical: 0,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  txIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txMetaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txCategory: {
    fontSize: 11,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txDate: {
    fontSize: 10,
    marginTop: 2,
  },
  emptyCardBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyCardText: {
    fontSize: 12,
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  footerNoteText: {
    fontSize: 10,
  },
});
