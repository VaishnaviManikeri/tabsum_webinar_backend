require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const RegistrationModel =
  require('../models/registrationModel');

const PaymentModel =
  require('../models/paymentModel');

const PaymentWebhookModel =
  require('../models/paymentWebhookModel');

const {
  generateMockWebhookSignature
} = require('../services/razorpayService');

const API_URL =
  'http://localhost:5000/api';

async function cleanup(
  registrationId,
  paymentDbId,
  eventId
) {
  try {
    if (eventId) {
      await db.query(
        `DELETE FROM payment_webhook_logs
         WHERE event_id = ?`,
        [eventId]
      );
    }

    if (paymentDbId) {
      await db.query(
        `DELETE FROM payments
         WHERE id = ?`,
        [paymentDbId]
      );
    }

    if (registrationId) {
      await db.query(
        `DELETE FROM registrations
         WHERE id = ?`,
        [registrationId]
      );
    }
  } catch (error) {
    console.error(
      'Cleanup error:',
      error.message
    );
  }
}

async function runTest() {
  let registrationId = null;
  let paymentDbId = null;
  let eventId = null;

  try {
    console.log(
      '========================================'
    );
    console.log(
      'PAYMENT STATUS MISMATCH TEST STARTED'
    );
    console.log(
      '========================================'
    );

    const testId = Date.now();

    /*
     * STEP 1
     * Create temporary registration
     */
    const registration =
      await RegistrationModel.createRegistration({
        firstName: 'Status',
        lastName: 'Mismatch Test',
        email:
          `status_mismatch_${testId}@example.com`,
        phone: '9999999999',
        city: 'Pune',
        role: 'Test User',
        goal:
          'Webhook payment status security test',
        consent: 1,
        webinarId: 1
      });

    registrationId =
      registration.registrationId;

    console.log(
      'STEP 1 REGISTRATION CREATED:',
      registrationId
    );

    /*
     * STEP 2
     * Create pending payment
     */
    const orderId =
      `order_status_mismatch_${testId}`;

    const payment =
      await PaymentModel.createPayment({
        registrationId,
        orderId,
        amount: 249,
        currency: 'INR',
        status: 'pending'
      });

    paymentDbId = payment.id;

    console.log(
      'STEP 2 PAYMENT CREATED:',
      payment
    );

    /*
     * STEP 3
     * Create webhook with failed payment
     *
     * This is intentionally NOT captured.
     */
    eventId =
      `evt_status_mismatch_${testId}`;

    const paymentId =
      `pay_status_mismatch_${testId}`;

    const webhookPayload = {
      id: eventId,

      event: 'payment.captured',

      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 24900,
            currency: 'INR',

            // INTENTIONALLY FAILED
            status: 'failed',
            captured: false
          }
        }
      }
    };

    console.log(
      'STEP 3 WEBHOOK CREATED WITH FAILED STATUS'
    );

    console.log(
      'WEBHOOK STATUS: failed'
    );

    console.log(
      'WEBHOOK CAPTURED: false'
    );

    /*
     * STEP 4
     * Send webhook
     */
    const rawBody =
      JSON.stringify(webhookPayload);

    const signature =
      generateMockWebhookSignature();

    const response =
      await axios.post(
        `${API_URL}/payments/webhook`,
        rawBody,
        {
          headers: {
            'Content-Type':
              'application/json',

            'x-razorpay-signature':
              signature
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
     * Failed payment must NOT be marked paid.
     *
     * Depending on the controller's validation
     * response, this should return HTTP 400.
     */
    if (response.status !== 400) {
      throw new Error(
        `Expected HTTP 400 but received ${response.status}`
      );
    }

    console.log(
      'STEP 5 PAYMENT STATUS REJECTION PASSED'
    );

    /*
     * STEP 6
     * Verify payment database state
     */
    const paymentAfter =
      await PaymentModel
        .getPaymentByRegistrationId(
          registrationId
        );

    console.log(
      'STEP 6 PAYMENT AFTER REJECTION:',
      paymentAfter
    );

    if (!paymentAfter) {
      throw new Error(
        'Payment record not found after webhook rejection'
      );
    }

    if (
      paymentAfter.status !==
      'pending'
    ) {
      throw new Error(
        `Payment status changed unexpectedly: ${paymentAfter.status}`
      );
    }

    if (
      paymentAfter.currency !==
      'INR'
    ) {
      throw new Error(
        `Payment currency changed unexpectedly: ${paymentAfter.currency}`
      );
    }

    console.log(
      'STEP 6 PAYMENT STATE INTEGRITY PASSED'
    );

    /*
     * STEP 7
     * Verify registration state
     */
    const registrationAfter =
      await RegistrationModel
        .getRegistrationById(
          registrationId
        );

    console.log(
      'STEP 7 REGISTRATION AFTER REJECTION:',
      {
        id: registrationAfter.id,
        payment_status:
          registrationAfter.payment_status,
        registration_status:
          registrationAfter.registration_status
      }
    );

    if (
      registrationAfter.payment_status !==
      'pending'
    ) {
      throw new Error(
        `Registration payment status changed unexpectedly: ${registrationAfter.payment_status}`
      );
    }

    if (
      registrationAfter.registration_status !==
      'registered'
    ) {
      throw new Error(
        `Registration status changed unexpectedly: ${registrationAfter.registration_status}`
      );
    }

    console.log(
      'STEP 7 REGISTRATION STATE INTEGRITY PASSED'
    );

    /*
     * STEP 8
     * Verify no reminder automation
     */
    const [reminderRows] =
      await db.query(
        `
        SELECT COUNT(*) AS count
        FROM webinar_reminder_logs
        WHERE registration_id = ?
        `,
        [registrationId]
      );

    const reminderCount =
      Number(reminderRows[0].count);

    console.log(
      'STEP 8 REMINDER COUNT:',
      reminderCount
    );

    if (reminderCount !== 0) {
      throw new Error(
        `Expected 0 reminders but found ${reminderCount}`
      );
    }

    console.log(
      'STEP 8 NO REMINDER AUTOMATION PASSED'
    );

    /*
     * STEP 9
     * Verify webhook failure log
     */
    const webhookLog =
      await PaymentWebhookModel
        .getByEventId(eventId);

    console.log(
      'STEP 9 WEBHOOK LOG:',
      webhookLog
    );

    if (!webhookLog) {
      throw new Error(
        'Webhook log was not created'
      );
    }

    if (
      webhookLog.processing_status !==
      'failed'
    ) {
      throw new Error(
        `Expected webhook status failed but received ${webhookLog.processing_status}`
      );
    }

    if (
      !webhookLog.error_message
    ) {
      throw new Error(
        'Webhook failure reason is missing'
      );
    }

    console.log(
      'STEP 9 WEBHOOK FAILURE LOG PASSED'
    );

    console.log('');
    console.log(
      '========================================'
    );
    console.log(
      'PAYMENT STATUS MISMATCH TEST PASSED'
    );
    console.log(
      '========================================'
    );

  } catch (error) {
    console.log('');
    console.log(
      '========================================'
    );
    console.log(
      'PAYMENT STATUS MISMATCH TEST FAILED'
    );
    console.log(
      '========================================'
    );

    console.error(
      error.message
    );

    process.exitCode = 1;

  } finally {
    await cleanup(
      registrationId,
      paymentDbId,
      eventId
    );

    console.log(
      'STATUS MISMATCH TEST DATA CLEANED UP'
    );

    process.exit();
  }
}

runTest();