export const DB_NAME = 'personal_finance.db';
export const CURRENT_SCHEMA_VERSION = 1;

export const CREATE_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at INTEGER NOT NULL
);
`;

export const CREATE_CATEGORIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  icon TEXT NOT NULL,
  color TEXT NOT NULL
);
`;

export const CREATE_TRANSACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income', 'expense')),
  description TEXT NOT NULL,
  merchant TEXT,
  category TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  is_ai_categorized INTEGER DEFAULT 0,
  ai_confidence REAL,
  FOREIGN KEY (category) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
);
`;

export const CREATE_BUDGETS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  monthly_limit REAL NOT NULL CHECK(monthly_limit >= 0),
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK(year >= 2000),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE(category_id, month, year)
);
`;

export const CREATE_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark', 'light')),
  privacy_preferences TEXT NOT NULL
);
`;

export const CREATE_INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(year, month);
`;

export interface SeedCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { id: 'salary', name: 'Salary', type: 'income', icon: 'cash-outline', color: '#10B981' },
  { id: 'investment', name: 'Investments', type: 'income', icon: 'trending-up', color: '#3B82F6' },
  { id: 'freelance', name: 'Freelance & Consulting', type: 'income', icon: 'briefcase-outline', color: '#8B5CF6' },
  { id: 'housing', name: 'Housing & Rent', type: 'expense', icon: 'home-outline', color: '#6366F1' },
  { id: 'groceries', name: 'Groceries', type: 'expense', icon: 'cart-outline', color: '#14B8A6' },
  { id: 'food_and_dining', name: 'Food & Dining', type: 'expense', icon: 'restaurant-outline', color: '#F97316' },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'bag-handle-outline', color: '#EC4899' },
  { id: 'utilities', name: 'Utilities', type: 'expense', icon: 'flash-outline', color: '#EAB308' },
  { id: 'transportation', name: 'Transportation', type: 'expense', icon: 'car-outline', color: '#06B6D4' },
  { id: 'healthcare', name: 'Healthcare', type: 'expense', icon: 'medkit-outline', color: '#EF4444' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'film-outline', color: '#A855F7' },
  { id: 'education', name: 'Education', type: 'expense', icon: 'book-outline', color: '#38BDF8' },
  { id: 'travel', name: 'Travel & Trips', type: 'expense', icon: 'airplane-outline', color: '#F43F5E' },
  { id: 'misc', name: 'Miscellaneous', type: 'expense', icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8' },
];

export const DEFAULT_SETTINGS = {
  id: 'default_settings',
  currency: 'INR',
  theme: 'dark',
  privacy_preferences: JSON.stringify({
    localOnly: true,
    telemetryEnabled: false,
    allowAiSummaries: true,
    biometricsRequired: false,
  }),
};
