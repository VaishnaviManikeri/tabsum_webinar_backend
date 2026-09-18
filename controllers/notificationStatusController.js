const db = require('../config/db');

const getNotificationStatuses = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        r.id AS registration_id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.payment_status,
        r.registration_status,
        r.webinar_title_snapshot,
        r.webinar_date_snapshot,
        r.webinar_time_snapshot,

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
        ), 'not_created') AS confirmation_whatsapp_status,

        rl.id AS reminder_id,
        rl.reminder_type,
        rl.scheduled_at,
        COALESCE(rl.email_status, 'not_created') AS reminder_email_status,
        COALESCE(rl.whatsapp_status, 'not_created') AS reminder_whatsapp_status,
        rl.email_sent_at AS reminder_email_sent_at,
        rl.whatsapp_sent_at AS reminder_whatsapp_sent_at,
        rl.error_message AS reminder_error_message

      FROM registrations r

      LEFT JOIN webinar_reminder_logs rl
        ON rl.registration_id = r.id

      ORDER BY r.id DESC, rl.scheduled_at ASC, rl.id ASC
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Get notification statuses error:', error);

    return res.status(500).json({
      success: false,
      message: 'Unable to load notification statuses.'
    });
  }
};

module.exports = {
  getNotificationStatuses
};