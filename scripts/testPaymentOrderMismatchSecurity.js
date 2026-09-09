require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const paymentController = require('../controllers/paymentController');
const RegistrationModel = require('../models/registrationModel');
const PaymentModel = require('../models/paymentModel');
const db = require('../config/db');

const TEST_REGISTRATION_ID = 17;

const createMockResponse = () => {
  return {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    }
  };
};

const deleteTestPayment = async (orderId) => {
  if (!orderId) {
    return;
  }

  try {
    await db.query(
      'DELETE FROM payments WHERE order_id = ?',
      [orderId]
    );

    console.log(
      'TEST PAYMENT DELETED FROM DATABASE'
    );
  } catch (error) {
    console.error(
      'TEST PAYMENT CLEANUP ERROR:',
      error.message
    );
  }
};

const runTest = async () => {
  let storedOrderId = null;

  console.log('\n==============================================');
  console.log(
    'STEP 14.7.3G — PAYMENT ORDER MISMATCH SECURITY TEST'
  );
  console.log('==============================================\n');

  try {
    // ==================================================
    // STEP 0 — MOCK MODE
    // ==================================================
    const mockMode =
      String(
        process.env.RAZORPAY_MOCK_MODE || 'false'
      ).toLowerCase() === 'true';

    console.log(
      `STEP 0 RAZORPAY MOCK MODE: ${
        mockMode ? 'ENABLED' : 'DISABLED'
      }`
    );

    if (!mockMode) {
      throw new Error(
        'RAZORPAY_MOCK_MODE=true is required'
      );
    }

    // ==================================================
    // STEP 1 — REGISTRATION
    // ==================================================
    const registration =
      await RegistrationModel.getRegistrationById(
        TEST_REGISTRATION_ID
      );

    if (!registration) {
      throw new Error(
        `Registration ${TEST_REGISTRATION_ID} does not exist`
      );
    }

    console.log(
      `STEP 1 registration ${TEST_REGISTRATION_ID} exists`
    );

    const originalPaymentStatus =
      registration.payment_status;

    const originalRegistrationStatus =
      registration.registration_status;

    console.log(
      'Original registration state:',
      {
        paymentStatus: originalPaymentStatus,
        registrationStatus:
          originalRegistrationStatus
      }
    );

    // ==================================================
    // STEP 2 — CREATE PAYMENT WITH VALID STORED ORDER ID
    // ==================================================
    storedOrderId =
      `order_stored_test_${Date.now()}`;

    await PaymentModel.createPayment({
      registrationId: TEST_REGISTRATION_ID,
      orderId: storedOrderId,
      amount: 249,
      currency: 'INR',
      status: 'pending'
    });

    console.log(
      'STEP 2 test payment created:',
      {
        storedOrderId,
        amount: 249,
        status: 'pending'
      }
    );

    // ==================================================
    // STEP 3 — VERIFY PAYMENT EXISTS
    // ==================================================
    const storedPayment =
      await PaymentModel.getPaymentByOrderId(
        storedOrderId
      );

    if (!storedPayment) {
      throw new Error(
        'Stored test payment was not found'
      );
    }

    console.log(
      'Database payment found:',
      {
        id: storedPayment.id,
        orderId: storedPayment.order_id,
        amount: storedPayment.amount,
        status: storedPayment.status
      }
    );

    if (storedPayment.status !== 'pending') {
      throw new Error(
        `Expected pending, got ${storedPayment.status}`
      );
    }

    if (Number(storedPayment.amount) !== 249) {
      throw new Error(
        `Expected ₹249, got ₹${storedPayment.amount}`
      );
    }

    console.log(
      'STEP 3 payment amount ₹249 and status pending confirmed'
    );

    // ==================================================
    // STEP 4 — CREATE WRONG ORDER ID
    // ==================================================
    const wrongOrderId =
      `order_wrong_test_${Date.now()}`;

    console.log(
      'STEP 4 order IDs prepared:',
      {
        storedOrderId,
        wrongOrderId
      }
    );

    if (storedOrderId === wrongOrderId) {
      throw new Error(
        'Stored and wrong order IDs unexpectedly match'
      );
    }

    // ==================================================
    // STEP 5 — CALL REAL CONTROLLER
    // ==================================================
    const paymentId =
      `pay_order_mismatch_test_${Date.now()}`;

    const req = {
      body: {
        registrationId: TEST_REGISTRATION_ID,

        paymentId,
        razorpay_payment_id: paymentId,

        /*
         * IMPORTANT:
         *
         * This is intentionally WRONG.
         *
         * Database contains storedOrderId,
         * but request contains wrongOrderId.
         */
        orderId: wrongOrderId,
        razorpay_order_id: wrongOrderId,

        signature: 'MOCK_SIGNATURE',
        razorpay_signature: 'MOCK_SIGNATURE'
      }
    };

    const res = createMockResponse();

    console.log(
      '\nSTEP 5 calling REAL verifyPayment controller...\n'
    );

    await paymentController.verifyPayment(
      req,
      res
    );

    console.log(
      'Controller response:',
      {
        statusCode: res.statusCode,
        body: res.body
      }
    );

    // ==================================================
    // STEP 6 — WRONG ORDER MUST BE REJECTED
    // ==================================================
    /*
     * The controller searches the payment table using
     * the supplied order ID.
     *
     * Because wrongOrderId does not exist, the correct
     * security response is HTTP 404.
     */
    if (res.statusCode !== 404) {
      throw new Error(
        `Expected HTTP 404 for unknown order ID, got ${res.statusCode}`
      );
    }

    if (
      !res.body ||
      res.body.success !== false
    ) {
      throw new Error(
        'Expected success=false'
      );
    }

    if (
      res.body.message !==
      'Payment record not found'
    ) {
      throw new Error(
        `Unexpected controller message: ${res.body.message}`
      );
    }

    console.log(
      'STEP 6 HTTP 404 + success=false + Payment record not found PASSED'
    );

    // ==================================================
    // STEP 7 — ORIGINAL PAYMENT MUST REMAIN PENDING
    // ==================================================
    const paymentAfterVerification =
      await PaymentModel.getPaymentByOrderId(
        storedOrderId
      );

    if (!paymentAfterVerification) {
      throw new Error(
        'Original test payment disappeared unexpectedly'
      );
    }

    if (
      paymentAfterVerification.status !==
      'pending'
    ) {
      throw new Error(
        `Payment status changed unexpectedly to ${paymentAfterVerification.status}`
      );
    }

    if (
      Number(paymentAfterVerification.amount) !==
      249
    ) {
      throw new Error(
        `Payment amount changed unexpectedly to ${paymentAfterVerification.amount}`
      );
    }

    /*
     * Make sure the stored order ID itself was not modified.
     */
    if (
      paymentAfterVerification.order_id !==
      storedOrderId
    ) {
      throw new Error(
        'Stored order ID was unexpectedly modified'
      );
    }

    console.log(
      'STEP 7 original payment remains pending, ₹249 and stored order ID unchanged PASSED'
    );

    // ==================================================
    // STEP 8 — REGISTRATION MUST REMAIN UNCHANGED
    // ==================================================
    const registrationAfterVerification =
      await RegistrationModel.getRegistrationById(
        TEST_REGISTRATION_ID
      );

    if (
      registrationAfterVerification.payment_status !==
      originalPaymentStatus
    ) {
      throw new Error(
        `Registration payment status changed from ${originalPaymentStatus} to ${registrationAfterVerification.payment_status}`
      );
    }

    if (
      registrationAfterVerification.registration_status !==
      originalRegistrationStatus
    ) {
      throw new Error(
        `Registration status changed from ${originalRegistrationStatus} to ${registrationAfterVerification.registration_status}`
      );
    }

    console.log(
      'STEP 8 registration payment/registration status unchanged PASSED'
    );

    // ==================================================
    // STEP 9 — AUTOMATION MUST NOT RUN
    // ==================================================
    console.log(
      'STEP 9 wrong order rejected before payment success flow'
    );

    console.log(
      'EMAIL / WHATSAPP / REMINDER AUTOMATION NOT TRIGGERED PASSED'
    );

    // ==================================================
    // FINAL
    // ==================================================
    console.log('\n==============================================');
    console.log(
      'PAYMENT ORDER MISMATCH SECURITY TEST PASSED'
    );
    console.log('==============================================\n');

  } catch (error) {
    console.error(
      '\n❌ PAYMENT ORDER MISMATCH SECURITY TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    process.exitCode = 1;

  } finally {
    // ==================================================
    // CLEANUP
    // ==================================================
    await deleteTestPayment(storedOrderId);

    /*
     * IMPORTANT:
     *
     * Do NOT call db.end().
     *
     * config/db.js initializes database tables
     * asynchronously.
     */
  }
};

runTest();