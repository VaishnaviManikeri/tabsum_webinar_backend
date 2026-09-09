const db = require('../config/db');

class EmailLogModel {

  // --------------------------------------------------
  // CREATE EMAIL LOG
  // --------------------------------------------------
  static async createLog({
    registrationId,
    email,
    emailType = 'registration_confirmation'
  }) {
    const [result] = await db.query(
      `
      INSERT INTO email_logs (
        registration_id,
        email,
        email_type,
        status,
        retry_count
      )
      VALUES (?, ?, ?, 'pending', 0)
      `,
      [
        registrationId,
        email,
        emailType
      ]
    );

    return {
      id: result.insertId,
      registration_id: registrationId,
      email,
      email_type: emailType,
      status: 'pending',
      retry_count: 0
    };
  }


  // --------------------------------------------------
  // CREATE OR GET EXISTING EMAIL LOG
  // --------------------------------------------------
  // Prevents duplicate email log records for:
  // registration_id + email_type
  // --------------------------------------------------
  static async createOrGetLog({
    registrationId,
    email,
    emailType = 'registration_confirmation'
  }) {
    const [result] = await db.query(
      `
      INSERT INTO email_logs (
        registration_id,
        email,
        email_type,
        status,
        retry_count
      )
      VALUES (?, ?, ?, 'pending', 0)

      ON DUPLICATE KEY UPDATE
        id = LAST_INSERT_ID(id)
      `,
      [
        registrationId,
        email,
        emailType
      ]
    );

    const [rows] = await db.query(
      `
      SELECT *
      FROM email_logs
      WHERE id = ?
      LIMIT 1
      `,
      [result.insertId]
    );

    return rows[0] || null;
  }


  // --------------------------------------------------
  // GET EMAIL LOG BY ID
  // --------------------------------------------------
  static async getById(id) {
    const [rows] = await db.query(
      `
      SELECT *
      FROM email_logs
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }


  // --------------------------------------------------
  // GET EMAIL LOG BY REGISTRATION + EMAIL TYPE
  // --------------------------------------------------
  static async getByRegistrationAndType(
    registrationId,
    emailType = 'registration_confirmation'
  ) {
    const [rows] = await db.query(
      `
      SELECT *
      FROM email_logs
      WHERE registration_id = ?
        AND email_type = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [
        registrationId,
        emailType
      ]
    );

    return rows[0] || null;
  }


  // --------------------------------------------------
  // CHECK WHETHER EMAIL WAS ALREADY SENT
  // --------------------------------------------------
  static async isAlreadySent(
    registrationId,
    emailType = 'registration_confirmation'
  ) {
    const [rows] = await db.query(
      `
      SELECT id
      FROM email_logs
      WHERE registration_id = ?
        AND email_type = ?
        AND status = 'sent'
      LIMIT 1
      `,
      [
        registrationId,
        emailType
      ]
    );

    return rows.length > 0;
  }


  // --------------------------------------------------
  // MARK EMAIL AS SENT
  // --------------------------------------------------
  static async markAsSent(
    id,
    messageId = null
  ) {
    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        status = 'sent',
        message_id = ?,
        error_message = NULL,
        sent_at = NOW(),
        last_attempt_at = NOW(),
        next_retry_at = NULL
      WHERE id = ?
      `,
      [
        messageId,
        id
      ]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // MARK EMAIL AS FAILED
  // --------------------------------------------------
  static async markAsFailed(
    id,
    errorMessage
  ) {
    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        status = 'failed',
        error_message = ?,
        retry_count = retry_count + 1,
        last_attempt_at = NOW()
      WHERE id = ?
      `,
      [
        errorMessage,
        id
      ]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // MARK EMAIL AS PENDING
  // --------------------------------------------------
  static async markAsPending(id) {
    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        status = 'pending',
        next_retry_at = NULL
      WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // INCREMENT RETRY COUNT
  // --------------------------------------------------
  static async incrementRetryCount(id) {
    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        retry_count = retry_count + 1,
        last_attempt_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // SCHEDULE NEXT EMAIL RETRY
  // --------------------------------------------------
  /*
    Retry strategy:

    retryCount = 1 → 5 minutes
    retryCount = 2 → 15 minutes
    retryCount = 3 → 30 minutes
  */
  static async scheduleRetry(
    id,
    retryCount
  ) {
    let delayMinutes;

    if (Number(retryCount) === 1) {
      delayMinutes = 5;
    } else if (Number(retryCount) === 2) {
      delayMinutes = 15;
    } else {
      delayMinutes = 30;
    }

    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        next_retry_at = DATE_ADD(
          NOW(),
          INTERVAL ? MINUTE
        )
      WHERE id = ?
      `,
      [
        delayMinutes,
        id
      ]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // GET EMAILS READY FOR RETRY
  // --------------------------------------------------
  /*
    Only returns:

    status = failed
    retry_count < maxRetries
    next_retry_at has arrived
  */
  static async getRetryableEmails(
    maxRetries = 3,
    limit = 20
  ) {
    const safeLimit = Math.max(
      1,
      Math.min(Number(limit) || 20, 100)
    );

    const [rows] = await db.query(
      `
      SELECT
        id,
        registration_id,
        email,
        email_type,
        status,
        message_id,
        error_message,
        retry_count,
        sent_at,
        last_attempt_at,
        next_retry_at,
        created_at,
        updated_at
      FROM email_logs
      WHERE
        status = 'failed'
        AND retry_count < ?
        AND (
          next_retry_at IS NULL
          OR next_retry_at <= NOW()
        )
      ORDER BY created_at ASC
      LIMIT ?
      `,
      [
        Number(maxRetries),
        safeLimit
      ]
    );

    return rows;
  }


  // --------------------------------------------------
  // CLEAR RETRY SCHEDULE
  // --------------------------------------------------
  static async clearRetrySchedule(id) {
    const [result] = await db.query(
      `
      UPDATE email_logs
      SET
        next_retry_at = NULL
      WHERE id = ?
      `,
      [id]
    );

    return result.affectedRows > 0;
  }


  // --------------------------------------------------
  // GET ALL EMAIL LOGS
  // --------------------------------------------------
  static async getAll({
    status = null,
    emailType = null,
    limit = 100,
    offset = 0
  } = {}) {

    let query = `
      SELECT
        el.*,

        r.first_name,
        r.last_name,
        r.phone,

        r.payment_status,
        r.registration_status

      FROM email_logs el

      LEFT JOIN registrations r
        ON el.registration_id = r.id

      WHERE 1 = 1
    `;

    const params = [];

    // --------------------------------------------------
    // FILTER BY STATUS
    // --------------------------------------------------
    if (status) {
      query += `
        AND el.status = ?
      `;

      params.push(status);
    }


    // --------------------------------------------------
    // FILTER BY EMAIL TYPE
    // --------------------------------------------------
    if (emailType) {
      query += `
        AND el.email_type = ?
      `;

      params.push(emailType);
    }


    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------
    query += `
      ORDER BY el.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(
      Number(limit)
    );

    params.push(
      Number(offset)
    );


    const [rows] = await db.query(
      query,
      params
    );

    return rows;
  }


  // --------------------------------------------------
  // GET EMAIL LOG STATISTICS
  // --------------------------------------------------
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

      FROM email_logs
      `
    );

    return rows[0];
  }


  // --------------------------------------------------
  // GET RETRY STATISTICS
  // --------------------------------------------------
  static async getRetryStats() {
    const [rows] = await db.query(
      `
      SELECT

        COUNT(*) AS total_retry_records,

        SUM(
          CASE
            WHEN status = 'failed'
            THEN 1
            ELSE 0
          END
        ) AS failed,

        SUM(
          CASE
            WHEN status = 'failed'
              AND retry_count < 3
            THEN 1
            ELSE 0
          END
        ) AS retryable,

        SUM(
          CASE
            WHEN status = 'failed'
              AND retry_count >= 3
            THEN 1
            ELSE 0
          END
        ) AS permanently_failed,

        SUM(
          CASE
            WHEN status = 'sent'
              AND retry_count > 0
            THEN 1
            ELSE 0
          END
        ) AS recovered_after_retry

      FROM email_logs
      `
    );

    return rows[0];
  }
}

module.exports = EmailLogModel;