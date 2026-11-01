import React, { useState } from 'react';
import { StyleSheet, View, Modal } from 'react-native';
import { DashboardScreen } from '../screens/DashboardScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { BudgetsScreen } from '../screens/BudgetsScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { AiAssistantScreen } from '../screens/AiAssistantScreen';
import { BottomTabBar } from './BottomTabBar';
import { MainTabType, Transaction, TransactionType } from '../types';
import { INITIAL_TRANSACTIONS } from '../data/mockData';
import { useTheme } from '../theme';

export const AppNavigator: React.FC = () => {
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addModalInitialType, setAddModalInitialType] = useState<TransactionType>('expense');

  const handleOpenAddModal = (type: TransactionType = 'expense') => {
    setAddModalInitialType(type);
    setShowAddModal(true);
  };

  const handleSaveTransaction = (newTxData: Omit<Transaction, 'id' | 'timestamp'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };

    setTransactions((prev) => [newTx, ...prev]);
    setShowAddModal(false);
  };

  const renderCurrentScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            transactions={transactions}
            onNavigate={setActiveTab}
            onOpenAddModal={handleOpenAddModal}
          />
        );
      case 'transactions':
        return (
          <TransactionsScreen
            transactions={transactions}
            onOpenAddModal={() => handleOpenAddModal('expense')}
          />
        );
      case 'budgets':
        return <BudgetsScreen />;
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
          />
        );
    }
  };

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
});

