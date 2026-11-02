import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Modal, ActivityIndicator } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { BudgetsScreen } from '../screens/BudgetsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { AiAssistantScreen } from '../screens/AiAssistantScreen';
import { BottomTabBar } from './BottomTabBar';
import { DatabaseDiagnosticModal } from '../components/DatabaseDiagnosticModal';
import { MainTabType, Transaction, TransactionType } from '../types';
import {
  initializeDatabase,
  getAllTransactions,
  insertTransaction,
  deleteTransaction,
} from '../database';
import { useTheme } from '../theme';

export const AppNavigator: React.FC = () => {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addModalInitialType, setAddModalInitialType] = useState<TransactionType>('expense');
  const [showDbDiagnostics, setShowDbDiagnostics] = useState<boolean>(false);

  // Load transactions from local SQLite database
  const loadDatabaseData = useCallback(async () => {
    try {
      await initializeDatabase();
      const records = await getAllTransactions();

      // Map Database Entities to UI Transactions
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
    setAddModalInitialType(type);
    setShowAddModal(true);
  };

  const handleSaveTransaction = async (newTxData: Omit<Transaction, 'id' | 'timestamp'>) => {
    try {
      const inserted = await insertTransaction({
        amount: newTxData.amount,
        transaction_type: newTxData.type,
        description: newTxData.description,
        merchant: newTxData.merchant || null,
        category: newTxData.category,
        transaction_date: newTxData.date,
        notes: newTxData.notes || null,
        is_ai_categorized: newTxData.isAiCategorized ? 1 : 0,
        ai_confidence: newTxData.aiConfidence || null,
      });

      const newTx: Transaction = {
        id: inserted.id,
        type: inserted.transaction_type,
        category: inserted.category as any,
        amount: inserted.amount,
        description: inserted.description,
        merchant: inserted.merchant || undefined,
        date: inserted.transaction_date,
        timestamp: inserted.created_at,
        notes: inserted.notes || undefined,
        isAiCategorized: inserted.is_ai_categorized === 1,
        aiConfidence: inserted.ai_confidence || undefined,
      };

      setTransactions((prev) => [newTx, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      console.error('[INSERT_TRANSACTION_ERROR]', err);
      alert('Failed to save transaction to local SQLite.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const success = await deleteTransaction(id);
      if (success) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
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
            onDeleteTransaction={handleDeleteTransaction}
          />
        );
      case 'budgets':
        return <BudgetsScreen onDatabaseChanged={loadDatabaseData} />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'assistant':
        return <AiAssistantScreen />;
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

      {/* Floating Bottom Navigation Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabPress={setActiveTab}
        onAddPress={() => handleOpenAddModal('expense')}
      />

      {/* Add Transaction Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <AddTransactionScreen
          initialType={addModalInitialType}
          onSave={handleSaveTransaction}
          onClose={() => setShowAddModal(false)}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
