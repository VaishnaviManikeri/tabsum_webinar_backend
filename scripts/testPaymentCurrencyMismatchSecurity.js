require('dotenv').config({
  path: '.env.local'
});

require('dotenv').config();


const db = require('../config/db');

const RegistrationModel =
  require('../models/registrationModel');

const PaymentModel =
  require('../models/paymentModel');


const {
  verifyPayment
} = require('../controllers/paymentController');


const {
  RAZORPAY_MOCK_MODE,
  generateMockSignature
} = require('../services/razorpayService');


// ======================================================
// TEST CONFIGURATION
// ======================================================

const TEST_REGISTRATION_ID = 17;

const EXPECTED_AMOUNT_RUPEES = 249;

const EXPECTED_AMOUNT_PAISE = 24900;

const EXPECTED_CURRENCY = 'INR';

const MOCK_WRONG_CURRENCY = 'USD';


// ======================================================
// CLEANUP HELPER
// ======================================================

const cleanupTestPayment = async (orderId) => {

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

  }

  catch (error) {

    console.error(
      'Test payment cleanup failed:',
      error.message
    );

  }

};


// ======================================================
// MAIN TEST
// ======================================================

const runTest = async () => {

  let testOrderId = null;

  let originalRegistrationState = null;


  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'STEP 14.7.3I - PAYMENT CURRENCY MISMATCH SECURITY TEST'
  );

  console.log(
    '======================================================'
  );

  console.log('\n');


  // ====================================================
  // STEP 0
  // VERIFY MOCK MODE
  // ====================================================

  console.log(
    'STEP 0 RAZORPAY MOCK MODE:',
    RAZORPAY_MOCK_MODE
      ? 'ENABLED'
      : 'DISABLED'
  );


  if (!RAZORPAY_MOCK_MODE) {

    throw new Error(
      'RAZORPAY_MOCK_MODE must be enabled for this test'
    );

  }


  // ====================================================
  // STEP 1
  // VERIFY REGISTRATION
  // ====================================================

  const registration =
    await RegistrationModel.getRegistrationById(
      TEST_REGISTRATION_ID
    );


  if (!registration) {

    throw new Error(
      `Registration ${TEST_REGISTRATION_ID} not found`
    );

  }


  originalRegistrationState = {

    paymentStatus:
      registration.payment_status,

    registrationStatus:
      registration.registration_status

  };


  console.log(
    'STEP 1 registration',
    TEST_REGISTRATION_ID,
    'exists'
  );


  console.log(
    'Original registration state:',
    originalRegistrationState
  );


  // ====================================================
  // STEP 2
  // CREATE TEST PAYMENT
  // ====================================================

  testOrderId =
    `order_currency_test_${Date.now()}`;


  const createdPayment =
    await PaymentModel.createPayment({

      registrationId:
        TEST_REGISTRATION_ID,

      orderId:
        testOrderId,

      amount:
        EXPECTED_AMOUNT_RUPEES,

      currency:
        EXPECTED_CURRENCY,

      status:
        'pending'

    });


  console.log(
    'STEP 2 test payment created:',
    {
      paymentId:
        createdPayment.id,

      orderId:
        testOrderId,

      amount:
        EXPECTED_AMOUNT_RUPEES,

      currency:
        EXPECTED_CURRENCY,

      status:
        'pending'

    }
  );


  // ====================================================
  // STEP 3
  // VERIFY DATABASE PAYMENT
  // ====================================================

  const databasePayment =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  if (!databasePayment) {

    throw new Error(
      'Test payment was not found in database'
    );

  }


  console.log(
    'STEP 3 database payment verified:',
    {
      id:
        databasePayment.id,

      amount:
        databasePayment.amount,

      currency:
        databasePayment.currency,

      status:
        databasePayment.status,

      orderId:
        databasePayment.order_id

    }
  );


  if (
    Number(databasePayment.amount) !==
    EXPECTED_AMOUNT_RUPEES
  ) {

    throw new Error(
      'Database payment amount is incorrect'
    );

  }


  if (
    String(databasePayment.currency).toUpperCase() !==
    EXPECTED_CURRENCY
  ) {

    throw new Error(
      'Database payment currency is incorrect'
    );

  }


  if (
    databasePayment.status !==
    'pending'
  ) {

    throw new Error(
      'Test payment must initially be pending'
    );

  }


  console.log(
    'STEP 3 database setup PASSED'
  );


  // ====================================================
  // STEP 4
  // PREPARE WRONG RAZORPAY CURRENCY
  // ====================================================

  process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY =
    MOCK_WRONG_CURRENCY;


  console.log(
    'STEP 4 payment currency mismatch prepared:',
    {
      databaseCurrency:
        EXPECTED_CURRENCY,

      razorpayMockCurrency:
        MOCK_WRONG_CURRENCY

    }
  );


  // ====================================================
  // STEP 5
  // PREPARE PAYMENT VERIFICATION REQUEST
  // ====================================================

  const paymentId =
    `pay_currency_test_${Date.now()}`;


  const signature =
    generateMockSignature();


  const request = {

    body: {

      registrationId:
        TEST_REGISTRATION_ID,

      paymentId,

      razorpay_payment_id:
        paymentId,

      orderId:
        testOrderId,

      razorpay_order_id:
        testOrderId,

      signature,

      razorpay_signature:
        signature

    }

  };


  let responseStatus = null;

  let responseBody = null;


  const response = {

    status(code) {

      responseStatus = code;

      return this;

    },

    json(data) {

      responseBody = data;

      return data;

    }

  };


  console.log(
    'STEP 5 calling REAL verifyPayment controller...'
  );


  // ====================================================
  // STEP 6
  // CALL REAL CONTROLLER
  // ====================================================

  await verifyPayment(
    request,
    response
  );


  console.log(
    'Controller response:',
    {
      statusCode:
        responseStatus,

      body:
        responseBody

    }
  );


  // ====================================================
  // STEP 7
  // VERIFY CURRENCY MISMATCH REJECTED
  // ====================================================

  if (
    responseStatus !==
    400
  ) {

    throw new Error(
      `Expected HTTP 400 but received ${responseStatus}`
    );

  }


  if (
    !responseBody ||
    responseBody.success !==
    false
  ) {

    throw new Error(
      'Currency mismatch should return success=false'
    );

  }


  if (
    responseBody.message !==
    'Payment currency mismatch'
  ) {

    throw new Error(
      `Unexpected error message: ${responseBody.message}`
    );

  }


  console.log(
    'STEP 7 HTTP 400 + success=false + Payment currency mismatch PASSED'
  );


  // ====================================================
  // STEP 8
  // VERIFY PAYMENT REMAINS PENDING
  // ====================================================

  const paymentAfterVerification =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  if (!paymentAfterVerification) {

    throw new Error(
      'Test payment disappeared from database'
    );

  }


  if (
    paymentAfterVerification.status !==
    'pending'
  ) {

    throw new Error(
      `Payment status changed unexpectedly: ${paymentAfterVerification.status}`
    );

  }


  if (
    Number(paymentAfterVerification.amount) !==
    EXPECTED_AMOUNT_RUPEES
  ) {

    throw new Error(
      `Payment amount changed unexpectedly: ${paymentAfterVerification.amount}`
    );

  }


  if (
    String(paymentAfterVerification.currency).toUpperCase() !==
    EXPECTED_CURRENCY
  ) {

    throw new Error(
      `Payment currency changed unexpectedly: ${paymentAfterVerification.currency}`
    );

  }


  if (
    paymentAfterVerification.order_id !==
    testOrderId
  ) {

    throw new Error(
      'Stored payment order ID changed unexpectedly'
    );

  }


  console.log(
    'STEP 8 payment remains pending, ₹249, INR and stored order ID unchanged PASSED'
  );


  // ====================================================
  // STEP 9
  // VERIFY REGISTRATION UNCHANGED
  // ====================================================

  const registrationAfterVerification =
    await RegistrationModel.getRegistrationById(
      TEST_REGISTRATION_ID
    );


  if (!registrationAfterVerification) {

    throw new Error(
      'Registration disappeared unexpectedly'
    );

  }


  if (
    registrationAfterVerification.payment_status !==
    originalRegistrationState.paymentStatus
  ) {

    throw new Error(
      `Registration payment status changed unexpectedly: ${registrationAfterVerification.payment_status}`
    );

  }


  if (
    registrationAfterVerification.registration_status !==
    originalRegistrationState.registrationStatus
  ) {

    throw new Error(
      `Registration status changed unexpectedly: ${registrationAfterVerification.registration_status}`
    );

  }


  console.log(
    'STEP 9 registration payment/registration status unchanged PASSED'
  );


  // ====================================================
  // STEP 10
  // VERIFY AUTOMATION NOT TRIGGERED
  // ====================================================

  if (
    responseBody &&
    responseBody.success === true
  ) {

    throw new Error(
      'Payment success flow was triggered unexpectedly'
    );

  }


  console.log(
    'STEP 10 payment rejected before success flow'
  );


  console.log(
    'EMAIL / WHATSAPP / REMINDER AUTOMATION NOT TRIGGERED PASSED'
  );


  // ====================================================
  // CLEANUP ENVIRONMENT VARIABLE
  // ====================================================

  delete process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY;


  // ====================================================
  // CLEANUP TEST PAYMENT
  // ====================================================

  await cleanupTestPayment(
    testOrderId
  );


  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'PAYMENT CURRENCY MISMATCH SECURITY TEST PASSED'
  );

  console.log(
    '======================================================'
  );

  console.log('\n');

};


// ======================================================
// RUN TEST
// ======================================================

runTest()

  .catch(async (error) => {

    delete process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY;


    console.error('\n');

    console.error(
      '======================================================'
    );

    console.error(
      'PAYMENT CURRENCY MISMATCH SECURITY TEST FAILED'
    );

    console.error(
      '======================================================'
    );

    console.error(
      error
    );


    await cleanupTestPayment(
      testOrderId
    );


    process.exitCode = 1;

  });