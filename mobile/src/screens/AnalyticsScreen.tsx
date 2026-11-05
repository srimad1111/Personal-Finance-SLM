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
import { formatINR } from '../utils/currency';

export const AnalyticsScreen: React.FC = () => {
  const { colors, borderRadius, isDark } = useTheme();

  const [timeframe, setTimeframe] = useState<'6M' | '3M' | '1M'>('6M');
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategorySpendingSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthsLimit = timeframe === '6M' ? 6 : timeframe === '3M' ? 3 : 1;
      const trendData = await getMonthlyTrends(monthsLimit);

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

  const totalIncome = trends.reduce((sum, t) => sum + t.income, 0);
  const totalExpense = trends.reduce((sum, t) => sum + t.expense, 0);
  const totalSavings = totalIncome - totalExpense;
  const avgMonthlySavings = trends.length > 0 ? totalSavings / trends.length : 0;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;

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
        subtitle="Financial Intelligence · SQLite Ledger"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Timeframe Segmented Switcher */}
        <View
          style={[
            styles.timeframeBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: borderRadius.md,
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
                  isActive && [
                    styles.timeframeTabActive,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: borderRadius.sm,
                    },
                  ],
                ]}
                onPress={() => setTimeframe(tf)}
              >
                <Text
                  style={[
                    styles.timeframeText,
                    {
                      color: isActive ? colors.textPrimary : colors.textMuted,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {tf === '6M' ? '6 Months' : tf === '3M' ? '3 Months' : 'Current Month'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* Income vs Expense Trend Chart Card */}
            <Card style={styles.chartCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                    Inflow vs Outflow
                  </Text>
                  <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>
                    Aggregated monthly performance
                  </Text>
                </View>
                {previousMonthData && (
                  <StatusBadge
                    label={isSpendingReduced ? `Outflow ↓ ${spendingChangePct.toFixed(0)}%` : `Outflow ↑ ${spendingChangePct.toFixed(0)}%`}
                    status={isSpendingReduced ? 'success' : 'warning'}
                    size="sm"
                  />
                )}
              </View>

              {trends.length > 0 ? (
                <TrendChart trends={trends} />
              ) : (
                <View style={styles.noDataBox}>
                  <Text style={[styles.noDataText, { color: colors.textMuted }]}>
                    No transactions yet to plot trend
                  </Text>
                </View>
              )}
            </Card>

            {/* Savings Performance Overview Card */}
            <Card style={styles.savingsCard}>
              <View style={styles.savingsTopRow}>
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
                    {formatINR(avgMonthlySavings)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.savingsIconCircle,
                    {
                      backgroundColor: avgMonthlySavings >= 0 ? colors.successLight : colors.dangerLight,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                >
                  <Ionicons
                    name={avgMonthlySavings >= 0 ? 'trending-up' : 'trending-down'}
                    size={20}
                    color={avgMonthlySavings >= 0 ? colors.success : colors.danger}
                  />
                </View>
              </View>

              <View style={[styles.savingsMetricsGrid, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.savingsMetricCol}>
                  <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>
                    Net Savings
                  </Text>
                  <Text
                    style={[
                      styles.savingsSubValue,
                      { color: totalSavings >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {formatINR(totalSavings)}
                  </Text>
                </View>
                <View style={[styles.dividerVertical, { backgroundColor: colors.borderSubtle }]} />
                <View style={styles.savingsMetricCol}>
                  <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>
                    Savings Rate
                  </Text>
                  <Text style={[styles.savingsSubValue, { color: colors.textPrimary }]}>
                    {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : '0%'}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Category-wise Spending Breakdown */}
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Category Breakdown
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                {categoryBreakdown.length} expense categories
              </Text>
            </View>

            {categoryBreakdown.length === 0 ? (
              <Card style={styles.noDataCard}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  No expense transactions in this timeframe.
                </Text>
              </Card>
            ) : (
              <Card style={styles.categoryListCard}>
                {categoryBreakdown.map((cat, index) => {
                  const isLast = index === categoryBreakdown.length - 1;
                  return (
                    <View
                      key={cat.categoryId}
                      style={[
                        styles.catBreakdownRow,
                        !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                      ]}
                    >
                      {/* Category Icon */}
                      <View
                        style={[
                          styles.catIconBox,
                          {
                            backgroundColor: `${cat.color}14`,
                            borderRadius: borderRadius.sm,
                          },
                        ]}
                      >
                        <Ionicons name={cat.icon as any} size={15} color={cat.color} />
                      </View>

                      {/* Details & Progress */}
                      <View style={styles.catInfo}>
                        <View style={styles.catLabelRow}>
                          <Text style={[styles.catName, { color: colors.textPrimary }]}>
                            {cat.categoryName}
                          </Text>
                          <Text style={[styles.catAmount, { color: colors.textPrimary }]}>
                            {formatINR(cat.totalAmount)}
                          </Text>
                        </View>

                        <View style={styles.progressBarWrapper}>
                          <ProgressBar
                            progress={cat.percentage / 100}
                            color={cat.color}
                            height={4}
                          />
                        </View>

                        <View style={styles.catMetaRow}>
                          <Text style={[styles.catMetaText, { color: colors.textMuted }]}>
                            {cat.transactionCount} transactions
                          </Text>
                          <Text style={[styles.catMetaText, { color: colors.textMuted }]}>
                            {cat.percentage.toFixed(1)}% of total
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </Card>
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
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  timeframeBar: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: 12,
  },
  timeframeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeframeTabActive: {
    borderWidth: 1,
  },
  timeframeText: {
    fontSize: 12,
  },
  chartCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  chartSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  noDataBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 12,
  },
  savingsCard: {
    padding: 16,
    marginBottom: 14,
  },
  savingsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  savingsIconCircle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingsMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  savingsMetricCol: {
    flex: 1,
  },
  savingsSubLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  savingsSubValue: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dividerVertical: {
    width: 1,
    height: 22,
    alignSelf: 'center',
    marginHorizontal: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
  },
  noDataCard: {
    padding: 24,
    alignItems: 'center',
  },
  categoryListCard: {
    paddingVertical: 0,
    paddingHorizontal: 14,
  },
  catBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  catIconBox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catInfo: {
    flex: 1,
  },
  catLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarWrapper: {
    marginVertical: 4,
  },
  catMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  catMetaText: {
    fontSize: 10,
  },
});
