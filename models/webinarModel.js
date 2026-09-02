const db = require('../config/db');

class WebinarModel {
  static async getWebinar() {
    const [rows] = await db.query('SELECT * FROM webinars ORDER BY id DESC LIMIT 1');
    return rows[0];
  }

  static async updateWebinar(data) {
    const {
      title, subtitle, date, time, duration,
      language, platform, price, backgroundImage
    } = data;

    // Check if webinar exists
    const existing = await this.getWebinar();

    if (existing) {
      const query = `
        UPDATE webinars SET
          title = ?, subtitle = ?, date = ?, time = ?,
          duration = ?, language = ?, platform = ?, price = ?,
          background_image = COALESCE(?, background_image)
        WHERE id = ?
      `;
      const [result] = await db.query(query, [
        title, subtitle, date, time, duration,
        language, platform, price, backgroundImage,
        existing.id
      ]);
      return result;
    } else {
      const query = `
        INSERT INTO webinars (
          title, subtitle, date, time, duration,
          language, platform, price, background_image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await db.query(query, [
        title, subtitle, date, time, duration,
        language, platform, price, backgroundImage
      ]);
      return result;
    }
  }
}

module.exports = WebinarModel;