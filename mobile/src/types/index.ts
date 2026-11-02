export * from './database';

export type TransactionCategory =
  | 'salary'
  | 'investment'
  | 'freelance'
  | 'food_and_dining'
  | 'groceries'
  | 'shopping'
  | 'utilities'
  | 'housing'
  | 'transportation'
  | 'healthcare'
  | 'entertainment'
  | 'education'
  | 'travel'
  | 'misc';

export interface CategoryMetadata {
  id: TransactionCategory;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: TransactionCategory;
  amount: number;
  description: string;
  merchant?: string;
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number;
  notes?: string;
  isAiCategorized: boolean;
  aiConfidence?: number;
}

export interface CategoryBudget {
  category: TransactionCategory;
  allocatedAmount: number;
  spentAmount: number;
  color: string;
}

export interface OverallBudget {
  monthlyLimit: number;
  totalSpent: number;
  daysRemaining: number;
  projectedSavings: number;
}

export interface SpendingTrend {
  month: string; // e.g. 'Jun', 'Jul', 'Aug'
  income: number;
  expense: number;
  savings: number;
}

export interface CategoryBreakdown {
  category: TransactionCategory;
  name: string;
  amount: number;
  percentage: number;
  color: string;
  icon: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  suggestedActions?: string[];
  financialInsight?: {
    type: 'alert' | 'metric' | 'breakdown';
    title: string;
    value?: string;
    details?: string;
  };
}

export type MainTabType = 'dashboard' | 'transactions' | 'budgets' | 'analytics' | 'assistant';
