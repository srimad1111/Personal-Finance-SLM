import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { useTheme } from '../theme';
import { CATEGORIES } from '../data/mockData';
import { getBudgetProgress, upsertBudget } from '../database';
import { BudgetProgressSummary } from '../types/database';

interface BudgetsScreenProps {
  onDatabaseChanged?: () => void;
}

export const BudgetsScreen: React.FC<BudgetsScreenProps> = ({ onDatabaseChanged }) => {
  const { colors, borderRadius } = useTheme();

  const [budgets, setBudgets] = useState<BudgetProgressSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingBudget, setEditingBudget] = useState<BudgetProgressSummary | null>(null);
  const [editLimitInput, setEditLimitInput] = useState('');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentMonthName = monthNames[now.getMonth()];

  const loadBudgetsFromDb = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getBudgetProgress(currentMonth, currentYear);
      setBudgets(data);
    } catch (err) {
      console.error('[LOAD_BUDGETS_ERROR]', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    loadBudgetsFromDb();
  }, [loadBudgetsFromDb]);

  // Total budget and spending metrics
  const totalLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  const overallRemaining = Math.max(totalLimit - totalSpent, 0);
  const overallRatio = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 0);

  const handleOpenEdit = (budget: BudgetProgressSummary) => {
    setEditingBudget(budget);
    setEditLimitInput(budget.monthlyLimit.toString());
  };

  const handleSaveBudgetLimit = async () => {
    if (!editingBudget) return;
    const newLimit = parseFloat(editLimitInput.replace(/[^0-9.]/g, ''));
    if (isNaN(newLimit) || newLimit <= 0) {
      alert('Please enter a valid budget limit');
      return;
    }

    try {
      await upsertBudget(editingBudget.categoryId, newLimit, currentMonth, currentYear);
      await loadBudgetsFromDb();
      if (onDatabaseChanged) {
        onDatabaseChanged();
      }
      setEditingBudget(null);
    } catch (err) {
      console.error('[SAVE_BUDGET_ERROR]', err);
      alert('Failed to update budget in local SQLite.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Budgets"
        subtitle="Spending Guardrails (SQLite)"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Master Monthly Budget Summary Card */}
        <Card style={[styles.masterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.masterHeader}>
            <View>
              <Text style={[styles.masterCaption, { color: colors.textMuted }]}>
                {currentMonthName.toUpperCase()} {currentYear} OVERALL BUDGET
              </Text>
              <Text style={[styles.masterLimit, { color: colors.textPrimary }]}>
                ${totalSpent.toFixed(2)}{' '}
                <Text style={{ fontSize: 18, color: colors.textMuted, fontWeight: '500' }}>
                  / ${totalLimit.toFixed(2)}
                </Text>
              </Text>
            </View>
            <StatusBadge
              label={`${daysRemaining} days left`}
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
              <Text style={[styles.footerSub, { color: colors.textMuted }]}>STATUS</Text>
              <Text
                style={[
                  styles.footerHighlight,
                  { color: overallRemaining > 0 ? colors.accentLight : colors.danger },
                ]}
              >
                {overallRemaining > 0 ? 'On Track' : 'Exceeded'}
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
            {budgets.length} in SQLite
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          budgets.map((b) => {
            const catMeta = (CATEGORIES as Record<string, any>)[b.categoryId] || {
              id: b.categoryId,
              name: b.categoryName,
              icon: b.icon || 'folder-outline',
              color: b.color || '#3B82F6',
              type: 'expense' as const,
            };
            const ratio = b.monthlyLimit > 0 ? b.spentAmount / b.monthlyLimit : 0;
            const isOverBudget = b.isOverBudget;

            return (
              <Card
                key={b.id}
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
                        {b.categoryName}
                      </Text>
                      <Text style={[styles.catRemainingText, { color: isOverBudget ? colors.danger : colors.textMuted }]}>
                        {isOverBudget
                          ? `Over by $${Math.abs(b.remainingAmount).toFixed(2)}`
                          : `$${b.remainingAmount.toFixed(2)} left`}
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
                        Cap: ${b.monthlyLimit.toFixed(2)} ({b.percentage.toFixed(0)}%)
                      </Text>
                    </View>
                  </View>

                  {/* Edit chevron */}
                  <Ionicons name="create-outline" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
                </View>
              </Card>
            );
          })
        )}
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
                  Edit {editingBudget.categoryName} Budget
                </Text>
                <TouchableOpacity onPress={() => setEditingBudget(null)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Current spending in SQLite: ${editingBudget.spentAmount.toFixed(2)}
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
                <Button title="Save to SQLite" onPress={handleSaveBudgetLimit} />
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
