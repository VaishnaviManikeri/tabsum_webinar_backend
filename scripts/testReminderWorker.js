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
  processReminder
} = require('../services/reminderWorker');

const TEST_REGISTRATION_ID =
  61;

const TEST_REMINDER_TYPE =
  'reminder_30m';

const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER WORKER TEST'
  );

  console.log(
    '========================================\n'
  );

  try {

    // ==================================================
    // REMOVE OLD TEST
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
      'OLD TEST REMINDER REMOVED'
    );


    // ==================================================
    // GET REGISTRATION + WEBINAR
    // ==================================================

    const [rows] =
      await db.query(
        `
        SELECT

          r.id AS registration_id,

          r.first_name,

          r.last_name,

          r.email,

          r.phone,

          r.payment_status,

          r.registration_status,

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
        [
          TEST_REGISTRATION_ID
        ]
      );


    const registration =
      rows[0];


    if (!registration) {

      throw new Error(
        'Test registration not found.'
      );

    }


    // ==================================================
    // CREATE TEST REMINDER
    // ==================================================

    const reminderLog =
      await ReminderLogModel
        .createOrGetReminderLog({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE,

          scheduledAt:
            '2026-10-15 09:30:00'

        });


    console.log(
      '\nTEST REMINDER CREATED'
    );

    console.log(
      reminderLog
    );


    // ==================================================
    // GET FULL REMINDER
    // ==================================================

    const fullReminder =
      await ReminderLogModel
        .getById(
          reminderLog.id
        );


    if (!fullReminder) {

      throw new Error(
        `Created reminder ${reminderLog.id} could not be fetched.`
      );

    }


    // ==================================================
    // BUILD REMINDER OBJECT SAFELY
    // ==================================================

    const reminder = {

      id:
        fullReminder.id,

      registration_id:
        fullReminder.registration_id,

      reminder_type:
        fullReminder.reminder_type,

      email_status:
        fullReminder.email_status,

      whatsapp_status:
        fullReminder.whatsapp_status,

      email_message_id:
        fullReminder.email_message_id,

      whatsapp_message_id:
        fullReminder.whatsapp_message_id,

      email_sent_at:
        fullReminder.email_sent_at,

      whatsapp_sent_at:
        fullReminder.whatsapp_sent_at,

      retry_count:
        fullReminder.retry_count,

      error_message:
        fullReminder.error_message,

      scheduled_at:
        fullReminder.scheduled_at,

      created_at:
        fullReminder.created_at,

      updated_at:
        fullReminder.updated_at,

      first_name:
        registration.first_name,

      last_name:
        registration.last_name,

      email:
        registration.email,

      phone:
        registration.phone,

      payment_status:
        registration.payment_status,

      registration_status:
        registration.registration_status,

      webinar_id:
        registration.webinar_id,

      webinar_title:
        registration.webinar_title,

      webinar_date:
        registration.webinar_date,

      webinar_time:
        registration.webinar_time,

      webinar_duration:
        registration.webinar_duration,

      webinar_platform:
        registration.webinar_platform,

      zoom_meeting_id:
        registration.zoom_meeting_id,

      zoom_join_url:
        registration.zoom_join_url,

      zoom_start_url:
        registration.zoom_start_url,

      zoom_password:
        registration.zoom_password,

      zoom_created_at:
        registration.zoom_created_at

    };


    // ==================================================
    // VALIDATE IDs BEFORE PROCESSING
    // ==================================================

    console.log(
      '\nREMINDER OBJECT VALIDATION'
    );

    console.log({
      reminderId:
        reminder.id,

      registrationId:
        reminder.registration_id,

      reminderType:
        reminder.reminder_type
    });


    if (
      reminder.id !==
      reminderLog.id
    ) {

      throw new Error(
        `Reminder ID mismatch. Expected ${reminderLog.id}, got ${reminder.id}.`
      );

    }


    if (
      reminder.registration_id !==
      TEST_REGISTRATION_ID
    ) {

      throw new Error(
        `Registration ID mismatch. Expected ${TEST_REGISTRATION_ID}, got ${reminder.registration_id}.`
      );

    }


    console.log(
      'REMINDER ID VALIDATION PASSED'
    );


    // ==================================================
    // PROCESS REMINDER
    // ==================================================

    console.log(
      '\nPROCESSING TEST REMINDER...'
    );


    const result =
      await processReminder(
        reminder
      );


    console.log(
      '\nWORKER RESULT'
    );

    console.log(
      result
    );


    // ==================================================
    // VALIDATE BOTH CHANNELS
    // ==================================================

    if (
      result.complete !==
      true
    ) {

      throw new Error(
        'Reminder worker did not complete both channels.'
      );

    }


    console.log(
      'EMAIL + WHATSAPP PROCESSING PASSED'
    );


    // ==================================================
    // DATABASE VALIDATION
    // ==================================================

    const finalLog =
      await ReminderLogModel
        .getById(
          reminderLog.id
        );


    console.log(
      '\nFINAL REMINDER LOG'
    );

    console.log(
      finalLog
    );


    if (!finalLog) {

      throw new Error(
        `Final reminder ${reminderLog.id} was not found.`
      );

    }


    if (
      finalLog.email_status !==
      'sent'
    ) {

      throw new Error(
        'Email status is not sent.'
      );

    }


    if (
      finalLog.whatsapp_status !==
      'sent'
    ) {

      throw new Error(
        'WhatsApp status is not sent.'
      );

    }


    if (
      !finalLog.email_message_id
    ) {

      throw new Error(
        'Email message ID missing.'
      );

    }


    if (
      !finalLog.whatsapp_message_id
    ) {

      throw new Error(
        'WhatsApp message ID missing.'
      );

    }


    console.log(
      'DATABASE STATUS VALIDATION PASSED'
    );


    // ==================================================
    // DUPLICATE WORKER TEST
    // ==================================================

    console.log(
      '\nTESTING WORKER DUPLICATE PROTECTION...'
    );


    const secondRun =
      await processReminder({

        id:
          finalLog.id,

        registration_id:
          finalLog.registration_id,

        reminder_type:
          finalLog.reminder_type,

        email_status:
          finalLog.email_status,

        whatsapp_status:
          finalLog.whatsapp_status,

        email_message_id:
          finalLog.email_message_id,

        whatsapp_message_id:
          finalLog.whatsapp_message_id,

        email_sent_at:
          finalLog.email_sent_at,

        whatsapp_sent_at:
          finalLog.whatsapp_sent_at,

        retry_count:
          finalLog.retry_count,

        error_message:
          finalLog.error_message,

        scheduled_at:
          finalLog.scheduled_at,

        first_name:
          registration.first_name,

        last_name:
          registration.last_name,

        email:
          registration.email,

        phone:
          registration.phone,

        payment_status:
          registration.payment_status,

        registration_status:
          registration.registration_status,

        webinar_id:
          registration.webinar_id,

        webinar_title:
          registration.webinar_title,

        webinar_date:
          registration.webinar_date,

        webinar_time:
          registration.webinar_time,

        webinar_duration:
          registration.webinar_duration,

        webinar_platform:
          registration.webinar_platform,

        zoom_meeting_id:
          registration.zoom_meeting_id,

        zoom_join_url:
          registration.zoom_join_url,

        zoom_start_url:
          registration.zoom_start_url,

        zoom_password:
          registration.zoom_password,

        zoom_created_at:
          registration.zoom_created_at

      });


    console.log(
      '\nSECOND WORKER RESULT'
    );

    console.log(
      secondRun
    );


    if (
      secondRun.complete !==
      true
    ) {

      throw new Error(
        'Second worker run should remain complete.'
      );

    }


    console.log(
      'WORKER DUPLICATE PROTECTION PASSED'
    );


    // ==================================================
    // CLEAN TEST DATA
    // ==================================================

    await db.query(
      `
      DELETE FROM webinar_reminder_logs
      WHERE id = ?
      `,
      [
        reminderLog.id
      ]
    );


    console.log(
      '\nTEST REMINDER CLEANED UP'
    );


    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER WORKER TEST PASSED'
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
      'REMINDER WORKER TEST FAILED'
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