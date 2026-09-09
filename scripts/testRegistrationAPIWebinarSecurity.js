require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const API_BASE_URL =
  process.env.TEST_API_URL || 'http://localhost:5000';

let createdRegistrationId = null;
let createdLeadId = null;


// ==================================================
// API REQUEST HELPER
// ==================================================

async function postRegistration(data) {
  return axios.post(
    `${API_BASE_URL}/api/registrations`,
    data,
    {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    }
  );
}


// ==================================================
// BASE DATA
// ==================================================

function getBaseData() {
  return {
    firstName: 'Webinar',
    lastName: 'Security Test',
    email: `webinar.security.${Date.now()}@example.com`,
    phone: '9876543210',
    city: 'Pune',
    role: 'Business Owner',
    goal: 'Webinar security testing',
    consent: true,
    webinarId: 1,
    source: 'Webinar Security Test'
  };
}


// ==================================================
// CLEANUP
// ==================================================

async function cleanup() {

  try {

    if (createdRegistrationId) {
      await db.query(
        'DELETE FROM registrations WHERE id = ?',
        [createdRegistrationId]
      );
    }

    if (createdLeadId) {
      await db.query(
        'DELETE FROM leads WHERE id = ?',
        [createdLeadId]
      );
    }

    console.log(
      'TEST DATA CLEANUP COMPLETED'
    );

  } catch (error) {

    console.error(
      'Cleanup error:',
      error.message
    );
  }
}


// ==================================================
// MAIN TEST
// ==================================================

async function runTest() {

  console.log('');
  console.log('==========================================');
  console.log('REGISTRATION WEBINAR SECURITY TEST STARTED');
  console.log('==========================================');
  console.log('');

  try {

    // ==================================================
    // STEP 1: DATABASE CONNECTION
    // ==================================================

    await db.query(
      'SELECT 1 AS database_test'
    );

    console.log(
      'STEP 1 DATABASE CONNECTION PASSED'
    );


    // ==================================================
    // STEP 2: NON-EXISTING WEBINAR ID
    // ==================================================

    const invalidWebinarData =
      getBaseData();

    invalidWebinarData.email =
      `invalid.webinar.${Date.now()}@example.com`;

    invalidWebinarData.webinarId =
      999999;


    const invalidWebinarResponse =
      await postRegistration(
        invalidWebinarData
      );


    console.log(
      'STEP 2 INVALID WEBINAR STATUS:',
      invalidWebinarResponse.status
    );

    console.log(
      'STEP 2 INVALID WEBINAR RESPONSE:',
      invalidWebinarResponse.data
    );


    // --------------------------------------------------
    // Expected controlled failure
    // --------------------------------------------------

    if (
      invalidWebinarResponse.status === 201
    ) {

      throw new Error(
        'Non-existing webinarId was accepted and registration was created'
      );
    }


    if (
      invalidWebinarResponse.status === 500
    ) {

      throw new Error(
        'Non-existing webinarId caused HTTP 500'
      );
    }


    console.log(
      'STEP 2 INVALID WEBINAR ID SECURITY PASSED'
    );


    // ==================================================
    // STEP 3: VERIFY NO REGISTRATION FOR INVALID WEBINAR
    // ==================================================

    const [invalidRows] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE email = ?
        `,
        [invalidWebinarData.email]
      );


    if (
      invalidRows.length !== 0
    ) {

      throw new Error(
        'Registration was created with invalid webinarId'
      );
    }


    console.log(
      'STEP 3 NO INVALID WEBINAR REGISTRATION CREATED'
    );


    // ==================================================
    // STEP 4: INVALID STRING WEBINAR ID
    // ==================================================

    const stringWebinarData =
      getBaseData();

    stringWebinarData.email =
      `string.webinar.${Date.now()}@example.com`;

    stringWebinarData.webinarId =
      'invalid-webinar-id';


    const stringWebinarResponse =
      await postRegistration(
        stringWebinarData
      );


    console.log(
      'STEP 4 STRING WEBINAR STATUS:',
      stringWebinarResponse.status
    );

    console.log(
      'STEP 4 STRING WEBINAR RESPONSE:',
      stringWebinarResponse.data
    );


    if (
      stringWebinarResponse.status === 201
    ) {

      throw new Error(
        'Invalid string webinarId was accepted'
      );
    }


    if (
      stringWebinarResponse.status === 500
    ) {

      throw new Error(
        'Invalid string webinarId caused HTTP 500'
      );
    }


    console.log(
      'STEP 4 STRING WEBINAR ID SECURITY PASSED'
    );


    // ==================================================
    // STEP 5: VERIFY NO INVALID STRING REGISTRATION
    // ==================================================

    const [stringRows] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE email = ?
        `,
        [stringWebinarData.email]
      );


    if (
      stringRows.length !== 0
    ) {

      throw new Error(
        'Registration was created with invalid string webinarId'
      );
    }


    console.log(
      'STEP 5 NO INVALID STRING REGISTRATION CREATED'
    );


    // ==================================================
    // STEP 6: VALID WEBINAR ID
    // ==================================================

    const validData =
      getBaseData();

    validData.email =
      `valid.webinar.${Date.now()}@example.com`;

    validData.webinarId =
      1;


    const validResponse =
      await postRegistration(
        validData
      );


    console.log(
      'STEP 6 VALID WEBINAR STATUS:',
      validResponse.status
    );

    console.log(
      'STEP 6 VALID WEBINAR RESPONSE:',
      validResponse.data
    );


    if (
      validResponse.status !== 201
    ) {

      throw new Error(
        `Expected HTTP 201 for valid webinarId but received ${validResponse.status}`
      );
    }


    createdRegistrationId =
      validResponse.data?.data?.registrationId;

    createdLeadId =
      validResponse.data?.data?.leadId;


    if (!createdRegistrationId) {

      throw new Error(
        'registrationId missing for valid webinar'
      );
    }


    if (!createdLeadId) {

      throw new Error(
        'leadId missing for valid webinar'
      );
    }


    console.log(
      'STEP 6 VALID WEBINAR REGISTRATION CREATED:',
      createdRegistrationId
    );


    // ==================================================
    // STEP 7: DATABASE VALIDATION
    // ==================================================

    const [registrationRows] =
      await db.query(
        `
        SELECT
          id,
          webinar_id,
          payment_status,
          registration_status
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [createdRegistrationId]
      );


    if (
      registrationRows.length !== 1
    ) {

      throw new Error(
        'Valid webinar registration not found'
      );
    }


    const registration =
      registrationRows[0];


    if (
      Number(registration.webinar_id) !== 1
    ) {

      throw new Error(
        'Valid webinarId was not stored correctly'
      );
    }


    if (
      registration.payment_status !==
      'pending'
    ) {

      throw new Error(
        'Unexpected payment status'
      );
    }


    if (
      registration.registration_status !==
      'registered'
    ) {

      throw new Error(
        'Unexpected registration status'
      );
    }


    console.log(
      'STEP 7 VALID WEBINAR DATABASE VALIDATION PASSED'
    );


    // ==================================================
    // STEP 8: CLEANUP
    // ==================================================

    await cleanup();


    // ==================================================
    // STEP 9: CLEANUP VALIDATION
    // ==================================================

    const [registrationCheck] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        `,
        [createdRegistrationId]
      );


    const [leadCheck] =
      await db.query(
        `
        SELECT id
        FROM leads
        WHERE id = ?
        `,
        [createdLeadId]
      );


    if (
      registrationCheck.length !== 0
    ) {

      throw new Error(
        'Registration cleanup failed'
      );
    }


    if (
      leadCheck.length !== 0
    ) {

      throw new Error(
        'Lead cleanup failed'
      );
    }


    console.log(
      'STEP 9 CLEANUP VALIDATION PASSED'
    );


    // ==================================================
    // FINAL
    // ==================================================

    console.log('');

    console.log(
      '=========================================='
    );

    console.log(
      'REGISTRATION WEBINAR SECURITY TEST PASSED'
    );

    console.log(
      '=========================================='
    );

    console.log('');

  } catch (error) {

    console.error('');

    console.error(
      'REGISTRATION WEBINAR SECURITY TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    console.error('');

    await cleanup();

    process.exitCode = 1;
  }
}


// ==================================================
// START
// ==================================================

runTest();