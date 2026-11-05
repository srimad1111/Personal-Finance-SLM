// client.web.ts - High-fidelity Web fallback database client
// Provides an in-browser SQLite-compatible engine with localStorage persistence
// allowing the application to run smoothly on Web without native expo-sqlite dependencies.

import {
  DB_NAME,
  CURRENT_SCHEMA_VERSION,
  SEED_CATEGORIES,
  DEFAULT_SETTINGS,
} from './schema';
import {
  TransactionEntity,
  CategoryEntity,
  BudgetEntity,
  SettingsEntity,
} from '../types/database';

export interface IDatabaseClient {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: any[]): Promise<T[]>;
}

interface WebDbState {
  version: number;
  categories: CategoryEntity[];
  settings: SettingsEntity[];
  budgets: BudgetEntity[];
  transactions: TransactionEntity[];
}

const STORAGE_KEY = 'pf_slm_database_web_v2';

class WebDatabaseClient implements IDatabaseClient {
  private state: WebDbState = {
    version: CURRENT_SCHEMA_VERSION,
    categories: [],
    settings: [],
    budgets: [],
    transactions: [],
  };

  private initialized = false;

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.state = {
              version: parsed.version || CURRENT_SCHEMA_VERSION,
              categories: Array.isArray(parsed.categories) ? parsed.categories : [],
              settings: Array.isArray(parsed.settings) ? parsed.settings : [],
              budgets: Array.isArray(parsed.budgets) ? parsed.budgets : [],
              transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            };
          }
        }
      }
    } catch (e) {
      console.warn('[WebDB] Failed to read from localStorage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
    } catch (e) {
      console.warn('[WebDB] Failed to persist to localStorage:', e);
    }
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.loadFromStorage();

    // 1. Seed Categories if empty
    if (this.state.categories.length === 0) {
      this.state.categories = SEED_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
      }));
    }

    // 2. Seed Default Settings if empty
    if (this.state.settings.length === 0) {
      this.state.settings = [
        {
          id: DEFAULT_SETTINGS.id,
          currency: DEFAULT_SETTINGS.currency,
          theme: DEFAULT_SETTINGS.theme as 'dark' | 'light',
          privacy_preferences: DEFAULT_SETTINGS.privacy_preferences,
        },
      ];
    }

    // Budgets and transactions start completely clean (0 records) on fresh installations.
    // User data is preserved; no demo records are automatically inserted.
    this.saveToStorage();
    this.initialized = true;
  }

  public async execAsync(sql: string): Promise<void> {
    await this.init();
    const clean = sql.trim();
    if (clean.includes('DELETE FROM')) {
      if (clean.includes('transactions')) this.state.transactions = [];
      if (clean.includes('budgets')) this.state.budgets = [];
      if (clean.includes('categories')) this.state.categories = [];
      if (clean.includes('settings')) this.state.settings = [];
      this.saveToStorage();
    }
  }

  public async runAsync(
    sql: string,
    params: any[] = []
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    await this.init();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 1. Transactions: INSERT
    if (/^INSERT INTO transactions/i.test(cleanSql)) {
      const [id, amount, transaction_type, description, merchant, category, transaction_date, notes, created_at, is_ai_categorized, ai_confidence] = params;
      const newTx: TransactionEntity = {
        id,
        amount: Number(amount),
        transaction_type,
        description,
        merchant: merchant ?? null,
        category,
        transaction_date,
        notes: notes ?? null,
        created_at: Number(created_at) || Date.now(),
        is_ai_categorized: Number(is_ai_categorized) || 0,
        ai_confidence: ai_confidence !== null && ai_confidence !== undefined ? Number(ai_confidence) : null,
      };
      this.state.transactions.unshift(newTx);
      this.saveToStorage();
      return { changes: 1, lastInsertRowId: this.state.transactions.length };
    }

    // 2. Transactions: UPDATE
    if (/^UPDATE transactions SET/i.test(cleanSql)) {
      // Last parameter in our repository update is the transaction ID
      const txId = params[params.length - 1];
      const idx = this.state.transactions.findIndex((t) => t.id === txId);
      if (idx !== -1) {
        // Match fields by analyzing SQL
        const setClause = cleanSql.substring(cleanSql.indexOf('SET') + 3, cleanSql.indexOf('WHERE')).trim();
        const assignments = setClause.split(',').map((s) => s.trim().split('=')[0].trim());
        const tx = { ...this.state.transactions[idx] };

        assignments.forEach((field, i) => {
          (tx as any)[field] = params[i];
        });

        this.state.transactions[idx] = tx;
        this.saveToStorage();
        return { changes: 1, lastInsertRowId: idx };
      }
      return { changes: 0, lastInsertRowId: 0 };
    }

    // 3. Transactions: DELETE
    if (/^DELETE FROM transactions WHERE id =/i.test(cleanSql)) {
      const txId = params[0];
      const prevLen = this.state.transactions.length;
      this.state.transactions = this.state.transactions.filter((t) => t.id !== txId);
      const changes = prevLen - this.state.transactions.length;
      if (changes > 0) this.saveToStorage();
      return { changes, lastInsertRowId: 0 };
    }

    // 4. Budgets: INSERT OR UPSERT
    if (/^INSERT (OR IGNORE )?INTO budgets/i.test(cleanSql)) {
      const [id, category_id, monthly_limit, month, year] = params;
      const existingIdx = this.state.budgets.findIndex(
        (b) => b.category_id === category_id && b.month === month && b.year === year
      );

      if (existingIdx !== -1) {
        if (cleanSql.includes('DO UPDATE SET')) {
          this.state.budgets[existingIdx].monthly_limit = Number(monthly_limit);
          this.saveToStorage();
        }
      } else {
        this.state.budgets.push({
          id,
          category_id,
          monthly_limit: Number(monthly_limit),
          month: Number(month),
          year: Number(year),
        });
        this.saveToStorage();
      }
      return { changes: 1, lastInsertRowId: this.state.budgets.length };
    }

    // 5. Budgets: DELETE
    if (/^DELETE FROM budgets WHERE id =/i.test(cleanSql)) {
      const budgetId = params[0];
      const prevLen = this.state.budgets.length;
      this.state.budgets = this.state.budgets.filter((b) => b.id !== budgetId);
      const changes = prevLen - this.state.budgets.length;
      if (changes > 0) this.saveToStorage();
      return { changes, lastInsertRowId: 0 };
    }

    // 6. Categories: INSERT
    if (/^INSERT INTO categories/i.test(cleanSql)) {
      const [id, name, type, icon, color] = params;
      const idx = this.state.categories.findIndex((c) => c.id === id);
      if (idx !== -1) {
        this.state.categories[idx] = { id, name, type, icon, color };
      } else {
        this.state.categories.push({ id, name, type, icon, color });
      }
      this.saveToStorage();
      return { changes: 1, lastInsertRowId: this.state.categories.length };
    }

    // 7. Settings: INSERT OR UPDATE
    if (/^INSERT INTO settings/i.test(cleanSql) || /^UPDATE settings/i.test(cleanSql)) {
      if (/^UPDATE settings/i.test(cleanSql)) {
        if (this.state.settings.length > 0) {
          const s = this.state.settings[0];
          if (cleanSql.includes('currency = ?')) s.currency = params[0];
          if (cleanSql.includes('theme = ?')) s.theme = params[1] || params[0];
          if (cleanSql.includes('privacy_preferences = ?')) s.privacy_preferences = params[params.length - 1];
          this.saveToStorage();
        }
      } else {
        const [id, currency, theme, privacy_preferences] = params;
        this.state.settings = [{ id, currency, theme, privacy_preferences }];
        this.saveToStorage();
      }
      return { changes: 1, lastInsertRowId: 1 };
    }

    // 8. Migrations: INSERT
    if (/^INSERT INTO schema_migrations/i.test(cleanSql)) {
      this.state.version = params[0] || CURRENT_SCHEMA_VERSION;
      this.saveToStorage();
      return { changes: 1, lastInsertRowId: 1 };
    }

    return { changes: 0, lastInsertRowId: 0 };
  }

  public async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const list = await this.getAllAsync<T>(sql, params);
    return list.length > 0 ? list[0] : null;
  }

  public async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.init();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 1. Schema Migrations: MAX(version)
    if (/SELECT MAX\(version\) as version FROM schema_migrations/i.test(cleanSql)) {
      return [{ version: this.state.version }] as unknown as T[];
    }

    // 2. Count queries
    if (/SELECT COUNT\(\*\) as count FROM categories/i.test(cleanSql)) {
      return [{ count: this.state.categories.length }] as unknown as T[];
    }
    if (/SELECT COUNT\(\*\) as count FROM settings/i.test(cleanSql)) {
      return [{ count: this.state.settings.length }] as unknown as T[];
    }
    if (/SELECT COUNT\(\*\) as count FROM budgets/i.test(cleanSql)) {
      return [{ count: this.state.budgets.length }] as unknown as T[];
    }
    if (/SELECT COUNT\(\*\) as count FROM transactions$/i.test(cleanSql)) {
      return [{ count: this.state.transactions.length }] as unknown as T[];
    }

    // 3. Settings Query
    if (/SELECT \* FROM settings WHERE id =/i.test(cleanSql)) {
      const match = this.state.settings.find((s) => s.id === 'default' || s.id === DEFAULT_SETTINGS.id);
      return (match ? [match] : []) as unknown as T[];
    }

    // 4. Categories Query
    if (/^SELECT\s+(c\.\*|\*)\s+FROM\s+categories/i.test(cleanSql) || /FROM categories( c)?\s+WHERE/i.test(cleanSql) && !cleanSql.includes('LEFT JOIN')) {
      // 4a. Categories not in budgets: WHERE id NOT IN (SELECT category_id FROM budgets WHERE month = ? AND year = ?)
      if (/NOT IN \(SELECT category_id FROM budgets/i.test(cleanSql)) {
        const [month, year] = params;
        const budgetedCategoryIds = new Set(
          this.state.budgets
            .filter((b) => b.month === Number(month) && b.year === Number(year))
            .map((b) => b.category_id)
        );
        const filtered = this.state.categories.filter(
          (c) => c.type === 'expense' && !budgetedCategoryIds.has(c.id)
        );
        return filtered.sort((a, b) => a.name.localeCompare(b.name)) as unknown as T[];
      }

      // 4b. Category by ID
      if (/WHERE id = \?/i.test(cleanSql)) {
        const cat = this.state.categories.find((c) => c.id === params[0]);
        return (cat ? [cat] : []) as unknown as T[];
      }

      // 4c. Category by Type
      if (/WHERE type = \?/i.test(cleanSql)) {
        const list = this.state.categories.filter((c) => c.type === params[0]);
        return list.sort((a, b) => a.name.localeCompare(b.name)) as unknown as T[];
      }

      // 4d. All Categories
      return [...this.state.categories].sort((a, b) => a.name.localeCompare(b.name)) as unknown as T[];
    }

    // 5. Budgets Progress Join Query
    if (/SELECT\s+b\.id/i.test(cleanSql)) {
      const [startDate, endDate, month, year] = params.length >= 4 ? params : [null, null, params[0], params[1]];
      const targetMonth = Number(month);
      const targetYear = Number(year);

      const matchingBudgets = this.state.budgets.filter(
        (b) => b.month === targetMonth && b.year === targetYear
      );

      const result = matchingBudgets.map((b) => {
        const cat = this.state.categories.find((c) => c.id === b.category_id);

        // Sum transactions in this category for this month and year
        const total_spent = this.state.transactions
          .filter((t) => {
            if (t.category !== b.category_id || t.transaction_type !== 'expense') return false;
            const parts = t.transaction_date.split('-');
            const txYear = parseInt(parts[0], 10);
            const txMonth = parseInt(parts[1], 10);
            return txYear === targetYear && txMonth === targetMonth;
          })
          .reduce((sum, t) => sum + t.amount, 0);

        return {
          id: b.id,
          categoryId: b.category_id,
          categoryName: cat ? cat.name : b.category_id,
          icon: cat ? cat.icon : 'pricetag-outline',
          color: cat ? cat.color : '#6366F1',
          monthlyLimit: b.monthly_limit,
          monthly_limit: b.monthly_limit,
          month: b.month,
          year: b.year,
          spentAmount: total_spent,
          total_spent,
        };
      });

      return result as unknown as T[];
    }

    // 6. Transactions: Summary Aggregation
    if (/SELECT\s+COUNT\(\*\) as count,\s+COALESCE\(SUM\(CASE WHEN transaction_type = 'income'/i.test(cleanSql) ||
        /SELECT\s+COALESCE\(SUM\(CASE WHEN transaction_type = 'income'/i.test(cleanSql)) {
      let filtered = [...this.state.transactions];
      let pIdx = 0;
      if (cleanSql.includes('transaction_date >= ?')) {
        const start = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date >= start);
      }
      if (cleanSql.includes('transaction_date <= ?')) {
        const end = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date <= end);
      }

      const count = filtered.length;
      let total_income = 0;
      let total_expenses = 0;
      let total_amount = 0;

      for (const t of filtered) {
        total_amount += t.amount;
        if (t.transaction_type === 'income') total_income += t.amount;
        if (t.transaction_type === 'expense') total_expenses += t.amount;
      }

      const avg_transaction = count > 0 ? total_amount / count : 0;
      const net_balance = total_income - total_expenses;

      return [
        {
          count,
          transactionCount: count,
          totalIncome: total_income,
          totalExpenses: total_expenses,
          total_income,
          total_expenses,
          netBalance: net_balance,
          net_balance,
          avg_transaction,
        },
      ] as unknown as T[];
    }

    // 7. Transactions: Category Wise Totals
    if (/FROM categories c\s+LEFT JOIN transactions t/i.test(cleanSql) ||
        /SELECT\s+category,\s+SUM\(amount\) as total_amount/i.test(cleanSql)) {
      const type = params[0] || 'expense';
      let filtered = this.state.transactions.filter((t) => t.transaction_type === type);
      let pIdx = 1;
      if (cleanSql.includes('transaction_date >= ?')) {
        const start = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date >= start);
      }
      if (cleanSql.includes('transaction_date <= ?')) {
        const end = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date <= end);
      }

      const groups: Record<string, { totalAmount: number; count: number }> = {};
      for (const t of filtered) {
        if (!groups[t.category]) {
          groups[t.category] = { totalAmount: 0, count: 0 };
        }
        groups[t.category].totalAmount += t.amount;
        groups[t.category].count += 1;
      }

      const list = Object.keys(groups).map((catId) => {
        const cat = this.state.categories.find((c) => c.id === catId);
        return {
          categoryId: catId,
          category: catId,
          categoryName: cat ? cat.name : catId,
          type: type as 'income' | 'expense',
          icon: cat ? cat.icon : 'receipt-outline',
          color: cat ? cat.color : '#6366F1',
          totalAmount: groups[catId].totalAmount,
          total_amount: groups[catId].totalAmount,
          transactionCount: groups[catId].count,
          count: groups[catId].count,
        };
      });

      list.sort((a, b) => b.totalAmount - a.totalAmount);
      return list as unknown as T[];
    }

    // 8. Transactions: Monthly Trends
    if (/substr\(transaction_date,\s*1,\s*7\)\s+as\s+(yearMonth|month_key)/i.test(cleanSql)) {
      const minMonthKey = params[0] || '2000-01';
      const filtered = this.state.transactions.filter(
        (t) => typeof minMonthKey === 'number' || t.transaction_date.substring(0, 7) >= minMonthKey
      );

      const monthsMap: Record<string, { income: number; expense: number }> = {};
      for (const t of filtered) {
        const mKey = t.transaction_date.substring(0, 7);
        if (!monthsMap[mKey]) {
          monthsMap[mKey] = { income: 0, expense: 0 };
        }
        if (t.transaction_type === 'income') monthsMap[mKey].income += t.amount;
        if (t.transaction_type === 'expense') monthsMap[mKey].expense += t.amount;
      }

      const list = Object.keys(monthsMap).map((month_key) => ({
        yearMonth: month_key,
        month_key,
        income: monthsMap[month_key].income,
        expense: monthsMap[month_key].expense,
        savings: monthsMap[month_key].income - monthsMap[month_key].expense,
      }));

      list.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
      return list as unknown as T[];
    }

    // 9. Single Transaction by ID
    if (/SELECT \* FROM transactions WHERE id = \?/i.test(cleanSql)) {
      const tx = this.state.transactions.find((t) => t.id === params[0]);
      return (tx ? [tx] : []) as unknown as T[];
    }

    // 10. General Transactions Query with Filters and Sorting
    if (/FROM transactions/i.test(cleanSql)) {
      let filtered = [...this.state.transactions];

      // Parse params according to the query construction in transactionRepository.getAll
      let pIdx = 0;
      if (cleanSql.includes('transaction_type = ?')) {
        const val = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_type === val);
      }
      if (cleanSql.includes('category = ?')) {
        const val = params[pIdx++];
        filtered = filtered.filter((t) => t.category === val);
      }
      if (cleanSql.includes('transaction_date >= ?')) {
        const val = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date >= val);
      }
      if (cleanSql.includes('transaction_date <= ?')) {
        const val = params[pIdx++];
        filtered = filtered.filter((t) => t.transaction_date <= val);
      }
      if (cleanSql.includes('description LIKE ? OR merchant LIKE ? OR category LIKE ?')) {
        const searchPattern = (params[pIdx] || '').replace(/%/g, '').toLowerCase();
        pIdx += 3; // consumed 3 params
        filtered = filtered.filter(
          (t) =>
            t.description.toLowerCase().includes(searchPattern) ||
            (t.merchant && t.merchant.toLowerCase().includes(searchPattern)) ||
            t.category.toLowerCase().includes(searchPattern)
        );
      }

      // Sorting
      if (cleanSql.includes('ORDER BY amount ASC')) {
        filtered.sort((a, b) => a.amount - b.amount);
      } else if (cleanSql.includes('ORDER BY amount DESC')) {
        filtered.sort((a, b) => b.amount - a.amount);
      } else if (cleanSql.includes('ORDER BY transaction_date ASC')) {
        filtered.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
      } else {
        // Default: transaction_date DESC, created_at DESC
        filtered.sort((a, b) => {
          const dComp = b.transaction_date.localeCompare(a.transaction_date);
          if (dComp !== 0) return dComp;
          return b.created_at - a.created_at;
        });
      }

      // Limit and Offset
      if (cleanSql.includes('LIMIT ?')) {
        const limitVal = params[pIdx++];
        if (cleanSql.includes('OFFSET ?')) {
          const offsetVal = params[pIdx++];
          filtered = filtered.slice(offsetVal, offsetVal + limitVal);
        } else {
          filtered = filtered.slice(0, limitVal);
        }
      }

      return filtered as unknown as T[];
    }

    return [] as unknown as T[];
  }
  public async resetForTesting(): Promise<void> {
    this.state.transactions = [];
    this.state.budgets = [];
    this.state.categories = SEED_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon,
      color: c.color,
    }));
    this.state.settings = [
      {
        id: DEFAULT_SETTINGS.id,
        currency: DEFAULT_SETTINGS.currency,
        theme: DEFAULT_SETTINGS.theme as 'dark' | 'light',
        privacy_preferences: DEFAULT_SETTINGS.privacy_preferences,
      },
    ];
    this.saveToStorage();
  }
}

const webDbInstance = new WebDatabaseClient();

export async function getDatabaseClient(): Promise<IDatabaseClient> {
  await webDbInstance.init();
  return webDbInstance;
}

export async function resetDatabase(): Promise<void> {
  await webDbInstance.resetForTesting();
}
