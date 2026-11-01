import * as SQLite from 'expo-sqlite';
import { DB_NAME, CREATE_TRANSACTIONS_TABLE_SQL, CREATE_INDEX_SQL } from './schema';
import { Transaction, FinancialSummary } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await initDatabase(dbInstance);
  }
  return dbInstance;
}

export async function initDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    ${CREATE_TRANSACTIONS_TABLE_SQL}
    ${CREATE_INDEX_SQL}
  `);
}

export async function insertTransaction(tx: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
  const db = await getDatabase();
  const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = Date.now();

  await db.runAsync(
    `INSERT INTO transactions (id, type, category, amount, description, timestamp, is_ai_categorized)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tx.type, tx.category, tx.amount, tx.description, timestamp, tx.isAiCategorized ? 1 : 0]
  );

  return {
    ...tx,
    id,
    timestamp,
  };
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description: string;
    timestamp: number;
    is_ai_categorized: number;
  }>('SELECT * FROM transactions ORDER BY timestamp DESC LIMIT 100');

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category as Transaction['category'],
    amount: r.amount,
    description: r.description,
    timestamp: r.timestamp,
    isAiCategorized: r.is_ai_categorized === 1,
  }));
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const db = await getDatabase();
  const summaryRow = await db.getFirstAsync<{
    totalIncome: number | null;
    totalExpenses: number | null;
    txCount: number;
  }>(`
    SELECT 
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS totalIncome,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS totalExpenses,
      COUNT(*) AS txCount
    FROM transactions
  `);

  const income = summaryRow?.totalIncome ?? 0;
  const expenses = summaryRow?.totalExpenses ?? 0;

  return {
    totalIncome: income,
    totalExpenses: expenses,
    netBalance: income - expenses,
    transactionCount: summaryRow?.txCount ?? 0,
  };
}

