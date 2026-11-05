import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
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
import { formatINR, formatTransactionAmount } from '../utils/currency';

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
  const { colors, borderRadius, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [inspectTx, setInspectTx] = useState<Transaction | null>(null);

  // Deterministic Filtering and Sorting
  const processedTransactions = useMemo(() => {
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
        return 'Newest';
      case 'date_asc':
        return 'Oldest';
      case 'amount_desc':
        return 'Highest';
      case 'amount_asc':
        return 'Lowest';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Activity"
        subtitle={`${processedTransactions.length} transactions`}
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
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
              <Ionicons name="swap-vertical-outline" size={15} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.iconBtn,
                {
                  backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={onOpenAddModal}
              accessibilityLabel="Add Transaction"
            >
              <Ionicons name="add" size={18} color={isDark ? '#090D16' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Integrated Search Bar */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Ionicons name="search-outline" size={15} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search merchant, item, or category..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Type Bar & Category Filter Scroll */}
      <View style={styles.filtersWrapper}>
        {/* Segmented Control */}
        <View
          style={[
            styles.segmentedBar,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          {(['all', 'expense', 'income'] as const).map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.segmentButton,
                  isActive && [
                    styles.segmentButtonActive,
                    {
                      backgroundColor: colors.surface,
                      borderRadius: borderRadius.sm,
                      borderColor: colors.border,
                    },
                  ],
                ]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: isActive ? colors.textPrimary : colors.textMuted,
                      fontWeight: isActive ? '600' : '500',
                    },
                  ]}
                >
                  {filter === 'all' ? 'All' : filter === 'expense' ? 'Expenses' : 'Income'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category Horizontal Filter Tags */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: borderRadius.sm,
              },
            ]}
            onPress={() => setShowSortModal(true)}
          >
            <Ionicons name="filter-outline" size={10} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={[styles.categoryChipText, { color: colors.textSecondary }]}>
              {getSortLabel(sortBy)}
            </Text>
          </TouchableOpacity>

          {selectedCategory && (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  backgroundColor: colors.dangerLight,
                  borderColor: `${colors.danger}40`,
                  borderRadius: borderRadius.sm,
                },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, { color: colors.danger, fontWeight: '600' }]}>
                Clear Filter ×
              </Text>
            </TouchableOpacity>
          )}

          {Object.values(CATEGORIES).map((cat) => {
            const isCatActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isCatActive ? `${cat.color}18` : colors.surface,
                    borderColor: isCatActive ? cat.color : colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
                onPress={() => setSelectedCategory(isCatActive ? null : cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={10}
                  color={isCatActive ? cat.color : colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: isCatActive ? cat.color : colors.textSecondary,
                      fontWeight: isCatActive ? '600' : '500',
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

      {/* Filtered Financial Mini-Strip */}
      <View
        style={[
          styles.summaryStrip,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>INFLOW</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            {currentTotalIncome > 0 ? `+${formatINR(currentTotalIncome)}` : formatINR(0)}
          </Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>OUTFLOW</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>
            {currentTotalExpense > 0 ? `-${formatINR(currentTotalExpense)}` : formatINR(0)}
          </Text>
        </View>
        <View style={[styles.stripDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>NET</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  currentTotalIncome >= currentTotalExpense ? colors.textPrimary : colors.danger,
              },
            ]}
          >
            {formatINR(currentTotalIncome - currentTotalExpense)}
          </Text>
        </View>
      </View>

      {/* Transaction List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {processedTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {searchQuery || selectedCategory || selectedFilter !== 'all'
                ? 'No transactions found'
                : 'No transactions yet'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {searchQuery || selectedCategory || selectedFilter !== 'all'
                ? 'Try adjusting your search query or active filter tags.'
                : 'Tap "+" above to record your first income or expense.'}
            </Text>
          </View>
        ) : (
          <Card style={styles.transactionsCard}>
            {processedTransactions.map((tx, index) => {
              const categoryMeta = CATEGORIES[tx.category] || {
                id: tx.category,
                name: tx.category,
                icon: 'receipt-outline',
                color: colors.accent,
                type: tx.type,
              };
              const isIncome = tx.type === 'income';
              const isLast = index === processedTransactions.length - 1;

              return (
                <TouchableOpacity
                  key={tx.id}
                  activeOpacity={0.7}
                  onPress={() => setInspectTx(tx)}
                  style={[
                    styles.txRow,
                    !isLast && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 },
                  ]}
                >
                  {/* Category Icon */}
                  <View
                    style={[
                      styles.txIconContainer,
                      {
                        backgroundColor: `${categoryMeta.color}14`,
                        borderRadius: borderRadius.sm,
                      },
                    ]}
                  >
                    <Ionicons
                      name={categoryMeta.icon as any}
                      size={16}
                      color={categoryMeta.color}
                    />
                  </View>

                  {/* Details */}
                  <View style={styles.txInfo}>
                    <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {tx.merchant || tx.description}
                    </Text>
                    <View style={styles.txMetaRow}>
                      <Text style={[styles.txCategory, { color: colors.textSecondary }]}>
                        {categoryMeta.name}
                      </Text>
                      {tx.isAiCategorized && (
                        <StatusBadge
                          label="SLM"
                          status="ai"
                          size="sm"
                          style={{ marginLeft: 6 }}
                        />
                      )}
                    </View>
                  </View>

                  {/* Amount and Date */}
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
                </TouchableOpacity>
              );
            })}
          </Card>
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
                borderRadius: borderRadius.lg,
              },
            ]}
          >
            <Text style={[styles.sortModalTitle, { color: colors.textPrimary }]}>
              Sort Transactions
            </Text>
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
                    isSelected && {
                      backgroundColor: colors.surfaceElevated,
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                  onPress={() => {
                    setSortBy(val);
                    setShowSortModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      {
                        color: isSelected ? colors.textPrimary : colors.textSecondary,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={15} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Transaction Details & Action Modal */}
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
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Transaction Details
                </Text>
                <TouchableOpacity onPress={() => setInspectTx(null)}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Amount Banner */}
              <View
                style={[
                  styles.modalAmountBanner,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalAmount,
                    { color: inspectTx.type === 'income' ? colors.success : colors.textPrimary },
                  ]}
                >
                  {formatTransactionAmount(inspectTx.amount, inspectTx.type)}
                </Text>
                <Text style={[styles.modalTypeLabel, { color: colors.textMuted }]}>
                  {inspectTx.type === 'income' ? 'CREDIT / INFLOW' : 'DEBIT / OUTFLOW'}
                </Text>
              </View>

              {/* Data Rows */}
              <View style={styles.modalRows}>
                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Merchant</Text>
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
                  <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                    {CATEGORIES[inspectTx.category]?.name || inspectTx.category}
                  </Text>
                </View>

                <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Date</Text>
                  <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                    {inspectTx.date}
                  </Text>
                </View>

                {inspectTx.notes && (
                  <View style={[styles.modalRow, { borderBottomColor: colors.borderSubtle }]}>
                    <Text style={[styles.modalRowLabel, { color: colors.textMuted }]}>Notes</Text>
                    <Text style={[styles.modalRowValue, { color: colors.textPrimary }]}>
                      {inspectTx.notes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Button
                  title="Delete"
                  variant="danger"
                  size="md"
                  icon="trash-outline"
                  onPress={() => handleDelete(inspectTx)}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Edit"
                  variant="secondary"
                  size="md"
                  icon="create-outline"
                  onPress={() => handleEdit(inspectTx)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 38,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filtersWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  segmentedBar: {
    flexDirection: 'row',
    padding: 3,
    marginBottom: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    borderWidth: 1,
  },
  segmentText: {
    fontSize: 12,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 11,
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  stripDivider: {
    width: 1,
    height: 18,
    alignSelf: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  transactionsCard: {
    paddingVertical: 0,
    paddingHorizontal: 14,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  txIconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txCategory: {
    fontSize: 11,
  },
  txAmountContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  txDate: {
    fontSize: 10,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sortModalCard: {
    width: '100%',
    maxWidth: 300,
    padding: 16,
    borderWidth: 1,
  },
  sortModalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  sortOptionText: {
    fontSize: 13,
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
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalAmountBanner: {
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  modalTypeLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  modalRows: {
    marginBottom: 14,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  modalRowLabel: {
    fontSize: 12,
  },
  modalRowValue: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
  },
});
