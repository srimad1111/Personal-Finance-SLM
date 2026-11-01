import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../theme';

interface ProgressBarProps {
  progress: number; // 0.0 to 1.0 (or >1 for over-budget)
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  autoThresholdColor?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  height = 8,
  style,
  autoThresholdColor = true,
}) => {
  const { colors, borderRadius } = useTheme();

  // Clamp width for visual bar between 0% and 100%
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  const getBarColor = (): string => {
    if (color) return color;
    if (!autoThresholdColor) return colors.accent;
    if (progress >= 1.0) return colors.danger;
    if (progress >= 0.8) return colors.warning;
    return colors.success;
  };

  const activeColor = getBarColor();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surfaceElevated,
          height,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            backgroundColor: activeColor,
            width: `${clampedProgress * 100}%`,
            height,
            borderRadius: borderRadius.full,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

