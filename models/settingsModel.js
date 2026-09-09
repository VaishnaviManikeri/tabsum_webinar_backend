const db = require('../config/db');
class SettingsModel {
  static parseValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value;
      }
    }
    return value;
  }

  static async get(key) { const [rows] = await db.query('SELECT setting_value FROM site_settings WHERE setting_key = ?', [key]); return rows[0] ? this.parseValue(rows[0].setting_value) : null; }
  static async set(key, value) { await db.query('INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [key, JSON.stringify(value)]); return this.get(key); }
}
module.exports = SettingsModel;
