import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MainTabType } from '../types';
import { useTheme } from '../theme';

interface BottomTabBarProps {
  activeTab: MainTabType;
  onTabPress: (tab: MainTabType) => void;
  onAddPress: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabPress,
  onAddPress,
}) => {
  const { colors, borderRadius, shadows, isDark } = useTheme();

  const leftTabs: {
    type: MainTabType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      type: 'dashboard',
      label: 'Portfolio',
      icon: 'wallet-outline',
      activeIcon: 'wallet',
    },
    {
      type: 'transactions',
      label: 'Activity',
      icon: 'receipt-outline',
      activeIcon: 'receipt',
    },
  ];

  const rightTabs: {
    type: MainTabType;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      type: 'budgets',
      label: 'Budgets',
      icon: 'pie-chart-outline',
      activeIcon: 'pie-chart',
    },
    {
      type: 'analytics',
      label: 'Analytics',
      icon: 'stats-chart-outline',
      activeIcon: 'stats-chart',
    },
    {
      type: 'assistant',
      label: 'Copilot',
      icon: 'sparkles-outline',
      activeIcon: 'sparkles',
    },
  ];

  return (
    <View style={styles.floatingContainer} pointerEvents="box-none">
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: colors.border,
            borderRadius: borderRadius.xl,
            shadowColor: colors.shadowColor,
          },
          shadows.elevated,
        ]}
      >
        {/* Left Tabs (Portfolio & Activity) */}
        {leftTabs.map((tab) => {
          const isActive = activeTab === tab.type;
          return (
            <TouchableOpacity
              key={tab.type}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onTabPress(tab.type)}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={18}
                color={isActive ? colors.textPrimary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.textPrimary : colors.textMuted,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />}
            </TouchableOpacity>
          );
        })}

        {/* Central Add Quick Action Button */}
        <TouchableOpacity
          style={[
            styles.centerAddButton,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
              borderRadius: borderRadius.full,
            },
            shadows.card,
          ]}
          activeOpacity={0.8}
          onPress={onAddPress}
          accessibilityLabel="Add New Transaction"
        >
          <Ionicons
            name="add"
            size={22}
            color={isDark ? '#090D16' : '#FFFFFF'}
          />
        </TouchableOpacity>

        {/* Right Tabs (Budgets, Analytics, Copilot) */}
        {rightTabs.map((tab) => {
          const isActive = activeTab === tab.type;
          const isAiTab = tab.type === 'assistant';
          const activeColor = isAiTab ? colors.aiAccent : colors.textPrimary;

          return (
            <TouchableOpacity
              key={tab.type}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onTabPress(tab.type)}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={18}
                color={isActive ? activeColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? activeColor : colors.textMuted,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {tab.label}
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: isAiTab ? colors.aiAccent : colors.accent },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 12,
    left: 14,
    right: 14,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 2,
  },
  centerAddButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
});
