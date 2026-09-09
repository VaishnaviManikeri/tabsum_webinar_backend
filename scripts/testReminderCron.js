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


const TEST_REGISTRATION_ID =
  17;

const TEST_REMINDER_TYPE =
  'reminder_30m';


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'AUTOMATIC REMINDER CRON TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // REMOVE OLD TEST REMINDER
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
    // VERIFY TEST REGISTRATION
    // ==================================================

    const [registrationRows] =
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

          w.date AS webinar_date,

          w.time AS webinar_time

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
      registrationRows[0];


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

      phone:
        registration.phone,

      payment_status:
        registration.payment_status,

      registration_status:
        registration.registration_status,

      webinar_title:
        registration.webinar_title
    });


    // ==================================================
    // VALIDATE PAYMENT
    // ==================================================

    if (
      registration.payment_status !==
      'paid'
    ) {

      throw new Error(
        'Test registration payment status must be paid.'
      );

    }


    if (
      registration.registration_status !==
      'registered'
    ) {

      throw new Error(
        'Test registration status must be registered.'
      );

    }


    console.log(
      'REGISTRATION VALIDATION PASSED'
    );


    // ==================================================
    // CREATE DUE REMINDER
    // ==================================================

    /*
      We intentionally use a past timestamp.

      This makes the reminder immediately eligible
      for the automatic cron worker.

      Example:

      scheduled_at < NOW()
    */

    const scheduledAt =
      new Date(
        Date.now() - 60 * 1000
      );


    const mysqlDateTime =
      scheduledAt
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');


    const reminderLog =
      await ReminderLogModel
        .createOrGetReminderLog({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE,

          scheduledAt:
            mysqlDateTime

        });


    console.log(
      '\nDUE TEST REMINDER CREATED'
    );


    console.log(
      reminderLog
    );


    // ==================================================
    // VERIFY REMINDER IS DUE
    // ==================================================

    const [dueRows] =
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

        WHERE id = ?

        LIMIT 1
        `,
        [
          reminderLog.id
        ]
      );


    const dueReminder =
      dueRows[0];


    if (!dueReminder) {

      throw new Error(
        'Created reminder could not be found.'
      );

    }


    console.log(
      '\nDUE REMINDER VALIDATION'
    );

    console.log(
      dueReminder
    );


    // ==================================================
    // IMPORTANT
    // ==================================================

    /*
      At this point the reminder should be:

      email_status     = pending
      whatsapp_status  = pending
      scheduled_at     < NOW()
    */

    if (
      dueReminder.email_status !==
      'pending'
    ) {

      throw new Error(
        'Email status should initially be pending.'
      );

    }


    if (
      dueReminder.whatsapp_status !==
      'pending'
    ) {

      throw new Error(
        'WhatsApp status should initially be pending.'
      );

    }


    console.log(
      'DUE REMINDER VALIDATION PASSED'
    );


    // ==================================================
    // WAIT FOR CRON
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'WAITING FOR AUTOMATIC CRON WORKER...'
    );

    console.log(
      '========================================'
    );

    console.log(
      'Do NOT manually call processReminder().'
    );

    console.log(
      'The server.js cron will process this reminder.'
    );

    console.log(
      'Checking database every 5 seconds...\n'
    );


    // ==================================================
    // POLL DATABASE
    // ==================================================

    const maxAttempts =
      24;

    let finalLog =
      null;

    let processed =
      false;


    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            5000
          )
      );


      const currentLog =
        await ReminderLogModel
          .getById(
            reminderLog.id
          );


      if (!currentLog) {

        throw new Error(
          `Reminder ${reminderLog.id} disappeared from database.`
        );

      }


      console.log(
        `Attempt ${attempt}/${maxAttempts}:`,
        {
          emailStatus:
            currentLog.email_status,

          whatsappStatus:
            currentLog.whatsapp_status
        }
      );


      finalLog =
        currentLog;


      if (
        currentLog.email_status ===
          'sent' &&

        currentLog.whatsapp_status ===
          'sent'
      ) {

        processed =
          true;

        break;

      }

    }


    // ==================================================
    // FINAL VALIDATION
    // ==================================================

    if (!processed) {

      throw new Error(
        'Automatic cron worker did not complete the reminder within the expected time.'
      );

    }


    console.log(
      '\n========================================'
    );

    console.log(
      'AUTOMATIC CRON PROCESSING PASSED'
    );

    console.log(
      '========================================'
    );


    console.log(
      '\nFINAL REMINDER LOG'
    );

    console.log(
      finalLog
    );


    // ==================================================
    // EMAIL VALIDATION
    // ==================================================

    if (
      finalLog.email_status !==
      'sent'
    ) {

      throw new Error(
        'Final email status is not sent.'
      );

    }


    if (
      !finalLog.email_message_id
    ) {

      throw new Error(
        'Email message ID is missing.'
      );

    }


    console.log(
      'EMAIL AUTOMATION VALIDATION PASSED'
    );


    // ==================================================
    // WHATSAPP VALIDATION
    // ==================================================

    if (
      finalLog.whatsapp_status !==
      'sent'
    ) {

      throw new Error(
        'Final WhatsApp status is not sent.'
      );

    }


    if (
      !finalLog.whatsapp_message_id
    ) {

      throw new Error(
        'WhatsApp message ID is missing.'
      );

    }


    console.log(
      'WHATSAPP AUTOMATION VALIDATION PASSED'
    );


    // ==================================================
    // DUPLICATE CHECK
    // ==================================================

    const emailMessageId =
      finalLog.email_message_id;

    const whatsappMessageId =
      finalLog.whatsapp_message_id;


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          5000
        )
    );


    const duplicateCheck =
      await ReminderLogModel
        .getById(
          reminderLog.id
        );


    if (
      duplicateCheck.email_message_id !==
      emailMessageId
    ) {

      throw new Error(
        'Email message ID changed. Possible duplicate processing.'
      );

    }


    if (
      duplicateCheck.whatsapp_message_id !==
      whatsappMessageId
    ) {

      throw new Error(
        'WhatsApp message ID changed. Possible duplicate processing.'
      );

    }


    console.log(
      'AUTOMATIC DUPLICATE PROTECTION PASSED'
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


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'AUTOMATIC REMINDER CRON TEST PASSED'
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
      'AUTOMATIC REMINDER CRON TEST FAILED'
    );

    console.error(
      '========================================'
    );

    console.error(
      error.message
    );


    process.exitCode =
      1;

  }

};


runTest();