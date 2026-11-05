import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { CategoryBreakdown } from '../types';
import { useTheme } from '../theme';
import { formatINR } from '../utils/currency';

interface ExpenseBreakdownBarProps {
  categories: CategoryBreakdown[];
}

export const ExpenseBreakdownBar: React.FC<ExpenseBreakdownBarProps> = ({ categories }) => {
  const { colors, borderRadius } = useTheme();

  // Display top categories
  const displayedCategories = categories.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Sleek Segmented Distribution Bar */}
      <View
        style={[
          styles.barContainer,
          {
            backgroundColor: colors.surfaceElevated,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        {categories.map((item, index) => {
          if (item.percentage < 1) return null;
          return (
            <View
              key={item.category}
              style={[
                styles.barSegment,
                {
                  backgroundColor: item.color,
                  width: `${item.percentage}%`,
                  marginRight: index < categories.length - 1 ? 2 : 0,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Grid Legend with Amounts and Percentages */}
      <View style={styles.legendGrid}>
        {displayedCategories.map((item) => (
          <View key={item.category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendName, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.legendValues}>
              <Text style={[styles.legendAmount, { color: colors.textPrimary }]}>
                {formatINR(item.amount)}
              </Text>
              <Text style={[styles.legendPct, { color: colors.textMuted }]}>
                {item.percentage.toFixed(0)}%
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  barContainer: {
    height: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  barSegment: {
    height: '100%',
    borderRadius: 3,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 10,
    columnGap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '47%',
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginRight: 4,
  },
  legendValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  legendPct: {
    fontSize: 10,
    fontWeight: '500',
  },
});
