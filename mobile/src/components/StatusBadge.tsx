import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
  label: string;
  status: 'active' | 'pending' | 'offline';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, status }) => {
  const getColors = () => {
    switch (status) {
      case 'active':
        return { bg: '#e8f5e9', text: '#2e7d32', dot: '#4caf50' };
      case 'pending':
        return { bg: '#fff8e1', text: '#f57f17', dot: '#ffb300' };
      case 'offline':
        return { bg: '#ede7f6', text: '#512da8', dot: '#7e57c2' };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

