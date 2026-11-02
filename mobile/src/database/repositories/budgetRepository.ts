import { getDatabaseClient } from '../client';
import { BudgetEntity, BudgetProgressSummary, CategoryEntity } from '../../types/database';

export class BudgetRepository {
  /**
   * Retrieve all category budgets for a given month and year with real calculated spent amounts.
   */
  async getBudgetProgress(month: number, year: number): Promise<BudgetProgressSummary[]> {
    const db = await getDatabaseClient();

    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    // Month upper bound
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const sql = `
      SELECT 
        b.id as id,
        b.category_id as categoryId,
        c.name as categoryName,
        c.icon as icon,
        c.color as color,
        b.monthly_limit as monthlyLimit,
        COALESCE(
          (
            SELECT SUM(t.amount)
            FROM transactions t
            WHERE t.category = b.category_id 
              AND t.transaction_type = 'expense'
              AND t.transaction_date >= ?
              AND t.transaction_date < ?
          ), 
          0
        ) as spentAmount
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.month = ? AND b.year = ?
      ORDER BY b.monthly_limit DESC;
    `;

    const rows = await db.getAllAsync<{
      id: string;
      categoryId: string;
      categoryName: string;
      icon: string;
      color: string;
      monthlyLimit: number;
      spentAmount: number;
    }>(sql, [startDate, endDate, month, year]);

    return rows.map((r) => {
      const remainingAmount = r.monthlyLimit - r.spentAmount;
      const percentage = r.monthlyLimit > 0 ? (r.spentAmount / r.monthlyLimit) * 100 : 0;
      return {
        id: r.id,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        icon: r.icon,
        color: r.color,
        monthlyLimit: r.monthlyLimit,
        spentAmount: r.spentAmount,
        remainingAmount,
        percentage,
        isOverBudget: remainingAmount < 0,
      };
    });
  }

  /**
   * Retrieve categories that have NOT been budgeted for the given month/year.
   */
  async getUnbudgetedCategories(month: number, year: number): Promise<CategoryEntity[]> {
    const db = await getDatabaseClient();

    const sql = `
      SELECT c.*
      FROM categories c
      WHERE c.type = 'expense'
        AND c.id NOT IN (
          SELECT category_id FROM budgets WHERE month = ? AND year = ?
        )
      ORDER BY c.name ASC;
    `;

    return await db.getAllAsync<CategoryEntity>(sql, [month, year]);
  }

  /**
   * Upsert a category budget (insert or update on conflict).
   */
  async upsert(
    category_id: string,
    monthly_limit: number,
    month: number,
    year: number
  ): Promise<BudgetEntity> {
    const db = await getDatabaseClient();
    const id = `bgt_${category_id}_${year}_${month}`;

    const sql = `
      INSERT INTO budgets (id, category_id, monthly_limit, month, year)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(category_id, month, year) DO UPDATE SET
        monthly_limit = excluded.monthly_limit;
    `;

    await db.runAsync(sql, [id, category_id, monthly_limit, month, year]);

    return {
      id,
      category_id,
      monthly_limit,
      month,
      year,
    };
  }

  /**
   * Delete a budget by ID.
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDatabaseClient();
    const result = await db.runAsync('DELETE FROM budgets WHERE id = ?;', [id]);
    return result.changes > 0;
  }
}
