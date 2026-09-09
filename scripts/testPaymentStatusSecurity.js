const dotenv = require('dotenv');

dotenv.config({
  path: '.env.local'
});

dotenv.config();


const PaymentModel =
  require('../models/paymentModel');

const RegistrationModel =
  require('../models/registrationModel');

const {
  verifyPayment
} = require('../controllers/paymentController');


// ======================================================
// TEST CONFIGURATION
// ======================================================

const TEST_REGISTRATION_ID = 17;

const EXPECTED_AMOUNT_RUPEES = 249;

const TEST_ORDER_ID =
  `order_status_test_${Date.now()}`;

const TEST_PAYMENT_ID =
  `pay_status_test_${Date.now()}`;

const TEST_SIGNATURE =
  'MOCK_SIGNATURE';


// ======================================================
// MOCK EXPRESS REQUEST
// ======================================================

const createMockRequest = () => {

  return {

    body: {

      registrationId:
        TEST_REGISTRATION_ID,

      razorpay_payment_id:
        TEST_PAYMENT_ID,

      razorpay_order_id:
        TEST_ORDER_ID,

      razorpay_signature:
        TEST_SIGNATURE

    }

  };

};


// ======================================================
// MOCK EXPRESS RESPONSE
// ======================================================

const createMockResponse = () => {

  return {

    statusCode: null,

    responseBody: null,

    status(code) {

      this.statusCode = code;

      return this;

    },

    json(data) {

      this.responseBody = data;

      return this;

    }

  };

};


// ======================================================
// MAIN TEST
// ======================================================

const runTest = async () => {

  let testPaymentDbId = null;

  let originalRegistration = null;


  try {

    console.log(
      '\n===================================================='
    );

    console.log(
      'PAYMENT STATUS TAMPERING SECURITY TEST'
    );

    console.log(
      '===================================================='
    );


    // ==================================================
    // STEP 0
    // ==================================================

    console.log(
      '\nSTEP 0: CHECKING RAZORPAY MOCK MODE...'
    );


    if (
      String(
        process.env.RAZORPAY_MOCK_MODE || ''
      ).toLowerCase() !== 'true'
    ) {

      throw new Error(
        'RAZORPAY_MOCK_MODE=true is required.'
      );

    }


    const mockStatus =
      String(
        process.env.RAZORPAY_MOCK_PAYMENT_STATUS ||
        ''
      ).toLowerCase();


    if (
      mockStatus !== 'failed'
    ) {

      throw new Error(
        'RAZORPAY_MOCK_PAYMENT_STATUS=failed is required for this test.'
      );

    }


    console.log(
      'RAZORPAY MOCK MODE: ENABLED'
    );

    console.log(
      'RAZORPAY MOCK PAYMENT STATUS:',
      mockStatus
    );


    // ==================================================
    // STEP 1
    // CHECK ORIGINAL REGISTRATION
    // ==================================================

    console.log(
      '\nSTEP 1: CHECKING TEST REGISTRATION...'
    );


    originalRegistration =
      await RegistrationModel.getRegistrationById(
        TEST_REGISTRATION_ID
      );


    if (!originalRegistration) {

      throw new Error(
        `Registration ${TEST_REGISTRATION_ID} not found.`
      );

    }


    console.log(
      'Registration ID:',
      TEST_REGISTRATION_ID
    );

    console.log(
      'Original Payment Status:',
      originalRegistration.payment_status
    );

    console.log(
      'Original Registration Status:',
      originalRegistration.registration_status
    );


    // ==================================================
    // STEP 2
    // CREATE TEST PAYMENT
    // ==================================================

    console.log(
      '\nSTEP 2: CREATING TEST PAYMENT...'
    );


    console.log(
      'Expected Amount:',
      `₹${EXPECTED_AMOUNT_RUPEES}`
    );

    console.log(
      'Test Razorpay Status:',
      'failed'
    );


    testPaymentDbId =
      await PaymentModel.createPayment({

        registrationId:
          TEST_REGISTRATION_ID,

        orderId:
          TEST_ORDER_ID,

        amount:
          EXPECTED_AMOUNT_RUPEES,

        currency:
          'INR',

        status:
          'pending'

      });


    console.log(
      'Test Payment DB ID:',
      testPaymentDbId
    );


    if (!testPaymentDbId) {

      throw new Error(
        'Test payment was not created.'
      );

    }


    // ==================================================
    // STEP 3
    // VERIFY PAYMENT SETUP
    // ==================================================

    console.log(
      '\nSTEP 3: VERIFYING TEST PAYMENT RECORD...'
    );


    const payment =
      await PaymentModel.getPaymentByOrderId(
        TEST_ORDER_ID
      );


    if (!payment) {

      throw new Error(
        'Test payment could not be fetched.'
      );

    }


    console.log(
      'Stored Payment Amount:',
      `₹${payment.amount}`
    );

    console.log(
      'Payment DB Status:',
      payment.status
    );

    console.log(
      'Payment Registration ID:',
      payment.registration_id
    );


    if (
      Number(payment.amount) !==
      EXPECTED_AMOUNT_RUPEES
    ) {

      throw new Error(
        `Expected amount ${EXPECTED_AMOUNT_RUPEES}, received ${payment.amount}`
      );

    }


    if (
      payment.status !==
      'pending'
    ) {

      throw new Error(
        `Expected pending status, received ${payment.status}`
      );

    }


    console.log(
      'PAYMENT SETUP → PASSED'
    );


    // ==================================================
    // STEP 4
    // CALL REAL CONTROLLER
    // ==================================================

    console.log(
      '\nSTEP 4: CALLING REAL verifyPayment()...'
    );


    const req =
      createMockRequest();

    const res =
      createMockResponse();


    await verifyPayment(
      req,
      res
    );


    // ==================================================
    // STEP 5
    // CONTROLLER RESPONSE
    // ==================================================

    console.log(
      '\nSTEP 5: CONTROLLER RESPONSE'
    );


    console.log(
      JSON.stringify(
        res.responseBody,
        null,
        2
      )
    );


    // ==================================================
    // STEP 6
    // VALIDATE FAILED PAYMENT PROTECTION
    // ==================================================

    console.log(
      '\nSTEP 6: VALIDATING PAYMENT STATUS PROTECTION...'
    );


    if (
      res.statusCode !==
      400
    ) {

      throw new Error(
        `Expected HTTP 400, received ${res.statusCode}`
      );

    }


    if (
      !res.responseBody ||
      res.responseBody.success !== false
    ) {

      throw new Error(
        'Expected success=false.'
      );

    }


    const responseMessage =
      String(
        res.responseBody.message || ''
      ).toLowerCase();


    if (
      !responseMessage.includes(
        'not captured'
      )
    ) {

      throw new Error(
        `Unexpected message: ${res.responseBody.message}`
      );

    }


    console.log(
      'HTTP 400 → PASSED'
    );

    console.log(
      'success=false → PASSED'
    );

    console.log(
      'Failed payment rejected → PASSED'
    );


    // ==================================================
    // STEP 7
    // VERIFY PAYMENT REMAINS PENDING
    // ==================================================

    console.log(
      '\nSTEP 7: VERIFYING PAYMENT WAS NOT MARKED PAID...'
    );


    const finalPayment =
      await PaymentModel.getPaymentByOrderId(
        TEST_ORDER_ID
      );


    if (!finalPayment) {

      throw new Error(
        'Test payment disappeared unexpectedly.'
      );

    }


    console.log(
      'Final Payment Status:',
      finalPayment.status
    );

    console.log(
      'Final Payment Amount:',
      `₹${finalPayment.amount}`
    );


    if (
      finalPayment.status !==
      'pending'
    ) {

      throw new Error(
        `Payment was incorrectly marked as ${finalPayment.status}`
      );

    }


    if (
      Number(finalPayment.amount) !==
      EXPECTED_AMOUNT_RUPEES
    ) {

      throw new Error(
        `Payment amount changed unexpectedly: ${finalPayment.amount}`
      );

    }


    console.log(
      'PAYMENT REMAINED PENDING → PASSED'
    );

    console.log(
      'PAYMENT AMOUNT REMAINED ₹249 → PASSED'
    );


    // ==================================================
    // STEP 8
    // VERIFY REGISTRATION UNCHANGED
    // ==================================================

    console.log(
      '\nSTEP 8: VERIFYING REGISTRATION WAS NOT PAID...'
    );


    const finalRegistration =
      await RegistrationModel.getRegistrationById(
        TEST_REGISTRATION_ID
      );


    if (!finalRegistration) {

      throw new Error(
        'Registration disappeared unexpectedly.'
      );

    }


    console.log(
      'Registration Payment Status:',
      finalRegistration.payment_status
    );

    console.log(
      'Registration Status:',
      finalRegistration.registration_status
    );


    if (
      finalRegistration.payment_status !==
      originalRegistration.payment_status
    ) {

      throw new Error(
        'Registration payment status changed unexpectedly.'
      );

    }


    if (
      finalRegistration.registration_status !==
      originalRegistration.registration_status
    ) {

      throw new Error(
        'Registration status changed unexpectedly.'
      );

    }


    console.log(
      'REGISTRATION REMAINED UNCHANGED → PASSED'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log(
      '\n===================================================='
    );

    console.log(
      'PAYMENT STATUS TAMPERING SECURITY TEST PASSED'
    );

    console.log(
      '===================================================='
    );

  }


  catch (error) {

    console.error(
      '\n===================================================='
    );

    console.error(
      'PAYMENT STATUS TAMPERING SECURITY TEST FAILED'
    );

    console.error(
      '===================================================='
    );

    console.error(
      error.message
    );

    process.exitCode = 1;

  }


  finally {

    // ==================================================
    // CLEANUP
    // ==================================================

    console.log(
      '\nCLEANUP / DATABASE RESTORE STARTED...'
    );


    try {

      const db =
        require('../config/db');


      if (testPaymentDbId) {

        await db.execute(
          'DELETE FROM payments WHERE id = ?',
          [testPaymentDbId]
        );

        console.log(
          'TEST PAYMENT CLEANED UP'
        );

      }

    }


    catch (cleanupError) {

      console.error(
        'Cleanup error:',
        cleanupError.message
      );

      process.exitCode = 1;

    }


    console.log(
      'CLEANUP COMPLETED'
    );

    console.log(
      '\nTEST SCRIPT FINISHED'
    );

  }

};


// ======================================================
// RUN TEST
// ======================================================

runTest();