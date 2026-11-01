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
      style={styles.container}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: borderRadius.xl,
          },
        ]}
      >
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 72,
  },
  iconCircle: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

