const db = require('../config/db');

class AttendanceModel {

  static async getWebinar(webinarId = null) {
    const query = webinarId
      ? `
        SELECT
          id,
          title,
          date,
          time,
          duration,
          zoom_meeting_id,
          recording_url
        FROM webinars
        WHERE id = ?
        LIMIT 1
      `
      : `
        SELECT
          id,
          title,
          date,
          time,
          duration,
          zoom_meeting_id,
          recording_url
        FROM webinars
        ORDER BY id DESC
        LIMIT 1
      `;

    const [rows] = await db.query(
      query,
      webinarId ? [webinarId] : []
    );

    return rows[0] || null;
  }

  static async getPaidRegistrations(webinarId) {
    const [rows] = await db.query(
      `
      SELECT
        id,
        webinar_id,
        first_name,
        last_name,
        email
      FROM registrations
      WHERE webinar_id = ?
        AND registration_status = 'registered'
        AND payment_status = 'paid'
      ORDER BY id ASC
      `,
      [webinarId]
    );

    return rows;
  }

  static async setWebinarRecording(
    webinarId,
    recordingUrl
  ) {
    const webinar = await this.getWebinar(webinarId);

    if (!webinar) {
      return null;
    }

    await db.query(
      `
      UPDATE webinars
      SET
        recording_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [recordingUrl, webinarId]
    );

    return this.getWebinar(webinarId);
  }

  static async getDashboard(webinarId = null) {
    const webinar = await this.getWebinar(webinarId);

    if (!webinar) {
      return null;
    }

    const [summaryRows] = await db.query(
      `
      SELECT
        SUM(
          r.registration_status = 'registered'
        ) AS registered_count,
        SUM(
          r.registration_status = 'registered'
          AND r.payment_status = 'paid'
        ) AS paid_count,
        SUM(
          r.registration_status = 'registered'
          AND r.payment_status = 'paid'
          AND a.attendance_status = 'attended'
        ) AS attended_count,
        SUM(
          r.registration_status = 'registered'
          AND r.payment_status = 'paid'
          AND a.attendance_status = 'absent'
        ) AS absent_count,
        SUM(
          r.registration_status = 'registered'
          AND r.payment_status = 'paid'
          AND (
            a.attendance_status IS NULL
            OR a.attendance_status = 'pending'
          )
        ) AS pending_count,
        SUM(
          r.registration_status = 'registered'
          AND r.payment_status = 'paid'
          AND a.recording_email_status = 'sent'
        ) AS recording_sent_count
      FROM registrations r
      LEFT JOIN webinar_attendance a
        ON a.registration_id = r.id
      WHERE r.webinar_id = ?
      `,
      [webinar.id]
    );

    const [registrations] = await db.query(
      `
      SELECT
        r.id AS registration_id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.payment_status,
        r.registration_status,
        r.registered_at,
        COALESCE(a.attendance_status, 'pending') AS attendance_status,
        a.attendance_source,
        a.participant_email,
        a.joined_at,
        a.left_at,
        a.duration_minutes,
        a.last_synced_at,
        COALESCE(
          a.recording_email_status,
          'not_required'
        ) AS recording_email_status,
        a.recording_email_sent_at,
        a.recording_email_error,
        COALESCE((
          SELECT el.status
          FROM email_logs el
          WHERE el.registration_id = r.id
            AND el.email_type = 'registration_confirmation'
          ORDER BY el.id DESC
          LIMIT 1
        ), 'not_created') AS confirmation_email_status,
        COALESCE((
          SELECT wl.status
          FROM whatsapp_logs wl
          WHERE wl.registration_id = r.id
            AND wl.whatsapp_type = 'registration_confirmation'
          ORDER BY wl.id DESC
          LIMIT 1
        ), 'not_created') AS confirmation_whatsapp_status
      FROM registrations r
      LEFT JOIN webinar_attendance a
        ON a.registration_id = r.id
      WHERE r.webinar_id = ?
        AND r.registration_status = 'registered'
        AND r.payment_status = 'paid'
      ORDER BY r.registered_at DESC, r.id DESC
      `,
      [webinar.id]
    );

    const summary = summaryRows[0] || {};

    return {
      webinar,
      summary: {
        registered: Number(summary.registered_count) || 0,
        paid: Number(summary.paid_count) || 0,
        attended: Number(summary.attended_count) || 0,
        absent: Number(summary.absent_count) || 0,
        pending: Number(summary.pending_count) || 0,
        recordingSent: Number(summary.recording_sent_count) || 0
      },
      registrations
    };
  }

  static async applyZoomAttendance(
    webinarId,
    matchedParticipants,
    {
      finalize = true
    } = {}
  ) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Only a completed-meeting report can classify a registrant as absent.
      // A live refresh merely adds people who have joined so far.
      if (finalize) {
        await connection.query(
          `
        INSERT INTO webinar_attendance (
          registration_id,
          webinar_id,
          attendance_status,
          attendance_source,
          last_synced_at,
          recording_email_status
        )
        SELECT
          r.id,
          r.webinar_id,
          'absent',
          'zoom',
          NOW(),
          'pending'
        FROM registrations r
        WHERE r.webinar_id = ?
          AND r.registration_status = 'registered'
          AND r.payment_status = 'paid'
        ON DUPLICATE KEY UPDATE
          recording_email_status = IF(
            attendance_source = 'manual'
            AND attendance_status = 'attended',
            recording_email_status,
            IF(
              recording_email_status = 'sent',
              'sent',
              'pending'
            )
          ),
          attendance_status = IF(
            attendance_source = 'manual',
            attendance_status,
            'absent'
          ),
          attendance_source = IF(
            attendance_source = 'manual',
            attendance_source,
            'zoom'
          ),
          last_synced_at = NOW()
          `,
          [webinarId]
        );
      }

      for (const participant of matchedParticipants) {
        await connection.query(
          `
          INSERT INTO webinar_attendance (
            registration_id,
            webinar_id,
            attendance_status,
            attendance_source,
            participant_email,
            joined_at,
            left_at,
            duration_minutes,
            last_synced_at,
            recording_email_status
          )
          VALUES (?, ?, 'attended', 'zoom', ?, ?, ?, ?, NOW(), 'not_required')
          ON DUPLICATE KEY UPDATE
            participant_email = IF(
              attendance_source = 'manual',
              participant_email,
              VALUES(participant_email)
            ),
            joined_at = IF(
              attendance_source = 'manual',
              joined_at,
              VALUES(joined_at)
            ),
            left_at = IF(
              attendance_source = 'manual',
              left_at,
              VALUES(left_at)
            ),
            duration_minutes = IF(
              attendance_source = 'manual',
              duration_minutes,
              VALUES(duration_minutes)
            ),
            attendance_status = IF(
              attendance_source = 'manual',
              attendance_status,
              'attended'
            ),
            attendance_source = IF(
              attendance_source = 'manual',
              attendance_source,
              'zoom'
            ),
            last_synced_at = NOW(),
            recording_email_status = IF(
              attendance_source = 'manual'
              AND attendance_status = 'absent',
              recording_email_status,
              'not_required'
            )
          `,
          [
            participant.registrationId,
            webinarId,
            participant.email,
            participant.joinedAt,
            participant.leftAt,
            participant.durationMinutes
          ]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async setManualAttendance(
    registrationId,
    attendanceStatus
  ) {
    const [registrations] = await db.query(
      `
      SELECT id, webinar_id
      FROM registrations
      WHERE id = ?
        AND registration_status = 'registered'
        AND payment_status = 'paid'
      LIMIT 1
      `,
      [registrationId]
    );

    const registration = registrations[0];

    if (!registration) {
      return null;
    }

    await db.query(
      `
      INSERT INTO webinar_attendance (
        registration_id,
        webinar_id,
        attendance_status,
        attendance_source,
        last_synced_at,
        recording_email_status
      )
      VALUES (?, ?, ?, 'manual', NOW(), ?)
      ON DUPLICATE KEY UPDATE
        attendance_status = VALUES(attendance_status),
        attendance_source = 'manual',
        last_synced_at = NOW(),
        recording_email_status = IF(
          VALUES(attendance_status) = 'absent',
          IF(recording_email_status = 'sent', 'sent', 'pending'),
          'not_required'
        )
      `,
      [
        registration.id,
        registration.webinar_id,
        attendanceStatus,
        attendanceStatus === 'absent'
          ? 'pending'
          : 'not_required'
      ]
    );

    return registration;
  }

  static async getWebinarsReadyForAttendanceSync() {
    const [rows] = await db.query(
      `
      SELECT DISTINCT
        w.id,
        w.title,
        w.date,
        w.time,
        w.zoom_meeting_id
      FROM webinars w
      INNER JOIN registrations r
        ON r.webinar_id = w.id
        AND r.registration_status = 'registered'
        AND r.payment_status = 'paid'
      WHERE w.zoom_meeting_id IS NOT NULL
        AND w.zoom_meeting_id <> ''
        AND w.date REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND STR_TO_DATE(w.date, '%Y-%m-%d') <= CURDATE()
      ORDER BY w.id ASC
      `
    );

    return rows;
  }

  static async getRecordingRecipients(webinarId) {
    const [rows] = await db.query(
      `
      SELECT
        a.id AS attendance_id,
        a.registration_id,
        r.first_name,
        r.last_name,
        r.email,
        w.id AS webinar_id,
        w.title AS webinar_title,
        w.zoom_meeting_id
      FROM webinar_attendance a
      INNER JOIN registrations r
        ON r.id = a.registration_id
      INNER JOIN webinars w
        ON w.id = a.webinar_id
      WHERE a.webinar_id = ?
        AND a.attendance_status = 'absent'
        AND a.recording_email_status IN ('pending', 'failed')
        AND a.recording_email_retry_count < 3
        AND r.registration_status = 'registered'
        AND r.payment_status = 'paid'
      ORDER BY a.id ASC
      `,
      [webinarId]
    );

    return rows;
  }

  static async markRecordingEmailSent(
    attendanceId,
    recordingUrl,
    messageId = null
  ) {
    await db.query(
      `
      UPDATE webinar_attendance
      SET
        recording_email_status = 'sent',
        recording_url = ?,
        recording_email_message_id = ?,
        recording_email_sent_at = NOW(),
        recording_email_error = NULL
      WHERE id = ?
      `,
      [recordingUrl, messageId, attendanceId]
    );
  }

  static async markRecordingEmailFailed(
    attendanceId,
    errorMessage
  ) {
    await db.query(
      `
      UPDATE webinar_attendance
      SET
        recording_email_status = 'failed',
        recording_email_retry_count = recording_email_retry_count + 1,
        recording_email_error = ?
      WHERE id = ?
      `,
      [errorMessage, attendanceId]
    );
  }
}

module.exports = AttendanceModel;
