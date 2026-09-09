const axios = require('axios');

const db = require('../config/db');

const BASE_URL =
  process.env.TEST_BASE_URL ||
  'http://localhost:5000';

const API_URL =
  `${BASE_URL}/api/payments/create-order`;


const INVALID_REGISTRATION_ID =
  999999999;


async function runTest() {

  let connection;

  try {

    console.log(
      '\n=============================================='
    );

    console.log(
      'CREATE PAYMENT ORDER REGISTRATION SECURITY TEST'
    );

    console.log(
      '==============================================\n'
    );


    // ==================================================
    // STEP 1
    // ==================================================

    console.log(
      'STEP 1: Checking database connection...'
    );

    connection =
      await db.getConnection();

    console.log(
      'Database connection passed\n'
    );


    // ==================================================
    // STEP 2
    // ==================================================

    console.log(
      'STEP 2: Confirm invalid registration does not exist...'
    );

    const [
      registrations
    ] =
      await connection.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [
          INVALID_REGISTRATION_ID
        ]
      );


    if (registrations.length > 0) {

      throw new Error(
        `Test registration ID ${INVALID_REGISTRATION_ID} already exists.`
      );

    }


    console.log(
      'Invalid registration confirmed\n'
    );


    // ==================================================
    // STEP 3
    // ==================================================

    console.log(
      'STEP 3: Checking existing payment records...'
    );


    const [
      existingPayments
    ] =
      await connection.query(
        `
        SELECT id, registration_id
        FROM payments
        WHERE registration_id = ?
        `,
        [
          INVALID_REGISTRATION_ID
        ]
      );


    if (existingPayments.length > 0) {

      throw new Error(
        'Unexpected payment record already exists for invalid registration.'
      );

    }


    console.log(
      'No payment record exists\n'
    );


    // ==================================================
    // STEP 4
    // ==================================================

    console.log(
      'STEP 4: Sending invalid registration ID to create-order API...'
    );


    let response;

    try {

      response =
        await axios.post(
          API_URL,
          {
            registrationId:
              INVALID_REGISTRATION_ID
          },
          {
            validateStatus:
              () => true
          }
        );

    }

    catch (error) {

      throw new Error(
        `API request failed: ${error.message}`
      );

    }


    console.log(
      'HTTP STATUS:',
      response.status
    );

    console.log(
      'RESPONSE:',
      response.data
    );


    // ==================================================
    // STEP 5
    // ==================================================

    console.log(
      '\nSTEP 5: Validating API response...'
    );


    if (response.status !== 404) {

      throw new Error(
        `Expected HTTP 404 but received ${response.status}`
      );

    }


    if (
      !response.data ||
      response.data.success !== false
    ) {

      throw new Error(
        'Expected success:false for invalid registration.'
      );

    }


    console.log(
      'Invalid registration correctly rejected\n'
    );


    // ==================================================
    // STEP 6
    // ==================================================

    console.log(
      'STEP 6: Checking payment database after request...'
    );


    const [
      paymentsAfterRequest
    ] =
      await connection.query(
        `
        SELECT
          id,
          registration_id,
          order_id,
          amount,
          currency,
          status
        FROM payments
        WHERE registration_id = ?
        `,
        [
          INVALID_REGISTRATION_ID
        ]
      );


    if (
      paymentsAfterRequest.length !== 0
    ) {

      throw new Error(
        'Payment record was created for invalid registration.'
      );

    }


    console.log(
      'No payment record created\n'
    );


    // ==================================================
    // STEP 7
    // ==================================================

    console.log(
      'STEP 7: Checking that no registration was created...'
    );


    const [
      registrationAfterRequest
    ] =
      await connection.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [
          INVALID_REGISTRATION_ID
        ]
      );


    if (
      registrationAfterRequest.length !== 0
    ) {

      throw new Error(
        'Unexpected registration record found.'
      );

    }


    console.log(
      'Registration database integrity passed\n'
    );


    // ==================================================
    // FINAL
    // ==================================================

    console.log(
      '=============================================='
    );

    console.log(
      'CREATE PAYMENT ORDER REGISTRATION SECURITY TEST PASSED'
    );

    console.log(
      '==============================================\n'
    );

  }

  catch (error) {

    console.error(
      '\n=============================================='
    );

    console.error(
      'CREATE PAYMENT ORDER REGISTRATION SECURITY TEST FAILED'
    );

    console.error(
      '=============================================='
    );

    console.error(
      error.message
    );

    process.exitCode = 1;

  }

  finally {

    if (connection) {

      connection.release();

    }

    await db.end();

  }

}


runTest();