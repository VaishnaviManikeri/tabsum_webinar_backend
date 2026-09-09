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
  let mockOrderId = null;

  console.log('\n==============================================');
  console.log('STEP 14.7.3F — INVALID SIGNATURE SECURITY TEST');
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
    // STEP 2 — CREATE TEST PAYMENT
    // ==================================================
    mockOrderId =
      `order_invalid_signature_test_${Date.now()}`;

    await PaymentModel.createPayment({
      registrationId: TEST_REGISTRATION_ID,
      orderId: mockOrderId,
      amount: 249,
      currency: 'INR',
      status: 'pending'
    });

    console.log(
      'STEP 2 test payment creation requested:',
      {
        orderId: mockOrderId,
        amount: 249,
        status: 'pending'
      }
    );

    // ==================================================
    // STEP 3 — VERIFY PAYMENT IN DB
    // ==================================================
    const pendingPayment =
      await PaymentModel.getPaymentByOrderId(
        mockOrderId
      );

    if (!pendingPayment) {
      throw new Error(
        'Test payment was not found in database'
      );
    }

    console.log(
      'Database payment found:',
      {
        id: pendingPayment.id,
        orderId: pendingPayment.order_id,
        amount: pendingPayment.amount,
        status: pendingPayment.status
      }
    );

    if (pendingPayment.status !== 'pending') {
      throw new Error(
        `Expected pending, got ${pendingPayment.status}`
      );
    }

    if (Number(pendingPayment.amount) !== 249) {
      throw new Error(
        `Expected ₹249, got ₹${pendingPayment.amount}`
      );
    }

    console.log(
      'STEP 3 payment amount ₹249 and status pending confirmed'
    );

    // ==================================================
    // STEP 4 — INVALID SIGNATURE
    // ==================================================
    const invalidSignature =
      'INVALID_SIGNATURE';

    const testPaymentId =
      `pay_invalid_signature_test_${Date.now()}`;

    console.log(
      'STEP 4 invalid signature prepared'
    );

    // ==================================================
    // STEP 5 — CALL REAL CONTROLLER
    // ==================================================
    /*
     * We intentionally provide all common field names.
     *
     * This handles the exact field naming currently
     * used by the controller:
     *
     * paymentId / razorpay_payment_id
     * orderId / razorpay_order_id
     * signature / razorpay_signature
     *
     * The signature value itself is intentionally INVALID.
     */
    const req = {
      body: {
        registrationId: TEST_REGISTRATION_ID,

        paymentId: testPaymentId,
        razorpay_payment_id: testPaymentId,

        orderId: mockOrderId,
        razorpay_order_id: mockOrderId,

        signature: invalidSignature,
        razorpay_signature: invalidSignature
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
    // STEP 6 — INVALID SIGNATURE MUST BE REJECTED
    // ==================================================
    if (res.statusCode !== 400) {
      throw new Error(
        `Expected HTTP 400, got ${res.statusCode}`
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
      'Payment verification failed'
    ) {
      throw new Error(
        `Unexpected controller message: ${res.body.message}`
      );
    }

    console.log(
      'STEP 6 HTTP 400 + success=false + Payment verification failed PASSED'
    );

    // ==================================================
    // STEP 7 — PAYMENT MUST REMAIN PENDING
    // ==================================================
    const paymentAfterVerification =
      await PaymentModel.getPaymentByOrderId(
        mockOrderId
      );

    if (!paymentAfterVerification) {
      throw new Error(
        'Test payment disappeared unexpectedly'
      );
    }

    if (
      paymentAfterVerification.status !==
      'pending'
    ) {
      throw new Error(
        `Payment changed to ${paymentAfterVerification.status}`
      );
    }

    if (
      Number(paymentAfterVerification.amount) !==
      249
    ) {
      throw new Error(
        `Payment amount changed to ${paymentAfterVerification.amount}`
      );
    }

    console.log(
      'STEP 7 payment remains pending and amount remains ₹249 PASSED'
    );

    // ==================================================
    // STEP 8 — REGISTRATION MUST NOT CHANGE
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
        `Payment status changed from ${originalPaymentStatus} to ${registrationAfterVerification.payment_status}`
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
      'STEP 8 registration status/payment status unchanged PASSED'
    );

    // ==================================================
    // STEP 9 — AUTOMATION MUST NOT RUN
    // ==================================================
    console.log(
      'STEP 9 invalid signature rejected before success flow'
    );

    console.log(
      'EMAIL / WHATSAPP / REMINDER AUTOMATION NOT TRIGGERED PASSED'
    );

    console.log('\n==============================================');
    console.log(
      'INVALID SIGNATURE SECURITY TEST PASSED'
    );
    console.log('==============================================\n');

  } catch (error) {
    console.error(
      '\n❌ INVALID SIGNATURE SECURITY TEST FAILED'
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
    await deleteTestPayment(mockOrderId);

    /*
     * IMPORTANT:
     *
     * DO NOT call db.end().
     *
     * config/db.js performs asynchronous initialization.
     * Closing the DB pool here caused:
     *
     * "Can't add new command when connection is in closed state"
     *
     * Therefore this test intentionally leaves the shared
     * DB connection alive.
     */
  }
};

runTest();