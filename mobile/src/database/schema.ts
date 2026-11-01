export const DB_NAME = 'personal_finance.db';

export const CREATE_TRANSACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  is_ai_categorized INTEGER DEFAULT 0
);
`;

export const CREATE_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
`;

