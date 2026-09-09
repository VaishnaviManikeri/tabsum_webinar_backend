require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const API_BASE_URL =
  process.env.TEST_API_URL || 'http://localhost:5000';


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
// BASE REGISTRATION DATA
// ==================================================

function getBaseData() {

  return {
    firstName: 'Consent',
    lastName: 'Security Test',
    email: `consent.${Date.now()}@example.com`,
    phone: '9876543210',
    city: 'Pune',
    role: 'Business Owner',
    goal: 'Consent security testing',
    webinarId: 1,
    source: 'Consent Security Test'
  };
}


// ==================================================
// MAIN TEST
// ==================================================

async function runTest() {

  console.log('');
  console.log('==========================================');
  console.log('REGISTRATION CONSENT SECURITY TEST STARTED');
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
    // STEP 2: CONSENT FALSE
    // ==================================================

    const falseData =
      getBaseData();

    falseData.consent = false;


    const falseResponse =
      await postRegistration(
        falseData
      );


    console.log(
      'STEP 2 CONSENT FALSE STATUS:',
      falseResponse.status
    );

    console.log(
      'STEP 2 CONSENT FALSE RESPONSE:',
      falseResponse.data
    );


    if (
      falseResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for consent=false but received ${falseResponse.status}`
      );
    }


    console.log(
      'STEP 2 CONSENT FALSE VALIDATION PASSED'
    );


    // ==================================================
    // STEP 3: CONSENT ZERO
    // ==================================================

    const zeroData =
      getBaseData();

    zeroData.email =
      `consent.zero.${Date.now()}@example.com`;

    zeroData.consent = 0;


    const zeroResponse =
      await postRegistration(
        zeroData
      );


    console.log(
      'STEP 3 CONSENT ZERO STATUS:',
      zeroResponse.status
    );

    console.log(
      'STEP 3 CONSENT ZERO RESPONSE:',
      zeroResponse.data
    );


    if (
      zeroResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for consent=0 but received ${zeroResponse.status}`
      );
    }


    console.log(
      'STEP 3 CONSENT ZERO VALIDATION PASSED'
    );


    // ==================================================
    // STEP 4: EMPTY STRING
    // ==================================================

    const emptyData =
      getBaseData();

    emptyData.email =
      `consent.empty.${Date.now()}@example.com`;

    emptyData.consent = '';


    const emptyResponse =
      await postRegistration(
        emptyData
      );


    console.log(
      'STEP 4 EMPTY CONSENT STATUS:',
      emptyResponse.status
    );

    console.log(
      'STEP 4 EMPTY CONSENT RESPONSE:',
      emptyResponse.data
    );


    if (
      emptyResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for empty consent but received ${emptyResponse.status}`
      );
    }


    console.log(
      'STEP 4 EMPTY CONSENT VALIDATION PASSED'
    );


    // ==================================================
    // STEP 5: NULL CONSENT
    // ==================================================

    const nullData =
      getBaseData();

    nullData.email =
      `consent.null.${Date.now()}@example.com`;

    nullData.consent = null;


    const nullResponse =
      await postRegistration(
        nullData
      );


    console.log(
      'STEP 5 NULL CONSENT STATUS:',
      nullResponse.status
    );

    console.log(
      'STEP 5 NULL CONSENT RESPONSE:',
      nullResponse.data
    );


    if (
      nullResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for consent=null but received ${nullResponse.status}`
      );
    }


    console.log(
      'STEP 5 NULL CONSENT VALIDATION PASSED'
    );


    // ==================================================
    // STEP 6: MISSING CONSENT
    // ==================================================

    const missingData =
      getBaseData();

    missingData.email =
      `consent.missing.${Date.now()}@example.com`;

    delete missingData.consent;


    const missingResponse =
      await postRegistration(
        missingData
      );


    console.log(
      'STEP 6 MISSING CONSENT STATUS:',
      missingResponse.status
    );

    console.log(
      'STEP 6 MISSING CONSENT RESPONSE:',
      missingResponse.data
    );


    if (
      missingResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for missing consent but received ${missingResponse.status}`
      );
    }


    console.log(
      'STEP 6 MISSING CONSENT VALIDATION PASSED'
    );


    // ==================================================
    // STEP 7: DATABASE VERIFICATION
    // ==================================================

    const testEmails = [
      falseData.email,
      zeroData.email,
      emptyData.email,
      nullData.email,
      missingData.email
    ];


    for (
      const email of testEmails
    ) {

      const [rows] =
        await db.query(
          `
          SELECT id
          FROM registrations
          WHERE email = ?
          `,
          [email]
        );


      if (
        rows.length !== 0
      ) {

        throw new Error(
          `Registration was created without valid consent: ${email}`
        );
      }
    }


    console.log(
      'STEP 7 NO REGISTRATION CREATED WITHOUT CONSENT'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log('');

    console.log(
      '=========================================='
    );

    console.log(
      'REGISTRATION CONSENT SECURITY TEST PASSED'
    );

    console.log(
      '=========================================='
    );

    console.log('');

  } catch (error) {

    console.error('');

    console.error(
      'REGISTRATION CONSENT SECURITY TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    console.error('');

    process.exitCode = 1;
  }
}


// ==================================================
// START TEST
// ==================================================

runTest();