import { getDatabaseClient } from '../client';
import { SettingsEntity } from '../../types/database';
import { DEFAULT_SETTINGS } from '../schema';

export class SettingsRepository {
  /**
   * Retrieve current application settings.
   */
  async getSettings(): Promise<SettingsEntity> {
    const db = await getDatabaseClient();
    const row = await db.getFirstAsync<SettingsEntity>(
      'SELECT * FROM settings WHERE id = ? LIMIT 1;',
      [DEFAULT_SETTINGS.id]
    );

    if (row) {
      return row;
    }

    // Insert default settings if missing
    await db.runAsync(
      'INSERT OR IGNORE INTO settings (id, currency, theme, privacy_preferences) VALUES (?, ?, ?, ?);',
      [DEFAULT_SETTINGS.id, DEFAULT_SETTINGS.currency, DEFAULT_SETTINGS.theme, DEFAULT_SETTINGS.privacy_preferences]
    );

    return {
      id: DEFAULT_SETTINGS.id,
      currency: DEFAULT_SETTINGS.currency,
      theme: DEFAULT_SETTINGS.theme as 'dark' | 'light',
      privacy_preferences: DEFAULT_SETTINGS.privacy_preferences,
    };
  }

  /**
   * Update settings fields with parameterized query.
   */
  async updateSettings(
    updates: Partial<Omit<SettingsEntity, 'id'>>
  ): Promise<SettingsEntity> {
    const db = await getDatabaseClient();
    const fields: string[] = [];
    const values: string[] = [];

    if (updates.currency !== undefined) {
      fields.push('currency = ?');
      values.push(updates.currency);
    }
    if (updates.theme !== undefined) {
      fields.push('theme = ?');
      values.push(updates.theme);
    }
    if (updates.privacy_preferences !== undefined) {
      fields.push('privacy_preferences = ?');
      values.push(updates.privacy_preferences);
    }

    if (fields.length > 0) {
      values.push(DEFAULT_SETTINGS.id);
      const sql = `UPDATE settings SET ${fields.join(', ')} WHERE id = ?;`;
      await db.runAsync(sql, values);
    }

    return this.getSettings();
  }
}

