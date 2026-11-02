import * as SQLite from 'expo-sqlite';
import {
  DB_NAME,
  CURRENT_SCHEMA_VERSION,
  CREATE_MIGRATIONS_TABLE_SQL,
  CREATE_CATEGORIES_TABLE_SQL,
  CREATE_TRANSACTIONS_TABLE_SQL,
  CREATE_BUDGETS_TABLE_SQL,
  CREATE_SETTINGS_TABLE_SQL,
  CREATE_INDEXES_SQL,
  SEED_CATEGORIES,
  DEFAULT_SETTINGS,
} from './schema';

let databaseInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Get or initialize the SQLite database connection singleton.
 */
export async function getDatabaseClient(): Promise<SQLite.SQLiteDatabase> {
  if (databaseInstance) {
    return databaseInstance;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);

      // Enforce SQLite PRAGMA invariants for performance and integrity
      await db.execAsync(`
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
      `);

      await applyMigrationsAndSeed(db);

      databaseInstance = db;
      return db;
    } catch (error) {
      // Security Invariant: Log operational error code without logging data payload
      console.error('[DB_CLIENT_ERROR] Failed to establish database connection:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Database initialization failed');
    } finally {
      isInitializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Executes versioned migrations and populates seed categories/settings if empty.
 */
async function applyMigrationsAndSeed(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Create migrations tracking table
  await db.execAsync(CREATE_MIGRATIONS_TABLE_SQL);

  const migrationRow = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM schema_migrations'
  );
  const currentVersion = migrationRow?.version ?? 0;

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    // Migration v1: Core tables & indexes
    await db.execAsync(`
      ${CREATE_CATEGORIES_TABLE_SQL}
      ${CREATE_TRANSACTIONS_TABLE_SQL}
      ${CREATE_BUDGETS_TABLE_SQL}
      ${CREATE_SETTINGS_TABLE_SQL}
      ${CREATE_INDEXES_SQL}
    `);

    // Record migration
    await db.runAsync(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [CURRENT_SCHEMA_VERSION, Date.now()]
    );
  }

  // 2. Seed Default Categories if empty
  const categoryCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if ((categoryCountRow?.count ?? 0) === 0) {
    for (const cat of SEED_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
        [cat.id, cat.name, cat.type, cat.icon, cat.color]
      );
    }
  }

  // 3. Seed Default Settings if empty
  const settingsCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM settings'
  );
  if ((settingsCountRow?.count ?? 0) === 0) {
    await db.runAsync(
      'INSERT INTO settings (id, currency, theme, privacy_preferences) VALUES (?, ?, ?, ?)',
      [DEFAULT_SETTINGS.id, DEFAULT_SETTINGS.currency, DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.privacy_preferences]
    );
  }

  // 4. Seed Starter Realistic Budgets for Current Month if empty
  const budgetCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM budgets'
  );
  if ((budgetCountRow?.count ?? 0) === 0) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const initialBudgets: [string, number][] = [
      ['housing', 1850.0],
      ['groceries', 600.0],
      ['food_and_dining', 450.0],
      ['shopping', 400.0],
      ['transportation', 250.0],
      ['utilities', 200.0],
      ['entertainment', 150.0],
    ];

    for (const [catId, limit] of initialBudgets) {
      const budgetId = `bgt_${catId}_${currentYear}_${currentMonth}`;
      await db.runAsync(
        `INSERT OR IGNORE INTO budgets (id, category_id, monthly_limit, month, year)
         VALUES (?, ?, ?, ?, ?)`,
        [budgetId, catId, limit, currentMonth, currentYear]
      );
    }
  }

  // 5. Seed Starter Transactions if table is completely empty
  const txCountRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM transactions'
  );
  if ((txCountRow?.count ?? 0) === 0) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    const starterTxList = [
      {
        id: `tx_${Date.now()}_01`,
        amount: 6250.0,
        type: 'income',
        description: 'Bi-weekly Direct Deposit',
        merchant: 'Anthropic Technologies',
        category: 'salary',
        date: `${currentYear}-${currentMonth}-01`,
        notes: 'Regular salary disbursement',
        isAi: 1,
        conf: 0.99,
      },
      {
        id: `tx_${Date.now()}_02`,
        amount: 1850.0,
        type: 'expense',
        description: 'Monthly Apartment Lease',
        merchant: 'Avalon Luxury Apartments',
        category: 'housing',
        date: `${currentYear}-${currentMonth}-01`,
        notes: 'Rent + reserved parking space',
        isAi: 1,
        conf: 0.98,
      },
      {
        id: `tx_${Date.now()}_03`,
        amount: 142.35,
        type: 'expense',
        description: 'Organic Groceries & Produce',
        merchant: 'Whole Foods Market',
        category: 'groceries',
        date: `${currentYear}-${currentMonth}-02`,
        notes: null,
        isAi: 1,
        conf: 0.97,
      },
      {
        id: `tx_${Date.now()}_04`,
        amount: 68.5,
        type: 'expense',
        description: 'Dinner with Engineering Team',
        merchant: 'Blue Bottle Coffee & Bistro',
        category: 'food_and_dining',
        date: `${currentYear}-${currentMonth}-02`,
        notes: null,
        isAi: 1,
        conf: 0.95,
      },
      {
        id: `tx_${Date.now()}_05`,
        amount: 89.2,
        type: 'expense',
        description: 'Electric & Gas Bill Oct',
        merchant: 'ConEdison Electric',
        category: 'utilities',
        date: `${currentYear}-${currentMonth}-02`,
        notes: null,
        isAi: 1,
        conf: 0.99,
      },
      {
        id: `tx_${Date.now()}_06`,
        amount: 32.4,
        type: 'expense',
        description: 'Ride to Airport Terminal',
        merchant: 'Uber Technologies',
        category: 'transportation',
        date: `${currentYear}-${currentMonth}-02`,
        notes: null,
        isAi: 1,
        conf: 0.98,
      },
      {
        id: `tx_${Date.now()}_07`,
        amount: 850.0,
        type: 'income',
        description: 'Embedded ML Consulting Milestone 1',
        merchant: 'Acme Advisory Client',
        category: 'freelance',
        date: `${currentYear}-${currentMonth}-02`,
        notes: 'Invoice #2041 paid via wire',
        isAi: 0,
        conf: null,
      },
    ];

    for (const t of starterTxList) {
      await db.runAsync(
        `INSERT INTO transactions (id, amount, transaction_type, description, merchant, category, transaction_date, notes, created_at, is_ai_categorized, ai_confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, t.amount, t.type, t.description, t.merchant, t.category, t.date, t.notes, Date.now(), t.isAi, t.conf]
      );
    }
  }
}

/**
 * Resets database for testing purposes.
 */
export async function resetDatabaseForTesting(): Promise<void> {
  const db = await getDatabaseClient();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM budgets;
    DELETE FROM categories;
    DELETE FROM settings;
    DELETE FROM schema_migrations;
  `);
  await applyMigrationsAndSeed(db);
}

