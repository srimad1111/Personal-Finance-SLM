import { getDatabaseClient } from './client';
import { TransactionRepository } from './repositories/transactionRepository';
import { CategoryRepository } from './repositories/categoryRepository';
import { BudgetRepository } from './repositories/budgetRepository';
import { SettingsRepository } from './repositories/settingsRepository';
import {
  TransactionEntity,
  TransactionFilter,
  FinancialSummary,
  CategorySpendingSummary,
  BudgetProgressSummary,
  MonthlyTrend,
  CategoryEntity,
  SettingsEntity,
} from '../types/database';

export * from './client';
export * from './schema';
export * from './repositories/transactionRepository';
export * from './repositories/categoryRepository';
export * from './repositories/budgetRepository';
export * from './repositories/settingsRepository';

// Singleton Repository Instances
export const transactionRepository = new TransactionRepository();
export const categoryRepository = new CategoryRepository();
export const budgetRepository = new BudgetRepository();
export const settingsRepository = new SettingsRepository();

/**
 * Ensures the database is initialized and migrations applied.
 */
export async function initializeDatabase(): Promise<void> {
  await getDatabaseClient();
}

/**
 * Backward-compatible helper for legacy components.
 */
export async function getDatabase() {
  return await getDatabaseClient();
}

export async function insertTransaction(
  tx: Omit<TransactionEntity, 'id' | 'created_at'> & { id?: string }
): Promise<TransactionEntity> {
  return await transactionRepository.insert(tx);
}

export async function getAllTransactions(filter?: TransactionFilter): Promise<TransactionEntity[]> {
  return await transactionRepository.getAll(filter);
}

export async function updateTransaction(
  id: string,
  updates: Partial<Omit<TransactionEntity, 'id' | 'created_at'>>
): Promise<boolean> {
  return await transactionRepository.update(id, updates);
}

export async function deleteTransaction(id: string): Promise<boolean> {
  return await transactionRepository.delete(id);
}

export async function getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary> {
  return await transactionRepository.getFinancialSummary(startDate, endDate);
}

export async function getCategoryWiseTotals(
  type: 'expense' | 'income' = 'expense',
  startDate?: string,
  endDate?: string
): Promise<CategorySpendingSummary[]> {
  return await transactionRepository.getCategoryWiseTotals(type, startDate, endDate);
}

export async function getMonthlyTrends(monthsCount: number = 6): Promise<MonthlyTrend[]> {
  return await transactionRepository.getMonthlyTrends(monthsCount);
}

export async function getBudgetProgress(month: number, year: number): Promise<BudgetProgressSummary[]> {
  return await budgetRepository.getBudgetProgress(month, year);
}

export async function getUnbudgetedCategories(month: number, year: number): Promise<CategoryEntity[]> {
  return await budgetRepository.getUnbudgetedCategories(month, year);
}

export async function upsertBudget(
  categoryId: string,
  monthlyLimit: number,
  month: number,
  year: number
) {
  return await budgetRepository.upsert(categoryId, monthlyLimit, month, year);
}

export async function getSettings(): Promise<SettingsEntity> {
  return await settingsRepository.getSettings();
}

export async function updateSettings(updates: Partial<Omit<SettingsEntity, 'id'>>): Promise<SettingsEntity> {
  return await settingsRepository.updateSettings(updates);
}
