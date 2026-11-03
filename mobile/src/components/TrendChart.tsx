import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SpendingTrend } from '../types';
import { useTheme } from '../theme';

interface TrendChartProps {
  trends: SpendingTrend[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ trends }) => {
  const { colors, borderRadius } = useTheme();

  // Normalize heights against maximum value with minimum baseline
  const maxVal = Math.max(...trends.flatMap((t) => [t.income, t.expense]), 50000);
  const chartHeight = 130;

  return (
    <View style={styles.container}>
      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Inflow</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendIndicator, { backgroundColor: colors.danger }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Outflow</Text>
        </View>
      </View>

      {/* Bar Chart Area with subtle background hairline guides */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {/* Subtle gridline guide at 50% */}
        <View
          style={[
            styles.gridLine,
            { top: chartHeight * 0.5, backgroundColor: colors.borderSubtle },
          ]}
        />

        {trends.map((item) => {
          const incomeHeight = Math.max((item.income / maxVal) * (chartHeight - 16), 4);
          const expenseHeight = Math.max((item.expense / maxVal) * (chartHeight - 16), 4);

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
                      borderTopLeftRadius: borderRadius.xs,
                      borderTopRightRadius: borderRadius.xs,
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
                      borderTopLeftRadius: borderRadius.xs,
                      borderTopRightRadius: borderRadius.xs,
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
    marginVertical: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chartArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.12)',
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  columnContainer: {
    alignItems: 'center',
    flex: 1,
  },
  barsGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: '100%',
  },
  bar: {
    width: 8,
    minHeight: 4,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '500',
    position: 'absolute',
    bottom: -18,
  },
});
