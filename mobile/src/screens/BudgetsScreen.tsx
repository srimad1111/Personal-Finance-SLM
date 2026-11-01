import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { useTheme } from '../theme';
import {
  INITIAL_OVERALL_BUDGET,
  INITIAL_CATEGORY_BUDGETS,
  CATEGORIES,
} from '../data/mockData';
import { CategoryBudget, OverallBudget, TransactionCategory } from '../types';

export const BudgetsScreen: React.FC = () => {
  const { colors, borderRadius } = useTheme();

  const [overallBudget, setOverallBudget] = useState<OverallBudget>(INITIAL_OVERALL_BUDGET);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>(INITIAL_CATEGORY_BUDGETS);
  const [editingBudget, setEditingBudget] = useState<CategoryBudget | null>(null);
  const [editLimitInput, setEditLimitInput] = useState('');

  // Computations
  const overallRatio = overallBudget.totalSpent / overallBudget.monthlyLimit;
  const overallRemaining = Math.max(overallBudget.monthlyLimit - overallBudget.totalSpent, 0);

  const handleOpenEdit = (budget: CategoryBudget) => {
    setEditingBudget(budget);
    setEditLimitInput(budget.allocatedAmount.toString());
  };

  const handleSaveBudgetLimit = () => {
    if (!editingBudget) return;
    const newLimit = parseFloat(editLimitInput.replace(/[^0-9.]/g, ''));
    if (isNaN(newLimit) || newLimit <= 0) {
      alert('Please enter a valid budget limit');
      return;
    }

    setCategoryBudgets((prev) =>
      prev.map((b) => (b.category === editingBudget.category ? { ...b, allocatedAmount: newLimit } : b))
    );
    setEditingBudget(null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Budgets"
        subtitle="Spending Guardrails & Limits"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Master Monthly Budget Summary Card */}
        <Card style={[styles.masterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.masterHeader}>
            <View>
              <Text style={[styles.masterCaption, { color: colors.textMuted }]}>
                NOVEMBER OVERALL BUDGET
              </Text>
              <Text style={[styles.masterLimit, { color: colors.textPrimary }]}>
                ${overallBudget.totalSpent.toFixed(2)}{' '}
                <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: '500' }}>
                  / ${overallBudget.monthlyLimit.toFixed(2)}
                </Text>
              </Text>
            </View>
            <StatusBadge
              label={`${overallBudget.daysRemaining} days left`}
              icon="calendar-outline"
              status="info"
            />
          </View>

          {/* Progress Bar */}
          <View style={{ marginVertical: 14 }}>
            <ProgressBar progress={overallRatio} height={10} autoThresholdColor />
          </View>

          <View style={styles.masterFooter}>
            <View>
              <Text style={[styles.footerSub, { color: colors.textMuted }]}>REMAINING SAFE TO SPEND</Text>
              <Text style={[styles.footerHighlight, { color: colors.success }]}>
                ${overallRemaining.toFixed(2)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.footerSub, { color: colors.textMuted }]}>PROJECTED SAVINGS</Text>
              <Text style={[styles.footerHighlight, { color: colors.accentLight }]}>
                ${overallBudget.projectedSavings.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Category-wise Budgets Header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Category Allowances
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
            {categoryBudgets.length} monitored
          </Text>
        </View>

        {/* Category Budget Cards */}
        {categoryBudgets.map((b) => {
          const catMeta = CATEGORIES[b.category] || CATEGORIES.misc;
          const ratio = b.spentAmount / b.allocatedAmount;
          const remaining = b.allocatedAmount - b.spentAmount;
          const isOverBudget = remaining < 0;

          return (
            <Card
              key={b.category}
              style={styles.categoryCard}
              onPress={() => handleOpenEdit(b)}
            >
              <View style={styles.categoryRow}>
                {/* Category Icon */}
                <View
                  style={[
                    styles.catIconCircle,
                    {
                      backgroundColor: `${b.color}20`,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Ionicons name={catMeta.icon as any} size={20} color={b.color} />
                </View>

                {/* Info */}
                <View style={styles.catInfo}>
                  <View style={styles.catNameRow}>
                    <Text style={[styles.catName, { color: colors.textPrimary }]}>
                      {catMeta.name}
                    </Text>
                    <Text style={[styles.catRemainingText, { color: isOverBudget ? colors.danger : colors.textMuted }]}>
                      {isOverBudget
                        ? `Over by $${Math.abs(remaining).toFixed(2)}`
                        : `$${remaining.toFixed(2)} left`}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={{ marginVertical: 8 }}>
                    <ProgressBar progress={ratio} height={6} autoThresholdColor />
                  </View>

                  <View style={styles.catSpendingMeta}>
                    <Text style={[styles.catSpendingAmount, { color: colors.textSecondary }]}>
                      Spent: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>${b.spentAmount.toFixed(2)}</Text>
                    </Text>
                    <Text style={[styles.catSpendingLimit, { color: colors.textMuted }]}>
                      Cap: ${b.allocatedAmount.toFixed(2)} ({(ratio * 100).toFixed(0)}%)
                    </Text>
                  </View>
                </View>

                {/* Edit chevron */}
                <Ionicons name="create-outline" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
              </View>
            </Card>
          );
        })}
      </ScrollView>

      {/* Edit Budget Limit Modal */}
      {editingBudget && (
        <Modal
          visible={!!editingBudget}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingBudget(null)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: borderRadius.xl,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Edit {CATEGORIES[editingBudget.category]?.name} Budget
                </Text>
                <TouchableOpacity onPress={() => setEditingBudget(null)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Current monthly spending: ${editingBudget.spentAmount.toFixed(2)}
              </Text>

              <View style={styles.modalInputWrapper}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>NEW MONTHLY LIMIT ($)</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      borderRadius: borderRadius.md,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  value={editLimitInput}
                  onChangeText={setEditLimitInput}
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <Button title="Save Budget Limit" onPress={handleSaveBudgetLimit} />
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setEditingBudget(null)}
                  style={{ marginTop: 6 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  masterCard: {
    padding: 20,
    marginBottom: 16,
  },
  masterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  masterCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  masterLimit: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  masterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  footerSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerHighlight: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryCard: {
    marginVertical: 4,
    padding: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catIconCircle: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  catInfo: {
    flex: 1,
  },
  catNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  catRemainingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  catSpendingMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catSpendingAmount: {
    fontSize: 12,
  },
  catSpendingLimit: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 22,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalInputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  modalActions: {
    marginTop: 8,
  },
});

