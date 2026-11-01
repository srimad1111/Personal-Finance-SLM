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
import { StatusBadge } from '../components/StatusBadge';
import { useTheme } from '../theme';
import { CATEGORIES } from '../data/mockData';
import { Transaction, TransactionCategory, TransactionType } from '../types';

interface AddTransactionScreenProps {
  initialType?: TransactionType;
  onSave: (transaction: Omit<Transaction, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  initialType = 'expense',
  onSave,
  onClose,
}) => {
  const { colors, borderRadius } = useTheme();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('groceries');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [aiSuggestedCat, setAiSuggestedCat] = useState<TransactionCategory | null>(null);

  // Simulated SLM zero-latency auto-categorization when typing merchant/description
  useEffect(() => {
    const text = `${merchant} ${description}`.toLowerCase();
    if (!text.trim()) {
      setAiSuggestedCat(null);
      return;
    }

    if (text.includes('whole foods') || text.includes('trader') || text.includes('grocery') || text.includes('market') || text.includes('walmart')) {
      setAiSuggestedCat('groceries');
    } else if (text.includes('coffee') || text.includes('starbucks') || text.includes('restaurant') || text.includes('bistro') || text.includes('mcdonald')) {
      setAiSuggestedCat('food_and_dining');
    } else if (text.includes('uber') || text.includes('lyft') || text.includes('transit') || text.includes('gas') || text.includes('chevron')) {
      setAiSuggestedCat('transportation');
    } else if (text.includes('apple') || text.includes('amazon') || text.includes('nike') || text.includes('target') || text.includes('zara')) {
      setAiSuggestedCat('shopping');
    } else if (text.includes('rent') || text.includes('lease') || text.includes('mortgage') || text.includes('apartment')) {
      setAiSuggestedCat('housing');
    } else if (text.includes('netflix') || text.includes('spotify') || text.includes('cinema') || text.includes('steam')) {
      setAiSuggestedCat('entertainment');
    } else if (text.includes('electric') || text.includes('water') || text.includes('utility') || text.includes('power')) {
      setAiSuggestedCat('utilities');
    } else if (text.includes('salary') || text.includes('payroll') || text.includes('direct deposit')) {
      setAiSuggestedCat('salary');
      setType('income');
    } else {
      setAiSuggestedCat(null);
    }
  }, [merchant, description]);

  const handleApplyAiCategory = () => {
    if (aiSuggestedCat) {
      setCategory(aiSuggestedCat);
    }
  };

  const handleSave = () => {
    const parsedAmount = parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    onSave({
      type,
      category,
      amount: parsedAmount,
      description: description.trim() || merchant.trim() || 'Untitled Transaction',
      merchant: merchant.trim() || undefined,
      date,
      notes: notes.trim() || undefined,
      isAiCategorized: !!aiSuggestedCat && category === aiSuggestedCat,
      aiConfidence: aiSuggestedCat && category === aiSuggestedCat ? 0.96 : undefined,
    });
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
          title="New Transaction"
          subtitle="Saved to Local SQLite"
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
                setCategory('groceries');
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
                setCategory('salary');
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

          {/* Amount Display & Input */}
          <Card style={[styles.amountCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.amountLabel, { color: colors.textMuted }]}>TRANSACTION AMOUNT</Text>
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
                onChangeText={setAmount}
                autoFocus
              />
            </View>
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
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
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
                placeholder="e.g. Weekly family groceries"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* AI Auto-Categorization Prompt Callout */}
            {aiSuggestedCat && aiSuggestedCat !== category && (
              <TouchableOpacity
                onPress={handleApplyAiCategory}
                style={[
                  styles.aiSuggestionBox,
                  {
                    backgroundColor: colors.aiAccentLight,
                    borderColor: colors.aiAccent,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={15} color={colors.aiAccentGlow} style={{ marginRight: 6 }} />
                  <Text style={[styles.aiSuggestionText, { color: colors.aiAccentGlow }]}>
                    SLM detected category: <Text style={{ fontWeight: '800' }}>{CATEGORIES[aiSuggestedCat]?.name}</Text>
                  </Text>
                </View>
                <Text style={[styles.applyPill, { color: colors.accentLight }]}>Apply</Text>
              </TouchableOpacity>
            )}
          </Card>

          {/* Category Selector Grid */}
          <Card style={{ marginVertical: 6 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
              Select Category
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
                    onPress={() => setCategory(cat.id)}
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
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date (YYYY-MM-DD)</Text>
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
                value={date}
                onChangeText={setDate}
              />
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
              title="Save to Local SQLite"
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
  aiSuggestionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  aiSuggestionText: {
    fontSize: 12,
  },
  applyPill: {
    fontSize: 12,
    fontWeight: '700',
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

