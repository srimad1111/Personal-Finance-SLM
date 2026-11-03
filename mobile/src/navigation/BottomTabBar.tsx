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

  const tabs: {
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
            backgroundColor: isDark ? 'rgba(15, 21, 35, 0.94)' : 'rgba(255, 255, 255, 0.94)',
            borderColor: colors.border,
            borderRadius: borderRadius.xl,
            shadowColor: colors.shadowColor,
          },
          shadows.card,
        ]}
      >
        {/* First 2 tabs */}
        {tabs.slice(0, 2).map((tab) => {
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
                size={19}
                color={isActive ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? (isDark ? '#FFFFFF' : colors.textPrimary) : colors.textMuted,
                    fontWeight: isActive ? '600' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
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
            shadows.subtle,
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

        {/* Next 3 tabs */}
        {tabs.slice(2).map((tab) => {
          const isActive = activeTab === tab.type;
          const isAiTab = tab.type === 'assistant';
          const activeColor = isAiTab
            ? colors.aiAccent
            : isDark
            ? '#FFFFFF'
            : colors.textPrimary;

          return (
            <TouchableOpacity
              key={tab.type}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onTabPress(tab.type)}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={19}
                color={isActive ? activeColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? activeColor : colors.textMuted,
                    fontWeight: isActive ? '600' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
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
    bottom: Platform.OS === 'ios' ? 24 : 14,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: -0.1,
  },
  centerAddButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
});
