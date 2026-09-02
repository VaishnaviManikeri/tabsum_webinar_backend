const db = require('../config/db');

class AboutModel {
  static parse(row) {
    if (!row) return null;
    return {
      id: row.id,
      ...JSON.parse(row.content),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async getAll() {
    const [rows] = await db.query('SELECT * FROM about_sections ORDER BY id DESC');
    return rows.map(this.parse);
  }

  static async getById(id) {
    const [rows] = await db.query('SELECT * FROM about_sections WHERE id = ?', [id]);
    return this.parse(rows[0]);
  }

  static async create(content) {
    const [result] = await db.query(
      'INSERT INTO about_sections (content) VALUES (?)',
      [JSON.stringify(content)]
    );
    return this.getById(result.insertId);
  }

  static async update(id, content) {
    const [result] = await db.query(
      'UPDATE about_sections SET content = ? WHERE id = ?',
      [JSON.stringify(content), id]
    );
    return result.affectedRows ? this.getById(id) : null;
  }

  static async remove(id) {
    const [result] = await db.query('DELETE FROM about_sections WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
}

module.exports = AboutModel;
