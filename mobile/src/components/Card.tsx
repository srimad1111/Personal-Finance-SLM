import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress, elevated = false }) => {
  const { colors, borderRadius, shadows } = useTheme();

  const containerStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: elevated ? colors.surfaceElevated : colors.card,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      shadowColor: colors.shadowColor,
    },
    shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginVertical: 6,
    borderWidth: 1,
  },
});
