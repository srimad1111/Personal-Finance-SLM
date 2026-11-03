import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface QuickActionButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accentColor?: string;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  label,
  icon,
  onPress,
  accentColor,
}) => {
  const { colors, borderRadius } = useTheme();
  const tint = accentColor || colors.accent;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: `${tint}14`,
            borderRadius: borderRadius.sm,
          },
        ]}
      >
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  iconBox: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
