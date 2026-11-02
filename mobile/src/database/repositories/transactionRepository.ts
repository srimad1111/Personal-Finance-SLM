import { getDatabaseClient } from '../client';
import {
  TransactionEntity,
  TransactionFilter,
  FinancialSummary,
  CategorySpendingSummary,
} from '../../types/database';

export class TransactionRepository {
  /**
   * Insert a new transaction with strictly parameterized SQL.
   */
  async insert(
    tx: Omit<TransactionEntity, 'id' | 'created_at'> & { id?: string }
  ): Promise<TransactionEntity> {
    const db = await getDatabaseClient();
    const id = tx.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = Date.now();

    const sql = `
      INSERT INTO transactions (
        id, amount, transaction_type, description, merchant,
        category, transaction_date, notes, created_at,
        is_ai_categorized, ai_confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    await db.runAsync(sql, [
      id,
      tx.amount,
      tx.transaction_type,
      tx.description,
      tx.merchant || null,
      tx.category,
      tx.transaction_date,
      tx.notes || null,
      createdAt,
      tx.is_ai_categorized ?? 0,
      tx.ai_confidence ?? null,
    ]);

    return {
      id,
      amount: tx.amount,
      transaction_type: tx.transaction_type,
      description: tx.description,
      merchant: tx.merchant || null,
      category: tx.category,
      transaction_date: tx.transaction_date,
      notes: tx.notes || null,
      created_at: createdAt,
      is_ai_categorized: tx.is_ai_categorized ?? 0,
      ai_confidence: tx.ai_confidence ?? null,
    };
  }

  /**
   * Update an existing transaction by ID using parameterized query.
   */
  async update(
    id: string,
    updates: Partial<Omit<TransactionEntity, 'id' | 'created_at'>>
  ): Promise<boolean> {
    const db = await getDatabaseClient();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.amount !== undefined) {
      fields.push('amount = ?');
      values.push(updates.amount);
    }
    if (updates.transaction_type !== undefined) {
      fields.push('transaction_type = ?');
      values.push(updates.transaction_type);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.merchant !== undefined) {
      fields.push('merchant = ?');
      values.push(updates.merchant);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.transaction_date !== undefined) {
      fields.push('transaction_date = ?');
      values.push(updates.transaction_date);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }
    if (updates.is_ai_categorized !== undefined) {
      fields.push('is_ai_categorized = ?');
      values.push(updates.is_ai_categorized);
    }
    if (updates.ai_confidence !== undefined) {
      fields.push('ai_confidence = ?');
      values.push(updates.ai_confidence);
    }

    if (fields.length === 0) {
      return false;
    }

    values.push(id);
    const sql = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?;`;
    const result = await db.runAsync(sql, values);

    return result.changes > 0;
  }

  /**
   * Delete a transaction by ID.
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabaseClient();
    const result = await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
    return result.changes > 0;
  }

  /**
   * Retrieve single transaction by ID.
   */
  async getById(id: string): Promise<TransactionEntity | null> {
    const db = await getDatabaseClient();
    const row = await db.getFirstAsync<TransactionEntity>(
      'SELECT * FROM transactions WHERE id = ? LIMIT 1;',
      [id]
    );
    return row || null;
  }

  /**
   * Retrieve transactions with dynamic parameterized filters.
   */
  async getAll(filter?: TransactionFilter): Promise<TransactionEntity[]> {
    const db = await getDatabaseClient();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.type) {
      conditions.push('transaction_type = ?');
      params.push(filter.type);
    }

    if (filter?.category) {
      conditions.push('category = ?');
      params.push(filter.category);
    }

    if (filter?.startDate) {
      conditions.push('transaction_date >= ?');
      params.push(filter.startDate);
    }

    if (filter?.endDate) {
      conditions.push('transaction_date <= ?');
      params.push(filter.endDate);
    }

    if (filter?.searchQuery && filter.searchQuery.trim().length > 0) {
      conditions.push('(description LIKE ? OR merchant LIKE ?)');
      const wild = `%${filter.searchQuery.trim()}%`;
      params.push(wild, wild);
    }

    let sql = 'SELECT * FROM transactions';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY transaction_date DESC, created_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    return await db.getAllAsync<TransactionEntity>(sql, params);
  }

  /**
   * Calculate financial summary (total income, total expenses, net balance, count).
   */
  async getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary> {
    const db = await getDatabaseClient();

    const conditions: string[] = [];
    const params: string[] = [];

    if (startDate) {
      conditions.push('transaction_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('transaction_date <= ?');
      params.push(endDate);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const sql = `
      SELECT 
        COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as totalExpenses,
        COUNT(*) as transactionCount
      FROM transactions
      ${whereClause};
    `;

    const row = await db.getFirstAsync<{
      totalIncome: number;
      totalExpenses: number;
      transactionCount: number;
    }>(sql, params);

    const totalIncome = row?.totalIncome ?? 0;
    const totalExpenses = row?.totalExpenses ?? 0;

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      transactionCount: row?.transactionCount ?? 0,
    };
  }

  /**
   * Calculate category-wise totals with percentages and icons.
   */
  async getCategoryWiseTotals(
    type: 'expense' | 'income' = 'expense',
    startDate?: string,
    endDate?: string
  ): Promise<CategorySpendingSummary[]> {
    const db = await getDatabaseClient();

    const conditions: string[] = ['t.transaction_type = ?'];
    const params: string[] = [type];

    if (startDate) {
      conditions.push('t.transaction_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('t.transaction_date <= ?');
      params.push(endDate);
    }

    const sql = `
      SELECT 
        c.id as categoryId,
        c.name as categoryName,
        c.type as type,
        c.icon as icon,
        c.color as color,
        COALESCE(SUM(t.amount), 0) as totalAmount,
        COUNT(t.id) as transactionCount
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category AND ${conditions.join(' AND ')}
      WHERE c.type = ?
      GROUP BY c.id, c.name, c.type, c.icon, c.color
      HAVING totalAmount > 0
      ORDER BY totalAmount DESC;
    `;

    // Note: 'type' is bound for the LEFT JOIN and for the WHERE c.type = ?
    const allParams = [...params, type];
    const rows = await db.getAllAsync<{
      categoryId: string;
      categoryName: string;
      type: 'income' | 'expense';
      icon: string;
      color: string;
      totalAmount: number;
      transactionCount: number;
    }>(sql, allParams);

    const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);

    return rows.map((r) => ({
      ...r,
      percentage: grandTotal > 0 ? (r.totalAmount / grandTotal) * 100 : 0,
    }));
  }
}

