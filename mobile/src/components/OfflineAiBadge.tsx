import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface OfflineAiBadgeProps {
  modelName?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const OfflineAiBadge: React.FC<OfflineAiBadgeProps> = ({
  modelName = 'Gemma 3 1B (Local)',
  onPress,
  style,
}) => {
  const { colors, borderRadius } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: borderRadius.sm,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.aiAccent }]} />
      <Ionicons name="sparkles" size={11} color={colors.aiAccent} style={styles.icon} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        <Text style={[styles.modelName, { color: colors.textPrimary }]}>{modelName}</Text>
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 10,
    fontWeight: '500',
  },
  modelName: {
    fontWeight: '600',
  },
});
