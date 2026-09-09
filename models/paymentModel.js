const db = require('../config/db');


// =====================================================
// PAYMENT MODEL
// =====================================================

const PaymentModel = {

  // ===================================================
  // CREATE PAYMENT RECORD
  // ===================================================

  createPayment: async ({
    registrationId,
    orderId,
    amount = 249,
    currency = 'INR',
    status = 'pending'
  }) => {

    const [result] = await db.query(
      `
      INSERT INTO payments
      (
        registration_id,
        order_id,
        amount,
        currency,
        status
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        registrationId,
        orderId,
        amount,
        currency,
        status
      ]
    );

    return result.insertId;
  },


  // ===================================================
  // GET PAYMENT BY REGISTRATION ID
  // ===================================================

  getPaymentByRegistrationId: async (registrationId) => {

    const [rows] = await db.query(
      `
      SELECT
        p.*,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,

        w.title AS webinar_title

      FROM payments p

      LEFT JOIN registrations r
        ON p.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE p.registration_id = ?

      ORDER BY p.id DESC

      LIMIT 1
      `,
      [registrationId]
    );

    return rows[0] || null;
  },


  // ===================================================
  // GET PAYMENT BY ORDER ID
  // ===================================================

  getPaymentByOrderId: async (orderId) => {

    const [rows] = await db.query(
      `
      SELECT *
      FROM payments
      WHERE order_id = ?
      LIMIT 1
      `,
      [orderId]
    );

    return rows[0] || null;
  },


  // ===================================================
  // GET PAYMENT BY PAYMENT ID
  // ===================================================

  getPaymentByPaymentId: async (paymentId) => {

    const [rows] = await db.query(
      `
      SELECT *
      FROM payments
      WHERE payment_id = ?
      LIMIT 1
      `,
      [paymentId]
    );

    return rows[0] || null;
  },


  // ===================================================
  // UPDATE PAYMENT ORDER
  // ===================================================
  // Used when an existing pending/failed payment
  // needs a new Razorpay order.
  // ===================================================

  updatePaymentOrder: async ({
    paymentRecordId,
    orderId,
    amount,
    currency = 'INR'
  }) => {

    const [result] = await db.query(
      `
      UPDATE payments

      SET
        order_id = ?,
        amount = ?,
        currency = ?,
        status = 'pending',
        payment_id = NULL,
        method = NULL,
        paid_at = NULL

      WHERE id = ?
      `,
      [
        orderId,
        amount,
        currency,
        paymentRecordId
      ]
    );

    return result;
  },


  // ===================================================
  // UPDATE PAYMENT AFTER VERIFICATION
  // ===================================================

  updatePayment: async ({
    orderId,
    paymentId,
    status,
    method = null
  }) => {

    const [result] = await db.query(
      `
      UPDATE payments

      SET
        payment_id = ?,
        status = ?,
        method = ?,
        paid_at = CASE
          WHEN ? = 'paid'
          THEN NOW()
          ELSE paid_at
        END

      WHERE order_id = ?
      `,
      [
        paymentId,
        status,
        method,
        status,
        orderId
      ]
    );

    return result;
  },


  // ===================================================
  // GET ALL PAYMENTS
  // ===================================================

  getAllPayments: async () => {

    const [rows] = await db.query(
      `
      SELECT
        p.*,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,

        w.title AS webinar_title

      FROM payments p

      LEFT JOIN registrations r
        ON p.registration_id = r.id

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      ORDER BY p.created_at DESC
      `
    );

    return rows;
  }

};


// =====================================================
// EXPORT PAYMENT MODEL
// =====================================================

module.exports = PaymentModel;