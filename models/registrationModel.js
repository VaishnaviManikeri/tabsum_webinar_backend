const db = require('../config/db');

class RegistrationModel {

  // =====================================================
  // GET ALL REGISTRATIONS
  // =====================================================

  static async getAllRegistrations(filters = {}) {

    let query = `
      SELECT
        r.id,
        r.lead_id,
        r.webinar_id,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,
        r.consent,

        r.registration_status,
        r.payment_status,

        r.registered_at,
        r.created_at,
        r.updated_at,

        l.lead_status,
        l.source

      FROM registrations r

      LEFT JOIN leads l
        ON r.lead_id = l.id

      WHERE 1 = 1
    `;

    const params = [];


    // =================================================
    // SEARCH
    // =================================================

    if (filters.search) {

      query += `
        AND (
          r.first_name LIKE ?
          OR r.last_name LIKE ?
          OR r.email LIKE ?
          OR r.phone LIKE ?
          OR r.city LIKE ?
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


    // =================================================
    // PAYMENT STATUS FILTER
    // =================================================

    if (
      filters.payment_status &&
      filters.payment_status !== 'all'
    ) {

      query += `
        AND r.payment_status = ?
      `;

      params.push(
        filters.payment_status
      );
    }


    // =================================================
    // REGISTRATION STATUS FILTER
    // =================================================

    if (
      filters.registration_status &&
      filters.registration_status !== 'all'
    ) {

      query += `
        AND r.registration_status = ?
      `;

      params.push(
        filters.registration_status
      );
    }


    query += `
      ORDER BY r.registered_at DESC
    `;


    const [rows] =
      await db.query(
        query,
        params
      );


    return rows;
  }


  // =====================================================
  // GET SINGLE REGISTRATION
  // =====================================================

  static async getRegistrationById(id) {

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.lead_id,
        r.webinar_id,

        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.city,
        r.role,
        r.goal,
        r.consent,

        r.registration_status,
        r.payment_status,

        r.registered_at,
        r.created_at,
        r.updated_at,

        l.lead_status,
        l.source

      FROM registrations r

      LEFT JOIN leads l
        ON r.lead_id = l.id

      WHERE r.id = ?

      LIMIT 1
      `,
      [id]
    );

    return rows[0];
  }


  // =====================================================
  // UPDATE PAYMENT STATUS
  // =====================================================

  static async updatePaymentStatus(
    id,
    paymentStatus
  ) {

    const allowedStatuses = [
      'pending',
      'paid',
      'failed'
    ];


    if (
      !allowedStatuses.includes(
        paymentStatus
      )
    ) {

      throw new Error(
        'Invalid payment status'
      );
    }


    const [result] =
      await db.query(
        `
        UPDATE registrations

        SET
          payment_status = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
          paymentStatus,
          id
        ]
      );


    return result;
  }


  // =====================================================
  // UPDATE REGISTRATION STATUS
  // =====================================================

  static async updateRegistrationStatus(
    id,
    registrationStatus
  ) {

    const allowedStatuses = [
      'registered',
      'cancelled'
    ];


    if (
      !allowedStatuses.includes(
        registrationStatus
      )
    ) {

      throw new Error(
        'Invalid registration status'
      );
    }


    const [result] =
      await db.query(
        `
        UPDATE registrations

        SET
          registration_status = ?,
          updated_at = CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
          registrationStatus,
          id
        ]
      );


    return result;
  }


  // =====================================================
  // REGISTRATION STATISTICS
  // =====================================================

  static async getStats() {

    const [rows] = await db.query(
      `
      SELECT

        COUNT(*) AS total,

        SUM(
          registration_status = 'registered'
        ) AS registered,

        SUM(
          registration_status = 'cancelled'
        ) AS cancelled,

        SUM(
          payment_status = 'pending'
        ) AS payment_pending,

        SUM(
          payment_status = 'paid'
        ) AS payment_paid,

        SUM(
          payment_status = 'failed'
        ) AS payment_failed

      FROM registrations
      `
    );


    return rows[0];
  }

}


module.exports = RegistrationModel;