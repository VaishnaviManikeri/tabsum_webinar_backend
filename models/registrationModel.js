const db =
  require('../config/db');


class RegistrationModel {


  // ==================================================
  // CREATE REGISTRATION
  // ==================================================

  static async createRegistration(data) {

    const connection =
      await db.getConnection();


    try {

      await connection.beginTransaction();


      // ------------------------------------------------
      // 1. Find webinar
      // ------------------------------------------------

      let webinarId =
        data.webinarId || null;


      if (!webinarId) {

        const [webinars] =
          await connection.query(`
            SELECT id
            FROM webinars
            ORDER BY id DESC
            LIMIT 1
          `);


        if (webinars.length > 0) {

          webinarId =
            webinars[0].id;

        }

      }


      // ------------------------------------------------
      // Make sure webinar exists
      // ------------------------------------------------

      if (!webinarId) {

        throw new Error(
          'No webinar is available for registration.'
        );

      }


      // ------------------------------------------------
      // 2. Find existing lead
      // ------------------------------------------------

      const [existingLeads] =
        await connection.query(
          `
          SELECT id
          FROM leads
          WHERE email = ?
          LIMIT 1
          `,
          [
            data.email
          ]
        );


      let leadId;


      // =================================================
      // EXISTING LEAD
      // =================================================

      if (
        existingLeads.length > 0
      ) {

        leadId =
          existingLeads[0].id;


        await connection.query(
          `
          UPDATE leads
          SET
            first_name = ?,
            last_name = ?,
            phone = ?,
            city = ?,
            role = ?,
            source = ?,
            lead_status = 'registered'
          WHERE id = ?
          `,
          [

            data.firstName,

            data.lastName,

            data.phone,

            data.city || null,

            data.role || null,

            data.source || 'Website',

            leadId

          ]
        );

      }


      // =================================================
      // NEW LEAD
      // =================================================

      else {

        const [leadResult] =
          await connection.query(
            `
            INSERT INTO leads
            (
              first_name,
              last_name,
              email,
              phone,
              city,
              role,
              source,
              lead_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'registered')
            `,
            [

              data.firstName,

              data.lastName,

              data.email,

              data.phone,

              data.city || null,

              data.role || null,

              data.source || 'Website'

            ]
          );


        leadId =
          leadResult.insertId;

      }


      // ------------------------------------------------
      // 3. Create registration
      // ------------------------------------------------

      const [registrationResult] =
        await connection.query(
          `
          INSERT INTO registrations
          (
            lead_id,
            webinar_id,
            first_name,
            last_name,
            email,
            phone,
            city,
            role,
            goal,
            consent
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [

            leadId,

            webinarId,

            data.firstName,

            data.lastName,

            data.email,

            data.phone,

            data.city || null,

            data.role || null,

            data.goal || null,

            data.consent ? 1 : 0

          ]
        );


      await connection.commit();


      return {

        leadId,

        registrationId:
          registrationResult.insertId,

        webinarId

      };


    } catch (error) {

      await connection.rollback();

      throw error;

    } finally {

      connection.release();

    }

  }


  // ==================================================
  // GET ALL REGISTRATIONS
  // ==================================================

  static async getAllRegistrations() {

    const [rows] =
      await db.query(`
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

          w.title AS webinar_title

        FROM registrations r

        LEFT JOIN webinars w
          ON r.webinar_id = w.id

        ORDER BY r.id DESC
      `);


    return rows;

  }


  // ==================================================
// GET SINGLE REGISTRATION
// ==================================================

static async getRegistrationById(id) {

  const [rows] =
    await db.query(
      `
      SELECT

        r.*,

        w.title AS webinar_title,

        w.date AS webinar_date,

        w.time AS webinar_time,

        w.duration AS webinar_duration,

        w.platform AS webinar_platform,

        w.price AS webinar_price

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE r.id = ?

      LIMIT 1
      `,
      [id]
    );


  // --------------------------------------------------
  // Registration not found
  // --------------------------------------------------

  if (
    !rows ||
    rows.length === 0
  ) {

    return null;

  }


  // --------------------------------------------------
  // Registration found
  // --------------------------------------------------

  return rows[0];

}


  // ==================================================
  // GET REGISTRATION WITH PAYMENT DETAILS
  // ==================================================
  // Used after successful Razorpay payment
  // to prepare confirmation email.
  // ==================================================

  static async getRegistrationWithPaymentDetails(
    registrationId
  ) {

    const [rows] =
      await db.query(
        `
        SELECT

          r.id,

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

          w.title AS webinar_title,

          w.date AS webinar_date,

          w.time AS webinar_time,

          w.duration AS webinar_duration,

          w.platform AS webinar_platform,

          w.price

        FROM registrations r

        LEFT JOIN webinars w
          ON r.webinar_id = w.id

        WHERE r.id = ?

        LIMIT 1
        `,
        [
          registrationId
        ]
      );


    return rows[0] || null;

  }


  // ==================================================
  // GET REGISTRATION STATS
  // ==================================================

  static async getRegistrationStats() {

    const [rows] =
      await db.query(`
        SELECT

          COUNT(*) AS total_registrations,

          SUM(
            registration_status = 'registered'
          ) AS registered,

          SUM(
            registration_status = 'cancelled'
          ) AS cancelled,

          SUM(
            payment_status = 'paid'
          ) AS paid,

          SUM(
            payment_status = 'pending'
          ) AS pending,

          SUM(
            payment_status = 'failed'
          ) AS failed

        FROM registrations
      `);


    return {

      total_registrations:
        Number(
          rows[0]?.total_registrations || 0
        ),

      registered:
        Number(
          rows[0]?.registered || 0
        ),

      cancelled:
        Number(
          rows[0]?.cancelled || 0
        ),

      paid:
        Number(
          rows[0]?.paid || 0
        ),

      pending:
        Number(
          rows[0]?.pending || 0
        ),

      failed:
        Number(
          rows[0]?.failed || 0
        )

    };

  }


  // ==================================================
  // UPDATE PAYMENT STATUS
  // ==================================================

  static async updatePaymentStatus(
    id,
    paymentStatus
  ) {

    const [result] =
      await db.query(
        `
        UPDATE registrations

        SET payment_status = ?

        WHERE id = ?
        `,
        [
          paymentStatus,
          id
        ]
      );


    if (
      result.affectedRows === 0
    ) {

      return null;

    }


    return this.getRegistrationById(
      id
    );

  }


  // ==================================================
  // UPDATE REGISTRATION STATUS
  // ==================================================

  static async updateRegistrationStatus(
    id,
    registrationStatus
  ) {

    const connection =
      await db.getConnection();


    try {

      await connection.beginTransaction();


      // ------------------------------------------------
      // Find registration + lead
      // ------------------------------------------------

      const [registrations] =
        await connection.query(
          `
          SELECT lead_id

          FROM registrations

          WHERE id = ?

          LIMIT 1
          `,
          [id]
        );


      if (
        registrations.length === 0
      ) {

        await connection.rollback();

        return null;

      }


      const leadId =
        registrations[0].lead_id;


      // ------------------------------------------------
      // Update registration
      // ------------------------------------------------

      await connection.query(
        `
        UPDATE registrations

        SET registration_status = ?

        WHERE id = ?
        `,
        [
          registrationStatus,
          id
        ]
      );


      // ------------------------------------------------
      // Update lead status
      // ------------------------------------------------

      let leadStatus =
        'registered';


      if (
        registrationStatus ===
        'cancelled'
      ) {

        leadStatus =
          'lost';

      }


      await connection.query(
        `
        UPDATE leads

        SET lead_status = ?

        WHERE id = ?
        `,
        [
          leadStatus,
          leadId
        ]
      );


      await connection.commit();


      return this.getRegistrationById(
        id
      );


    } catch (error) {

      await connection.rollback();

      throw error;

    } finally {

      connection.release();

    }

  }

}


module.exports =
  RegistrationModel;