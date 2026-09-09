const axios = require('axios');

const db = require('../config/db');

const BASE_URL =
  process.env.TEST_BASE_URL ||
  'http://localhost:5000';

const API_URL =
  `${BASE_URL}/api/payments/create-order`;


const INVALID_VALUES = [
  {
    name: 'alphabetic string',
    value: 'abc'
  },
  {
    name: 'text string',
    value: 'hello'
  },
  {
    name: 'negative number',
    value: -1
  },
  {
    name: 'decimal number',
    value: 1.5
  },
  {
    name: 'object',
    value: {}
  },
  {
    name: 'array',
    value: []
  }
];


async function runTest() {

  let connection;

  try {

    console.log(
      '\n=============================================='
    );

    console.log(
      'CREATE PAYMENT ORDER REGISTRATION ID VALIDATION TEST'
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
      'STEP 2: Testing invalid registration ID values...\n'
    );


    for (const testCase of INVALID_VALUES) {

      console.log(
        `Testing ${testCase.name}:`,
        testCase.value
      );


      const [
        beforePayments
      ] =
        await connection.query(
          `
          SELECT COUNT(*) AS count
          FROM payments
          WHERE registration_id IS NOT NULL
          `
        );


      let response;

      try {

        response =
          await axios.post(
            API_URL,
            {
              registrationId:
                testCase.value
            },
            {
              validateStatus:
                () => true
            }
          );

      }

      catch (error) {

        throw new Error(
          `API request failed for ${testCase.name}: ${error.message}`
        );

      }


      console.log(
        'HTTP:',
        response.status
      );

      console.log(
        'Response:',
        response.data
      );


      // ------------------------------------------------
      // Expected 400
      // ------------------------------------------------

      if (response.status !== 400) {

        throw new Error(
          `${testCase.name}: expected HTTP 400 but received ${response.status}`
        );

      }


      if (
        !response.data ||
        response.data.success !== false
      ) {

        throw new Error(
          `${testCase.name}: expected success:false`
        );

      }


      const [
        afterPayments
      ] =
        await connection.query(
          `
          SELECT COUNT(*) AS count
          FROM payments
          WHERE registration_id IS NOT NULL
          `
        );


      if (
        Number(afterPayments[0].count) !==
        Number(beforePayments[0].count)
      ) {

        throw new Error(
          `${testCase.name}: payment record count changed`
        );

      }


      console.log(
        `✓ ${testCase.name} rejected correctly\n`
      );

    }


    // ==================================================
    // STEP 3
    // ==================================================

    console.log(
      'STEP 3: Invalid registration ID validation passed\n'
    );


    // ==================================================
    // FINAL
    // ==================================================

    console.log(
      '=============================================='
    );

    console.log(
      'CREATE PAYMENT ORDER REGISTRATION ID VALIDATION TEST PASSED'
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
      'CREATE PAYMENT ORDER REGISTRATION ID VALIDATION TEST FAILED'
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