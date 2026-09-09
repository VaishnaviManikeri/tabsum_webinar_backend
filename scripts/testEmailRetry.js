const db = require('../config/db');

const EmailLogModel =
  require('../models/emailLogModel');

const runTest = async () => {

  let testLogId = null;

  try {

    console.log('\n');
    console.log('========================================');
    console.log('EMAIL RETRY FOUNDATION TEST');
    console.log('========================================');


    // ==================================================
    // 1. GET EXISTING REGISTRATION
    // ==================================================

    const [registrations] = await db.query(
      `
      SELECT
        id,
        email
      FROM registrations
      ORDER BY id DESC
      LIMIT 1
      `
    );


    if (!registrations.length) {

      throw new Error(
        'No registration found in database.'
      );

    }


    const registration =
      registrations[0];


    console.log(
      '\nUsing registration:'
    );

    console.log(
      registration
    );


    // ==================================================
    // 2. CREATE TEST EMAIL LOG
    // ==================================================

    const emailLog =
      await EmailLogModel.createOrGetLog({

        registrationId:
          registration.id,

        email:
          registration.email,

        emailType:
          'retry_test'

      });


    testLogId =
      emailLog.id;


    console.log(
      '\nCREATE EMAIL LOG ✅'
    );

    console.log(
      emailLog
    );


    // ==================================================
    // 3. SIMULATE EMAIL FAILURE
    // ==================================================

    console.log(
      '\nSimulating email failure...'
    );


    await EmailLogModel.markAsFailed(

      testLogId,

      'TEST ERROR: Simulated SES failure'

    );


    // ==================================================
    // 4. GET FAILED LOG
    // ==================================================

    let failedLog =
      await EmailLogModel.getById(
        testLogId
      );


    console.log(
      '\nFAILED EMAIL LOG:'
    );

    console.log(
      failedLog
    );


    // ==================================================
    // 5. VERIFY FAILED STATUS
    // ==================================================

    if (
      failedLog.status !== 'failed'
    ) {

      throw new Error(
        'Email status is not failed.'
      );

    }


    if (
      Number(failedLog.retry_count) !== 1
    ) {

      throw new Error(
        'Retry count should be 1.'
      );

    }


    console.log(
      '\nEMAIL FAILURE LOGGING WORKING ✅'
    );


    // ==================================================
    // 6. SCHEDULE RETRY IMMEDIATELY
    // ==================================================
    /*
      Normally first retry = 5 minutes.

      For testing we set next_retry_at
      directly to NOW().
    */

    await db.query(
      `
      UPDATE email_logs
      SET
        next_retry_at = NOW()
      WHERE id = ?
      `,
      [testLogId]
    );


    failedLog =
      await EmailLogModel.getById(
        testLogId
      );


    console.log(
      '\nRETRY SCHEDULE CREATED ✅'
    );

    console.log({

      id:
        failedLog.id,

      status:
        failedLog.status,

      retry_count:
        failedLog.retry_count,

      next_retry_at:
        failedLog.next_retry_at

    });


    // ==================================================
    // 7. CHECK RETRYABLE EMAILS
    // ==================================================

    const retryableEmails =
      await EmailLogModel.getRetryableEmails(
        3,
        20
      );


    const retryEmail =
      retryableEmails.find(
        item =>
          Number(item.id) ===
          Number(testLogId)
      );


    if (!retryEmail) {

      throw new Error(
        'Test email was not detected as retryable.'
      );

    }


    console.log(
      '\nRETRYABLE EMAIL FOUND ✅'
    );

    console.log({

      id:
        retryEmail.id,

      email:
        retryEmail.email,

      status:
        retryEmail.status,

      retry_count:
        retryEmail.retry_count,

      next_retry_at:
        retryEmail.next_retry_at

    });


    // ==================================================
    // 8. SIMULATE RETRY ATTEMPT
    // ==================================================

    console.log(
      '\nSimulating retry attempt...'
    );


    await EmailLogModel.markAsPending(
      testLogId
    );


    // ==================================================
    // 9. SIMULATE SUCCESSFUL RETRY
    // ==================================================

    await EmailLogModel.markAsSent(

      testLogId,

      '<test-retry-message-id@example.com>'

    );


    // ==================================================
    // 10. VERIFY FINAL STATUS
    // ==================================================

    const finalLog =
      await EmailLogModel.getById(
        testLogId
      );


    console.log(
      '\nFINAL EMAIL LOG:'
    );

    console.log(
      finalLog
    );


    // ==================================================
    // 11. VALIDATE FINAL RESULT
    // ==================================================

    if (
      finalLog.status !== 'sent'
    ) {

      throw new Error(
        'Retry did not result in sent status.'
      );

    }


    if (
      finalLog.message_id !==
      '<test-retry-message-id@example.com>'
    ) {

      throw new Error(
        'Retry message ID was not saved.'
      );

    }


    if (
      finalLog.next_retry_at !== null
    ) {

      throw new Error(
        'next_retry_at should be NULL after successful send.'
      );

    }


    console.log(
      '\nRETRY SUCCESS FLOW WORKING ✅'
    );


    // ==================================================
    // 12. CLEANUP TEST RECORD
    // ==================================================

    await db.query(
      `
      DELETE FROM email_logs
      WHERE id = ?
      `,
      [testLogId]
    );


    console.log(
      '\nTEST RECORD CLEANED UP ✅'
    );


    console.log(
      '\n========================================'
    );

    console.log(
      'EMAIL RETRY FOUNDATION TEST PASSED ✅'
    );

    console.log(
      '========================================\n'
    );


    process.exit(0);


  } catch (error) {

    console.error(
      '\n========================================'
    );

    console.error(
      'EMAIL RETRY TEST FAILED ❌'
    );

    console.error(
      error
    );

    console.error(
      '========================================\n'
    );


    // --------------------------------------------------
    // CLEANUP AFTER FAILURE
    // --------------------------------------------------

    if (testLogId) {

      try {

        await db.query(
          `
          DELETE FROM email_logs
          WHERE id = ?
          `,
          [testLogId]
        );

        console.log(
          'Test record cleaned up.'
        );

      } catch (cleanupError) {

        console.error(
          'Cleanup failed:',
          cleanupError
        );

      }

    }


    process.exit(1);

  }

};


runTest();