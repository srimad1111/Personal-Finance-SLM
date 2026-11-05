import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
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
import {
  getBudgetProgress,
  getUnbudgetedCategories,
  upsertBudget,
  budgetRepository,
} from '../database';
import { BudgetProgressSummary, CategoryEntity } from '../types/database';
import { formatINR } from '../utils/currency';

interface BudgetsScreenProps {
  onDatabaseChanged?: () => void;
}

export const BudgetsScreen: React.FC<BudgetsScreenProps> = ({ onDatabaseChanged }) => {
  const { colors, borderRadius, isDark } = useTheme();

  const [budgets, setBudgets] = useState<BudgetProgressSummary[]>([]);
  const [unbudgetedCats, setUnbudgetedCats] = useState<CategoryEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit Budget Modal state
  const [editingBudget, setEditingBudget] = useState<BudgetProgressSummary | null>(null);
  const [editLimitInput, setEditLimitInput] = useState('');

  // Create Budget Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedCreateCatId, setSelectedCreateCatId] = useState<string>('');
  const [createLimitInput, setCreateLimitInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

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
      const unbudgeted = await getUnbudgetedCategories(currentMonth, currentYear);
      setUnbudgetedCats(unbudgeted);
      if (unbudgeted.length > 0 && !selectedCreateCatId) {
        setSelectedCreateCatId(unbudgeted[0].id);
      }
    } catch (err) {
      console.error('[LOAD_BUDGETS_ERROR]', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, currentYear, selectedCreateCatId]);

  useEffect(() => {
    loadBudgetsFromDb();
  }, [loadBudgetsFromDb]);

  const totalLimit = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  const overallRemaining = Math.max(totalLimit - totalSpent, 0);
  const overallRatio = totalLimit > 0 ? totalSpent / totalLimit : 0;
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const daysRemaining = Math.max(daysInMonth - now.getDate(), 0);

  const overspentBudgets = budgets.filter((b) => b.isOverBudget);
  const warningBudgets = budgets.filter((b) => !b.isOverBudget && b.percentage >= 80);

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

  const handleDeleteBudget = async (id: string) => {
    try {
      await budgetRepository.delete(id);
      await loadBudgetsFromDb();
      if (onDatabaseChanged) {
        onDatabaseChanged();
      }
      setEditingBudget(null);
    } catch (err) {
      console.error('[DELETE_BUDGET_ERROR]', err);
    }
  };

  const handleCreateBudget = async () => {
    if (!selectedCreateCatId) {
      setCreateError('Please select a category');
      return;
    }
    const cleanLimit = parseFloat(createLimitInput.replace(/[^0-9.]/g, ''));
    if (isNaN(cleanLimit) || cleanLimit <= 0) {
      setCreateError('Please enter a valid monthly limit in ₹');
      return;
    }

    try {
      await upsertBudget(selectedCreateCatId, cleanLimit, currentMonth, currentYear);
      setCreateLimitInput('');
      setCreateError(null);
      setShowCreateModal(false);
      await loadBudgetsFromDb();
      if (onDatabaseChanged) {
        onDatabaseChanged();
      }
    } catch (err) {
      console.error('[CREATE_BUDGET_ERROR]', err);
      setCreateError('Failed to create budget in local SQLite.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Budgets"
        subtitle={`${currentMonthName} ${currentYear} · Deterministic Guardrails`}
        rightAction={
          unbudgetedCats.length > 0 ? (
            <TouchableOpacity
              style={[
                styles.addBudgetBtn,
                {
                  backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => {
                setCreateError(null);
                setShowCreateModal(true);
              }}
              accessibilityLabel="Create Category Budget"
            >
              <Ionicons
                name="add"
                size={16}
                color={isDark ? '#090D16' : '#FFFFFF'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.addBudgetBtnText,
                  { color: isDark ? '#090D16' : '#FFFFFF' },
                ]}
              >
                Set Limit
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Overspending Alert Banner */}
        {overspentBudgets.length > 0 && (
          <View
            style={[
              styles.alertBanner,
              {
                backgroundColor: colors.dangerLight,
                borderColor: `${colors.danger}30`,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color={colors.danger} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: colors.danger }]}>
                Over Budget ({overspentBudgets.length} {overspentBudgets.length === 1 ? 'category' : 'categories'})
              </Text>
              <Text style={[styles.alertSub, { color: colors.textSecondary }]}>
                {overspentBudgets.map((b) => `${b.categoryName} by ${formatINR(Math.abs(b.remainingAmount))}`).join(', ')}
              </Text>
            </View>
          </View>
        )}

        {/* 80%-100% Caution Banner */}
        {warningBudgets.length > 0 && overspentBudgets.length === 0 && (
          <View
            style={[
              styles.alertBanner,
              {
                backgroundColor: colors.warningLight,
                borderColor: `${colors.warning}30`,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <Ionicons name="information-circle" size={18} color={colors.warning} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: colors.warning }]}>
                Near Budget Threshold (&gt; 80%)
              </Text>
              <Text style={[styles.alertSub, { color: colors.textSecondary }]}>
                {warningBudgets.map((b) => `${b.categoryName} (${b.percentage.toFixed(0)}%)`).join(', ')}
              </Text>
            </View>
          </View>
        )}

        {/* Master Monthly Budget Overview Card */}
        <Card style={styles.masterCard}>
          <View style={styles.masterHeader}>
            <View>
              <Text style={[styles.masterCaption, { color: colors.textMuted }]}>
                MONTHLY UTILIZATION
              </Text>
              <Text style={[styles.masterLimit, { color: colors.textPrimary }]}>
                {formatINR(totalSpent)}{' '}
                <Text style={{ fontSize: 16, color: colors.textMuted, fontWeight: '400' }}>
                  / {formatINR(totalLimit)}
                </Text>
              </Text>
            </View>
            <StatusBadge
              label={`${daysRemaining}d remaining`}
              icon="time-outline"
              status="neutral"
            />
          </View>

          {/* Progress Bar */}
          <View style={{ marginVertical: 12 }}>
            <ProgressBar
              progress={overallRatio}
              height={6}
              color={overallRatio > 1 ? colors.danger : overallRatio > 0.8 ? colors.warning : colors.accent}
            />
          </View>

          <View style={[styles.masterFooter, { borderTopColor: colors.borderSubtle }]}>
            <View>
              <Text style={[styles.footerSub, { color: colors.textMuted }]}>SAFE TO SPEND</Text>
              <Text style={[styles.footerHighlight, { color: colors.success }]}>
                {formatINR(overallRemaining)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.footerSub, { color: colors.textMuted }]}>UTILIZED</Text>
              <Text style={[styles.footerHighlight, { color: colors.textPrimary }]}>
                {(overallRatio * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </Card>

        {/* Category Allowances Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Category Allowances
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
            {budgets.length} active
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 30 }} />
        ) : budgets.length === 0 ? (
          <Card style={styles.emptyBudgetsCard}>
            <Ionicons name="pie-chart-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyBudgetsTitle, { color: colors.textPrimary }]}>
              No Budgets Set
            </Text>
            <Text style={[styles.emptyBudgetsSub, { color: colors.textMuted }]}>
              All category budgets start at ₹0.00. Tap "Set Limit" above to configure monthly spending limits.
            </Text>
          </Card>
        ) : (
          budgets.map((b) => {
            const catMeta = (CATEGORIES as Record<string, any>)[b.categoryId] || {
              id: b.categoryId,
              name: b.categoryName,
              icon: b.icon || 'receipt-outline',
              color: b.color || colors.accent,
            };

            const ratio = b.monthlyLimit > 0 ? b.spentAmount / b.monthlyLimit : 0;
            const barColor = b.isOverBudget
              ? colors.danger
              : b.percentage >= 80
              ? colors.warning
              : colors.success;

            return (
              <Card key={b.id} style={styles.budgetCard}>
                <View style={styles.budgetTopRow}>
                  {/* Category Badge & Name */}
                  <View style={styles.catTitleGroup}>
                    <View
                      style={[
                        styles.catIconBox,
                        {
                          backgroundColor: `${catMeta.color}14`,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                    >
                      <Ionicons name={catMeta.icon as any} size={16} color={catMeta.color} />
                    </View>
                    <View>
                      <Text style={[styles.catName, { color: colors.textPrimary }]}>
                        {b.categoryName}
                      </Text>
                      <Text style={[styles.catSub, { color: colors.textMuted }]}>
                        {formatINR(b.spentAmount)} of {formatINR(b.monthlyLimit)}
                      </Text>
                    </View>
                  </View>

                  {/* Percentage & Edit Button */}
                  <View style={styles.budgetActionGroup}>
                    <Text
                      style={[
                        styles.percentageText,
                        { color: b.isOverBudget ? colors.danger : colors.textPrimary },
                      ]}
                    >
                      {b.percentage.toFixed(0)}%
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(b)}
                      style={[
                        styles.editIconBtn,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="pencil" size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={{ marginVertical: 10 }}>
                  <ProgressBar progress={ratio} height={5} color={barColor} />
                </View>

                {/* Bottom Status Row */}
                <View style={styles.budgetBottomRow}>
                  <Text style={[styles.bottomStatusLabel, { color: colors.textMuted }]}>
                    {b.isOverBudget
                      ? `Exceeded by ${formatINR(Math.abs(b.remainingAmount))}`
                      : `${formatINR(b.remainingAmount)} remaining`}
                  </Text>
                  <StatusBadge
                    label={b.isOverBudget ? 'Over Limit' : b.percentage >= 80 ? 'Near Limit' : 'On Track'}
                    status={b.isOverBudget ? 'danger' : b.percentage >= 80 ? 'warning' : 'success'}
                    size="sm"
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Edit Budget Modal */}
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
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Edit {editingBudget.categoryName} Limit
                </Text>
                <TouchableOpacity onPress={() => setEditingBudget(null)}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                NEW MONTHLY LIMIT (₹)
              </Text>
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

              <View style={styles.modalActionRow}>
                <Button
                  title="Remove"
                  variant="danger"
                  size="md"
                  icon="trash-outline"
                  onPress={() => handleDeleteBudget(editingBudget.id)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Save Limit"
                  variant="primary"
                  size="md"
                  icon="checkmark-outline"
                  onPress={handleSaveBudgetLimit}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Create Budget Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Set Category Budget
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>SELECT CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {unbudgetedCats.map((cat) => {
                const isSelected = selectedCreateCatId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catSelectChip,
                      {
                        backgroundColor: isSelected ? `${cat.color}1C` : colors.surfaceElevated,
                        borderColor: isSelected ? cat.color : colors.border,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                    onPress={() => setSelectedCreateCatId(cat.id)}
                  >
                    <Text
                      style={[
                        styles.catSelectText,
                        {
                          color: isSelected ? colors.textPrimary : colors.textSecondary,
                          fontWeight: isSelected ? '600' : '400',
                        },
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>MONTHLY LIMIT (₹)</Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: createError ? colors.danger : colors.border,
                  color: colors.textPrimary,
                  borderRadius: borderRadius.md,
                },
              ]}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={createLimitInput}
              onChangeText={(val) => {
                setCreateLimitInput(val);
                if (createError) setCreateError(null);
              }}
            />
            {createError && (
              <Text style={[styles.inlineError, { color: colors.danger }]}>{createError}</Text>
            )}

            <View style={[styles.modalActionRow, { marginTop: 14 }]}>
              <Button
                title="Cancel"
                variant="ghost"
                size="md"
                onPress={() => setShowCreateModal(false)}
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Set Budget"
                variant="primary"
                size="md"
                icon="checkmark-outline"
                onPress={handleCreateBudget}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  addBudgetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  addBudgetBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  alertSub: {
    fontSize: 11,
  },
  masterCard: {
    padding: 16,
    marginBottom: 14,
  },
  masterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  masterCaption: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  masterLimit: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  masterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerSub: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  footerHighlight: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 12,
  },
  budgetCard: {
    padding: 14,
    marginBottom: 8,
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  catIconBox: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  catName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  catSub: {
    fontSize: 11,
    marginTop: 1,
  },
  budgetActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentageText: {
    fontSize: 13,
    fontWeight: '600',
  },
  editIconBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  budgetBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomStatusLabel: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: 18,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  modalInput: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  modalActionRow: {
    flexDirection: 'row',
  },
  catSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    marginRight: 6,
  },
  catSelectText: {
    fontSize: 12,
  },
  inlineError: {
    fontSize: 11,
    marginBottom: 8,
  },
  emptyBudgetsCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyBudgetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyBudgetsSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
