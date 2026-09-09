const db = require('../config/db');

class WhatsAppLogModel {

  // ==========================================
  // CREATE WHATSAPP LOG
  // ==========================================
  static async createLog({
    registrationId,
    phone,
    whatsappType = 'registration_confirmation'
  }) {

    const [result] = await db.query(
      `
      INSERT INTO whatsapp_logs (
        registration_id,
        phone,
        whatsapp_type,
        status,
        retry_count
      )
      VALUES (?, ?, ?, 'pending', 0)
      `,
      [
        registrationId,
        phone,
        whatsappType
      ]
    );

    return {
      id: result.insertId,
      registration_id: registrationId,
      phone,
      whatsapp_type: whatsappType,
      status: 'pending',
      retry_count: 0
    };
  }


  // ==========================================
  // CREATE OR GET EXISTING LOG
  // Prevent duplicate WhatsApp messages
  // ==========================================
  static async createOrGetLog({
    registrationId,
    phone,
    whatsappType = 'registration_confirmation'
  }) {

    const [result] = await db.query(
      `
      INSERT INTO whatsapp_logs (
        registration_id,
        phone,
        whatsapp_type,
        status,
        retry_count
      )
      VALUES (?, ?, ?, 'pending', 0)

      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id)
      `,
      [
        registrationId,
        phone,
        whatsappType
      ]
    );

    const [rows] = await db.query(
      `
      SELECT *
      FROM whatsapp_logs
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    return rows[0] || null;
  }


  // ==========================================
  // GET LOG BY ID
  // ==========================================
  static async getById(id) {

    const [rows] = await db.query(
      `
      SELECT *
      FROM whatsapp_logs
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }


  // ==========================================
  // GET LOG BY REGISTRATION + TYPE
  // ==========================================
  static async getByRegistrationAndType(
    registrationId,
    whatsappType = 'registration_confirmation'
  ) {

    const [rows] = await db.query(
      `
      SELECT *
      FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [
        registrationId,
        whatsappType
      ]
    );

    return rows[0] || null;
  }


  // ==========================================
  // CHECK IF WHATSAPP ALREADY SENT
  // ==========================================
  static async isAlreadySent(
    registrationId,
    whatsappType = 'registration_confirmation'
  ) {

    const [rows] = await db.query(
      `
      SELECT id
      FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type = ?
        AND status = 'sent'
      LIMIT 1
      `,
      [
        registrationId,
        whatsappType
      ]
    );

    return rows.length > 0;
  }


  // ==========================================
  // MARK AS SENT
  // ==========================================
  static async markAsSent(
    id,
    messageId = null
  ) {

    const [result] = await db.query(
      `
      UPDATE whatsapp_logs
      SET
        status = 'sent',
        message_id = ?,
        error_message = NULL,
        sent_at = NOW()
      WHERE id = ?
      `,
      [
        messageId,
        id
      ]
    );

    return result.affectedRows > 0;
  }


  // ==========================================
  // MARK AS FAILED
  // ==========================================
  static async markAsFailed(
    id,
    errorMessage
  ) {

    const [result] = await db.query(
      `
      UPDATE whatsapp_logs
      SET
        status = 'failed',
        error_message = ?,
        retry_count = retry_count + 1
      WHERE id = ?
      `,
      [
        errorMessage,
        id
      ]
    );

    return result.affectedRows > 0;
  }


  // ==========================================
  // MARK AS PENDING
  // ==========================================
  static async markAsPending(id) {

    const [result] = await db.query(
      `
      UPDATE whatsapp_logs
      SET
        status = 'pending'
      WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }


  // ==========================================
  // INCREMENT RETRY COUNT
  // ==========================================
  static async incrementRetryCount(id) {

    const [result] = await db.query(
      `
      UPDATE whatsapp_logs
      SET
        retry_count = retry_count + 1
      WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }


  // ==========================================
  // GET ALL WHATSAPP LOGS
  // ==========================================
  static async getAll({
    status = null,
    whatsappType = null,
    limit = 100,
    offset = 0
  } = {}) {

    let query = `
      SELECT
        wl.*,
        r.first_name,
        r.last_name,
        r.email,
        r.payment_status,
        r.registration_status
      FROM whatsapp_logs wl
      LEFT JOIN registrations r
        ON wl.registration_id = r.id
      WHERE 1 = 1
    `;

    const params = [];


    if (status) {

      query += `
        AND wl.status = ?
      `;

      params.push(status);
    }


    if (whatsappType) {

      query += `
        AND wl.whatsapp_type = ?
      `;

      params.push(whatsappType);
    }


    query += `
      ORDER BY wl.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit));
    params.push(Number(offset));


    const [rows] = await db.query(
      query,
      params
    );

    return rows;
  }


  // ==========================================
  // GET WHATSAPP STATISTICS
  // ==========================================
  static async getStats() {

    const [rows] = await db.query(
      `
      SELECT

        COUNT(*) AS total,

        SUM(
          CASE
            WHEN status = 'pending'
            THEN 1
            ELSE 0
          END
        ) AS pending,

        SUM(
          CASE
            WHEN status = 'sent'
            THEN 1
            ELSE 0
          END
        ) AS sent,

        SUM(
          CASE
            WHEN status = 'failed'
            THEN 1
            ELSE 0
          END
        ) AS failed

      FROM whatsapp_logs
      `
    );

    return rows[0];
  }
}

module.exports = WhatsAppLogModel;