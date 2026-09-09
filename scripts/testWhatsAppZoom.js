require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env.local')
});

const db = require('../config/db');

const {
  sendWhatsAppRegistrationConfirmation,
  normalizeIndianPhone
} = require('../services/whatsappService');


const TEST_REGISTRATION_ID = 17;


const runTest = async () => {

  console.log(
    '\n========================================'
  );

  console.log(
    'WHATSAPP + ZOOM INTEGRATION TEST'
  );

  console.log(
    '========================================\n'
  );


  try {

    // ==================================================
    // GET REGISTRATION
    // ==================================================

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.webinar_id,
        r.payment_status,

        w.title AS webinar_title,
        DATE_FORMAT(w.date, '%Y-%m-%d') AS webinar_date,
        TIME_FORMAT(w.time, '%H:%i') AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password,
        w.zoom_created_at

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE r.id = ?

      LIMIT 1
      `,
      [TEST_REGISTRATION_ID]
    );


    const registration = rows[0];


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

      phone:
        registration.phone,

      webinarId:
        registration.webinar_id,

      webinarTitle:
        registration.webinar_title,

      webinarDate:
        registration.webinar_date,

      webinarTime:
        registration.webinar_time,

      webinarDuration:
        registration.webinar_duration,

      webinarPlatform:
        registration.webinar_platform

    });


    // ==================================================
    // PHONE VALIDATION
    // ==================================================

    const normalizedPhone =
      normalizeIndianPhone(
        registration.phone
      );


    console.log(
      '\nPHONE NORMALIZATION'
    );

    console.log(
      'Original:',
      registration.phone
    );

    console.log(
      'Normalized:',
      normalizedPhone
    );


    if (
      !normalizedPhone.startsWith('91') ||
      normalizedPhone.length !== 12
    ) {

      throw new Error(
        'Phone normalization failed.'
      );

    }


    console.log(
      'PHONE NORMALIZATION PASSED'
    );


    // ==================================================
    // ZOOM VALIDATION
    // ==================================================

    console.log(
      '\nZOOM DETAILS'
    );

    console.log({
      meetingId:
        registration.zoom_meeting_id,

      joinUrl:
        registration.zoom_join_url,

      startUrl:
        registration.zoom_start_url,

      password:
        registration.zoom_password,

      createdAt:
        registration.zoom_created_at
    });


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
    // REMOVE OLD TEST WHATSAPP LOG
    // ==================================================

    await db.query(
      `
      DELETE FROM whatsapp_logs
      WHERE registration_id = ?
      AND whatsapp_type = 'registration_confirmation'
      `,
      [TEST_REGISTRATION_ID]
    );


    console.log(
      '\nOLD TEST WHATSAPP LOG REMOVED'
    );


    // ==================================================
    // SEND WHATSAPP
    // ==================================================

    console.log(
      '\nSENDING WHATSAPP CONFIRMATION...'
    );


    const result =
      await sendWhatsAppRegistrationConfirmation({
        registration
      });


    console.log(
      '\nWHATSAPP RESULT'
    );

    console.log(
      result
    );


    // ==================================================
    // VALIDATE RESULT
    // ==================================================

    if (!result.success) {

      throw new Error(
        'WhatsApp sending failed.'
      );

    }


    if (!result.mock) {

      throw new Error(
        'Expected WhatsApp mock mode.'
      );

    }


    if (!result.messageId) {

      throw new Error(
        'WhatsApp message ID is missing.'
      );

    }


    if (
      !result.parameters ||
      result.parameters.length !== 9
    ) {

      throw new Error(
        'Expected exactly 9 WhatsApp template parameters.'
      );

    }


    // ==================================================
    // VALIDATE TEMPLATE PARAMETERS
    // ==================================================

    console.log(
      '\nTEMPLATE PARAMETERS'
    );


    result.parameters.forEach(
      (parameter, index) => {

        console.log(
          `{{${index + 1}}}:`,
          parameter
        );

      }
    );


    if (
      result.parameters[0] !==
      `${registration.first_name || ''} ${registration.last_name || ''}`.trim()
    ) {

      throw new Error(
        'Customer name parameter is incorrect.'
      );

    }


    if (
      result.parameters[1] !==
      registration.webinar_title
    ) {

      throw new Error(
        'Webinar title parameter is incorrect.'
      );

    }


    if (
      result.parameters[2] !==
      registration.webinar_date
    ) {

      throw new Error(
        'Webinar date parameter is incorrect.'
      );

    }


    if (
      result.parameters[3] !==
      registration.webinar_time
    ) {

      throw new Error(
        'Webinar time parameter is incorrect.'
      );

    }


    if (
      result.parameters[6] !==
      registration.zoom_join_url
    ) {

      throw new Error(
        'Zoom Join URL parameter is incorrect.'
      );

    }


    if (
      result.parameters[7] !==
      registration.zoom_meeting_id
    ) {

      throw new Error(
        'Zoom Meeting ID parameter is incorrect.'
      );

    }


    if (
      result.parameters[8] !==
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
    // CHECK DATABASE LOG
    // ==================================================

    const [logs] = await db.query(
      `
      SELECT
        id,
        registration_id,
        phone,
        whatsapp_type,
        status,
        message_id,
        retry_count
      FROM whatsapp_logs
      WHERE registration_id = ?
      AND whatsapp_type = 'registration_confirmation'
      `,
      [TEST_REGISTRATION_ID]
    );


    console.log(
      '\nWHATSAPP LOG'
    );

    console.log(
      logs
    );


    if (logs.length !== 1) {

      throw new Error(
        `Expected exactly 1 WhatsApp log. Found ${logs.length}.`
      );

    }


    if (
      logs[0].status !== 'sent'
    ) {

      throw new Error(
        `Expected WhatsApp log status sent. Found ${logs[0].status}.`
      );

    }


    console.log(
      'WHATSAPP LOG VALIDATION PASSED'
    );


    // ==================================================
    // DUPLICATE TEST
    // ==================================================

    console.log(
      '\nTESTING DUPLICATE WHATSAPP PROTECTION...'
    );


    const secondResult =
      await sendWhatsAppRegistrationConfirmation({
        registration
      });


    console.log(
      '\nSECOND WHATSAPP RESULT'
    );

    console.log(
      secondResult
    );


    if (
      !secondResult.success
    ) {

      throw new Error(
        'Duplicate request failed.'
      );

    }


    if (
      secondResult.alreadySent !== true
    ) {

      throw new Error(
        'Duplicate WhatsApp protection failed.'
      );

    }


    console.log(
      'DUPLICATE WHATSAPP PROTECTION PASSED'
    );


    // ==================================================
    // FINAL LOG COUNT
    // ==================================================

    const [finalLogs] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM whatsapp_logs
      WHERE registration_id = ?
      AND whatsapp_type = 'registration_confirmation'
      `,
      [TEST_REGISTRATION_ID]
    );


    console.log(
      'DATABASE WHATSAPP LOG COUNT:',
      finalLogs[0].total
    );


    if (
      Number(finalLogs[0].total) !== 1
    ) {

      throw new Error(
        'Duplicate WhatsApp log detected.'
      );

    }


    console.log(
      'ONLY ONE WHATSAPP LOG EXISTS'
    );


    console.log(
      '\n========================================'
    );

    console.log(
      'WHATSAPP + ZOOM INTEGRATION PASSED'
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
      'WHATSAPP + ZOOM INTEGRATION FAILED'
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