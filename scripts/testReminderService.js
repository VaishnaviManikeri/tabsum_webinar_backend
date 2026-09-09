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
  calculateReminderTimes,
  createReminderLogsForRegistration,
  isValidDateString,
  isValidTimeString
} = require('../services/reminderService');


const TEST_REGISTRATION_ID =
  17;


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER SERVICE TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // GET REGISTRATION + WEBINAR
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
    // VALIDATE DATE/TIME
    // ==================================================

    if (
      !isValidDateString(
        registration.webinar_date
      )
    ) {

      throw new Error(
        'Webinar date validation failed.'
      );

    }


    if (
      !isValidTimeString(
        registration.webinar_time
      )
    ) {

      throw new Error(
        'Webinar time validation failed.'
      );

    }


    console.log(
      '\nWEBINAR DATE/TIME VALIDATION PASSED'
    );


    // ==================================================
    // CALCULATE REMINDER TIMES
    // ==================================================

    const reminderTimes =
      calculateReminderTimes({

        webinarDate:
          registration.webinar_date,

        webinarTime:
          registration.webinar_time

      });


    console.log(
      '\nCALCULATED REMINDER TIMES'
    );


    console.log({

      webinar:
        reminderTimes.webinarDateTimeMySQL,

      reminder_24h:
        reminderTimes.reminder_24h,

      reminder_3h:
        reminderTimes.reminder_3h,

      reminder_30m:
        reminderTimes.reminder_30m

    });


    // ==================================================
    // EXPECTED TIMES
    // ==================================================

    const expectedWebinar =
      '2026-10-15 10:00:00';

    const expected24h =
      '2026-10-14 10:00:00';

    const expected3h =
      '2026-10-15 07:00:00';

    const expected30m =
      '2026-10-15 09:30:00';


    if (
      reminderTimes.webinarDateTimeMySQL !==
      expectedWebinar
    ) {

      throw new Error(
        `Webinar time mismatch. Expected ${expectedWebinar}, got ${reminderTimes.webinarDateTimeMySQL}`
      );

    }


    if (
      reminderTimes.reminder_24h !==
      expected24h
    ) {

      throw new Error(
        `24h reminder mismatch. Expected ${expected24h}, got ${reminderTimes.reminder_24h}`
      );

    }


    if (
      reminderTimes.reminder_3h !==
      expected3h
    ) {

      throw new Error(
        `3h reminder mismatch. Expected ${expected3h}, got ${reminderTimes.reminder_3h}`
      );

    }


    if (
      reminderTimes.reminder_30m !==
      expected30m
    ) {

      throw new Error(
        `30m reminder mismatch. Expected ${expected30m}, got ${reminderTimes.reminder_30m}`
      );

    }


    console.log(
      'REMINDER TIME CALCULATION PASSED'
    );


    // ==================================================
    // CLEAN OLD TEST REMINDER LOGS
    // ==================================================

    await db.query(

      `
      DELETE FROM webinar_reminder_logs

      WHERE registration_id = ?
      `,

      [TEST_REGISTRATION_ID]

    );


    console.log(
      '\nOLD TEST REMINDER LOGS REMOVED'
    );


    // ==================================================
    // CREATE REMINDER LOGS
    // ==================================================

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


    if (
      !result.success
    ) {

      throw new Error(
        'Reminder creation failed.'
      );

    }


    if (
      result.skipped
    ) {

      throw new Error(
        `Registration was unexpectedly skipped: ${result.reason}`
      );

    }


    if (
      result.reminders.length !== 3
    ) {

      throw new Error(
        `Expected 3 reminders. Found ${result.reminders.length}`
      );

    }


    console.log(
      'THREE REMINDER LOGS CREATED'
    );


    // ==================================================
    // VALIDATE REMINDER TYPES
    // ==================================================

    const reminderTypes =
      result.reminders.map(
        reminder =>
          reminder.reminderType
      );


    const expectedTypes = [

      'reminder_24h',

      'reminder_3h',

      'reminder_30m'

    ];


    for (
      const type
      of expectedTypes
    ) {

      if (
        !reminderTypes.includes(
          type
        )
      ) {

        throw new Error(
          `Missing reminder type: ${type}`
        );

      }

    }


    console.log(
      'REMINDER TYPES VALIDATION PASSED'
    );


    // ==================================================
    // FETCH DATABASE LOGS
    // ==================================================

    const [logs] =
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

        ORDER BY scheduled_at ASC

        `,

        [TEST_REGISTRATION_ID]

      );


    console.log(
      '\nDATABASE REMINDER LOGS'
    );


    console.log(
      logs
    );


    if (
      logs.length !== 3
    ) {

      throw new Error(
        `Expected 3 database logs. Found ${logs.length}`
      );

    }


    // ==================================================
    // VALIDATE PENDING STATUS
    // ==================================================

    for (
      const log
      of logs
    ) {

      if (
        log.email_status !==
        'pending'
      ) {

        throw new Error(
          `Email status is not pending for ${log.reminder_type}`
        );

      }


      if (
        log.whatsapp_status !==
        'pending'
      ) {

        throw new Error(
          `WhatsApp status is not pending for ${log.reminder_type}`
        );

      }

    }


    console.log(
      'PENDING STATUS VALIDATION PASSED'
    );


    // ==================================================
    // DUPLICATE PROTECTION
    // ==================================================

    const duplicateResult =
      await createReminderLogsForRegistration(
        registration
      );


    console.log(
      '\nDUPLICATE CREATE RESULT'
    );


    console.log(
      duplicateResult
    );


    if (
      !duplicateResult.success
    ) {

      throw new Error(
        'Duplicate reminder creation failed.'
      );

    }


    // ==================================================
    // CHECK FINAL COUNT
    // ==================================================

    const [finalLogs] =
      await db.query(

        `
        SELECT COUNT(*) AS total

        FROM webinar_reminder_logs

        WHERE registration_id = ?
        `,

        [TEST_REGISTRATION_ID]

      );


    console.log(
      'FINAL REMINDER LOG COUNT:',
      finalLogs[0].total
    );


    if (
      Number(
        finalLogs[0].total
      ) !== 3
    ) {

      throw new Error(
        'Duplicate reminder logs were created.'
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

      [TEST_REGISTRATION_ID]

    );


    console.log(
      '\nTEST REMINDER LOGS CLEANED UP'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER SERVICE TEST PASSED'
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
      'REMINDER SERVICE TEST FAILED'
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