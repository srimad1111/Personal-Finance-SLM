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
  const { colors, borderRadius, shadows } = useTheme();

  const tabs: { type: MainTabType; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
    {
      type: 'dashboard',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      type: 'transactions',
      label: 'History',
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
      label: 'Insights',
      icon: 'stats-chart-outline',
      activeIcon: 'stats-chart',
    },
    {
      type: 'assistant',
      label: 'SLM AI',
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
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            borderRadius: borderRadius.xl,
            shadowColor: colors.shadowColor,
          },
          shadows.glow,
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
                size={20}
                color={isActive ? colors.accent : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.accent : colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Central Add Action Button */}
        <TouchableOpacity
          style={[
            styles.centerAddButton,
            {
              backgroundColor: colors.accent,
              borderRadius: borderRadius.full,
              shadowColor: colors.accent,
            },
            shadows.card,
          ]}
          activeOpacity={0.85}
          onPress={onAddPress}
          accessibilityLabel="Add New Transaction"
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Next 3 tabs */}
        {tabs.slice(2).map((tab) => {
          const isActive = activeTab === tab.type;
          const isAiTab = tab.type === 'assistant';
          const activeColor = isAiTab ? colors.aiAccentGlow : colors.accent;

          return (
            <TouchableOpacity
              key={tab.type}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => onTabPress(tab.type)}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={isActive ? activeColor : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? activeColor : colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
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
    bottom: Platform.OS === 'ios' ? 24 : 16,
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
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
  },
  centerAddButton: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
});

