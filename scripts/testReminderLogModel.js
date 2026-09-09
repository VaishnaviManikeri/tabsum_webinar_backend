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
  'reminder_24h';


const TEST_SCHEDULED_AT =
  '2026-10-14 10:00:00';


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'REMINDER LOG MODEL TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // CLEAN OLD TEST DATA
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
    // CREATE REMINDER
    // ==================================================

    const created =
      await ReminderLogModel.createReminderLog({

        registrationId:
          TEST_REGISTRATION_ID,

        reminderType:
          TEST_REMINDER_TYPE,

        scheduledAt:
          TEST_SCHEDULED_AT

      });


    console.log(
      '\nCREATED REMINDER'
    );

    console.log(
      created
    );


    if (!created.id) {

      throw new Error(
        'Reminder log creation failed.'
      );

    }


    console.log(
      'CREATE REMINDER PASSED'
    );


    // ==================================================
    // GET BY ID
    // ==================================================

    const found =
      await ReminderLogModel.getById(
        created.id
      );


    console.log(
      '\nGET REMINDER BY ID'
    );

    console.log(
      found
    );


    if (!found) {

      throw new Error(
        'Reminder log could not be retrieved.'
      );

    }


    console.log(
      'GET BY ID PASSED'
    );


    // ==================================================
    // GET BY REGISTRATION + TYPE
    // ==================================================

    const foundByType =
      await ReminderLogModel
        .getByRegistrationAndType({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE

        });


    if (!foundByType) {

      throw new Error(
        'Reminder log lookup failed.'
      );

    }


    console.log(
      'GET BY REGISTRATION + TYPE PASSED'
    );


    // ==================================================
    // CHECK SENT STATUS
    // ==================================================

    const beforeSent =
      await ReminderLogModel
        .isReminderSent({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE

        });


    console.log(
      '\nREMINDER SENT BEFORE:',
      beforeSent
    );


    if (beforeSent !== false) {

      throw new Error(
        'Reminder should not be marked as sent initially.'
      );

    }


    // ==================================================
    // MARK EMAIL SENT
    // ==================================================

    const emailSent =
      await ReminderLogModel
        .markEmailAsSent({

          reminderId:
            created.id,

          messageId:
            'test-email-message-id'

        });


    if (!emailSent) {

      throw new Error(
        'Failed to mark email as sent.'
      );

    }


    console.log(
      'EMAIL MARK AS SENT PASSED'
    );


    // ==================================================
    // MARK WHATSAPP SENT
    // ==================================================

    const whatsappSent =
      await ReminderLogModel
        .markWhatsAppAsSent({

          reminderId:
            created.id,

          messageId:
            'test-whatsapp-message-id'

        });


    if (!whatsappSent) {

      throw new Error(
        'Failed to mark WhatsApp as sent.'
      );

    }


    console.log(
      'WHATSAPP MARK AS SENT PASSED'
    );


    // ==================================================
    // CHECK COMPLETE SENT STATUS
    // ==================================================

    const afterSent =
      await ReminderLogModel
        .isReminderSent({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE

        });


    console.log(
      'REMINDER SENT AFTER:',
      afterSent
    );


    if (afterSent !== true) {

      throw new Error(
        'Reminder should be marked as completely sent.'
      );

    }


    console.log(
      'COMPLETE SENT STATUS PASSED'
    );


    // ==================================================
    // TEST DUPLICATE PROTECTION
    // ==================================================

    const duplicate =
      await ReminderLogModel
        .createOrGetReminderLog({

          registrationId:
            TEST_REGISTRATION_ID,

          reminderType:
            TEST_REMINDER_TYPE,

          scheduledAt:
            TEST_SCHEDULED_AT

        });


    console.log(
      '\nDUPLICATE CREATE RESULT'
    );

    console.log(
      duplicate
    );


    if (
      Number(duplicate.id) !==
      Number(created.id)
    ) {

      throw new Error(
        'Duplicate protection failed.'
      );

    }


    console.log(
      'DUPLICATE PROTECTION PASSED'
    );


    // ==================================================
    // GET STATS
    // ==================================================

    const stats =
      await ReminderLogModel.getStats();


    console.log(
      '\nREMINDER STATISTICS'
    );

    console.log(
      stats
    );


    console.log(
      'STATISTICS PASSED'
    );


    // ==================================================
    // CLEAN TEST RECORD
    // ==================================================

    await ReminderLogModel.deleteById(
      created.id
    );


    console.log(
      '\nTEST RECORD CLEANED UP'
    );


    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER LOG MODEL TEST PASSED'
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
      'REMINDER LOG MODEL TEST FAILED'
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