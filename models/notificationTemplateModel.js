const db = require('../config/db');

class NotificationTemplateModel {
  static async getAll() {
    const [rows] = await db.query(
      'SELECT * FROM notification_templates ORDER BY channel, message_type'
    );
    return rows;
  }

  static async get(channel, messageType, activeOnly = true) {
    const [rows] = await db.query(
      `SELECT * FROM notification_templates
       WHERE channel = ? AND message_type = ?${activeOnly ? ' AND is_active = TRUE' : ''}
       LIMIT 1`,
      [channel, messageType]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const [result] = await db.query(
      `INSERT INTO notification_templates
       (channel, message_type, template_name, language_code, subject, body, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.channel, data.message_type, data.template_name || null,
        data.language_code || 'en_US', data.subject || null, data.body || '',
        data.is_active !== false]
    );
    return this.getById(result.insertId);
  }

  static async getById(id) {
    const [rows] = await db.query(
      'SELECT * FROM notification_templates WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async update(id, data) {
    const [result] = await db.query(
      `UPDATE notification_templates
       SET template_name = ?, language_code = ?, subject = ?, body = ?, is_active = ?
       WHERE id = ?`,
      [data.template_name || null, data.language_code || 'en_US',
        data.subject || null, data.body || '', data.is_active !== false, id]
    );
    return result.affectedRows ? this.getById(id) : null;
  }

  static async deactivate(id) {
    const [result] = await db.query(
      'UPDATE notification_templates SET is_active = FALSE WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = NotificationTemplateModel;