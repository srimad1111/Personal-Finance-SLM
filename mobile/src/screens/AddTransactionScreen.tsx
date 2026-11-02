import React, { useState, useEffect } from 'react';
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
  const { colors, borderRadius } = useTheme();

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
    editingTransaction ? editingTransaction.category : (initialType === 'income' ? 'salary' : 'groceries')
  );
  const [date, setDate] = useState(
    editingTransaction ? editingTransaction.date : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(editingTransaction?.notes || '');

  // Validation Error States
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Validate Date (YYYY-MM-DD) deterministically
  const validateDate = (d: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(d)) return false;
    const [y, m, day] = d.split('-').map(Number);
    if (y < 2000 || y > 2100) return false;
    if (m < 1 || m > 12) return false;
    if (day < 1 || day > 31) return false;
    // Check leap year / month day counts
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
      setAmountError('Enter a valid amount greater than $0.00');
      isValid = false;
    } else if (!/^\d+(\.\d{1,2})?$/.test(cleanAmountStr)) {
      setAmountError('Amount can have at most 2 decimal places');
      isValid = false;
    } else {
      setAmountError(null);
    }

    // 2. Validate Date
    if (!validateDate(date.trim())) {
      setDateError('Enter a valid date in YYYY-MM-DD format');
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Header
          title={isEditing ? 'Edit Transaction' : 'New Transaction'}
          subtitle={isEditing ? 'Update local SQLite record' : 'Saved directly to SQLite'}
          showThemeToggle={false}
          rightAction={
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Segmented Type Switcher */}
          <View
            style={[
              styles.typeSwitcher,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.typeOption,
                type === 'expense' && {
                  backgroundColor: colors.danger,
                  borderRadius: borderRadius.md,
                },
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
                    color: type === 'expense' ? '#FFFFFF' : colors.textMuted,
                    fontWeight: type === 'expense' ? '700' : '500',
                  },
                ]}
              >
                Expense (Outflow)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeOption,
                type === 'income' && {
                  backgroundColor: colors.success,
                  borderRadius: borderRadius.md,
                },
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
                    color: type === 'income' ? '#FFFFFF' : colors.textMuted,
                    fontWeight: type === 'income' ? '700' : '500',
                  },
                ]}
              >
                Income (Inflow)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Display & Input with Validation */}
          <Card style={[styles.amountCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>TRANSACTION AMOUNT ($)</Text>
            <View style={styles.amountInputRow}>
              <Text
                style={[
                  styles.currencySymbol,
                  { color: type === 'income' ? colors.success : colors.danger },
                ]}
              >
                $
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  { color: colors.textPrimary },
                ]}
                placeholder="0.00"
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
              <Text style={[styles.errorText, { color: colors.danger }]}>{amountError}</Text>
            )}
          </Card>

          {/* Merchant & Description */}
          <Card style={{ marginVertical: 6 }}>
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Merchant / Payee</Text>
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
                placeholder="e.g. Whole Foods, Apple, ConEdison..."
                placeholderTextColor={colors.textMuted}
                value={merchant}
                onChangeText={setMerchant}
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Description <Text style={{ color: colors.danger }}>*</Text>
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
                placeholder="e.g. Weekly family groceries"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={(val) => {
                  setDescription(val);
                  if (descriptionError) setDescriptionError(null);
                }}
              />
              {descriptionError && (
                <Text style={[styles.errorText, { color: colors.danger }]}>{descriptionError}</Text>
              )}
            </View>
          </Card>

          {/* Category Selector Grid */}
          <Card style={{ marginVertical: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
              Select Category (Manual)
            </Text>
            <View style={styles.categoriesGrid}>
              {availableCategories.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: isSelected ? `${cat.color}25` : colors.surfaceElevated,
                        borderColor: isSelected ? cat.color : colors.border,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                    onPress={() => setCategory(cat.id as TransactionCategory)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={18}
                      color={isSelected ? cat.color : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color: isSelected ? cat.color : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Date & Notes */}
          <Card style={{ marginVertical: 6 }}>
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Date (YYYY-MM-DD) <Text style={{ color: colors.danger }}>*</Text>
              </Text>
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
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={date}
                onChangeText={(val) => {
                  setDate(val);
                  if (dateError) setDateError(null);
                }}
              />
              {dateError && (
                <Text style={[styles.errorText, { color: colors.danger }]}>{dateError}</Text>
              )}
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Optional Notes</Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                placeholder="Add tags, receipts, or personal reminders..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionsFooter}>
            <Button
              title={isEditing ? 'Update Transaction in SQLite' : 'Save to Local SQLite'}
              icon="checkmark-circle-outline"
              variant={type === 'income' ? 'primary' : 'danger'}
              size="lg"
              onPress={handleSave}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={onClose}
              style={{ marginTop: 8 }}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeSwitcher: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionText: {
    fontSize: 13,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  currencySymbol: {
    fontSize: 34,
    fontWeight: '800',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    minWidth: 120,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 6,
  },
  categoryOptionText: {
    fontSize: 12,
  },
  actionsFooter: {
    marginTop: 16,
    marginBottom: 20,
  },
});
