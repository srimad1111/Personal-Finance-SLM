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
  modelName = 'Llama-3.2 / Qwen2.5 (Local)',
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
          backgroundColor: colors.aiAccentLight,
          borderColor: colors.aiAccent,
          borderRadius: borderRadius.full,
        },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.aiAccentGlow }]} />
      <Ionicons name="hardware-chip-outline" size={13} color={colors.aiAccentGlow} style={styles.icon} />
      <Text style={[styles.text, { color: colors.aiAccentGlow }]}>
        Offline SLM: <Text style={styles.modelName}>{modelName}</Text>
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  modelName: {
    fontWeight: '700',
  },
});

