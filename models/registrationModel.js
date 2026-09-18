const db = require('../config/db');


// ==================================================
// REGISTRATION MODEL
// ==================================================

class RegistrationModel {


  // ==================================================
  // CREATE REGISTRATION
  // ==================================================

  static async createRegistration(data) {

    const connection =
      await db.getConnection();

    try {

      await connection.beginTransaction();


      // ==================================================
      // 1. FIND WEBINAR
      // ==================================================

      let webinarId =
        data.webinarId || null;


      // --------------------------------------------------
      // If webinarId is not supplied,
      // use latest webinar.
      // --------------------------------------------------

      if (!webinarId) {

        const [webinars] =
          await connection.query(
            `
            SELECT *
            FROM webinars
            ORDER BY id DESC
            LIMIT 1
            `
          );

        if (webinars.length > 0) {

          webinarId =
            webinars[0].id;

        }

      }


      // ==================================================
      // 2. MAKE SURE WEBINAR EXISTS
      // ==================================================

      if (!webinarId) {

        throw new Error(
          'No webinar is available for registration.'
        );

      }


      // ==================================================
      // 3. GET COMPLETE WEBINAR
      // ==================================================

      const [webinarRows] =
        await connection.query(
          `
          SELECT
            id,
            title,
            subtitle,
            date,
            time,
            duration,
            language,
            platform,
            price
          FROM webinars
          WHERE id = ?
          LIMIT 1
          `,
          [webinarId]
        );


      if (
        !webinarRows ||
        webinarRows.length === 0
      ) {

        throw new Error(
          'Webinar not found.'
        );

      }


      const webinar =
        webinarRows[0];


      // ==================================================
      // 4. FIND EXISTING LEAD
      // ==================================================

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


      // ==================================================
      // EXISTING LEAD
      // ==================================================

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


      // ==================================================
      // NEW LEAD
      // ==================================================

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


      // ==================================================
      // 5. CREATE WEBINAR SNAPSHOT
      // ==================================================

      const webinarTitle =
        webinar.title || null;

      const webinarSubtitle =
        webinar.subtitle || null;

      const webinarDate =
        webinar.date || null;

      const webinarTime =
        webinar.time || null;

      const webinarDuration =
        webinar.duration || null;

      const webinarLanguage =
        webinar.language || null;

      const webinarPlatform =
        webinar.platform || null;

      const webinarPrice =
        webinar.price !== null &&
        webinar.price !== undefined
          ? Number(webinar.price)
          : null;


      // ==================================================
      // 6. CREATE REGISTRATION
      // ==================================================

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
            consent,

            webinar_title_snapshot,
            webinar_subtitle_snapshot,
            webinar_date_snapshot,
            webinar_time_snapshot,
            webinar_duration_snapshot,
            webinar_language_snapshot,
            webinar_platform_snapshot,
            webinar_price_snapshot
          )
          VALUES (
            ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
          )
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
            data.consent ? 1 : 0,

            webinarTitle,
            webinarSubtitle,
            webinarDate,
            webinarTime,
            webinarDuration,
            webinarLanguage,
            webinarPlatform,
            webinarPrice
          ]
        );


      // ==================================================
      // 7. COMMIT
      // ==================================================

      await connection.commit();


      // ==================================================
      // 8. RETURN REGISTRATION DATA
      // ==================================================

      return {

        leadId,

        registrationId:
          registrationResult.insertId,

        webinarId,

        webinar: {
          id: webinar.id,
          title: webinarTitle,
          subtitle: webinarSubtitle,
          date: webinarDate,
          time: webinarTime,
          duration: webinarDuration,
          language: webinarLanguage,
          platform: webinarPlatform,
          price: webinarPrice
        }

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
      await db.query(
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

          r.webinar_title_snapshot,
          r.webinar_subtitle_snapshot,
          r.webinar_date_snapshot,
          r.webinar_time_snapshot,
          r.webinar_duration_snapshot,
          r.webinar_language_snapshot,
          r.webinar_platform_snapshot,
          r.webinar_price_snapshot,

          r.registered_at,
          r.created_at,
          r.updated_at,

          w.title AS current_webinar_title

        FROM registrations r

        LEFT JOIN webinars w
          ON r.webinar_id = w.id

        ORDER BY r.id DESC
        `
      );


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

          r.webinar_title_snapshot AS webinar_title,
          r.webinar_subtitle_snapshot AS webinar_subtitle,
          r.webinar_date_snapshot AS webinar_date,
          r.webinar_time_snapshot AS webinar_time,
          r.webinar_duration_snapshot AS webinar_duration,
          r.webinar_language_snapshot AS webinar_language,
          r.webinar_platform_snapshot AS webinar_platform,
          r.webinar_price_snapshot AS webinar_price,

          w.title AS current_webinar_title,
          w.date AS current_webinar_date,
          w.time AS current_webinar_time,
          w.price AS current_webinar_price

        FROM registrations r

        LEFT JOIN webinars w
          ON r.webinar_id = w.id

        WHERE r.id = ?

        LIMIT 1
        `,
        [id]
      );


    if (
      !rows ||
      rows.length === 0
    ) {

      return null;

    }


    return rows[0];

  }


  // ==================================================
  // GET REGISTRATION WITH PAYMENT DETAILS
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

          r.webinar_title_snapshot AS webinar_title,
          r.webinar_subtitle_snapshot AS webinar_subtitle,
          r.webinar_date_snapshot AS webinar_date,
          r.webinar_time_snapshot AS webinar_time,
          r.webinar_duration_snapshot AS webinar_duration,
          r.webinar_language_snapshot AS webinar_language,
          r.webinar_platform_snapshot AS webinar_platform,
          r.webinar_price_snapshot AS webinar_price,

          r.webinar_id,

          w.zoom_meeting_id,
          w.zoom_join_url,
          w.zoom_start_url,
          w.zoom_password,
          w.zoom_created_at,

          r.registered_at,
          r.created_at,
          r.updated_at

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
      await db.query(
        `
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
        `
      );


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


// ==================================================
// EXPORT
// ==================================================

module.exports =
  RegistrationModel;