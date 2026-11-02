import { getDatabaseClient } from '../client';
import { CategoryEntity } from '../../types/database';

export class CategoryRepository {
  /**
   * Retrieve all categories, optionally filtered by type.
   */
  async getAll(type?: 'income' | 'expense'): Promise<CategoryEntity[]> {
    const db = await getDatabaseClient();
    let sql = 'SELECT * FROM categories';
    const params: string[] = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    sql += ' ORDER BY name ASC;';
    return await db.getAllAsync<CategoryEntity>(sql, params);
  }

  /**
   * Retrieve single category by ID.
   */
  async getById(id: string): Promise<CategoryEntity | null> {
    const db = await getDatabaseClient();
    const row = await db.getFirstAsync<CategoryEntity>(
      'SELECT * FROM categories WHERE id = ? LIMIT 1;',
      [id]
    );
    return row || null;
  }

  /**
   * Insert a new custom category.
   */
  async insert(cat: CategoryEntity): Promise<CategoryEntity> {
    const db = await getDatabaseClient();
    const sql = `
      INSERT INTO categories (id, name, type, icon, color)
      VALUES (?, ?, ?, ?, ?);
    `;
    await db.runAsync(sql, [cat.id, cat.name, cat.type, cat.icon, cat.color]);
    return cat;
  }
}

