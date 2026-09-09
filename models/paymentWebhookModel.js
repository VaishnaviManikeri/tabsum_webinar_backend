const db = require('../config/db');


// =====================================================
// PAYMENT WEBHOOK MODEL
// =====================================================

const PaymentWebhookModel = {

  // ===================================================
  // GET WEBHOOK EVENT BY EVENT ID
  // ===================================================

  getByEventId: async (eventId) => {

    const [rows] = await db.query(
      `
      SELECT *
      FROM payment_webhook_logs
      WHERE event_id = ?
      LIMIT 1
      `,
      [eventId]
    );

    return rows[0] || null;
  },


  // ===================================================
  // CREATE WEBHOOK EVENT
  // ===================================================

  createEvent: async ({
    eventId,
    eventType,
    paymentId = null,
    orderId = null,
    signatureValid = false,
    processingStatus = 'received'
  }) => {

    const [result] = await db.query(
      `
      INSERT INTO payment_webhook_logs
      (
        event_id,
        event_type,
        payment_id,
        order_id,
        signature_valid,
        processing_status
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        eventId,
        eventType,
        paymentId,
        orderId,
        signatureValid ? 1 : 0,
        processingStatus
      ]
    );

    return result.insertId;
  },


  // ===================================================
  // MARK WEBHOOK AS PROCESSED
  // ===================================================

  markProcessed: async (eventId) => {

    const [result] = await db.query(
      `
      UPDATE payment_webhook_logs

      SET
        processing_status = 'processed',
        processed_at = NOW(),
        error_message = NULL

      WHERE event_id = ?
      `,
      [eventId]
    );

    return result;
  },


  // ===================================================
  // MARK WEBHOOK AS FAILED
  // ===================================================

  markFailed: async ({
    eventId,
    errorMessage
  }) => {

    const [result] = await db.query(
      `
      UPDATE payment_webhook_logs

      SET
        processing_status = 'failed',
        error_message = ?

      WHERE event_id = ?
      `,
      [
        errorMessage || 'Webhook processing failed',
        eventId
      ]
    );

    return result;
  },


  // ===================================================
  // MARK WEBHOOK AS SKIPPED
  // ===================================================

  markSkipped: async ({
    eventId,
    reason = null
  }) => {

    const [result] = await db.query(
      `
      UPDATE payment_webhook_logs

      SET
        processing_status = 'skipped',
        error_message = ?

      WHERE event_id = ?
      `,
      [
        reason,
        eventId
      ]
    );

    return result;
  },


  // ===================================================
  // GET ALL WEBHOOK EVENTS
  // ===================================================

  getAll: async () => {

    const [rows] = await db.query(
      `
      SELECT *
      FROM payment_webhook_logs
      ORDER BY created_at DESC
      `
    );

    return rows;
  },


  // ===================================================
  // GET WEBHOOK STATS
  // ===================================================

  getStats: async () => {

    const [rows] = await db.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(
          processing_status = 'processed'
        ) AS processed,
        SUM(
          processing_status = 'failed'
        ) AS failed,
        SUM(
          processing_status = 'skipped'
        ) AS skipped,
        SUM(
          processing_status = 'received'
        ) AS received
      FROM payment_webhook_logs
      `
    );

    return rows[0];
  }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = PaymentWebhookModel;