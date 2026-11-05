import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useTheme } from '../theme';
import { CATEGORIES } from '../data/mockData';
import { Transaction, TransactionCategory, TransactionType } from '../types';

interface AddTransactionScreenProps {
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
  onSave: (transaction: Omit<Transaction, 'id' | 'timestamp'>, editId?: string) => void;
  onClose: () => void;
}

export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  initialType = 'expense',
  editingTransaction,
  onSave,
  onClose,
}) => {
  const { colors, borderRadius, isDark } = useTheme();

  const isEditing = !!editingTransaction;

  const [type, setType] = useState<TransactionType>(
    editingTransaction ? editingTransaction.type : initialType
  );
  const [amount, setAmount] = useState(
    editingTransaction ? editingTransaction.amount.toString() : ''
  );
  const [merchant, setMerchant] = useState(
    editingTransaction?.merchant || ''
  );
  const [description, setDescription] = useState(
    editingTransaction?.description || ''
  );
  const [category, setCategory] = useState<TransactionCategory>(
    editingTransaction
      ? editingTransaction.category
      : initialType === 'income'
      ? 'salary'
      : 'groceries'
  );
  const [date, setDate] = useState(
    editingTransaction ? editingTransaction.date : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(editingTransaction?.notes || '');

  // Validation Error States
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const validateDate = (d: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(d)) return false;
    const [y, m, day] = d.split('-').map(Number);
    if (y < 2000 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (day < 1 || day > 31) return false;
    const testDate = new Date(y, m - 1, day);
    return (
      testDate.getFullYear() === y &&
      testDate.getMonth() === m - 1 &&
      testDate.getDate() === day
    );
  };

  const handleSave = () => {
    let isValid = true;

    // 1. Validate Amount
    const cleanAmountStr = amount.replace(/[^0-9.]/g, '');
    const parsedAmount = parseFloat(cleanAmountStr);
    if (!cleanAmountStr || isNaN(parsedAmount) || parsedAmount <= 0) {
      setAmountError('Enter a valid amount greater than ₹0.00');
      isValid = false;
    } else if (!/^\d+(\.\d{1,2})?$/.test(cleanAmountStr)) {
      setAmountError('Amount can have at most 2 decimal places');
      isValid = false;
    } else {
      setAmountError(null);
    }

    // 2. Validate Date
    if (!validateDate(date.trim())) {
      setDateError('Enter date in YYYY-MM-DD format');
      isValid = false;
    } else {
      setDateError(null);
    }

    // 3. Validate Merchant or Description
    const finalDesc = description.trim() || merchant.trim();
    if (!finalDesc || finalDesc.length < 2) {
      setDescriptionError('Provide a description or merchant name (min 2 chars)');
      isValid = false;
    } else {
      setDescriptionError(null);
    }

    if (!isValid) return;

    onSave(
      {
        type,
        category,
        amount: parsedAmount,
        description: description.trim() || merchant.trim(),
        merchant: merchant.trim() || undefined,
        date: date.trim(),
        notes: notes.trim() || undefined,
        isAiCategorized: false,
      },
      editingTransaction?.id
    );
  };

  const availableCategories = Object.values(CATEGORIES).filter((c) =>
    type === 'income' ? c.type === 'income' : c.type === 'expense'
  );

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    setDate(d.toISOString().split('T')[0]);
    if (dateError) setDateError(null);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Header
          title={isEditing ? 'Edit Transaction' : 'Record Transaction'}
          subtitle={isEditing ? 'Update SQLite record' : 'Stored in local encrypted SQLite'}
          showThemeToggle={false}
          rightAction={
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Segmented Type Toggle (Expense / Income) */}
          <View
            style={[
              styles.typeSwitcher,
              {
                backgroundColor: colors.surfaceElevated,
                borderRadius: borderRadius.md,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.typeOption,
                type === 'expense' && [
                  styles.typeOptionActive,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ],
              ]}
              onPress={() => {
                setType('expense');
                if (CATEGORIES[category]?.type !== 'expense') {
                  setCategory('groceries');
                }
              }}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  {
                    color: type === 'expense' ? colors.danger : colors.textMuted,
                    fontWeight: type === 'expense' ? '600' : '500',
                  },
                ]}
              >
                Expense (Outflow)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                type === 'income' && [
                  styles.typeOptionActive,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ],
              ]}
              onPress={() => {
                setType('income');
                if (CATEGORIES[category]?.type !== 'income') {
                  setCategory('salary');
                }
              }}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  {
                    color: type === 'income' ? colors.success : colors.textMuted,
                    fontWeight: type === 'income' ? '600' : '500',
                  },
                ]}
              >
                Income (Inflow)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hero Amount Field (Fintech Standard) */}
          <Card style={styles.amountCard}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>
              TRANSACTION AMOUNT (INR)
            </Text>
            <View style={styles.amountInputRow}>
              <Text
                style={[
                  styles.currencySymbol,
                  { color: type === 'income' ? colors.success : colors.textPrimary },
                ]}
              >
                ₹
              </Text>
              <TextInput
                style={[styles.amountInput, { color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  if (amountError) setAmountError(null);
                }}
                autoFocus={!isEditing}
              />
            </View>
            {amountError && (
              <Text style={[styles.inlineError, { color: colors.danger }]}>{amountError}</Text>
            )}
          </Card>

          {/* Form Fields Card */}
          <Card style={styles.formCard}>
            {/* Merchant / Entity */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MERCHANT / ENTITY</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                placeholder="e.g. Swiggy, Blinkit, TCS, BESCOM"
                placeholderTextColor={colors.textMuted}
                value={merchant}
                onChangeText={setMerchant}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                DESCRIPTION / NOTE
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: descriptionError ? colors.danger : colors.border,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                placeholder="e.g. Team dinner, Grocery restock"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={(val) => {
                  setDescription(val);
                  if (descriptionError) setDescriptionError(null);
                }}
              />
              {descriptionError && (
                <Text style={[styles.inlineError, { color: colors.danger }]}>
                  {descriptionError}
                </Text>
              )}
            </View>

            {/* Category Grid */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>CATEGORY</Text>
              <View style={styles.categoryGrid}>
                {availableCategories.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryTile,
                        {
                          backgroundColor: isSelected ? `${cat.color}1C` : colors.surfaceElevated,
                          borderColor: isSelected ? cat.color : colors.border,
                          borderRadius: borderRadius.sm,
                        },
                      ]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={15}
                        color={isSelected ? cat.color : colors.textMuted}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.categoryTileText,
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
              </View>
            </View>

            {/* Date with Quick Set Buttons */}
            <View style={styles.inputGroup}>
              <View style={styles.dateLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  DATE (YYYY-MM-DD)
                </Text>
                <View style={styles.quickDateRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickDateBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                    onPress={() => setQuickDate(0)}
                  >
                    <Text style={[styles.quickDateText, { color: colors.textSecondary }]}>
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickDateBtn,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                    ]}
                    onPress={() => setQuickDate(1)}
                  >
                    <Text style={[styles.quickDateText, { color: colors.textSecondary }]}>
                      Yesterday
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: dateError ? colors.danger : colors.border,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                placeholder="2026-11-03"
                placeholderTextColor={colors.textMuted}
                value={date}
                onChangeText={(val) => {
                  setDate(val);
                  if (dateError) setDateError(null);
                }}
              />
              {dateError && (
                <Text style={[styles.inlineError, { color: colors.danger }]}>{dateError}</Text>
              )}
            </View>

            {/* Additional Notes */}
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                ADDITIONAL NOTES (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                placeholder="Payment reference, UPI transaction ID, invoice details..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionSection}>
            <Button
              title={isEditing ? 'Save Changes' : 'Record Transaction'}
              variant="primary"
              size="lg"
              icon="checkmark-outline"
              onPress={handleSave}
              style={{ marginBottom: 10 }}
            />
            <Button
              title="Cancel"
              variant="ghost"
              size="md"
              onPress={onClose}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  typeSwitcher: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: 12,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionActive: {
    borderWidth: 1,
  },
  typeOptionText: {
    fontSize: 13,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 30,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    minWidth: 120,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  inlineError: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  formCard: {
    padding: 16,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textArea: {
    height: 64,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  categoryTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  categoryTileText: {
    fontSize: 12,
  },
  dateLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 4,
  },
  quickDateText: {
    fontSize: 10,
    fontWeight: '500',
  },
  actionSection: {
    paddingVertical: 10,
  },
});
