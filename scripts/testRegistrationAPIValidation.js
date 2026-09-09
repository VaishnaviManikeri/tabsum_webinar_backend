require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const API_BASE_URL =
  process.env.TEST_API_URL || 'http://localhost:5000';

const TEST_EMAIL =
  `registration.validation.${Date.now()}@example.com`;

let registrationId = null;
let leadId = null;


// ==================================================
// HELPER: API REQUEST
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
// CLEANUP
// ==================================================

async function cleanupTestData() {

  try {

    if (registrationId) {

      await db.query(
        'DELETE FROM registrations WHERE id = ?',
        [registrationId]
      );
    }


    if (leadId) {

      await db.query(
        'DELETE FROM leads WHERE id = ?',
        [leadId]
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
// BASE VALID REGISTRATION DATA
// ==================================================

function getValidRegistrationData() {

  return {

    firstName: 'Validation',

    lastName: 'Test',

    email: TEST_EMAIL,

    phone: '9876543210',

    city: 'Pune',

    role: 'Business Owner',

    goal: 'Testing registration validation',

    consent: true,

    webinarId: 1,

    source: 'Validation E2E Test'
  };
}


// ==================================================
// MAIN TEST
// ==================================================

async function runTest() {

  console.log('');

  console.log(
    '=========================================='
  );

  console.log(
    'REGISTRATION API VALIDATION TEST STARTED'
  );

  console.log(
    '=========================================='
  );

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
    // STEP 2: MISSING REQUIRED FIELD
    // ==================================================

    const missingFieldData =
      getValidRegistrationData();

    delete missingFieldData.firstName;


    const missingFieldResponse =
      await postRegistration(
        missingFieldData
      );


    console.log(
      'STEP 2 MISSING FIELD HTTP STATUS:',
      missingFieldResponse.status
    );

    console.log(
      'STEP 2 MISSING FIELD RESPONSE:',
      missingFieldResponse.data
    );


    if (
      missingFieldResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for missing required field but received ${missingFieldResponse.status}`
      );
    }


    if (
      missingFieldResponse.data?.success !==
      false
    ) {

      throw new Error(
        'Missing field response success should be false'
      );
    }


    console.log(
      'STEP 2 MISSING REQUIRED FIELD VALIDATION PASSED'
    );


    // ==================================================
    // STEP 3: CONSENT FALSE
    // ==================================================

    const consentData =
      getValidRegistrationData();

    consentData.consent = false;

    consentData.email =
      `consent.${Date.now()}@example.com`;


    const consentResponse =
      await postRegistration(
        consentData
      );


    console.log(
      'STEP 3 CONSENT HTTP STATUS:',
      consentResponse.status
    );

    console.log(
      'STEP 3 CONSENT RESPONSE:',
      consentResponse.data
    );


    if (
      consentResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for consent=false but received ${consentResponse.status}`
      );
    }


    if (
      consentResponse.data?.success !==
      false
    ) {

      throw new Error(
        'Consent validation success should be false'
      );
    }


    console.log(
      'STEP 3 CONSENT VALIDATION PASSED'
    );


    // ==================================================
    // STEP 4: INVALID EMAIL
    // ==================================================

    const invalidEmailData =
      getValidRegistrationData();

    invalidEmailData.email =
      'invalid-email';


    const invalidEmailResponse =
      await postRegistration(
        invalidEmailData
      );


    console.log(
      'STEP 4 INVALID EMAIL HTTP STATUS:',
      invalidEmailResponse.status
    );

    console.log(
      'STEP 4 INVALID EMAIL RESPONSE:',
      invalidEmailResponse.data
    );


    if (
      invalidEmailResponse.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for invalid email but received ${invalidEmailResponse.status}`
      );
    }


    if (
      invalidEmailResponse.data?.success !==
      false
    ) {

      throw new Error(
        'Invalid email response success should be false'
      );
    }


    console.log(
      'STEP 4 INVALID EMAIL VALIDATION PASSED'
    );


    // ==================================================
    // STEP 5: CREATE VALID REGISTRATION
    // ==================================================

    const validData =
      getValidRegistrationData();


    const validResponse =
      await postRegistration(
        validData
      );


    console.log(
      'STEP 5 VALID REGISTRATION HTTP STATUS:',
      validResponse.status
    );

    console.log(
      'STEP 5 VALID REGISTRATION RESPONSE:',
      validResponse.data
    );


    if (
      validResponse.status !== 201
    ) {

      throw new Error(
        `Expected HTTP 201 for valid registration but received ${validResponse.status}`
      );
    }


    if (
      validResponse.data?.success !==
      true
    ) {

      throw new Error(
        'Valid registration success should be true'
      );
    }


    registrationId =
      validResponse.data?.data?.registrationId;

    leadId =
      validResponse.data?.data?.leadId;


    if (!registrationId) {

      throw new Error(
        'registrationId missing from valid registration response'
      );
    }


    if (!leadId) {

      throw new Error(
        'leadId missing from valid registration response'
      );
    }


    console.log(
      'STEP 5 VALID REGISTRATION CREATED:',
      registrationId
    );


    // ==================================================
    // STEP 6: DUPLICATE EMAIL
    // ==================================================

    const duplicateData =
      getValidRegistrationData();


    const duplicateResponse =
      await postRegistration(
        duplicateData
      );


    console.log(
      'STEP 6 DUPLICATE HTTP STATUS:',
      duplicateResponse.status
    );

    console.log(
      'STEP 6 DUPLICATE RESPONSE:',
      duplicateResponse.data
    );


    if (
      duplicateResponse.status !== 409
    ) {

      throw new Error(
        `Expected HTTP 409 for duplicate email but received ${duplicateResponse.status}`
      );
    }


    if (
      duplicateResponse.data?.success !==
      false
    ) {

      throw new Error(
        'Duplicate email response success should be false'
      );
    }


    console.log(
      'STEP 6 DUPLICATE EMAIL VALIDATION PASSED'
    );


    // ==================================================
    // STEP 7: VERIFY ONLY ONE REGISTRATION EXISTS
    // ==================================================

    const [registrationRows] =
      await db.query(
        `
        SELECT
          id,
          email
        FROM registrations
        WHERE email = ?
        `,
        [TEST_EMAIL]
      );


    if (
      registrationRows.length !== 1
    ) {

      throw new Error(
        `Expected exactly 1 registration but found ${registrationRows.length}`
      );
    }


    if (
      Number(registrationRows[0].id) !==
      Number(registrationId)
    ) {

      throw new Error(
        'Duplicate request created another registration'
      );
    }


    console.log(
      'STEP 7 DUPLICATE DATABASE PROTECTION PASSED'
    );


    // ==================================================
    // STEP 8: CLEANUP
    // ==================================================

    await cleanupTestData();


    // ==================================================
    // STEP 9: VERIFY CLEANUP
    // ==================================================

    const [registrationCheck] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        `,
        [registrationId]
      );


    const [leadCheck] =
      await db.query(
        `
        SELECT id
        FROM leads
        WHERE id = ?
        `,
        [leadId]
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
    // FINAL SUCCESS
    // ==================================================

    console.log('');

    console.log(
      '=========================================='
    );

    console.log(
      'REGISTRATION API VALIDATION TEST PASSED'
    );

    console.log(
      '=========================================='
    );

    console.log('');

  } catch (error) {

    console.error('');

    console.error(
      'REGISTRATION API VALIDATION TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    console.error('');

    await cleanupTestData();

    process.exitCode = 1;
  }
}


// ==================================================
// START
// ==================================================

runTest();