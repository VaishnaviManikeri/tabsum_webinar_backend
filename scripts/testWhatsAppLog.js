const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
  path: [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env')
  ]
});

const db = require('../config/db');
const WhatsAppLogModel = require('../models/whatsappLogModel');

const runTest = async () => {

  let testLogId = null;

  try {

    console.log('\n========================================');
    console.log('WHATSAPP LOG MODEL TEST');
    console.log('========================================\n');


    // ==========================================
    // STEP 1 — GET EXISTING REGISTRATION
    // ==========================================

    const [registrations] = await db.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone
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

    const registration = registrations[0];

    console.log('Using registration:');

    console.log({
      id: registration.id,
      name:
        `${registration.first_name || ''} ${registration.last_name || ''}`.trim(),
      email: registration.email,
      phone: registration.phone
    });

    console.log('');


    // ==========================================
    // STEP 2 — CLEAN OLD TEST RECORD
    // ==========================================

    await db.query(
      `
      DELETE FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type = 'test_confirmation'
      `,
      [registration.id]
    );


    // ==========================================
    // STEP 3 — CREATE WHATSAPP LOG
    // ==========================================

    const createdLog =
      await WhatsAppLogModel.createLog({
        registrationId: registration.id,
        phone: registration.phone,
        whatsappType: 'test_confirmation'
      });

    testLogId = createdLog.id;

    console.log('CREATE WHATSAPP LOG ✅');

    console.log(createdLog);

    console.log('');


    // ==========================================
    // STEP 4 — GET BY ID
    // ==========================================

    const fetchedLog =
      await WhatsAppLogModel.getById(
        testLogId
      );

    if (!fetchedLog) {
      throw new Error(
        'Unable to fetch WhatsApp log by ID.'
      );
    }

    console.log('GET BY ID ✅');

    console.log(fetchedLog);

    console.log('');


    // ==========================================
    // STEP 5 — CHECK INITIAL STATUS
    // ==========================================

    if (
      fetchedLog.status !== 'pending' ||
      Number(fetchedLog.retry_count) !== 0
    ) {
      throw new Error(
        'Initial WhatsApp log status is incorrect.'
      );
    }

    console.log(
      'INITIAL PENDING STATUS WORKING ✅'
    );

    console.log('');


    // ==========================================
    // STEP 6 — SIMULATE WHATSAPP FAILURE
    // ==========================================

    console.log(
      'Simulating WhatsApp failure...'
    );

    await WhatsAppLogModel.markAsFailed(
      testLogId,
      'TEST ERROR: Simulated WhatsApp API failure'
    );


    const failedLog =
      await WhatsAppLogModel.getById(
        testLogId
      );

    console.log('');

    console.log('FAILED WHATSAPP LOG:');

    console.log(failedLog);

    console.log('');


    // ==========================================
    // STEP 7 — VERIFY FAILURE
    // ==========================================

    if (
      failedLog.status !== 'failed'
    ) {
      throw new Error(
        'WhatsApp failure status was not saved.'
      );
    }

    if (
      Number(failedLog.retry_count) !== 1
    ) {
      throw new Error(
        'WhatsApp retry count was not incremented.'
      );
    }

    console.log(
      'WHATSAPP FAILURE LOGGING WORKING ✅'
    );

    console.log('');


    // ==========================================
    // STEP 8 — MARK AS PENDING
    // ==========================================

    await WhatsAppLogModel.markAsPending(
      testLogId
    );

    const pendingLog =
      await WhatsAppLogModel.getById(
        testLogId
      );

    if (
      pendingLog.status !== 'pending'
    ) {
      throw new Error(
        'Unable to change WhatsApp log to pending.'
      );
    }

    console.log(
      'PENDING RETRY STATE WORKING ✅'
    );

    console.log('');


    // ==========================================
    // STEP 9 — SIMULATE SUCCESS
    // ==========================================

    await WhatsAppLogModel.markAsSent(
      testLogId,
      '<test-whatsapp-message-id@example.com>'
    );


    const sentLog =
      await WhatsAppLogModel.getById(
        testLogId
      );

    console.log('FINAL WHATSAPP LOG:');

    console.log(sentLog);

    console.log('');


    // ==========================================
    // STEP 10 — VERIFY SUCCESS
    // ==========================================

    if (
      sentLog.status !== 'sent'
    ) {
      throw new Error(
        'WhatsApp sent status was not saved.'
      );
    }

    if (
      sentLog.message_id !==
      '<test-whatsapp-message-id@example.com>'
    ) {
      throw new Error(
        'WhatsApp message ID was not saved correctly.'
      );
    }

    if (
      Number(sentLog.retry_count) !== 1
    ) {
      throw new Error(
        'Retry count changed unexpectedly.'
      );
    }

    console.log(
      'WHATSAPP SUCCESS FLOW WORKING ✅'
    );

    console.log('');


    // ==========================================
    // STEP 11 — DUPLICATE PROTECTION TEST
    // ==========================================

    console.log(
      'Testing duplicate protection...'
    );

    const firstDuplicateCall =
      await WhatsAppLogModel.createOrGetLog({
        registrationId: registration.id,
        phone: registration.phone,
        whatsappType: 'test_duplicate'
      });

    const secondDuplicateCall =
      await WhatsAppLogModel.createOrGetLog({
        registrationId: registration.id,
        phone: registration.phone,
        whatsappType: 'test_duplicate'
      });


    console.log('');

    console.log('FIRST CALL:');

    console.log(firstDuplicateCall);

    console.log('');

    console.log('SECOND CALL:');

    console.log(secondDuplicateCall);

    console.log('');


    // ==========================================
    // STEP 12 — VERIFY DUPLICATE PROTECTION
    // ==========================================

    if (
      firstDuplicateCall.id !==
      secondDuplicateCall.id
    ) {
      throw new Error(
        'Duplicate WhatsApp log protection FAILED.'
      );
    }


    const [duplicateRows] =
      await db.query(
        `
        SELECT COUNT(*) AS count
        FROM whatsapp_logs
        WHERE registration_id = ?
          AND whatsapp_type = 'test_duplicate'
        `,
        [registration.id]
      );


    const duplicateCount =
      Number(duplicateRows[0].count);


    if (duplicateCount !== 1) {
      throw new Error(
        `Expected 1 duplicate test record, found ${duplicateCount}.`
      );
    }


    console.log(
      'DUPLICATE WHATSAPP PROTECTION WORKING ✅'
    );

    console.log(
      'ONLY ONE DATABASE RECORD EXISTS ✅'
    );

    console.log('');


    // ==========================================
    // STEP 13 — WHATSAPP STATS
    // ==========================================

    const stats =
      await WhatsAppLogModel.getStats();

    console.log(
      'WHATSAPP LOG STATS ✅'
    );

    console.log(stats);

    console.log('');


    // ==========================================
    // STEP 14 — CLEAN TEST RECORDS
    // ==========================================

    await db.query(
      `
      DELETE FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type IN (
          'test_confirmation',
          'test_duplicate'
        )
      `,
      [registration.id]
    );

    console.log(
      'TEST RECORDS CLEANED UP ✅'
    );

    console.log('');


    // ==========================================
    // FINAL
    // ==========================================

    console.log('========================================');
    console.log(
      'WHATSAPP LOG MODEL TEST PASSED ✅'
    );
    console.log('========================================\n');


  } catch (error) {

    console.error('\n❌ WHATSAPP LOG MODEL TEST FAILED');

    console.error(
      error.message
    );

    console.error(
      error
    );


    // ==========================================
    // CLEANUP AFTER FAILURE
    // ==========================================

    try {

      if (testLogId) {

        await db.query(
          `
          DELETE FROM whatsapp_logs
          WHERE id = ?
          `,
          [testLogId]
        );

      }

    } catch (cleanupError) {

      console.error(
        'Cleanup error:',
        cleanupError.message
      );

    }

    process.exitCode = 1;

  } finally {

    // ==========================================
    // CLOSE DATABASE
    // ==========================================

    try {

      if (
        db &&
        typeof db.end === 'function'
      ) {
        await db.end();
      }

    } catch (error) {

      console.error(
        'Database close error:',
        error.message
      );

    }

  }
};


runTest();