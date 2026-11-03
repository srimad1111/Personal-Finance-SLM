import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
  flat?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  elevated = false,
  flat = false,
}) => {
  const { colors, borderRadius, shadows } = useTheme();

  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: flat
        ? 'transparent'
        : elevated
        ? colors.surfaceElevated
        : colors.surface,
      borderColor: flat ? 'transparent' : colors.border,
      borderRadius: borderRadius.lg,
      shadowColor: colors.shadowColor,
    },
    !flat && shadows.subtle,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
  },
});
