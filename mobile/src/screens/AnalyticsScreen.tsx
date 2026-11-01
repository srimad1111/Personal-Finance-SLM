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
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { TrendChart } from '../components/TrendChart';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import {
  MONTHLY_SPENDING_TRENDS,
  CATEGORY_BREAKDOWN,
} from '../data/mockData';

export const AnalyticsScreen: React.FC = () => {
  const { colors, borderRadius } = useTheme();

  const [timeframe, setTimeframe] = useState<'6M' | '3M' | '1M'>('6M');

  // Trend computations
  const currentMonthData = MONTHLY_SPENDING_TRENDS[MONTHLY_SPENDING_TRENDS.length - 1];
  const previousMonthData = MONTHLY_SPENDING_TRENDS[MONTHLY_SPENDING_TRENDS.length - 2];

  const spendingDiff = currentMonthData.expense - previousMonthData.expense;
  const isSpendingReduced = spendingDiff < 0;

  const total6MSavings = MONTHLY_SPENDING_TRENDS.reduce((sum, t) => sum + t.savings, 0);
  const avgMonthlySavings = total6MSavings / MONTHLY_SPENDING_TRENDS.length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Analytics"
        subtitle="Spending Patterns & Intelligence"
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
                  {tf === '6M' ? 'Last 6 Months' : tf === '3M' ? 'Quarter' : 'Current Month'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Income vs Expense Trend Chart Card */}
        <Card style={styles.chartCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
                Income vs Expenses
              </Text>
              <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>
                Monthly comparison across 2026
              </Text>
            </View>
            <StatusBadge
              label={isSpendingReduced ? 'Spending ↓ 40%' : 'Spending ↑'}
              status={isSpendingReduced ? 'success' : 'warning'}
            />
          </View>

          <TrendChart trends={MONTHLY_SPENDING_TRENDS} />
        </Card>

        {/* Savings Performance Metric Card */}
        <Card style={{ marginVertical: 6 }}>
          <View style={styles.savingsHeader}>
            <View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                AVERAGE MONTHLY SAVINGS
              </Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                ${avgMonthlySavings.toFixed(2)}
              </Text>
            </View>
            <View
              style={[
                styles.savingsBadgeCircle,
                { backgroundColor: colors.successLight, borderRadius: borderRadius.full },
              ]}
            >
              <Ionicons name="trending-up" size={24} color={colors.success} />
            </View>
          </View>

          <View style={[styles.savingsMetricsGrid, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.savingsMetricCol}>
              <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>Total 6M Saved</Text>
              <Text style={[styles.savingsSubValue, { color: colors.textPrimary }]}>
                ${total6MSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={[styles.dividerVertical, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.savingsMetricCol}>
              <Text style={[styles.savingsSubLabel, { color: colors.textMuted }]}>Peak Inflow</Text>
              <Text style={[styles.savingsSubValue, { color: colors.textPrimary }]}>$7,450.00 (Oct)</Text>
            </View>
          </View>
        </Card>

        {/* Category-wise Spending Breakdown */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Category Spending Distribution
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Ranked by total outflow
          </Text>
        </View>

        {CATEGORY_BREAKDOWN.map((cat) => {
          return (
            <Card key={cat.category} style={styles.categoryBreakdownCard}>
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
                      {cat.name}
                    </Text>
                    <Text style={[styles.catBreakdownAmount, { color: colors.textPrimary }]}>
                      ${cat.amount.toFixed(2)}
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
                      {cat.percentage.toFixed(1)}% of total expenses
                    </Text>
                    <Text style={[styles.catStatusText, { color: cat.color }]}>
                      {cat.percentage > 25 ? 'High Impact' : 'Normal'}
                    </Text>
                  </View>
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

