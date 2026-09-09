const dotenv = require('dotenv');
const path = require('path');

dotenv.config({
  path: [
    path.join(__dirname, '..', '.env.local'),
    path.join(__dirname, '..', '.env')
  ]
});

const db = require('../config/db');

const WhatsAppLogModel =
  require('../models/whatsappLogModel');

const {
  normalizeIndianPhone,
  sendWhatsAppTemplate,
  sendWhatsAppRegistrationConfirmation
} = require('../services/whatsappService');


// ======================================================
// TEST FUNCTION
// ======================================================

const runTest = async () => {

  try {

    console.log('\n========================================');
    console.log('WHATSAPP SERVICE TEST');
    console.log('========================================\n');


    // ==================================================
    // STEP 1 — CHECK MOCK MODE
    // ==================================================

    console.log(
      'WhatsApp Mock Mode:',
      process.env.WHATSAPP_MOCK_MODE
    );

    if (
      String(
        process.env.WHATSAPP_MOCK_MODE
      ).toLowerCase() !== 'true'
    ) {

      throw new Error(
        'WHATSAPP_MOCK_MODE must be true for this test.'
      );

    }

    console.log(
      'MOCK MODE ENABLED ✅'
    );

    console.log('');


    // ==================================================
    // STEP 2 — GET EXISTING REGISTRATION
    // ==================================================

    const [registrations] =
      await db.query(
        `
        SELECT
          r.id,
          r.first_name,
          r.last_name,
          r.email,
          r.phone,
          r.payment_status,
          w.title AS webinar_title,
          w.duration AS webinar_duration,
          w.platform AS webinar_platform
        FROM registrations r
        LEFT JOIN webinars w
          ON r.webinar_id = w.id
        ORDER BY r.id DESC
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
      'Using registration:'
    );

    console.log(
      registration
    );

    console.log('');


    // ==================================================
    // STEP 3 — NORMALIZE PHONE NUMBER
    // ==================================================

    const normalizedPhone =
      normalizeIndianPhone(
        registration.phone
      );


    console.log(
      'Original phone:',
      registration.phone
    );

    console.log(
      'Normalized phone:',
      normalizedPhone
    );

    console.log('');


    if (
      !normalizedPhone.startsWith('91')
    ) {

      throw new Error(
        'Phone number normalization failed.'
      );

    }


    console.log(
      'PHONE NORMALIZATION WORKING ✅'
    );

    console.log('');


    // ==================================================
    // STEP 4 — CLEAN OLD TEST CONFIRMATION LOG
    // ==================================================

    await db.query(
      `
      DELETE FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type = 'registration_confirmation'
      `,
      [
        registration.id
      ]
    );


    // ==================================================
    // STEP 5 — DIRECT TEMPLATE SERVICE TEST
    // ==================================================

    console.log(
      'Testing WhatsApp template service...'
    );

    const templateResult =
      await sendWhatsAppTemplate({

        phone:
          registration.phone,

        templateName:
          'registration_confirmation',

        languageCode:
          'en_US',

        parameters: [
          `${registration.first_name || ''} ${registration.last_name || ''}`.trim(),
          registration.webinar_title ||
            'The Abundance Crossroad™',
          registration.webinar_duration ||
            '2 Hours Each Day',
          registration.webinar_platform ||
            'Zoom'
        ]

      });


    console.log('');

    console.log(
      'TEMPLATE SERVICE RESULT:'
    );

    console.log(
      templateResult
    );

    console.log('');


    // ==================================================
    // STEP 6 — VERIFY MOCK RESPONSE
    // ==================================================

    if (
      !templateResult ||
      templateResult.success !== true
    ) {

      throw new Error(
        'WhatsApp template service did not return success.'
      );

    }


    if (
      templateResult.mock !== true
    ) {

      throw new Error(
        'WhatsApp template service is not running in mock mode.'
      );

    }


    if (
      !templateResult.messageId
    ) {

      throw new Error(
        'Mock WhatsApp message ID was not generated.'
      );

    }


    console.log(
      'MOCK WHATSAPP SEND WORKING ✅'
    );

    console.log('');


    // ==================================================
    // STEP 7 — REGISTRATION CONFIRMATION SERVICE
    // ==================================================

    console.log(
      'Testing registration confirmation service...'
    );

    const firstResult =
      await sendWhatsAppRegistrationConfirmation({
        registration
      });


    console.log('');

    console.log(
      'FIRST CONFIRMATION RESULT:'
    );

    console.log(
      firstResult
    );

    console.log('');


    if (
      !firstResult ||
      firstResult.success !== true
    ) {

      throw new Error(
        'Registration confirmation WhatsApp failed.'
      );

    }


    if (
      firstResult.alreadySent !== false
    ) {

      throw new Error(
        'First WhatsApp confirmation was unexpectedly treated as duplicate.'
      );

    }


    console.log(
      'REGISTRATION CONFIRMATION SENT ✅'
    );

    console.log('');


    // ==================================================
    // STEP 8 — CHECK DATABASE LOG
    // ==================================================

    const firstLog =
      await WhatsAppLogModel
        .getByRegistrationAndType(
          registration.id,
          'registration_confirmation'
        );


    console.log(
      'WHATSAPP DATABASE LOG:'
    );

    console.log(
      firstLog
    );

    console.log('');


    if (!firstLog) {

      throw new Error(
        'WhatsApp log was not created.'
      );

    }


    if (
      firstLog.status !== 'sent'
    ) {

      throw new Error(
        'WhatsApp log status is not sent.'
      );

    }


    if (
      !firstLog.message_id
    ) {

      throw new Error(
        'WhatsApp message ID was not saved.'
      );

    }


    console.log(
      'WHATSAPP DATABASE LOGGING WORKING ✅'
    );

    console.log('');


    // ==================================================
    // STEP 9 — DUPLICATE TEST
    // ==================================================

    console.log(
      'Testing duplicate WhatsApp protection...'
    );


    const secondResult =
      await sendWhatsAppRegistrationConfirmation({
        registration
      });


    console.log('');

    console.log(
      'SECOND CONFIRMATION RESULT:'
    );

    console.log(
      secondResult
    );

    console.log('');


    if (
      !secondResult ||
      secondResult.success !== true
    ) {

      throw new Error(
        'Second WhatsApp confirmation did not return success.'
      );

    }


    if (
      secondResult.alreadySent !== true
    ) {

      throw new Error(
        'Duplicate WhatsApp message was NOT prevented.'
      );

    }


    console.log(
      'DUPLICATE WHATSAPP PREVENTED ✅'
    );

    console.log('');


    // ==================================================
    // STEP 10 — DATABASE COUNT
    // ==================================================

    const [rows] =
      await db.query(
        `
        SELECT COUNT(*) AS count
        FROM whatsapp_logs
        WHERE registration_id = ?
          AND whatsapp_type = 'registration_confirmation'
        `,
        [
          registration.id
        ]
      );


    const logCount =
      Number(rows[0].count);


    console.log(
      'Registration confirmation log count:',
      logCount
    );

    console.log('');


    if (
      logCount !== 1
    ) {

      throw new Error(
        `Expected 1 WhatsApp log, found ${logCount}.`
      );

    }


    console.log(
      'ONLY ONE WHATSAPP LOG EXISTS ✅'
    );

    console.log('');


    // ==================================================
    // STEP 11 — FINAL LOG
    // ==================================================

    const finalLog =
      await WhatsAppLogModel
        .getByRegistrationAndType(
          registration.id,
          'registration_confirmation'
        );


    console.log(
      'FINAL WHATSAPP LOG:'
    );

    console.log(
      finalLog
    );

    console.log('');


    // ==================================================
    // STEP 12 — CLEAN TEST DATA
    // ==================================================

    await db.query(
      `
      DELETE FROM whatsapp_logs
      WHERE registration_id = ?
        AND whatsapp_type = 'registration_confirmation'
      `,
      [
        registration.id
      ]
    );


    console.log(
      'TEST WHATSAPP LOG CLEANED UP ✅'
    );

    console.log('');


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log('========================================');

    console.log(
      'WHATSAPP SERVICE TEST PASSED ✅'
    );

    console.log('========================================\n');


  } catch (error) {

    console.error('\n❌ WHATSAPP SERVICE TEST FAILED');

    console.error(
      'Error:',
      error.message
    );

    console.error('');

    console.error(
      error
    );

    process.exitCode = 1;


  } finally {

    // ==================================================
    // CLOSE DATABASE
    // ==================================================

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


// ======================================================
// START TEST
// ======================================================

runTest();