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
  sendReminderWhatsApp,
  buildReminderParameters,
  getReminderTemplateName
} = require('../services/reminderWhatsAppService');


const TEST_REGISTRATION_ID =
  17;


const TEST_REMINDER_TYPE =
  'reminder_24h';


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER WHATSAPP SERVICE TEST'
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

      phone:
        registration.phone,

      paymentStatus:
        registration.payment_status,

      webinar:
        registration.webinar_title,

      date:
        registration.webinar_date,

      time:
        registration.webinar_time,

      duration:
        registration.webinar_duration,

      platform:
        registration.webinar_platform,

      zoomMeetingId:
        registration.zoom_meeting_id,

      zoomJoinUrl:
        registration.zoom_join_url,

      zoomPassword:
        registration.zoom_password

    });


    // ==================================================
    // PAYMENT VALIDATION
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
    // PHONE VALIDATION
    // ==================================================

    if (
      !registration.phone
    ) {

      throw new Error(
        'Registration phone number is missing.'
      );

    }


    console.log(
      'PHONE VALIDATION PASSED'
    );


    // ==================================================
    // ZOOM VALIDATION
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
    // TEMPLATE VALIDATION
    // ==================================================

    const templateName =
      getReminderTemplateName(
        TEST_REMINDER_TYPE
      );


    console.log(
      '\nTEMPLATE:',
      templateName
    );


    if (
      templateName !==
      'reminder_24h'
    ) {

      throw new Error(
        'Incorrect 24h WhatsApp template.'
      );

    }


    console.log(
      'TEMPLATE VALIDATION PASSED'
    );


    // ==================================================
    // BUILD PARAMETERS
    // ==================================================

    const parameters =
      buildReminderParameters({

        registration

      });


    console.log(
      '\nTEMPLATE PARAMETERS'
    );


    parameters.forEach(
      (value, index) => {

        console.log(
          `{{${index + 1}}}:`,
          value
        );

      }
    );


    if (
      parameters.length !== 9
    ) {

      throw new Error(
        `Expected 9 parameters. Found ${parameters.length}`
      );

    }


    // ==================================================
    // VALIDATE IMPORTANT PARAMETERS
    // ==================================================

    if (
      parameters[0] !==
      'Vaishnavi Manikeri'
    ) {

      throw new Error(
        'Participant name parameter is incorrect.'
      );

    }


    if (
      parameters[1] !==
      'Abundance Crossroad™'
    ) {

      throw new Error(
        'Webinar title parameter is incorrect.'
      );

    }


    if (
      parameters[6] !==
      registration.zoom_join_url
    ) {

      throw new Error(
        'Zoom Join URL parameter is incorrect.'
      );

    }


    if (
      parameters[7] !==
      registration.zoom_meeting_id
    ) {

      throw new Error(
        'Zoom Meeting ID parameter is incorrect.'
      );

    }


    if (
      parameters[8] !==
      registration.zoom_password
    ) {

      throw new Error(
        'Zoom password parameter is incorrect.'
      );

    }


    console.log(
      'TEMPLATE PARAMETERS VALIDATION PASSED'
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
      '\nOLD TEST REMINDER LOG REMOVED'
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
        'Reminder log creation failed.'
      );

    }


    if (
      reminderLog.whatsapp_status !==
      'pending'
    ) {

      throw new Error(
        'WhatsApp status should initially be pending.'
      );

    }


    console.log(
      'REMINDER LOG VALIDATION PASSED'
    );


    // ==================================================
    // SEND WHATSAPP
    // ==================================================

    console.log(
      '\nSENDING WHATSAPP REMINDER...'
    );


    const result =
      await sendReminderWhatsApp({

        registration,

        reminderLog,

        reminderType:
          TEST_REMINDER_TYPE

      });


    console.log(
      '\nWHATSAPP RESULT'
    );


    console.log(
      result
    );


    // ==================================================
    // RESULT VALIDATION
    // ==================================================

    if (
      result.success !==
      true
    ) {

      throw new Error(
        'WhatsApp reminder was not successful.'
      );

    }


    if (
      result.alreadySent !==
      false
    ) {

      throw new Error(
        'WhatsApp reminder unexpectedly marked as already sent.'
      );

    }


    if (
      result.mock !==
      true
    ) {

      throw new Error(
        'Expected WhatsApp mock mode.'
      );

    }


    if (
      !result.messageId
    ) {

      throw new Error(
        'WhatsApp message ID is missing.'
      );

    }


    if (
      result.parameters.length !==
      9
    ) {

      throw new Error(
        'Incorrect WhatsApp parameter count.'
      );

    }


    if (
      result.zoom.joinUrl !==
      registration.zoom_join_url
    ) {

      throw new Error(
        'Zoom Join URL was not returned correctly.'
      );

    }


    console.log(
      'WHATSAPP REMINDER SEND PASSED'
    );


    console.log(
      'ZOOM JOIN URL INCLUDED'
    );


    // ==================================================
    // CHECK DATABASE
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
      updatedLog.whatsapp_status !==
      'sent'
    ) {

      throw new Error(
        'WhatsApp status was not updated to sent.'
      );

    }


    if (
      !updatedLog.whatsapp_message_id
    ) {

      throw new Error(
        'WhatsApp message ID was not saved.'
      );

    }


    if (
      !updatedLog.whatsapp_sent_at
    ) {

      throw new Error(
        'WhatsApp sent timestamp was not saved.'
      );

    }


    console.log(
      'WHATSAPP LOG UPDATE PASSED'
    );


    // ==================================================
    // DUPLICATE PROTECTION
    // ==================================================

    console.log(
      '\nTESTING DUPLICATE WHATSAPP PROTECTION...'
    );


    const secondResult =
      await sendReminderWhatsApp({

        registration,

        reminderLog:
          updatedLog,

        reminderType:
          TEST_REMINDER_TYPE

      });


    console.log(
      '\nSECOND WHATSAPP RESULT'
    );


    console.log(
      secondResult
    );


    if (
      secondResult.success !==
      true
    ) {

      throw new Error(
        'Duplicate WhatsApp request failed.'
      );

    }


    if (
      secondResult.alreadySent !==
      true
    ) {

      throw new Error(
        'Duplicate WhatsApp protection failed.'
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
      'DUPLICATE WHATSAPP PROTECTION PASSED'
    );


    // ==================================================
    // FINAL DATABASE COUNT
    // ==================================================

    const [countRows] =
      await db.query(

        `
        SELECT COUNT(*) AS total

        FROM webinar_reminder_logs

        WHERE registration_id = ?

        AND reminder_type = ?

        `,

        [

          TEST_REGISTRATION_ID,

          TEST_REMINDER_TYPE

        ]

      );


    console.log(
      'DATABASE REMINDER LOG COUNT:',
      countRows[0].total
    );


    if (
      Number(
        countRows[0].total
      ) !== 1
    ) {

      throw new Error(
        'Multiple reminder logs were created.'
      );

    }


    console.log(
      'ONLY ONE REMINDER LOG EXISTS'
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
    // FINAL
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER WHATSAPP SERVICE TEST PASSED'
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
      'REMINDER WHATSAPP SERVICE TEST FAILED'
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