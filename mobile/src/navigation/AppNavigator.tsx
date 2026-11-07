import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Modal, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { BudgetsScreen } from '../screens/BudgetsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { AiAssistantScreen } from '../screens/AiAssistantScreen';
import { LocalModelTestScreen } from '../screens/LocalModelTestScreen';
import { BottomTabBar } from './BottomTabBar';
import { DatabaseDiagnosticModal } from '../components/DatabaseDiagnosticModal';
import { MainTabType, Transaction, TransactionType } from '../types';
import {
  initializeDatabase,
  getAllTransactions,
  insertTransaction,
  updateTransaction,
  deleteTransaction,
} from '../database';
import { useTheme } from '../theme';

export const AppNavigator: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addModalInitialType, setAddModalInitialType] = useState<TransactionType>('expense');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showDbDiagnostics, setShowDbDiagnostics] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Load transactions deterministically from local SQLite database
  const loadDatabaseData = useCallback(async () => {
    try {
      await initializeDatabase();
      const records = await getAllTransactions();

      const mapped: Transaction[] = records.map((r) => ({
        id: r.id,
        type: r.transaction_type,
        category: r.category as any,
        amount: r.amount,
        description: r.description,
        merchant: r.merchant || undefined,
        date: r.transaction_date,
        timestamp: r.created_at,
        notes: r.notes || undefined,
        isAiCategorized: r.is_ai_categorized === 1,
        aiConfidence: r.ai_confidence || undefined,
      }));

      setTransactions(mapped);
    } catch (err) {
      console.error('[APP_NAVIGATOR_DB_LOAD_ERROR]', err);
    } finally {
      setIsLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    loadDatabaseData();
  }, [loadDatabaseData]);

  const handleOpenAddModal = (type: TransactionType = 'expense') => {
    setEditingTransaction(null);
    setAddModalInitialType(type);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setAddModalInitialType(tx.type);
    setShowAddModal(true);
  };

  const handleSaveTransaction = async (
    newTxData: Omit<Transaction, 'id' | 'timestamp'>,
    editId?: string
  ) => {
    try {
      if (editId) {
        // Edit existing transaction in SQLite
        await updateTransaction(editId, {
          amount: newTxData.amount,
          transaction_type: newTxData.type,
          description: newTxData.description,
          merchant: newTxData.merchant || null,
          category: newTxData.category,
          transaction_date: newTxData.date,
          notes: newTxData.notes || null,
        });
      } else {
        // Insert new transaction in SQLite
        await insertTransaction({
          amount: newTxData.amount,
          transaction_type: newTxData.type,
          description: newTxData.description,
          merchant: newTxData.merchant || null,
          category: newTxData.category,
          transaction_date: newTxData.date,
          notes: newTxData.notes || null,
          is_ai_categorized: 0,
          ai_confidence: null,
        });
      }

      await loadDatabaseData();
      setShowAddModal(false);
      setEditingTransaction(null);
    } catch (err) {
      console.error('[SAVE_TRANSACTION_ERROR]', err);
      alert('Failed to save transaction to local SQLite.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const success = await deleteTransaction(id);
      if (success) {
        await loadDatabaseData();
      }
    } catch (err) {
      console.error('[DELETE_TRANSACTION_ERROR]', err);
      alert('Failed to delete transaction from local SQLite.');
    }
  };

  const renderCurrentScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            transactions={transactions}
            onNavigate={setActiveTab}
            onOpenAddModal={handleOpenAddModal}
            onOpenDbDiagnostics={() => setShowDbDiagnostics(true)}
          />
        );
      case 'transactions':
        return (
          <TransactionsScreen
            transactions={transactions}
            onOpenAddModal={() => handleOpenAddModal('expense')}
            onEditTransaction={handleOpenEditModal}
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case 'budgets':
        return <BudgetsScreen onDatabaseChanged={loadDatabaseData} />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'assistant':
        return <AiAssistantScreen />;
      case 'modelTest':
        return <LocalModelTestScreen onNavigate={setActiveTab} />;
      default:
        return (
          <DashboardScreen
            transactions={transactions}
            onNavigate={setActiveTab}
            onOpenAddModal={handleOpenAddModal}
            onOpenDbDiagnostics={() => setShowDbDiagnostics(true)}
          />
        );
    }
  };

  if (isLoadingDb) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Active Screen View */}
      <View style={styles.screenContainer}>{renderCurrentScreen()}</View>

      {/* Bottom Navigation Region */}
      {!isKeyboardVisible && activeTab !== 'modelTest' && (
        <View
          style={[
            styles.bottomNavRegion,
            {
              paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8),
              backgroundColor: colors.background,
            },
          ]}
        >
          <BottomTabBar
            activeTab={activeTab}
            onTabPress={setActiveTab}
            onAddPress={() => handleOpenAddModal('expense')}
          />
        </View>
      )}

      {/* Add / Edit Transaction Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddModal(false);
          setEditingTransaction(null);
        }}
      >
        <AddTransactionScreen
          initialType={addModalInitialType}
          editingTransaction={editingTransaction}
          onSave={handleSaveTransaction}
          onClose={() => {
            setShowAddModal(false);
            setEditingTransaction(null);
          }}
        />
      </Modal>

      {/* Database Diagnostic & Self-Test Modal */}
      <DatabaseDiagnosticModal
        visible={showDbDiagnostics}
        onClose={() => setShowDbDiagnostics(false)}
        onDatabaseChanged={loadDatabaseData}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  bottomNavRegion: {
    width: '100%',
    paddingTop: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
