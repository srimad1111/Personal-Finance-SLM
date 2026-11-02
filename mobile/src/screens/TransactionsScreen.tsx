import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { useTheme } from '../theme';
import { CATEGORIES } from '../data/mockData';
import { Transaction } from '../types';
import { formatTransactionAmount } from '../utils/currency';

type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

interface TransactionsScreenProps {
  transactions: Transaction[];
  onOpenAddModal: () => void;
  onEditTransaction?: (tx: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  transactions,
  onOpenAddModal,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const { colors, borderRadius } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [inspectTx, setInspectTx] = useState<Transaction | null>(null);

  // Deterministic Filtering and Sorting
  const processedTransactions = useMemo(() => {
    // 1. Filter
    const filtered = transactions.filter((tx) => {
      if (selectedFilter !== 'all' && tx.type !== selectedFilter) return false;
      if (selectedCategory && tx.category !== selectedCategory) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const merchantMatch = tx.merchant?.toLowerCase().includes(q);
        const descMatch = tx.description.toLowerCase().includes(q);
        const categoryMatch = CATEGORIES[tx.category]?.name.toLowerCase().includes(q);
        return merchantMatch || descMatch || categoryMatch;
      }

      return true;
    });

    // 2. Deterministic Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return b.date.localeCompare(a.date) || b.timestamp - a.timestamp;
        case 'date_asc':
          return a.date.localeCompare(b.date) || a.timestamp - b.timestamp;
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        default:
          return b.timestamp - a.timestamp;
      }
    });
  }, [transactions, selectedFilter, selectedCategory, searchQuery, sortBy]);

  // Real deterministic sums for the filtered view
  const currentTotalIncome = processedTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentTotalExpense = processedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleDelete = (tx: Transaction) => {
    if (!onDeleteTransaction) return;
    onDeleteTransaction(tx.id);
    setInspectTx(null);
  };

  const handleEdit = (tx: Transaction) => {
    setInspectTx(null);
    if (onEditTransaction) {
      onEditTransaction(tx);
    }
  };

  const getSortLabel = (s: SortOption): string => {
    switch (s) {
      case 'date_desc':
        return 'Date: Newest';
      case 'date_asc':
        return 'Date: Oldest';
      case 'amount_desc':
        return 'Amount: High to Low';
      case 'amount_asc':
        return 'Amount: Low to High';
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <Header
        title="Transactions"
        subtitle={`${processedTransactions.length} recorded in SQLite`}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setShowSortModal(true)}
              accessibilityLabel="Sort Transactions"
            >
              <Ionicons name="swap-vertical-outline" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.accent,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={onOpenAddModal}
              accessibilityLabel="Add Transaction"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search merchant, item, category..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs & Active Sort Chip */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {/* Active Sort Pill */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.accent,
                borderRadius: borderRadius.full,
              },
            ]}
            onPress={() => setShowSortModal(true)}
          >
            <Ionicons name="filter-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.filterChipText, { color: colors.accent, fontWeight: '700' }]}>
              {getSortLabel(sortBy)}
            </Text>
          </TouchableOpacity>

          <View style={[styles.filterDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* Type filters */}
          {(['all', 'expense', 'income'] as const).map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? colors.accent : colors.surfaceElevated,
                    borderColor: isActive ? colors.accent : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.filterDivider, { backgroundColor: colors.borderSubtle }]} />

          {/* Category Filter Pills */}
          {selectedCategory && (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: colors.dangerLight,
                  borderColor: colors.danger,
                  borderRadius: borderRadius.full,
                },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.filterChipText, { color: colors.danger, fontWeight: '700' }]}>
                Clear Category ×
              </Text>
            </TouchableOpacity>
          )}

          {Object.values(CATEGORIES).map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isCatActive ? `${cat.color}25` : colors.surfaceElevated,
                    borderColor: isCatActive ? cat.color : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
                onPress={() => setSelectedCategory(isCatActive ? null : cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={12}
                  color={isCatActive ? cat.color : colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isCatActive ? cat.color : colors.textSecondary,
                      fontWeight: isCatActive ? '700' : '500',
                    },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Filtered Financial Summary Mini-strip */}
      <View style={[styles.summaryStrip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>INFLOW</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            +${currentTotalIncome.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>OUTFLOW</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>
            -${currentTotalExpense.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>NET</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: currentTotalIncome >= currentTotalExpense ? colors.textPrimary : colors.danger },
            ]}
          >
            ${(currentTotalIncome - currentTotalExpense).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Transaction List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {processedTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Try altering your search or active filter filters.
            </Text>
          </View>
        ) : (
          processedTransactions.map((tx) => {
            const categoryMeta = CATEGORIES[tx.category] || CATEGORIES.misc;
            const isIncome = tx.type === 'income';

            return (
              <Card
                key={tx.id}
                style={styles.txCard}
                onPress={() => setInspectTx(tx)}
              >
                <View style={styles.txRow}>
                  {/* Category Icon */}
                  <View
                    style={[
                      styles.txIconContainer,
                      {
                        backgroundColor: `${categoryMeta.color}1F`,
                        borderRadius: borderRadius.md,
                      },
                    ]}
                  >
                    <Ionicons
                      name={categoryMeta.icon as any}
                      size={20}
                      color={categoryMeta.color}
                    />
                  </View>

                  {/* Info */}
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tx.merchant || tx.description}
                    </Text>
                    <View style={styles.txMetaRow}>
                      <Text style={[styles.txCategory, { color: colors.textMuted }]}>
                        {categoryMeta.name}
                      </Text>
                      {tx.isAiCategorized && (
                        <StatusBadge
                          label="SLM Tagged"
                          icon="hardware-chip-outline"
                          status="ai"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Price and Date */}
                  <View style={styles.txAmountContainer}>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isIncome ? colors.success : colors.textPrimary },
                      ]}
                    >
                      {formatTransactionAmount(tx.amount, tx.type)}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.textMuted }]}>{tx.date}</Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Sort Options Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowSortModal(false)}
        >
          <View
            style={[
              styles.sortModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.xl,
              },
            ]}
          >
            <Text style={[styles.sortModalTitle, { color: colors.textPrimary }]}>Sort Transactions</Text>
            {(
              [
                ['date_desc', 'Date: Newest First'],
                ['date_asc', 'Date: Oldest First'],
                ['amount_desc', 'Amount: Highest First'],
                ['amount_asc', 'Amount: Lowest First'],
              ] as [SortOption, string][]
            ).map(([val, label]) => {
              const isSelected = sortBy === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.sortOptionRow,
                    isSelected && { backgroundColor: colors.surfaceElevated, borderRadius: borderRadius.md },
                  ]}
                  onPress={() => {
                    setSortBy(val);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      { color: isSelected ? colors.accent : colors.textPrimary, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transaction Details, Edit & Delete Modal */}
      {inspectTx && (
        <Modal
          visible={!!inspectTx}
          transparent
          animationType="fade"
          onRequestClose={() => setInspectTx(null)}
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
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Transaction Details</Text>
                <TouchableOpacity onPress={() => setInspectTx(null)}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Amount Banner */}
              <View
                style={[
                  styles.modalAmountBanner,
                  {
                    backgroundColor: inspectTx.type === 'income' ? colors.successLight : colors.dangerLight,
                    borderRadius: borderRadius.lg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalAmount,
                    { color: inspectTx.type === 'income' ? colors.success : colors.danger },
                  ]}
                >
                  {formatTransactionAmount(inspectTx.amount, inspectTx.type)}
                </Text>
                <Text style={[styles.modalTypeLabel, { color: colors.textSecondary }]}>
                  {inspectTx.type === 'income' ? 'CREDIT / INFLOW' : 'DEBIT / OUTFLOW'}
                </Text>
              </View>

              {/* Data Rows */}
              <View style={styles.modalRows}>
                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Merchant / Payee</Text>
                  <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                    {inspectTx.merchant || 'N/A'}
                  </Text>
                </View>

                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Description</Text>
                  <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                    {inspectTx.description}
                  </Text>
                </View>

                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Category</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={CATEGORIES[inspectTx.category]?.icon as any}
                      size={15}
                      color={CATEGORIES[inspectTx.category]?.color}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                      {CATEGORIES[inspectTx.category]?.name}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Date</Text>
                  <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>{inspectTx.date}</Text>
                </View>

                {inspectTx.notes && (
                  <View style={[styles.modalRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Notes</Text>
                    <Text style={[styles.modalRowValue, { color: colors.textSecondary }]}>
                      {inspectTx.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons: Edit, Delete, Close */}
              <View style={{ marginTop: 16, gap: 8 }}>
                {onEditTransaction && (
                  <Button
                    title="Edit Transaction"
                    icon="create-outline"
                    variant="primary"
                    onPress={() => handleEdit(inspectTx)}
                  />
                )}
                {onDeleteTransaction && (
                  <Button
                    title="Delete Transaction"
                    icon="trash-outline"
                    variant="danger"
                    onPress={() => handleDelete(inspectTx)}
                  />
                )}
                <Button
                  title="Close"
                  variant="ghost"
                  onPress={() => setInspectTx(null)}
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
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  filtersWrapper: {
    marginBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  filterDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  summaryStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  stripDivider: {
    width: 1,
    height: '80%',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  txCard: {
    marginVertical: 4,
    padding: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  txCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  txAmountContainer: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txDate: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sortModalCard: {
    width: '100%',
    padding: 20,
    borderWidth: 1,
  },
  sortModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sortOptionText: {
    fontSize: 14,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalAmountBanner: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  modalAmount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  modalTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  modalRows: {
    gap: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  modalRowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalRowValue: {
    fontSize: 13,
    fontWeight: '600',
  },
});
