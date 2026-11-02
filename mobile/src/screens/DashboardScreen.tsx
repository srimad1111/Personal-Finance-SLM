import React, { useState } from 'react';
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
import { OfflineAiBadge } from '../components/OfflineAiBadge';
import { QuickActionButton } from '../components/QuickActionButton';
import { ExpenseBreakdownBar } from '../components/ExpenseBreakdownBar';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import {
  CATEGORY_BREAKDOWN,
  CATEGORIES,
} from '../data/mockData';
import { MainTabType, Transaction } from '../types';

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

  // Compute live metrics from SQLite transactions
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;
  const recentTransactions = transactions.slice(0, 5);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Portfolio"
        subtitle="SLM-Powered Financial Overview"
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onOpenDbDiagnostics && (
              <TouchableOpacity
                style={[
                  styles.headerActionBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                  },
                ]}
                onPress={onOpenDbDiagnostics}
                accessibilityLabel="SQLite Diagnostics & Tests"
              >
                <Ionicons name="server-outline" size={17} color={colors.accent} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onNavigate('assistant')}
              accessibilityLabel="AI Assistant"
            >
              <Ionicons name="sparkles" size={17} color={colors.aiAccentGlow} />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Status & SQLite Health Row */}
        <View style={styles.badgeRow}>
          <OfflineAiBadge onPress={() => onNavigate('assistant')} />
          {onOpenDbDiagnostics && (
            <TouchableOpacity
              onPress={onOpenDbDiagnostics}
              style={[
                styles.dbPill,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: borderRadius.full,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={[styles.dbPillText, { color: colors.textSecondary }]}>
                SQLite: <Text style={{ fontWeight: '700', color: colors.success }}>WAL Active</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Master Balance Card */}
        <Card style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.balanceHeader}>
            <Text style={[styles.balanceCaption, { color: colors.textMuted }]}>TOTAL NET WORTH</Text>
            <TouchableOpacity
              onPress={() => setShowBalance(!showBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.balanceAmount, { color: colors.textPrimary }]}>
            {showBalance ? `$${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '••••••••'}
          </Text>

          {/* Metric Sub-cards */}
          <View style={[styles.metricsGrid, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.metricColumn}>
              <View style={styles.metricLabelGroup}>
                <View style={[styles.indicatorDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Income</Text>
              </View>
              <Text style={[styles.metricNumber, { color: colors.success }]}>
                +${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <View style={styles.metricLabelGroup}>
                <View style={[styles.indicatorDot, { backgroundColor: colors.danger }]} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Expenses</Text>
              </View>
              <Text style={[styles.metricNumber, { color: colors.danger }]}>
                -${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.metricColumn}>
              <View style={styles.metricLabelGroup}>
                <View style={[styles.indicatorDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Savings</Text>
              </View>
              <Text style={[styles.metricNumber, { color: colors.textPrimary }]}>
                {savingsRate.toFixed(1)}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Action Buttons */}
        <View style={styles.quickActionsRow}>
          <QuickActionButton
            label="Expense"
            icon="arrow-up-circle-outline"
            accentColor={colors.danger}
            onPress={() => onOpenAddModal('expense')}
          />
          <QuickActionButton
            label="Income"
            icon="arrow-down-circle-outline"
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
            label="Ask AI"
            icon="sparkles"
            accentColor={colors.aiAccentGlow}
            onPress={() => onNavigate('assistant')}
          />
        </View>

        {/* Spending Breakdown Section */}
        <Card style={{ marginVertical: 8 }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Expense Breakdown
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Stored locally in SQLite database
              </Text>
            </View>
            <TouchableOpacity onPress={() => onNavigate('analytics')}>
              <Text style={[styles.seeAllText, { color: colors.accent }]}>Analytics →</Text>
            </TouchableOpacity>
          </View>

          <ExpenseBreakdownBar categories={CATEGORY_BREAKDOWN} />
        </Card>

        {/* Recent Transactions Section */}
        <View style={styles.recentTransactionsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent Transactions ({transactions.length})
          </Text>
          <TouchableOpacity onPress={() => onNavigate('transactions')}>
            <Text style={[styles.seeAllText, { color: colors.accent }]}>See all →</Text>
          </TouchableOpacity>
        </View>

        {recentTransactions.map((tx) => {
          const categoryMeta = CATEGORIES[tx.category] || CATEGORIES.misc;
          const isIncome = tx.type === 'income';

          return (
            <Card
              key={tx.id}
              style={styles.transactionCard}
              onPress={() => onNavigate('transactions')}
            >
              <View style={styles.txRow}>
                {/* Category Icon */}
                <View
                  style={[
                    styles.txIconContainer,
                    {
                      backgroundColor: `${categoryMeta.color}1F`,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={categoryMeta.icon as any}
                    size={20}
                    color={categoryMeta.color}
                  />
                </View>

                {/* Details */}
                <View style={styles.txInfo}>
                  <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {tx.merchant || tx.description}
                  </Text>
                  <View style={styles.txMetaRow}>
                    <Text style={[styles.txCategory, { color: colors.textMuted }]}>
                      {categoryMeta.name}
                    </Text>
                    {tx.isAiCategorized && (
                      <StatusBadge
                        label="SLM Tagged"
                        icon="hardware-chip-outline"
                        status="ai"
                        style={{ marginLeft: 6 }}
                      />
                    )}
                  </View>
                </View>

                {/* Amount */}
                <View style={styles.txAmountContainer}>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isIncome ? colors.success : colors.textPrimary },
                    ]}
                  >
                    {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.txDate, { color: colors.textMuted }]}>{tx.date}</Text>
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dbPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dbPillText: {
    fontSize: 11,
    fontWeight: '500',
  },
  balanceCard: {
    padding: 20,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceCaption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginVertical: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  metricColumn: {
    flex: 1,
  },
  metricLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricNumber: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    paddingHorizontal: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recentTransactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  transactionCard: {
    marginVertical: 4,
    padding: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  txCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
});
