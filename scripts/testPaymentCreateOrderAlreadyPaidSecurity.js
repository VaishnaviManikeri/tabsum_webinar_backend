const axios = require('axios');

const db = require('../config/db');

const BASE_URL =
  process.env.TEST_BASE_URL ||
  'http://localhost:5000';

const REGISTRATION_API =
  `${BASE_URL}/api/registrations`;

const PAYMENT_API =
  `${BASE_URL}/api/payments/create-order`;

const TEST_EMAIL =
  `payment-paid-security-${Date.now()}@example.com`;

let connection;

let registrationId = null;
let paymentId = null;
let createdRegistration = false;


async function runTest() {

  try {

    console.log(
      '\n=============================================='
    );

    console.log(
      'PAYMENT CREATE ORDER ALREADY PAID SECURITY TEST'
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
      'STEP 2: Creating valid registration...'
    );


    const registrationResponse =
      await axios.post(
        REGISTRATION_API,
        {
          firstName:
            'Already',

          lastName:
            'PaidTest',

          email:
            TEST_EMAIL,

          phone:
            '9876543211',

          city:
            'Pune',

          role:
            'Professional',

          goal:
            'Payment security test',

          consent:
            true,

          source:
            'Already Paid Security Test'
        },
        {
          validateStatus:
            () => true
        }
      );


    if (
      registrationResponse.status !== 201 ||
      !registrationResponse.data?.success
    ) {

      throw new Error(
        'Unable to create test registration.'
      );

    }


    registrationId =
      registrationResponse.data.data.registrationId;

    createdRegistration = true;


    console.log(
      'Registration created:',
      registrationId,
      '\n'
    );


    // ==================================================
    // STEP 3
    // ==================================================

    console.log(
      'STEP 3: Creating paid payment record...'
    );


    const [
      paymentResult
    ] =
      await connection.query(
        `
        INSERT INTO payments
        (
          registration_id,
          order_id,
          amount,
          currency,
          status
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          registrationId,
          `order_paid_security_${Date.now()}`,
          249,
          'INR',
          'paid'
        ]
      );


    paymentId =
      paymentResult.insertId;


    console.log(
      'Paid payment created:',
      paymentId,
      '\n'
    );


    // ==================================================
    // STEP 4
    // ==================================================

    console.log(
      'STEP 4: Calling create-order API again...'
    );


    const response =
      await axios.post(
        PAYMENT_API,
        {
          registrationId
        },
        {
          validateStatus:
            () => true
        }
      );


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
      '\nSTEP 5: Validating duplicate paid payment rejection...'
    );


    if (
      response.status !== 400
    ) {

      throw new Error(
        `Expected HTTP 400 but received ${response.status}`
      );

    }


    if (
      response.data?.success !== false
    ) {

      throw new Error(
        'Expected success:false.'
      );

    }


    if (
      response.data?.message !==
      'Payment is already completed'
    ) {

      throw new Error(
        `Unexpected message: ${response.data?.message}`
      );

    }


    console.log(
      'Already-paid payment correctly rejected\n'
    );


    // ==================================================
    // STEP 6
    // ==================================================

    console.log(
      'STEP 6: Checking payment record remains unchanged...'
    );


    const [
      payments
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
        WHERE id = ?
        LIMIT 1
        `,
        [
          paymentId
        ]
      );


    if (
      payments.length !== 1
    ) {

      throw new Error(
        'Original payment record was changed or deleted.'
      );

    }


    const payment =
      payments[0];


    if (
      Number(payment.registration_id) !==
      Number(registrationId)
    ) {

      throw new Error(
        'Payment registration mapping changed.'
      );

    }


    if (
      Number(payment.amount) !== 249
    ) {

      throw new Error(
        'Payment amount changed.'
      );

    }


    if (
      payment.currency !== 'INR'
    ) {

      throw new Error(
        'Payment currency changed.'
      );

    }


    if (
      payment.status !== 'paid'
    ) {

      throw new Error(
        `Payment status changed from paid to ${payment.status}`
      );

    }


    console.log(
      'Original payment record remains intact\n'
    );


    // ==================================================
    // STEP 7
    // ==================================================

    console.log(
      'STEP 7: Checking duplicate payment records...'
    );


    const [
      paymentCount
    ] =
      await connection.query(
        `
        SELECT COUNT(*) AS count
        FROM payments
        WHERE registration_id = ?
        `,
        [
          registrationId
        ]
      );


    if (
      Number(paymentCount[0].count) !== 1
    ) {

      throw new Error(
        `Expected exactly 1 payment record but found ${paymentCount[0].count}`
      );

    }


    console.log(
      'No duplicate payment record created\n'
    );


    // ==================================================
    // STEP 8
    // ==================================================

    console.log(
      'STEP 8: Checking registration payment status...'
    );


    const [
      registrations
    ] =
      await connection.query(
        `
        SELECT
          payment_status,
          registration_status
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [
          registrationId
        ]
      );


    if (
      registrations.length !== 1
    ) {

      throw new Error(
        'Registration not found.'
      );

    }


    if (
      registrations[0].payment_status !==
      'pending'
    ) {

      throw new Error(
        `Unexpected registration payment_status: ${registrations[0].payment_status}`
      );

    }


    if (
      registrations[0].registration_status !==
      'registered'
    ) {

      throw new Error(
        `Unexpected registration_status: ${registrations[0].registration_status}`
      );

    }


    console.log(
      'Registration state remains unchanged\n'
    );


    // ==================================================
    // SUCCESS
    // ==================================================

    console.log(
      '=============================================='
    );

    console.log(
      'PAYMENT CREATE ORDER ALREADY PAID SECURITY TEST PASSED'
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
      'PAYMENT CREATE ORDER ALREADY PAID SECURITY TEST FAILED'
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

    try {

      if (paymentId) {

        await db.query(
          `
          DELETE FROM payments
          WHERE id = ?
          `,
          [
            paymentId
          ]
        );

        console.log(
          'Payment test data cleaned up'
        );

      }


      if (
        createdRegistration &&
        registrationId
      ) {

        await db.query(
          `
          DELETE FROM registrations
          WHERE id = ?
          `,
          [
            registrationId
          ]
        );

        console.log(
          'Registration test data cleaned up'
        );

      }

    }

    catch (cleanupError) {

      console.error(
        'Cleanup error:',
        cleanupError.message
      );

    }


    if (connection) {

      connection.release();

    }

  }

}


runTest();