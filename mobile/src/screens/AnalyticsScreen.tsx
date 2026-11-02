import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { TrendChart } from '../components/TrendChart';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import { getMonthlyTrends, getCategoryWiseTotals } from '../database';
import { MonthlyTrend, CategorySpendingSummary } from '../types/database';

export const AnalyticsScreen: React.FC = () => {
  const { colors, borderRadius } = useTheme();

  const [timeframe, setTimeframe] = useState<'6M' | '3M' | '1M'>('6M');
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySpendingSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthsLimit = timeframe === '6M' ? 6 : timeframe === '3M' ? 3 : 1;
      const trendData = await getMonthlyTrends(monthsLimit);

      // Category breakdown for selected timeframe
      const now = new Date();
      const currentYear = now.getFullYear();
      let startDate: string | undefined = undefined;

      if (timeframe === '1M') {
        const m = String(now.getMonth() + 1).padStart(2, '0');
        startDate = `${currentYear}-${m}-01`;
      } else if (timeframe === '3M') {
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const m = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
        startDate = `${threeMonthsAgo.getFullYear()}-${m}-01`;
      } else {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const m = String(sixMonthsAgo.getMonth() + 1).padStart(2, '0');
        startDate = `${sixMonthsAgo.getFullYear()}-${m}-01`;
      }

      const catData = await getCategoryWiseTotals('expense', startDate);

      setTrends(trendData);
      setCategoryBreakdown(catData);
    } catch (err) {
      console.error('[LOAD_ANALYTICS_ERROR]', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Deterministic math calculations
  const totalIncome = trends.reduce((sum, t) => sum + t.income, 0);
  const totalExpense = trends.reduce((sum, t) => sum + t.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const avgMonthlySavings = trends.length > 0 ? totalSavings / trends.length : 0;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

  // Month-over-month comparison
  const currentMonthData = trends[trends.length - 1];
  const previousMonthData = trends.length > 1 ? trends[trends.length - 2] : null;

  let spendingChangePct = 0;
  let isSpendingReduced = true;
  if (currentMonthData && previousMonthData && previousMonthData.expense > 0) {
    const diff = currentMonthData.expense - previousMonthData.expense;
    spendingChangePct = (Math.abs(diff) / previousMonthData.expense) * 100;
    isSpendingReduced = diff <= 0;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Analytics"
        subtitle="Spending Patterns (Deterministic SQLite)"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Timeframe Switcher */}
        <View
          style={[
            styles.timeframeBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: borderRadius.lg,
            },
          ]}
        >
          {(['6M', '3M', '1M'] as const).map((tf) => {
            const isActive = timeframe === tf;
            return (
              <TouchableOpacity
                key={tf}
                style={[
                  styles.timeframeTab,
                  isActive && {
                    backgroundColor: colors.accent,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={() => setTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {tf === '6M' ? 'Last 6 Months' : tf === '3M' ? 'Quarter (3M)' : 'Current Month'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* Income vs Expense Trend Chart Card */}
            <Card style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                    Income vs Expenses
                  </Text>
                  <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>
                    Calculated from local SQLite ledger
                  </Text>
                </View>
                {previousMonthData && (
                  <StatusBadge
                    label={isSpendingReduced ? `Spending ↓ ${spendingChangePct.toFixed(0)}%` : `Spending ↑ ${spendingChangePct.toFixed(0)}%`}
                    status={isSpendingReduced ? 'success' : 'warning'}
                  />
                )}
              </View>

              {trends.length > 0 ? (
                <TrendChart trends={trends} />
              ) : (
                <View style={styles.noDataBox}>
                  <Text style={[styles.noDataText, { color: colors.textMuted }]}>
                    Insufficient monthly records to plot trend
                  </Text>
                </View>
              )}
            </Card>

            {/* Savings Performance Metric Card */}
            <Card style={{ marginVertical: 6 }}>
              <View style={styles.savingsHeader}>
                <View>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    AVERAGE MONTHLY SAVINGS
                  </Text>
                  <Text
                    style={[
                      styles.statValue,
                      { color: avgMonthlySavings >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    ${avgMonthlySavings.toFixed(2)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.savingsBadgeCircle,
                    {
                      backgroundColor: avgMonthlySavings >= 0 ? colors.successLight : colors.dangerLight,
                      borderRadius: borderRadius.full,
                    },
                  ]}
                >
                  <Ionicons
                    name={avgMonthlySavings >= 0 ? 'trending-up' : 'trending-down'}
                    size={24}
                    color={avgMonthlySavings >= 0 ? colors.success : colors.danger}
                  />
                </View>
              </View>

              <View style={[styles.savingsMetricsGrid, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.savingsMetricCol}>
                  <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>Net Savings</Text>
                  <Text
                    style={[
                      styles.savingsSubValue,
                      { color: totalSavings >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    ${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={[styles.dividerVertical, { backgroundColor: colors.borderSubtle }]} />
                <View style={styles.savingsMetricCol}>
                  <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>Savings Rate</Text>
                  <Text style={[styles.savingsSubValue, { color: colors.textPrimary }]}>
                    {savingsRate.toFixed(1)}%
                  </Text>
                </View>
              </View>
            </Card>

            {/* Category-wise Spending Breakdown */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Category Spending Distribution
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                Ranked by deterministic SQLite totals
              </Text>
            </View>

            {categoryBreakdown.length === 0 ? (
              <Card style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted }}>No expense transactions in this timeframe.</Text>
              </Card>
            ) : (
              categoryBreakdown.map((cat) => {
                return (
                  <Card key={cat.categoryId} style={styles.categoryBreakdownCard}>
                    <View style={styles.catBreakdownRow}>
                      {/* Category Icon */}
                      <View
                        style={[
                          styles.catIconBox,
                          {
                            backgroundColor: `${cat.color}20`,
                            borderRadius: borderRadius.md,
                          },
                        ]}
                      >
                        <Ionicons name={cat.icon as any} size={18} color={cat.color} />
                      </View>

                      {/* Details */}
                      <View style={styles.catBreakdownInfo}>
                        <View style={styles.catTopRow}>
                          <Text style={[styles.catBreakdownName, { color: colors.textPrimary }]}>
                            {cat.categoryName}
                          </Text>
                          <Text style={[styles.catBreakdownAmount, { color: colors.textPrimary }]}>
                            ${cat.totalAmount.toFixed(2)}
                          </Text>
                        </View>

                        {/* Progress Bar */}
                        <View style={{ marginVertical: 6 }}>
                          <ProgressBar
                            progress={cat.percentage / 100}
                            color={cat.color}
                            height={6}
                            autoThresholdColor={false}
                          />
                        </View>

                        <View style={styles.catBottomRow}>
                          <Text style={[styles.catPercentageText, { color: colors.textMuted }]}>
                            {cat.percentage.toFixed(1)}% of total ({cat.transactionCount} tx)
                          </Text>
                          <Text style={[styles.catStatusText, { color: cat.color }]}>
                            {cat.percentage > 30 ? 'Primary Outflow' : 'Normal'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        )}
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
  timeframeBar: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  timeframeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeText: {
    fontSize: 12,
  },
  chartCard: {
    padding: 18,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  noDataBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 13,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  savingsBadgeCircle: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  savingsMetricCol: {
    flex: 1,
  },
  savingsSubLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  savingsSubValue: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  dividerVertical: {
    width: 1,
    marginHorizontal: 12,
  },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryBreakdownCard: {
    marginVertical: 4,
    padding: 12,
  },
  catBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconBox: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catBreakdownInfo: {
    flex: 1,
  },
  catTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catBreakdownName: {
    fontSize: 14,
    fontWeight: '600',
  },
  catBreakdownAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  catBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catPercentageText: {
    fontSize: 11,
  },
  catStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
