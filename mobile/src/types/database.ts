export type TransactionType = 'income' | 'expense';

export interface TransactionEntity {
  id: string;
  amount: number;
  transaction_type: TransactionType;
  description: string;
  merchant: string | null;
  category: string;
  transaction_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: number; // Unix timestamp in ms
  is_ai_categorized: number; // 0 or 1
  ai_confidence: number | null;
}

export interface CategoryEntity {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

export interface BudgetEntity {
  id: string;
  category_id: string;
  monthly_limit: number;
  month: number; // 1 - 12
  year: number; // e.g. 2026
}

export interface SettingsEntity {
  id: string;
  currency: string;
  theme: 'dark' | 'light';
  privacy_preferences: string; // JSON string
}

export interface TransactionFilter {
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
}

export interface CategorySpendingSummary {
  categoryId: string;
  categoryName: string;
  type: TransactionType;
  icon: string;
  color: string;
  totalAmount: number;
  percentage: number;
  transactionCount: number;
}

export interface BudgetProgressSummary {
  id: string;
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  monthlyLimit: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  isOverBudget: boolean;
}

export interface MonthlyTrend {
  month: string; // e.g. 'Nov 26' or 'Nov'
  yearMonth: string; // '2026-11'
  income: number;
  expense: number;
  savings: number;
}

export interface DbTestResult {
  test: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

export interface DbTestSuiteReport {
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  results: DbTestResult[];
}
