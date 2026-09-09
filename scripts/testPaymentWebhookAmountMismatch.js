const axios = require('axios');
const db = require('../config/db');

const RegistrationModel =
  require('../models/registrationModel');

const PaymentModel =
  require('../models/paymentModel');

const WEBHOOK_URL =
  'http://localhost:5000/api/payments/webhook';

const testEmail =
  `amount_mismatch_${Date.now()}@example.com`;

const testPhone =
  `90100${String(Date.now()).slice(-5)}`;

const testOrderId =
  `order_amount_mismatch_${Date.now()}`;

const testPaymentId =
  `pay_amount_mismatch_${Date.now()}`;

const eventId =
  `evt_amount_mismatch_${Date.now()}`;

let registrationId = null;
let paymentDbId = null;

async function cleanup() {
  try {
    if (registrationId) {
      await db.query(
        `
        DELETE FROM webinar_reminder_logs
        WHERE registration_id = ?
        `,
        [registrationId]
      );
    }

    await db.query(
      `
      DELETE FROM payments
      WHERE order_id = ?
      `,
      [testOrderId]
    );

    await db.query(
      `
      DELETE FROM payment_webhook_logs
      WHERE event_id = ?
      `,
      [eventId]
    );

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
      'AMOUNT MISMATCH TEST DATA CLEANED UP'
    );

  } catch (error) {
    console.error(
      'Cleanup error:',
      error.message
    );
  }
}

async function runTest() {
  try {
    console.log('');
    console.log('========================================');
    console.log(
      'PAYMENT AMOUNT MISMATCH TEST STARTED'
    );
    console.log('========================================');

    /*
    |--------------------------------------------------------------------------
    | STEP 1 — Create temporary registration
    |--------------------------------------------------------------------------
    */

    const registration =
      await RegistrationModel.createRegistration({
        firstName: 'Amount',
        lastName: 'Mismatch',
        email: testEmail,
        phone: testPhone,
        city: 'Pune',
        role: 'Developer',
        goal: 'Amount mismatch security testing',
        consent: true,
        webinarId: 1
      });

    registrationId =
      registration.registrationId;

    console.log(
      'STEP 1 REGISTRATION CREATED:',
      registrationId
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 2 — Create correct ₹249 pending payment
    |--------------------------------------------------------------------------
    */

    await PaymentModel.createPayment({
      registrationId,
      orderId: testOrderId,
      amount: 249,
      currency: 'INR',
      status: 'pending'
    });

    /*
    |--------------------------------------------------------------------------
    | Get payment DB ID
    |--------------------------------------------------------------------------
    */

    const [paymentRowsBefore] =
      await db.query(
        `
        SELECT
          id,
          registration_id,
          order_id,
          amount,
          currency,
          status,
          payment_id
        FROM payments
        WHERE order_id = ?
        LIMIT 1
        `,
        [testOrderId]
      );

    if (!paymentRowsBefore.length) {
      throw new Error(
        'Test payment was not created'
      );
    }

    paymentDbId =
      paymentRowsBefore[0].id;

    console.log(
      'STEP 2 PAYMENT CREATED:',
      paymentRowsBefore[0]
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 3 — Configure mock Razorpay
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
    | STEP 4 — Send webhook with WRONG amount
    |--------------------------------------------------------------------------
    |
    | DB amount = ₹249
    | Webhook amount = ₹100
    |
    */

    const webhookPayload = {
      id: eventId,

      event: 'payment.captured',

      payload: {
        payment: {
          entity: {
            id: testPaymentId,
            order_id: testOrderId,

            // WRONG AMOUNT
            amount: 10000,

            currency: 'INR',
            status: 'captured',
            captured: true
          }
        }
      }
    };

    console.log(
      'STEP 3 WEBHOOK CREATED WITH WRONG AMOUNT'
    );

    console.log(
      'DATABASE AMOUNT: ₹249'
    );

    console.log(
      'WEBHOOK AMOUNT: ₹100'
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 5 — Send webhook
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
      'STEP 4 HTTP STATUS:',
      response.status
    );

    console.log(
      'STEP 4 RESPONSE:',
      response.data
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 6 — Validate rejection
    |--------------------------------------------------------------------------
    */

    if (
      response.status !== 400
    ) {
      throw new Error(
        `Expected HTTP 400 but received ${response.status}`
      );
    }

    if (
      response.data.success !== false
    ) {
      throw new Error(
        'Amount mismatch webhook was not rejected'
      );
    }

    if (
      !String(response.data.message)
        .toLowerCase()
        .includes('amount')
    ) {
      throw new Error(
        'Response does not indicate an amount mismatch'
      );
    }

    console.log(
      'STEP 5 AMOUNT MISMATCH REJECTION PASSED'
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 7 — Verify payment remains pending
    |--------------------------------------------------------------------------
    */

    const [paymentRowsAfter] =
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
        WHERE id = ?
        LIMIT 1
        `,
        [paymentDbId]
      );

    console.log(
      'STEP 6 PAYMENT AFTER REJECTION:',
      paymentRowsAfter[0]
    );

    if (!paymentRowsAfter.length) {
      throw new Error(
        'Payment record disappeared'
      );
    }

    if (
      paymentRowsAfter[0].status !==
      'pending'
    ) {
      throw new Error(
        'Payment was incorrectly marked as paid'
      );
    }

    if (
      paymentRowsAfter[0].payment_id !==
      null
    ) {
      throw new Error(
        'Payment ID was incorrectly saved'
      );
    }

    if (
      Number(paymentRowsAfter[0].amount) !==
      249
    ) {
      throw new Error(
        'Database payment amount changed unexpectedly'
      );
    }

    console.log(
      'STEP 6 PAYMENT STATE INTEGRITY PASSED'
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 8 — Verify registration remains pending
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
      'STEP 7 REGISTRATION AFTER REJECTION:',
      registrationRows[0]
    );

    if (
      registrationRows[0].payment_status !==
      'pending'
    ) {
      throw new Error(
        'Registration was incorrectly marked as paid'
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
      'STEP 7 REGISTRATION STATE INTEGRITY PASSED'
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 9 — Verify no reminders were created
    |--------------------------------------------------------------------------
    */

    const [reminderRows] =
      await db.query(
        `
        SELECT id
        FROM webinar_reminder_logs
        WHERE registration_id = ?
        `,
        [registrationId]
      );

    console.log(
      'STEP 8 REMINDER COUNT:',
      reminderRows.length
    );

    if (reminderRows.length !== 0) {
      throw new Error(
        'Reminders were incorrectly created'
      );
    }

    console.log(
      'STEP 8 NO REMINDER AUTOMATION PASSED'
    );

    /*
    |--------------------------------------------------------------------------
    | STEP 10 — Verify webhook log
    |--------------------------------------------------------------------------
    */

    const [webhookRows] =
      await db.query(
        `
        SELECT
          event_id,
          event_type,
          processing_status,
          error_message
        FROM payment_webhook_logs
        WHERE event_id = ?
        LIMIT 1
        `,
        [eventId]
      );

    console.log(
      'STEP 9 WEBHOOK LOG:',
      webhookRows[0]
    );

    if (!webhookRows.length) {
      throw new Error(
        'Webhook log was not created'
      );
    }

    if (
      webhookRows[0].processing_status !==
      'failed'
    ) {
      throw new Error(
        'Webhook log was not marked failed'
      );
    }

    console.log(
      'STEP 9 WEBHOOK FAILURE LOG PASSED'
    );

    /*
    |--------------------------------------------------------------------------
    | FINAL
    |--------------------------------------------------------------------------
    */

    console.log('');
    console.log('========================================');
    console.log(
      'PAYMENT AMOUNT MISMATCH TEST PASSED'
    );
    console.log('========================================');

  } catch (error) {

    console.error('');
    console.error('========================================');
    console.error(
      'PAYMENT AMOUNT MISMATCH TEST FAILED'
    );
    console.error('========================================');

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