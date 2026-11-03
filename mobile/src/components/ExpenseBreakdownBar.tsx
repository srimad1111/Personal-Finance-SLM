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

  const displayedCategories = categories.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Segmented Distribution Strip */}
      <View
        style={[
          styles.barContainer,
          {
            backgroundColor: colors.surfaceElevated,
            borderRadius: borderRadius.sm,
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
                  marginRight: index < categories.length - 1 ? 1 : 0,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Grid Legend with Amounts and Percentages */}
      <View style={styles.legendContainer}>
        {displayedCategories.map((item) => (
          <View key={item.category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendName, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.legendValue, { color: colors.textPrimary }]}>
              {formatINR(item.amount)}
            </Text>
            <Text style={[styles.legendPercentage, { color: colors.textMuted }]}>
              {item.percentage.toFixed(0)}%
            </Text>
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
    height: 7,
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  barSegment: {
    height: '100%',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    rowGap: 10,
    columnGap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '45%',
    flex: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  legendName: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  legendPercentage: {
    fontSize: 11,
    fontWeight: '500',
  },
});
