import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SpendingTrend } from '../types';
import { useTheme } from '../theme';

interface TrendChartProps {
  trends: SpendingTrend[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ trends }) => {
  const { colors, borderRadius } = useTheme();

  // Find max value to normalize heights for INR scale
  const maxVal = Math.max(...trends.flatMap((t) => [t.income, t.expense]), 50000);
  const chartHeight = 140;

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.danger }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Expenses</Text>
        </View>
      </View>

      {/* Bar Chart Area */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {trends.map((item) => {
          const incomeHeight = (item.income / maxVal) * chartHeight;
          const expenseHeight = (item.expense / maxVal) * chartHeight;

          return (
            <View key={item.month} style={styles.columnContainer}>
              <View style={styles.barsGroup}>
                {/* Income Bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: incomeHeight,
                      backgroundColor: colors.success,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                />
                {/* Expense Bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: expenseHeight,
                      backgroundColor: colors.danger,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.monthLabel, { color: colors.textMuted }]}>{item.month}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  columnContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barsGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: '100%',
  },
  bar: {
    width: 10,
    minHeight: 4,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    position: 'absolute',
    bottom: -20,
  },
});

