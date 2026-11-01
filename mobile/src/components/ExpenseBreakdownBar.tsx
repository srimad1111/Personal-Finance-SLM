import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { CategoryBreakdown } from '../types';
import { useTheme } from '../theme';

interface ExpenseBreakdownBarProps {
  categories: CategoryBreakdown[];
}

export const ExpenseBreakdownBar: React.FC<ExpenseBreakdownBarProps> = ({ categories }) => {
  const { colors, borderRadius } = useTheme();

  // Top categories to display in the legend
  const displayedCategories = categories.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Segmented Bar */}
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
                  borderTopLeftRadius: index === 0 ? borderRadius.full : 0,
                  borderBottomLeftRadius: index === 0 ? borderRadius.full : 0,
                  borderTopRightRadius: index === categories.length - 1 ? borderRadius.full : 0,
                  borderBottomRightRadius: index === categories.length - 1 ? borderRadius.full : 0,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legendContainer}>
        {displayedCategories.map((item) => (
          <View key={item.category} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              {item.name} <Text style={{ fontWeight: '700', color: colors.textPrimary }}>({item.percentage.toFixed(0)}%)</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  barContainer: {
    height: 12,
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
    marginTop: 12,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

