require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const API_BASE_URL =
  process.env.TEST_API_URL || 'http://localhost:5000';

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

async function runTest() {

  console.log('');
  console.log('==========================================');
  console.log('REGISTRATION API SECURITY TEST STARTED');
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
    // STEP 2: INVALID DATA TYPES
    // ==================================================

    const invalidData = {

      firstName: 12345,

      lastName: 67890,

      email: {
        malicious: true
      },

      phone: 9876543210,

      city: 123,

      role: {
        admin: true
      },

      goal: 456,

      consent: 'true',

      webinarId: 1,

      source: 'Security Test'
    };


    const response =
      await postRegistration(
        invalidData
      );


    console.log(
      'STEP 2 INVALID DATA HTTP STATUS:',
      response.status
    );

    console.log(
      'STEP 2 INVALID DATA RESPONSE:',
      response.data
    );


    // --------------------------------------------------
    // IMPORTANT:
    // Application should not crash with 500.
    // --------------------------------------------------

    if (
      response.status === 500
    ) {

      throw new Error(
        'Invalid data types caused HTTP 500'
      );
    }


    // --------------------------------------------------
    // Expected controlled validation response
    // --------------------------------------------------

    if (
      response.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 for invalid data types but received ${response.status}`
      );
    }


    if (
      response.data?.success !== false
    ) {

      throw new Error(
        'Invalid data response success should be false'
      );
    }


    console.log(
      'STEP 2 INVALID DATA TYPE SECURITY PASSED'
    );


    // ==================================================
    // STEP 3: VERIFY NO REGISTRATION CREATED
    // ==================================================

    const [rows] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE email = ?
        `,
        ['[object Object]']
      );


    if (
      rows.length !== 0
    ) {

      throw new Error(
        'Invalid input created a registration'
      );
    }


    console.log(
      'STEP 3 NO INVALID REGISTRATION CREATED'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log('');

    console.log(
      '=========================================='
    );

    console.log(
      'REGISTRATION API SECURITY TEST PASSED'
    );

    console.log(
      '=========================================='
    );

    console.log('');

  } catch (error) {

    console.error('');

    console.error(
      'REGISTRATION API SECURITY TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    console.error('');

    process.exitCode = 1;
  }
}

runTest();