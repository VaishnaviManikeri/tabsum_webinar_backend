const db = require('../config/db');

class SectionModel {
  static parseContent(content) {
    if (!content) return {};
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch (error) {
        return {};
      }
    }
    return content;
  }

  static parse(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      ...this.parseContent(row.content),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static async get(slug) { const [rows] = await db.query('SELECT * FROM content_sections WHERE slug = ?', [slug]); return this.parse(rows[0]); }
  static async create(slug, content) { const [result] = await db.query('INSERT INTO content_sections (slug, content) VALUES (?, ?)', [slug, JSON.stringify(content)]); return this.get(slug, result.insertId); }
  static async update(slug, content) { const [result] = await db.query('UPDATE content_sections SET content = ? WHERE slug = ?', [JSON.stringify(content), slug]); return result.affectedRows ? this.get(slug) : null; }
  static async remove(slug) { const [result] = await db.query('DELETE FROM content_sections WHERE slug = ?', [slug]); return result.affectedRows > 0; }
}
module.exports = SectionModel;
