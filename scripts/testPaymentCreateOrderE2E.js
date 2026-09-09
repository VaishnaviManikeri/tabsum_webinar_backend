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
  `payment-order-e2e-${Date.now()}@example.com`;

let connection;

let registrationId = null;
let paymentRecordId = null;
let createdRegistration = false;


async function runTest() {

  try {

    console.log(
      '\n=============================================='
    );

    console.log(
      'PAYMENT CREATE ORDER E2E TEST'
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
            'Payment',

          lastName:
            'OrderTest',

          email:
            TEST_EMAIL,

          phone:
            '9876543210',

          city:
            'Pune',

          role:
            'Professional',

          goal:
            'Learn webinar concepts',

          consent:
            true,

          source:
            'Payment Order E2E Test'
        },
        {
          validateStatus:
            () => true
        }
      );


    console.log(
      'Registration HTTP:',
      registrationResponse.status
    );

    console.log(
      'Registration response:',
      registrationResponse.data
    );


    if (
      registrationResponse.status !== 201 ||
      !registrationResponse.data?.success
    ) {

      throw new Error(
        'Valid registration creation failed.'
      );

    }


    registrationId =
      registrationResponse.data?.data?.registrationId;


    if (!registrationId) {

      throw new Error(
        'Registration ID missing from registration response.'
      );

    }


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
      'STEP 3: Checking registration in database...'
    );


    const [
      registrations
    ] =
      await connection.query(
        `
        SELECT
          id,
          email,
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
        'Registration was not found in database.'
      );

    }


    const registration =
      registrations[0];


    if (
      registration.payment_status !== 'pending'
    ) {

      throw new Error(
        `Expected registration payment_status=pending but received ${registration.payment_status}`
      );

    }


    if (
      registration.registration_status !== 'registered'
    ) {

      throw new Error(
        `Expected registration_status=registered but received ${registration.registration_status}`
      );

    }


    console.log(
      'Registration database validation passed\n'
    );


    // ==================================================
    // STEP 4
    // ==================================================

    console.log(
      'STEP 4: Creating Razorpay payment order...'
    );


    const paymentResponse =
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
      'Payment order HTTP:',
      paymentResponse.status
    );

    console.log(
      'Payment order response:',
      paymentResponse.data
    );


    if (
      paymentResponse.status !== 201 ||
      !paymentResponse.data?.success
    ) {

      throw new Error(
        'Payment order creation failed.'
      );

    }


    const paymentData =
      paymentResponse.data.data;


    if (!paymentData) {

      throw new Error(
        'Payment order response data is missing.'
      );

    }


    // ==================================================
    // STEP 5
    // ==================================================

    console.log(
      'STEP 5: Validating payment order response...'
    );


    if (
      !paymentData.paymentRecordId
    ) {

      throw new Error(
        'paymentRecordId missing.'
      );

    }


    if (
      !paymentData.orderId
    ) {

      throw new Error(
        'orderId missing.'
      );

    }


    if (
      Number(paymentData.amount) !== 24900
    ) {

      throw new Error(
        `Expected Razorpay amount 24900 paise but received ${paymentData.amount}`
      );

    }


    if (
      paymentData.currency !== 'INR'
    ) {

      throw new Error(
        `Expected currency INR but received ${paymentData.currency}`
      );

    }


    if (
      paymentData.status !== 'pending'
    ) {

      throw new Error(
        `Expected payment status pending but received ${paymentData.status}`
      );

    }


    paymentRecordId =
      paymentData.paymentRecordId;


    console.log(
      'Payment order response validation passed\n'
    );


    // ==================================================
    // STEP 6
    // ==================================================

    console.log(
      'STEP 6: Checking payment record in database...'
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
          paymentRecordId
        ]
      );


    if (
      payments.length !== 1
    ) {

      throw new Error(
        'Payment record was not found in database.'
      );

    }


    const payment =
      payments[0];


    // --------------------------------------------------
    // Registration mapping
    // --------------------------------------------------

    if (
      Number(payment.registration_id) !==
      Number(registrationId)
    ) {

      throw new Error(
        'Payment registration mapping is incorrect.'
      );

    }


    // --------------------------------------------------
    // Order ID mapping
    // --------------------------------------------------

    if (
      payment.order_id !==
      paymentData.orderId
    ) {

      throw new Error(
        'Payment order ID mapping is incorrect.'
      );

    }


    // --------------------------------------------------
    // Amount validation
    // --------------------------------------------------

    if (
      Number(payment.amount) !== 249
    ) {

      throw new Error(
        `Expected database payment amount 249 but received ${payment.amount}`
      );

    }


    // --------------------------------------------------
    // Currency validation
    // --------------------------------------------------

    if (
      payment.currency !== 'INR'
    ) {

      throw new Error(
        `Expected database currency INR but received ${payment.currency}`
      );

    }


    // --------------------------------------------------
    // Status validation
    // --------------------------------------------------

    if (
      payment.status !== 'pending'
    ) {

      throw new Error(
        `Expected database payment status pending but received ${payment.status}`
      );

    }


    console.log(
      'Payment database consistency passed\n'
    );


    // ==================================================
    // STEP 7
    // ==================================================

    console.log(
      'STEP 7: Checking registration remains pending...'
    );


    const [
      registrationAfterPaymentOrder
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
      registrationAfterPaymentOrder.length !== 1
    ) {

      throw new Error(
        'Registration disappeared after payment order creation.'
      );

    }


    if (
      registrationAfterPaymentOrder[0].payment_status !==
      'pending'
    ) {

      throw new Error(
        'Registration payment_status changed unexpectedly.'
      );

    }


    if (
      registrationAfterPaymentOrder[0].registration_status !==
      'registered'
    ) {

      throw new Error(
        'Registration status changed unexpectedly.'
      );

    }


    console.log(
      'Registration state remains correct\n'
    );


    // ==================================================
    // STEP 8
    // ==================================================

    console.log(
      'STEP 8: Checking payment amount consistency...'
    );


    if (
      Number(payment.amount) !== 249
    ) {

      throw new Error(
        'Stored payment amount is not ₹249.'
      );

    }


    console.log(
      'Payment amount consistency passed\n'
    );


    // ==================================================
    // SUCCESS
    // ==================================================

    console.log(
      '=============================================='
    );

    console.log(
      'PAYMENT CREATE ORDER E2E TEST PASSED'
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
      'PAYMENT CREATE ORDER E2E TEST FAILED'
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

      // ----------------------------------------------
      // Cleanup payment
      // ----------------------------------------------

      if (
        paymentRecordId
      ) {

        await db.query(
          `
          DELETE FROM payments
          WHERE id = ?
          `,
          [
            paymentRecordId
          ]
        );

        console.log(
          'Payment test data cleaned up'
        );

      }


      // ----------------------------------------------
      // Cleanup registration
      // ----------------------------------------------

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