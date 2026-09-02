const db = require('../config/db');

class LeadModel {

  // Get all leads
  static async getAllLeads(filters = {}) {
    let query = `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        city,
        role,
        source,
        lead_status,
        created_at,
        updated_at
      FROM leads
      WHERE 1=1
    `;

    const params = [];

    // Search
    if (filters.search) {
      query += `
        AND (
          first_name LIKE ?
          OR last_name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
          OR city LIKE ?
        )
      `;

      const searchValue = `%${filters.search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      query += ` AND lead_status = ?`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await db.query(query, params);

    return rows;
  }


  // Get single lead
  static async getLeadById(id) {

    const [rows] = await db.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        city,
        role,
        source,
        lead_status,
        created_at,
        updated_at
      FROM leads
      WHERE id = ?
      `,
      [id]
    );

    return rows[0];
  }


  // Update lead status
  static async updateLeadStatus(id, leadStatus) {

    const allowedStatuses = [
      'new',
      'registered',
      'interested',
      'converted',
      'lost'
    ];

    if (!allowedStatuses.includes(leadStatus)) {
      throw new Error('Invalid lead status');
    }

    const [result] = await db.query(
      `
      UPDATE leads
      SET
        lead_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [leadStatus, id]
    );

    return result;
  }


  // CRM statistics
  static async getStats() {

    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(lead_status = 'new') AS new_leads,
        SUM(lead_status = 'registered') AS registered,
        SUM(lead_status = 'interested') AS interested,
        SUM(lead_status = 'converted') AS converted,
        SUM(lead_status = 'lost') AS lost
      FROM leads
    `);

    return rows[0];
  }
}

module.exports = LeadModel;