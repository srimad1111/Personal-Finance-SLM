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

  // Budgets and transactions start completely clean (0 records) on fresh installations.
  // User data is preserved across app launches; no demo records are automatically inserted.
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

