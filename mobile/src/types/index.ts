export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'salary'
  | 'investment'
  | 'food_and_dining'
  | 'groceries'
  | 'shopping'
  | 'utilities'
  | 'housing'
  | 'transportation'
  | 'healthcare'
  | 'entertainment'
  | 'education'
  | 'misc';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  timestamp: number;
  isAiCategorized: boolean;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  transactionCount: number;
}

export interface ModelInferenceState {
  isModelLoaded: boolean;
  modelName: string;
  inferenceBackend: 'local_gguf' | 'uninitialized';
  vramOrRamUsageMb?: number;
}

