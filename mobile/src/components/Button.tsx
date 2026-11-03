import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const getVariantStyles = (): { bg: string; text: string; border?: string } => {
    switch (variant) {
      case 'primary':
        return {
          bg: isDark ? '#FFFFFF' : '#0F172A',
          text: isDark ? '#090D16' : '#FFFFFF',
        };
      case 'secondary':
        return {
          bg: colors.surfaceElevated,
          text: colors.textPrimary,
          border: colors.border,
        };
      case 'outline':
        return {
          bg: 'transparent',
          text: colors.textPrimary,
          border: colors.border,
        };
      case 'danger':
        return {
          bg: colors.danger,
          text: '#FFFFFF',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          text: colors.textSecondary,
        };
    }
  };

  const getSizeStyles = (): {
    paddingVertical: number;
    paddingHorizontal: number;
    fontSize: number;
    iconSize: number;
  } => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 7, paddingHorizontal: 12, fontSize: 12, iconSize: 14 };
      case 'md':
        return { paddingVertical: 11, paddingHorizontal: 16, fontSize: 14, iconSize: 17 };
      case 'lg':
        return { paddingVertical: 14, paddingHorizontal: 20, fontSize: 15, iconSize: 19 };
    }
  };

  const vStyle = getVariantStyles();
  const sStyle = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? colors.chipBackground : vStyle.bg,
          borderColor: vStyle.border || 'transparent',
          borderWidth: vStyle.border ? 1 : 0,
          borderRadius: borderRadius.md,
          paddingVertical: sStyle.paddingVertical,
          paddingHorizontal: sStyle.paddingHorizontal,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vStyle.text} />
      ) : (
        <View style={styles.content}>
          {icon && (
            <Ionicons
              name={icon}
              size={sStyle.iconSize}
              color={disabled ? colors.textMuted : vStyle.text}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              {
                color: disabled ? colors.textMuted : vStyle.text,
                fontSize: sStyle.fontSize,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
