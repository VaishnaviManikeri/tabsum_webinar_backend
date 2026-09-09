require('dotenv').config({
  path: require('path').join(
    __dirname,
    '..',
    '.env.local'
  )
});


const db =
  require('../config/db');


const ReminderLogModel =
  require('../models/reminderLogModel');


const {
  sendReminderEmail
} = require('../services/reminderEmailService');


const TEST_REGISTRATION_ID =
  17;


const TEST_REMINDER_TYPE =
  'reminder_24h';


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER EMAIL SERVICE TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // GET REGISTRATION
    // ==================================================

    const [rows] =
      await db.query(

        `
        SELECT

          r.id,

          r.first_name,

          r.last_name,

          r.email,

          r.phone,

          r.registration_status,

          r.payment_status,

          r.webinar_id,

          w.title AS webinar_title,

          DATE_FORMAT(
            w.date,
            '%Y-%m-%d'
          ) AS webinar_date,

          TIME_FORMAT(
            w.time,
            '%H:%i'
          ) AS webinar_time,

          w.duration AS webinar_duration,

          w.platform AS webinar_platform,

          w.zoom_meeting_id,

          w.zoom_join_url,

          w.zoom_start_url,

          w.zoom_password,

          w.zoom_created_at

        FROM registrations r

        INNER JOIN webinars w

          ON r.webinar_id = w.id

        WHERE r.id = ?

        LIMIT 1

        `,

        [TEST_REGISTRATION_ID]

      );


    const registration =
      rows[0];


    if (!registration) {

      throw new Error(
        `Registration ${TEST_REGISTRATION_ID} not found.`
      );

    }


    console.log(
      'REGISTRATION FOUND'
    );


    console.log({

      id:
        registration.id,

      name:
        `${registration.first_name || ''} ${registration.last_name || ''}`.trim(),

      email:
        registration.email,

      paymentStatus:
        registration.payment_status,

      webinar:
        registration.webinar_title,

      date:
        registration.webinar_date,

      time:
        registration.webinar_time,

      zoomMeetingId:
        registration.zoom_meeting_id,

      zoomJoinUrl:
        registration.zoom_join_url,

      zoomPassword:
        registration.zoom_password

    });


    // ==================================================
    // VALIDATE PAYMENT
    // ==================================================

    if (
      registration.payment_status !==
      'paid'
    ) {

      throw new Error(
        'Test registration is not paid.'
      );

    }


    console.log(
      'PAYMENT STATUS VALIDATION PASSED'
    );


    // ==================================================
    // VALIDATE ZOOM
    // ==================================================

    if (
      !registration.zoom_meeting_id
    ) {

      throw new Error(
        'Zoom Meeting ID is missing.'
      );

    }


    if (
      !registration.zoom_join_url
    ) {

      throw new Error(
        'Zoom Join URL is missing.'
      );

    }


    if (
      !registration.zoom_password
    ) {

      throw new Error(
        'Zoom password is missing.'
      );

    }


    console.log(
      'ZOOM DETAILS VALIDATION PASSED'
    );


    // ==================================================
    // REMOVE OLD TEST LOG
    // ==================================================

    await db.query(

      `
      DELETE FROM webinar_reminder_logs

      WHERE registration_id = ?

      AND reminder_type = ?

      `,

      [

        TEST_REGISTRATION_ID,

        TEST_REMINDER_TYPE

      ]

    );


    console.log(
      'OLD TEST REMINDER LOG REMOVED'
    );


    // ==================================================
    // CREATE REMINDER LOG
    // ==================================================

    const reminderLog =
      await ReminderLogModel
        .createOrGetReminderLog({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE,

          scheduledAt:
            '2026-10-14 10:00:00'

        });


    console.log(
      '\nREMINDER LOG CREATED'
    );


    console.log(
      reminderLog
    );


    if (!reminderLog) {

      throw new Error(
        'Unable to create reminder log.'
      );

    }


    if (
      reminderLog.email_status !==
      'pending'
    ) {

      throw new Error(
        'Reminder email should initially be pending.'
      );

    }


    console.log(
      'REMINDER LOG VALIDATION PASSED'
    );


    // ==================================================
    // SEND EMAIL
    // ==================================================

    console.log(
      '\nSENDING REMINDER EMAIL THROUGH AMAZON SES...'
    );


    const result =
      await sendReminderEmail({

        registration,

        reminderLog,

        reminderType:
          TEST_REMINDER_TYPE

      });


    console.log(
      '\nEMAIL RESULT'
    );


    console.log(
      result
    );


    // ==================================================
    // VALIDATE EMAIL RESULT
    // ==================================================

    if (
      !result.success
    ) {

      throw new Error(
        'Reminder email was not successful.'
      );

    }


    if (
      result.alreadySent
    ) {

      throw new Error(
        'Email unexpectedly detected as already sent.'
      );

    }


    if (
      !result.messageId
    ) {

      throw new Error(
        'Email Message ID is missing.'
      );

    }


    if (
      result.zoomIncluded !== true
    ) {

      throw new Error(
        'Zoom details were not included in reminder email.'
      );

    }


    console.log(
      'REMINDER EMAIL SEND PASSED'
    );


    console.log(
      'ZOOM DETAILS INCLUDED IN EMAIL'
    );


    // ==================================================
    // GET UPDATED LOG
    // ==================================================

    const updatedLog =
      await ReminderLogModel
        .getById(

          reminderLog.id

        );


    console.log(
      '\nUPDATED REMINDER LOG'
    );


    console.log(
      updatedLog
    );


    if (
      updatedLog.email_status !==
      'sent'
    ) {

      throw new Error(
        'Reminder email log was not marked as sent.'
      );

    }


    if (
      !updatedLog.email_message_id
    ) {

      throw new Error(
        'Email Message ID was not stored.'
      );

    }


    if (
      !updatedLog.email_sent_at
    ) {

      throw new Error(
        'Email sent timestamp was not stored.'
      );

    }


    console.log(
      'EMAIL LOG UPDATE PASSED'
    );


    // ==================================================
    // DUPLICATE EMAIL TEST
    // ==================================================

    console.log(
      '\nTESTING DUPLICATE EMAIL PROTECTION...'
    );


    const secondResult =
      await sendReminderEmail({

        registration,

        reminderLog:
          updatedLog,

        reminderType:
          TEST_REMINDER_TYPE

      });


    console.log(
      '\nSECOND EMAIL RESULT'
    );


    console.log(
      secondResult
    );


    if (
      secondResult.success !==
      true
    ) {

      throw new Error(
        'Duplicate email request failed.'
      );

    }


    if (
      secondResult.alreadySent !==
      true
    ) {

      throw new Error(
        'Duplicate email protection failed.'
      );

    }


    if (
      secondResult.messageId !==
      result.messageId
    ) {

      throw new Error(
        'Duplicate request returned incorrect message ID.'
      );

    }


    console.log(
      'DUPLICATE EMAIL PROTECTION PASSED'
    );


    // ==================================================
    // CLEAN TEST DATA
    // ==================================================

    await db.query(

      `
      DELETE FROM webinar_reminder_logs

      WHERE registration_id = ?

      AND reminder_type = ?

      `,

      [

        TEST_REGISTRATION_ID,

        TEST_REMINDER_TYPE

      ]

    );


    console.log(
      '\nTEST REMINDER LOG CLEANED UP'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER EMAIL SERVICE TEST PASSED'
    );

    console.log(
      '========================================\n'
    );

  }


  catch (error) {

    console.error(
      '\n========================================'
    );

    console.error(
      'REMINDER EMAIL SERVICE TEST FAILED'
    );

    console.error(
      '========================================'
    );

    console.error(
      error.message
    );


    process.exitCode = 1;

  }

};


runTest();