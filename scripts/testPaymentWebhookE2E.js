const axios = require('axios');
const db = require('../config/db');

const RegistrationModel = require('../models/registrationModel');
const PaymentModel = require('../models/paymentModel');

const WEBHOOK_URL =
  'http://localhost:5000/api/payments/webhook';

const TEST_EMAIL =
  `webhook_test_${Date.now()}@example.com`;

const TEST_PHONE =
  `90000${String(Date.now()).slice(-5)}`;

let registrationId = null;
let paymentDbId = null;
let webhookEventId = null;

const testOrderId =
  `order_webhook_test_${Date.now()}`;

const testPaymentId =
  `pay_webhook_test_${Date.now()}`;


/*
|--------------------------------------------------------------------------
| Cleanup Test Data
|--------------------------------------------------------------------------
*/
async function cleanup() {
  try {
    /*
    |--------------------------------------------------------------------------
    | Delete reminder logs created for this test registration
    |--------------------------------------------------------------------------
    */

    if (registrationId) {
      await db.query(
        `
        DELETE FROM webinar_reminder_logs
        WHERE registration_id = ?
        `,
        [registrationId]
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Delete payment directly using order_id
    |--------------------------------------------------------------------------
    | PaymentModel does not expose deletePayment(),
    | so cleanup is done directly through MySQL.
    |--------------------------------------------------------------------------
    */

    await db.query(
      `
      DELETE FROM payments
      WHERE order_id = ?
      `,
      [testOrderId]
    );

    /*
    |--------------------------------------------------------------------------
    | Delete webhook log
    |--------------------------------------------------------------------------
    */

    if (webhookEventId) {
      await db.query(
        `
        DELETE FROM payment_webhook_logs
        WHERE event_id = ?
        `,
        [webhookEventId]
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Delete registration
    |--------------------------------------------------------------------------
    */

    if (registrationId) {
      await db.query(
        `
        DELETE FROM registrations
        WHERE id = ?
        `,
        [registrationId]
      );
    }

    console.log(
      'TEST WEBHOOK DATA CLEANED UP'
    );

  } catch (error) {
    console.error(
      'Cleanup error:',
      error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| Main Test
|--------------------------------------------------------------------------
*/

async function runTest() {
  try {

    console.log('');
    console.log('========================================');
    console.log(
      'PAYMENT WEBHOOK E2E TEST STARTED'
    );
    console.log('========================================');


    /*
    |--------------------------------------------------------------------------
    | STEP 1 — Create Temporary Registration
    |--------------------------------------------------------------------------
    */

    const registration =
      await RegistrationModel.createRegistration({
        firstName: 'Webhook',
        lastName: 'Test',
        email: TEST_EMAIL,
        phone: TEST_PHONE,
        city: 'Pune',
        role: 'Developer',
        goal: 'Webhook E2E Testing',
        consent: true,
        webinarId: 1
      });

    registrationId =
      registration.registrationId;

    console.log(
      'STEP 1 TEMP REGISTRATION CREATED:',
      registrationId
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 2 — Create Pending Payment
    |--------------------------------------------------------------------------
    */

    await PaymentModel.createPayment({
      registrationId,
      orderId: testOrderId,
      amount: 249,
      currency: 'INR',
      status: 'pending'
    });

    console.log(
      'STEP 2 PENDING PAYMENT CREATED FOR ORDER:',
      testOrderId
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 3 — Verify Initial Database State
    |--------------------------------------------------------------------------
    */

    const [beforeRows] =
      await db.query(
        `
        SELECT
          r.id,
          r.payment_status,
          r.registration_status,
          p.id AS payment_db_id,
          p.status AS payment_db_status,
          p.amount,
          p.currency,
          p.order_id,
          p.payment_id
        FROM registrations r
        LEFT JOIN payments p
          ON p.registration_id = r.id
        WHERE r.id = ?
        ORDER BY p.id DESC
        LIMIT 1
        `,
        [registrationId]
      );


    if (!beforeRows.length) {
      throw new Error(
        'Initial database state not found'
      );
    }


    paymentDbId =
      beforeRows[0].payment_db_id;


    console.log(
      'STEP 3 INITIAL DB STATE:',
      beforeRows[0]
    );


    if (
      beforeRows[0].payment_status !==
      'pending'
    ) {
      throw new Error(
        'Initial registration payment status is not pending'
      );
    }


    if (
      beforeRows[0].registration_status !==
      'registered'
    ) {
      throw new Error(
        'Initial registration status is not registered'
      );
    }


    if (
      beforeRows[0].payment_db_status !==
      'pending'
    ) {
      throw new Error(
        'Initial payment status is not pending'
      );
    }


    console.log(
      'STEP 3 INITIAL DATABASE STATE VALIDATION PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 4 — Enable Razorpay Mock Mode
    |--------------------------------------------------------------------------
    */

    process.env.RAZORPAY_MOCK_MODE =
      'true';

    process.env.RAZORPAY_MOCK_PAYMENT_STATUS =
      'captured';

    process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID =
      testOrderId;

    process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY =
      'INR';


    /*
    |--------------------------------------------------------------------------
    | STEP 5 — Build Webhook Payload
    |--------------------------------------------------------------------------
    */

    webhookEventId =
      `evt_webhook_test_${Date.now()}`;


    const webhookPayload = {
      id: webhookEventId,

      event: 'payment.captured',

      payload: {
        payment: {
          entity: {
            id: testPaymentId,
            order_id: testOrderId,
            amount: 24900,
            currency: 'INR',
            status: 'captured',
            captured: true
          }
        }
      }
    };


    console.log(
      'STEP 4 WEBHOOK PAYLOAD CREATED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 6 — Send Actual HTTP Webhook Request
    |--------------------------------------------------------------------------
    */

    const response =
      await axios.post(
        WEBHOOK_URL,
        webhookPayload,
        {
          headers: {
            'Content-Type':
              'application/json',

            'x-razorpay-signature':
              'MOCK_WEBHOOK_SIGNATURE'
          },

          validateStatus: () => true
        }
      );


    console.log(
      'STEP 5 WEBHOOK HTTP STATUS:',
      response.status
    );


    console.log(
      'STEP 5 WEBHOOK RESPONSE:',
      response.data
    );


    if (
      response.status !== 200 ||
      response.data.success !== true
    ) {
      throw new Error(
        'Webhook processing failed'
      );
    }


    console.log(
      'STEP 5 WEBHOOK PROCESSING PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 7 — Verify Payment Database
    |--------------------------------------------------------------------------
    */

    const [paymentRows] =
      await db.query(
        `
        SELECT
          id,
          registration_id,
          order_id,
          payment_id,
          amount,
          currency,
          status,
          paid_at
        FROM payments
        WHERE order_id = ?
        LIMIT 1
        `,
        [testOrderId]
      );


    console.log(
      'STEP 6 PAYMENT DB AFTER WEBHOOK:',
      paymentRows[0]
    );


    if (!paymentRows.length) {
      throw new Error(
        'Payment record disappeared'
      );
    }


    paymentDbId =
      paymentRows[0].id;


    if (
      paymentRows[0].registration_id !==
      registrationId
    ) {
      throw new Error(
        'Payment registration ownership changed unexpectedly'
      );
    }


    if (
      paymentRows[0].status !==
      'paid'
    ) {
      throw new Error(
        'Payment status was not updated to paid'
      );
    }


    if (
      paymentRows[0].payment_id !==
      testPaymentId
    ) {
      throw new Error(
        'Payment ID was not saved correctly'
      );
    }


    if (
      paymentRows[0].order_id !==
      testOrderId
    ) {
      throw new Error(
        'Payment order ID changed unexpectedly'
      );
    }


    if (
      Number(paymentRows[0].amount) !==
      249
    ) {
      throw new Error(
        'Payment amount changed unexpectedly'
      );
    }


    if (
      paymentRows[0].currency !==
      'INR'
    ) {
      throw new Error(
        'Payment currency changed unexpectedly'
      );
    }


    if (!paymentRows[0].paid_at) {
      throw new Error(
        'Payment paid_at was not recorded'
      );
    }


    console.log(
      'STEP 6 PAYMENT DATABASE UPDATE PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 8 — Verify Registration Database
    |--------------------------------------------------------------------------
    */

    const [registrationRows] =
      await db.query(
        `
        SELECT
          id,
          payment_status,
          registration_status
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [registrationId]
      );


    console.log(
      'STEP 7 REGISTRATION DB AFTER WEBHOOK:',
      registrationRows[0]
    );


    if (!registrationRows.length) {
      throw new Error(
        'Registration record disappeared'
      );
    }


    if (
      registrationRows[0].payment_status !==
      'paid'
    ) {
      throw new Error(
        'Registration payment_status was not updated to paid'
      );
    }


    if (
      registrationRows[0].registration_status !==
      'registered'
    ) {
      throw new Error(
        'Registration status changed unexpectedly'
      );
    }


    console.log(
      'STEP 7 REGISTRATION DATABASE UPDATE PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 9 — Verify Webhook Log
    |--------------------------------------------------------------------------
    */

    const [webhookRows] =
      await db.query(
        `
        SELECT
          id,
          event_id,
          event_type,
          payment_id,
          order_id,
          signature_valid,
          processing_status,
          error_message,
          processed_at
        FROM payment_webhook_logs
        WHERE event_id = ?
        LIMIT 1
        `,
        [webhookEventId]
      );


    console.log(
      'STEP 8 WEBHOOK LOG:',
      webhookRows[0]
    );


    if (!webhookRows.length) {
      throw new Error(
        'Webhook log was not created'
      );
    }


    if (
      webhookRows[0].event_id !==
      webhookEventId
    ) {
      throw new Error(
        'Webhook event ID was not saved correctly'
      );
    }


    if (
      webhookRows[0].event_type !==
      'payment.captured'
    ) {
      throw new Error(
        'Webhook event type was not saved correctly'
      );
    }


    if (
      webhookRows[0].payment_id !==
      testPaymentId
    ) {
      throw new Error(
        'Webhook payment ID was not saved correctly'
      );
    }


    if (
      webhookRows[0].order_id !==
      testOrderId
    ) {
      throw new Error(
        'Webhook order ID was not saved correctly'
      );
    }


    if (
      webhookRows[0].signature_valid !== 1 &&
      webhookRows[0].signature_valid !== true
    ) {
      throw new Error(
        'Webhook signature was not marked valid'
      );
    }


    if (
      webhookRows[0].processing_status !==
      'processed'
    ) {
      throw new Error(
        'Webhook log was not marked processed'
      );
    }


    if (!webhookRows[0].processed_at) {
      throw new Error(
        'Webhook processed_at was not recorded'
      );
    }


    console.log(
      'STEP 8 WEBHOOK LOG VALIDATION PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 10 — Duplicate Webhook Test
    |--------------------------------------------------------------------------
    */

    const duplicateResponse =
      await axios.post(
        WEBHOOK_URL,
        webhookPayload,
        {
          headers: {
            'Content-Type':
              'application/json',

            'x-razorpay-signature':
              'MOCK_WEBHOOK_SIGNATURE'
          },

          validateStatus: () => true
        }
      );


    console.log(
      'STEP 9 DUPLICATE WEBHOOK STATUS:',
      duplicateResponse.status
    );


    console.log(
      'STEP 9 DUPLICATE WEBHOOK RESPONSE:',
      duplicateResponse.data
    );


    if (
      duplicateResponse.status !== 200 ||
      duplicateResponse.data.success !== true
    ) {
      throw new Error(
        'Duplicate webhook was not handled safely'
      );
    }


    console.log(
      'STEP 9 DUPLICATE WEBHOOK PROTECTION PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 11 — Verify Payment Still Paid
    |--------------------------------------------------------------------------
    */

    const [finalPaymentRows] =
      await db.query(
        `
        SELECT
          status,
          payment_id,
          order_id
        FROM payments
        WHERE id = ?
        LIMIT 1
        `,
        [paymentDbId]
      );


    console.log(
      'STEP 10 FINAL PAYMENT STATE:',
      finalPaymentRows[0]
    );


    if (
      !finalPaymentRows.length ||
      finalPaymentRows[0].status !== 'paid'
    ) {
      throw new Error(
        'Payment state changed after duplicate webhook'
      );
    }


    if (
      finalPaymentRows[0].payment_id !==
      testPaymentId
    ) {
      throw new Error(
        'Payment ID changed after duplicate webhook'
      );
    }


    if (
      finalPaymentRows[0].order_id !==
      testOrderId
    ) {
      throw new Error(
        'Order ID changed after duplicate webhook'
      );
    }


    console.log(
      'STEP 10 DUPLICATE WEBHOOK DATABASE INTEGRITY PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | FINAL SUCCESS
    |--------------------------------------------------------------------------
    */

    console.log('');
    console.log('========================================');
    console.log(
      'PAYMENT WEBHOOK E2E TEST PASSED'
    );
    console.log('========================================');


  } catch (error) {

    console.error('');
    console.error(
      '========================================'
    );

    console.error(
      'PAYMENT WEBHOOK E2E TEST FAILED'
    );

    console.error(
      '========================================'
    );

    console.error(
      error.response?.data ||
      error.message
    );

    process.exitCode = 1;

  } finally {

    await cleanup();

  }
}


runTest();