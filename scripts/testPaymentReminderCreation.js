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
  createReminderLogsForRegistration
} =
  require('../services/reminderService');


const TEST_REGISTRATION_ID =
  60;


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'PAYMENT → REMINDER CREATION TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // REMOVE EXISTING TEST REMINDERS
    // ==================================================

    await db.query(
      `
      DELETE FROM webinar_reminder_logs

      WHERE registration_id = ?
      `,
      [
        TEST_REGISTRATION_ID
      ]
    );


    console.log(
      'OLD TEST REMINDERS REMOVED'
    );


    // ==================================================
    // GET PAID REGISTRATION
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


    console.log(
      '\nTEST REGISTRATION'
    );

    console.log({

      id:
        registration.id,

      name:
        `${registration.first_name} ${registration.last_name}`,

      email:
        registration.email,

      paymentStatus:
        registration.payment_status,

      registrationStatus:
        registration.registration_status,

      webinar:
        registration.webinar_title,

      date:
        registration.webinar_date,

      time:
        registration.webinar_time

    });


    // ==================================================
    // PAYMENT VALIDATION
    // ==================================================

    if (
      registration.payment_status !==
      'paid'
    ) {

      throw new Error(
        'Registration payment status is not paid.'
      );

    }


    if (
      registration.registration_status !==
      'registered'
    ) {

      throw new Error(
        'Registration status is not registered.'
      );

    }


    console.log(
      'PAID REGISTRATION VALIDATION PASSED'
    );


    // ==================================================
    // CREATE REMINDERS
    // ==================================================

    console.log(
      '\nCREATING REMINDER LOGS...'
    );


    const result =
      await createReminderLogsForRegistration(
        registration
      );


    console.log(
      '\nREMINDER CREATION RESULT'
    );

    console.log(
      result
    );


    // ==================================================
    // VALIDATE RESULT
    // ==================================================

    if (
      result.success !==
      true
    ) {

      throw new Error(
        'Reminder creation was not successful.'
      );

    }


    if (
      result.created !==
      3
    ) {

      throw new Error(
        `Expected 3 reminders to be created, but got ${result.created}.`
      );

    }


    if (
      !Array.isArray(
        result.reminders
      )
    ) {

      throw new Error(
        'Reminder details array is missing.'
      );

    }


    if (
      result.reminders.length !==
      3
    ) {

      throw new Error(
        `Expected 3 reminder details, but got ${result.reminders.length}.`
      );

    }


    console.log(
      '24H + 3H + 30M REMINDERS CREATED'
    );


    // ==================================================
    // VALIDATE TYPES
    // ==================================================

    const reminderTypes =
      result.reminders
        .map(
          reminder =>
            reminder.reminderType
        )
        .sort();


    const expectedTypes = [

      'reminder_24h',

      'reminder_30m',

      'reminder_3h'

    ];


    if (
      JSON.stringify(
        reminderTypes
      ) !==
      JSON.stringify(
        expectedTypes
      )
    ) {

      throw new Error(
        `Reminder types mismatch: ${JSON.stringify(reminderTypes)}`
      );

    }


    console.log(
      'REMINDER TYPES VALIDATION PASSED'
    );


    // ==================================================
    // DATABASE VALIDATION
    // ==================================================

    const [dbRows] =
      await db.query(
        `
        SELECT

          id,

          registration_id,

          reminder_type,

          email_status,

          whatsapp_status,

          scheduled_at

        FROM webinar_reminder_logs

        WHERE registration_id = ?

        ORDER BY reminder_type ASC
        `,
        [
          TEST_REGISTRATION_ID
        ]
      );


    console.log(
      '\nDATABASE REMINDER LOGS'
    );

    console.log(
      dbRows
    );


    if (
      dbRows.length !==
      3
    ) {

      throw new Error(
        `Expected 3 database reminder logs, found ${dbRows.length}.`
      );

    }


    // ==================================================
    // VALIDATE PENDING STATUS
    // ==================================================

    for (
      const reminder of dbRows
    ) {

      if (
        reminder.email_status !==
        'pending'
      ) {

        throw new Error(
          `Email status for ${reminder.reminder_type} is not pending.`
        );

      }


      if (
        reminder.whatsapp_status !==
        'pending'
      ) {

        throw new Error(
          `WhatsApp status for ${reminder.reminder_type} is not pending.`
        );

      }

    }


    console.log(
      'DATABASE REMINDER STATUS VALIDATION PASSED'
    );


    // ==================================================
    // DUPLICATE PROTECTION TEST
    // ==================================================

    console.log(
      '\nTESTING DUPLICATE REMINDER PROTECTION...'
    );


    const secondResult =
      await createReminderLogsForRegistration(
        registration
      );


    console.log(
      '\nSECOND CREATION RESULT'
    );

    console.log(
      secondResult
    );


    const [afterSecondRows] =
      await db.query(
        `
        SELECT

          id,

          registration_id,

          reminder_type

        FROM webinar_reminder_logs

        WHERE registration_id = ?

        ORDER BY id ASC
        `,
        [
          TEST_REGISTRATION_ID
        ]
      );


    if (
      afterSecondRows.length !==
      3
    ) {

      throw new Error(
        `Duplicate protection failed. Expected 3 logs, found ${afterSecondRows.length}.`
      );

    }


    console.log(
      'DUPLICATE REMINDER PROTECTION PASSED'
    );


    // ==================================================
    // CLEAN TEST DATA
    // ==================================================

    await db.query(
      `
      DELETE FROM webinar_reminder_logs

      WHERE registration_id = ?
      `,
      [
        TEST_REGISTRATION_ID
      ]
    );


    console.log(
      '\nTEST REMINDERS CLEANED UP'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'PAYMENT → REMINDER CREATION TEST PASSED'
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
      'PAYMENT → REMINDER CREATION TEST FAILED'
    );

    console.error(
      '========================================'
    );

    console.error(
      error.message
    );


    // Try to clean test data
    try {

      await db.query(
        `
        DELETE FROM webinar_reminder_logs

        WHERE registration_id = ?
        `,
        [
          TEST_REGISTRATION_ID
        ]
      );

      console.log(
        'TEST DATA CLEANED AFTER FAILURE'
      );

    }

    catch (cleanupError) {

      console.error(
        'Cleanup error:',
        cleanupError.message
      );

    }


    process.exitCode =
      1;

  }

};


runTest();