const db = require('../config/db');

// ======================================================
// REMINDER LOG MODEL
// ======================================================

class ReminderLogModel {

  // ====================================================
  // CREATE REMINDER LOG
  // ====================================================

  static async createReminderLog({
    registrationId,
    reminderType,
    scheduledAt
  }) {
    const [result] = await db.query(
      `
      INSERT INTO webinar_reminder_logs (
        registration_id,
        reminder_type,
        email_status,
        whatsapp_status,
        scheduled_at
      )
      VALUES (?, ?, 'pending', 'pending', ?)
      `,
      [
        registrationId,
        reminderType,
        scheduledAt
      ]
    );

    return {
      id: result.insertId,
      registrationId,
      reminderType,
      emailStatus: 'pending',
      whatsappStatus: 'pending',
      scheduledAt
    };
  }


  // ====================================================
  // CREATE OR GET REMINDER LOG
  // ====================================================

  static async createOrGetReminderLog({
    registrationId,
    reminderType,
    scheduledAt
  }) {
    try {

      const [existingRows] = await db.query(
        `
        SELECT *
        FROM webinar_reminder_logs
        WHERE registration_id = ?
          AND reminder_type = ?
        LIMIT 1
        `,
        [
          registrationId,
          reminderType
        ]
      );

      // Existing record
      if (existingRows.length > 0) {
        return existingRows[0];
      }

      // Create new record
      const [result] = await db.query(
        `
        INSERT INTO webinar_reminder_logs (
          registration_id,
          reminder_type,
          email_status,
          whatsapp_status,
          scheduled_at
        )
        VALUES (?, ?, 'pending', 'pending', ?)
        `,
        [
          registrationId,
          reminderType,
          scheduledAt
        ]
      );

      const [rows] = await db.query(
        `
        SELECT *
        FROM webinar_reminder_logs
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
      );

      return rows[0] || null;

    } catch (error) {

      // Handle duplicate insert race condition
      if (error.code === 'ER_DUP_ENTRY') {

        const [rows] = await db.query(
          `
          SELECT *
          FROM webinar_reminder_logs
          WHERE registration_id = ?
            AND reminder_type = ?
          LIMIT 1
          `,
          [
            registrationId,
            reminderType
          ]
        );

        return rows[0] || null;
      }

      throw error;
    }
  }


  // ====================================================
  // GET REMINDER BY ID
  // ====================================================

  static async getById(reminderId) {

    const [rows] = await db.query(
      `
      SELECT
        rl.*,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,
        r.payment_status,
        r.registration_status,

        w.id AS webinar_id,
        w.title AS webinar_title,
        w.date AS webinar_date,
        w.time AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password,
        w.zoom_created_at

      FROM webinar_reminder_logs rl

      LEFT JOIN registrations r
        ON rl.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE rl.id = ?

      LIMIT 1
      `,
      [reminderId]
    );

    return rows[0] || null;
  }


  // ====================================================
  // GET BY REGISTRATION + REMINDER TYPE
  // ====================================================

  static async getByRegistrationAndType({
    registrationId,
    reminderType
  }) {

    const [rows] = await db.query(
      `
      SELECT *
      FROM webinar_reminder_logs
      WHERE registration_id = ?
        AND reminder_type = ?
      LIMIT 1
      `,
      [
        registrationId,
        reminderType
      ]
    );

    return rows[0] || null;
  }


  // ====================================================
  // CHECK IF REMINDER IS COMPLETELY SENT
  // ====================================================

  static async isReminderSent({
    registrationId,
    reminderType
  }) {

    const reminder =
      await this.getByRegistrationAndType({
        registrationId,
        reminderType
      });

    if (!reminder) {
      return false;
    }

    return (
      reminder.email_status === 'sent' &&
      reminder.whatsapp_status === 'sent'
    );
  }


  // ====================================================
  // MARK EMAIL AS SENT
  // ====================================================

  static async markEmailAsSent({
    reminderId,
    messageId = null
  }) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        email_status = 'sent',
        email_message_id = ?,
        email_sent_at = NOW(),
        error_message = NULL

      WHERE id = ?
      `,
      [
        messageId,
        reminderId
      ]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // MARK EMAIL AS FAILED
  // ====================================================

  static async markEmailAsFailed({
    reminderId,
    errorMessage
  }) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        email_status = 'failed',
        error_message = ?,
        retry_count = retry_count + 1

      WHERE id = ?
      `,
      [
        errorMessage ||
          'Email reminder failed.',
        reminderId
      ]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // MARK WHATSAPP AS SENT
  // ====================================================

  static async markWhatsAppAsSent({
    reminderId,
    messageId = null
  }) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        whatsapp_status = 'sent',
        whatsapp_message_id = ?,
        whatsapp_sent_at = NOW(),
        error_message = NULL

      WHERE id = ?
      `,
      [
        messageId,
        reminderId
      ]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // MARK WHATSAPP AS FAILED
  // ====================================================

  static async markWhatsAppAsFailed({
    reminderId,
    errorMessage
  }) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        whatsapp_status = 'failed',
        error_message = ?,
        retry_count = retry_count + 1

      WHERE id = ?
      `,
      [
        errorMessage ||
          'WhatsApp reminder failed.',
        reminderId
      ]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // MARK EMAIL AS PENDING
  // ====================================================

  static async markEmailAsPending(
    reminderId
  ) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        email_status = 'pending'

      WHERE id = ?
      `,
      [reminderId]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // MARK WHATSAPP AS PENDING
  // ====================================================

  static async markWhatsAppAsPending(
    reminderId
  ) {

    const [result] = await db.query(
      `
      UPDATE webinar_reminder_logs

      SET
        whatsapp_status = 'pending'

      WHERE id = ?
      `,
      [reminderId]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // GET PENDING REMINDERS
  // ====================================================

  static async getPendingReminders({
    limit = 20
  } = {}) {

    const safeLimit = Math.max(
      1,
      Math.min(
        Number(limit) || 20,
        100
      )
    );

    const [rows] = await db.query(
      `
      SELECT

        rl.*,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,
        r.payment_status,
        r.registration_status,
        r.webinar_id,

        w.title AS webinar_title,
        w.date AS webinar_date,
        w.time AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password,
        w.zoom_created_at

      FROM webinar_reminder_logs rl

      INNER JOIN registrations r
        ON rl.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE
        r.payment_status = 'paid'

        AND r.registration_status = 'registered'

        AND rl.scheduled_at <= NOW()

        AND (
          rl.email_status IN ('pending', 'failed')
          OR
          rl.whatsapp_status IN ('pending', 'failed')
        )

      ORDER BY
        rl.scheduled_at ASC

      LIMIT ${safeLimit}
      `
    );

    return rows;
  }


  // ====================================================
  // GET UPCOMING REMINDERS
  // ====================================================

  static async getUpcomingReminders({
    minutes = 60,
    limit = 100
  } = {}) {

    const safeMinutes = Math.max(
      1,
      Math.min(
        Number(minutes) || 60,
        1440
      )
    );

    const safeLimit = Math.max(
      1,
      Math.min(
        Number(limit) || 100,
        500
      )
    );

    const [rows] = await db.query(
      `
      SELECT

        rl.*,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,
        r.payment_status,
        r.registration_status,
        r.webinar_id,

        w.title AS webinar_title,
        w.date AS webinar_date,
        w.time AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password,
        w.zoom_created_at

      FROM webinar_reminder_logs rl

      INNER JOIN registrations r
        ON rl.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE
        r.payment_status = 'paid'

        AND r.registration_status = 'registered'

        AND rl.scheduled_at
          BETWEEN NOW()
          AND DATE_ADD(
            NOW(),
            INTERVAL ${safeMinutes} MINUTE
          )

      ORDER BY
        rl.scheduled_at ASC

      LIMIT ${safeLimit}
      `
    );

    return rows;
  }


  // ====================================================
  // GET ALL REMINDER LOGS
  // ====================================================

  static async getAll({
    limit = 100,
    offset = 0,
    reminderType = null,
    emailStatus = null,
    whatsappStatus = null,
    paymentStatus = null,
    search = null
  } = {}) {

    const safeLimit = Math.max(
      1,
      Math.min(
        Number(limit) || 100,
        500
      )
    );

    const safeOffset = Math.max(
      0,
      Number(offset) || 0
    );

    const conditions = [];
    const params = [];

    // -----------------------------------------------
    // Reminder type filter
    // -----------------------------------------------

    if (reminderType) {

      conditions.push(
        'rl.reminder_type = ?'
      );

      params.push(reminderType);
    }

    // -----------------------------------------------
    // Email status filter
    // -----------------------------------------------

    if (emailStatus) {

      conditions.push(
        'rl.email_status = ?'
      );

      params.push(emailStatus);
    }

    // -----------------------------------------------
    // WhatsApp status filter
    // -----------------------------------------------

    if (whatsappStatus) {

      conditions.push(
        'rl.whatsapp_status = ?'
      );

      params.push(whatsappStatus);
    }

    // -----------------------------------------------
    // Payment status filter
    // -----------------------------------------------

    if (paymentStatus) {

      conditions.push(
        'r.payment_status = ?'
      );

      params.push(paymentStatus);
    }

    // -----------------------------------------------
    // Search filter
    // -----------------------------------------------

    if (search) {

      conditions.push(
        `
        (
          r.first_name LIKE ?
          OR r.last_name LIKE ?
          OR r.email LIKE ?
          OR r.phone LIKE ?
          OR w.title LIKE ?
        )
        `
      );

      const searchValue =
        `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [rows] = await db.query(
      `
      SELECT

        rl.id,
        rl.registration_id,
        rl.reminder_type,

        rl.email_status,
        rl.whatsapp_status,

        rl.email_message_id,
        rl.whatsapp_message_id,

        rl.email_sent_at,
        rl.whatsapp_sent_at,

        rl.retry_count,
        rl.error_message,

        rl.scheduled_at,
        rl.created_at,
        rl.updated_at,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,

        r.payment_status,
        r.registration_status,

        w.id AS webinar_id,
        w.title AS webinar_title,
        w.date AS webinar_date,
        w.time AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password

      FROM webinar_reminder_logs rl

      LEFT JOIN registrations r
        ON rl.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      ${whereClause}

      ORDER BY
        rl.created_at DESC

      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
      `,
      params
    );

    return rows;
  }


  // ====================================================
  // COUNT ALL REMINDER LOGS
  // ====================================================

  static async getCount({
    reminderType = null,
    emailStatus = null,
    whatsappStatus = null,
    paymentStatus = null,
    search = null
  } = {}) {

    const conditions = [];
    const params = [];

    if (reminderType) {

      conditions.push(
        'rl.reminder_type = ?'
      );

      params.push(reminderType);
    }

    if (emailStatus) {

      conditions.push(
        'rl.email_status = ?'
      );

      params.push(emailStatus);
    }

    if (whatsappStatus) {

      conditions.push(
        'rl.whatsapp_status = ?'
      );

      params.push(whatsappStatus);
    }

    if (paymentStatus) {

      conditions.push(
        'r.payment_status = ?'
      );

      params.push(paymentStatus);
    }

    if (search) {

      conditions.push(
        `
        (
          r.first_name LIKE ?
          OR r.last_name LIKE ?
          OR r.email LIKE ?
          OR r.phone LIKE ?
          OR w.title LIKE ?
        )
        `
      );

      const searchValue =
        `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const [rows] = await db.query(
      `
      SELECT COUNT(*) AS total

      FROM webinar_reminder_logs rl

      LEFT JOIN registrations r
        ON rl.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      ${whereClause}
      `,
      params
    );

    return Number(
      rows[0]?.total || 0
    );
  }


  // ====================================================
  // GET REMINDER STATISTICS
  // ====================================================

  static async getStats() {

    const [rows] = await db.query(
      `
      SELECT

        COUNT(*) AS total,

        SUM(
          reminder_type = 'reminder_24h'
        ) AS reminder_24h,

        SUM(
          reminder_type = 'reminder_3h'
        ) AS reminder_3h,

        SUM(
          reminder_type = 'reminder_30m'
        ) AS reminder_30m,

        SUM(
          email_status = 'sent'
        ) AS email_sent,

        SUM(
          email_status = 'failed'
        ) AS email_failed,

        SUM(
          email_status = 'pending'
        ) AS email_pending,

        SUM(
          whatsapp_status = 'sent'
        ) AS whatsapp_sent,

        SUM(
          whatsapp_status = 'failed'
        ) AS whatsapp_failed,

        SUM(
          whatsapp_status = 'pending'
        ) AS whatsapp_pending,

        SUM(
          email_status = 'sent'
          AND whatsapp_status = 'sent'
        ) AS completed,

        SUM(
          email_status = 'failed'
          OR whatsapp_status = 'failed'
        ) AS failed,

        SUM(
          email_status = 'pending'
          OR whatsapp_status = 'pending'
        ) AS pending

      FROM webinar_reminder_logs
      `
    );

    return rows[0] || {
      total: 0,
      reminder_24h: 0,
      reminder_3h: 0,
      reminder_30m: 0,
      email_sent: 0,
      email_failed: 0,
      email_pending: 0,
      whatsapp_sent: 0,
      whatsapp_failed: 0,
      whatsapp_pending: 0,
      completed: 0,
      failed: 0,
      pending: 0
    };
  }


  // ====================================================
  // DELETE REMINDER LOG
  // ====================================================

  static async deleteById(
    reminderId
  ) {

    const [result] = await db.query(
      `
      DELETE FROM webinar_reminder_logs
      WHERE id = ?
      `,
      [reminderId]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // DELETE ALL REMINDERS FOR REGISTRATION
  // ====================================================

  static async deleteByRegistrationId(
    registrationId
  ) {

    const [result] = await db.query(
      `
      DELETE FROM webinar_reminder_logs
      WHERE registration_id = ?
      `,
      [registrationId]
    );

    return result.affectedRows > 0;
  }


  // ====================================================
  // EXPORT
  // ====================================================

}

module.exports =
  ReminderLogModel;