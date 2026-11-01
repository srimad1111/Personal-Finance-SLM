import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface StatusBadgeProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  backgroundColor?: string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'ai';
  style?: StyleProp<ViewStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  icon,
  color,
  backgroundColor,
  status = 'info',
  style,
}) => {
  const { colors, borderRadius } = useTheme();

  const getStatusColors = (): { bg: string; text: string } => {
    if (color && backgroundColor) {
      return { bg: backgroundColor, text: color };
    }
    switch (status) {
      case 'success':
        return { bg: colors.successLight, text: colors.success };
      case 'warning':
        return { bg: colors.warningLight, text: colors.warning };
      case 'danger':
        return { bg: colors.dangerLight, text: colors.danger };
      case 'ai':
        return { bg: colors.aiAccentLight, text: colors.aiAccentGlow };
      case 'info':
      default:
        return { bg: colors.chipBackground, text: colors.textSecondary };
    }
  };

  const scheme = getStatusColors();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: scheme.bg,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      {icon && (
        <Ionicons name={icon} size={11} color={scheme.text} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.label, { color: scheme.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
