import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface StatusBadgeProps {
  label: string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'neutral',
  icon,
  size = 'sm',
  style,
}) => {
  const { colors, borderRadius } = useTheme();

  const getStatusColor = (): { bg: string; text: string; border: string } => {
    switch (status) {
      case 'success':
        return {
          bg: colors.successLight,
          text: colors.success,
          border: `${colors.success}33`,
        };
      case 'warning':
        return {
          bg: colors.warningLight,
          text: colors.warning,
          border: `${colors.warning}33`,
        };
      case 'danger':
        return {
          bg: colors.dangerLight,
          text: colors.danger,
          border: `${colors.danger}33`,
        };
      case 'info':
        return {
          bg: 'rgba(59, 130, 246, 0.10)',
          text: colors.accent,
          border: 'rgba(59, 130, 246, 0.25)',
        };
      case 'ai':
        return {
          bg: colors.aiAccentLight,
          text: colors.aiAccent,
          border: `${colors.aiAccent}33`,
        };
      case 'neutral':
      default:
        return {
          bg: colors.surfaceElevated,
          text: colors.textSecondary,
          border: colors.border,
        };
    }
  };

  const currentColors = getStatusColor();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: currentColors.bg,
          borderColor: currentColors.border,
          borderRadius: borderRadius.sm,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 8,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSm ? 10 : 12}
          color={currentColors.text}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: currentColors.text,
            fontSize: isSm ? 10 : 11,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
