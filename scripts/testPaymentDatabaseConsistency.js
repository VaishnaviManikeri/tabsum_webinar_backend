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

const TEST_WEBINAR_ID = 1;

const PAYMENT_AMOUNT_RUPEES = 249;

const PAYMENT_CURRENCY = 'INR';


// ======================================================
// HELPERS
// ======================================================

const cleanupPayment = async (orderId) => {

  if (!orderId) {
    return;
  }

  try {

    await db.query(
      'DELETE FROM payments WHERE order_id = ?',
      [orderId]
    );

    console.log(
      'TEST PAYMENT CLEANED:',
      orderId
    );

  }

  catch (error) {

    console.error(
      'Payment cleanup failed:',
      error.message
    );

  }

};


const cleanupRegistration = async (registrationId) => {

  if (!registrationId) {
    return;
  }

  try {

    await db.query(
      'DELETE FROM registrations WHERE id = ?',
      [registrationId]
    );

    console.log(
      'TEST REGISTRATION CLEANED:',
      registrationId
    );

  }

  catch (error) {

    console.error(
      'Registration cleanup failed:',
      error.message
    );

  }

};


// ======================================================
// CONTROLLER RESPONSE HELPER
// ======================================================

const createMockResponse = () => {

  let statusCode = null;

  let body = null;


  const response = {

    status(code) {

      statusCode = code;

      return this;

    },

    json(data) {

      body = data;

      return data;

    }

  };


  return {

    response,

    getStatus: () =>
      statusCode,

    getBody: () =>
      body

  };

};


// ======================================================
// MAIN TEST
// ======================================================

const runTest = async () => {

  let testRegistrationId = null;

  let testOrderId = null;

  let testPaymentId = null;


  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'STEP 14.7.3K - DATABASE CONSISTENCY & PAYMENT STATE INTEGRITY TEST'
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
  // CREATE TEMPORARY REGISTRATION
  // ====================================================

  const createdRegistration =
    await RegistrationModel.createRegistration({

      firstName:
        'Database',

      lastName:
        'ConsistencyTest',

      email:
        `database.consistency.${Date.now()}@example.com`,

      phone:
        '9999999999',

      city:
        'Test City',

      role:
        'Tester',

      goal:
        'Database consistency security testing',

      consent:
        true,

      webinarId:
        TEST_WEBINAR_ID

    });


  testRegistrationId =
    createdRegistration.registrationId;


  if (!testRegistrationId) {

    throw new Error(
      'Temporary registration was not created'
    );

  }


  console.log(
    'STEP 1 temporary registration created:',
    testRegistrationId
  );


  // ====================================================
  // STEP 2
  // VERIFY INITIAL REGISTRATION STATE
  // ====================================================

  let registration =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  if (!registration) {

    throw new Error(
      'Temporary registration could not be fetched'
    );

  }


  console.log(
    'STEP 2 initial registration state:',
    {
      paymentStatus:
        registration.payment_status,

      registrationStatus:
        registration.registration_status

    }
  );


  if (
    registration.payment_status !==
    'pending'
  ) {

    throw new Error(
      `Expected payment_status=pending but received ${registration.payment_status}`
    );

  }


  if (
    registration.registration_status !==
    'registered'
  ) {

    throw new Error(
      `Expected registration_status=registered but received ${registration.registration_status}`
    );

  }


  console.log(
    'STEP 2 initial registration state PASSED'
  );


  // ====================================================
  // STEP 3
  // CREATE PENDING PAYMENT
  // ====================================================

  testOrderId =
    `order_db_consistency_${Date.now()}`;


  const createdPayment =
    await PaymentModel.createPayment({

      registrationId:
        testRegistrationId,

      orderId:
        testOrderId,

      amount:
        PAYMENT_AMOUNT_RUPEES,

      currency:
        PAYMENT_CURRENCY,

      status:
        'pending'

    });


  console.log(
    'STEP 3 pending payment created:',
    {
      paymentId:
        createdPayment.id,

      orderId:
        testOrderId,

      amount:
        PAYMENT_AMOUNT_RUPEES,

      currency:
        PAYMENT_CURRENCY,

      status:
        'pending'

    }
  );


  // ====================================================
  // STEP 4
  // VERIFY PENDING STATE CONSISTENCY
  // ====================================================

  let payment =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  registration =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  if (!payment) {

    throw new Error(
      'Pending payment was not found'
    );

  }


  if (
    payment.status !==
    'pending'
  ) {

    throw new Error(
      `Expected payment pending but received ${payment.status}`
    );

  }


  if (
    registration.payment_status !==
    'pending'
  ) {

    throw new Error(
      `Expected registration payment pending but received ${registration.payment_status}`
    );

  }


  console.log(
    'STEP 4 pending payment + pending registration CONSISTENT PASSED'
  );


  // ====================================================
  // STEP 5
  // INVALID SIGNATURE TEST
  // ====================================================

  testPaymentId =
    `pay_db_consistency_invalid_${Date.now()}`;


  const invalidRequest = {

    body: {

      registrationId:
        testRegistrationId,

      paymentId:
        testPaymentId,

      razorpay_payment_id:
        testPaymentId,

      orderId:
        testOrderId,

      razorpay_order_id:
        testOrderId,

      signature:
        'INVALID_SIGNATURE',

      razorpay_signature:
        'INVALID_SIGNATURE'

    }

  };


  const invalidResponse =
    createMockResponse();


  console.log(
    'STEP 5 testing invalid payment signature...'
  );


  await verifyPayment(
    invalidRequest,
    invalidResponse.response
  );


  console.log(
    'Invalid payment response:',
    {
      statusCode:
        invalidResponse.getStatus(),

      body:
        invalidResponse.getBody()

    }
  );


  if (
    invalidResponse.getStatus() !==
    400
  ) {

    throw new Error(
      `Expected invalid payment HTTP 400 but received ${invalidResponse.getStatus()}`
    );

  }


  if (
    invalidResponse.getBody()?.success !==
    false
  ) {

    throw new Error(
      'Invalid payment must return success=false'
    );

  }


  console.log(
    'STEP 5 invalid payment rejected PASSED'
  );


  // ====================================================
  // STEP 6
  // VERIFY DATABASE STILL CONSISTENT
  // ====================================================

  payment =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  registration =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  if (
    payment.status !==
    'pending'
  ) {

    throw new Error(
      `Payment changed unexpectedly after invalid verification: ${payment.status}`
    );

  }


  if (
    registration.payment_status !==
    'pending'
  ) {

    throw new Error(
      `Registration changed unexpectedly after invalid verification: ${registration.payment_status}`
    );

  }


  console.log(
    'STEP 6 invalid payment left payment + registration CONSISTENT PASSED'
  );


  // ====================================================
  // STEP 7
  // PREPARE VALID MOCK PAYMENT
  // ====================================================

  testPaymentId =
    `pay_db_consistency_valid_${Date.now()}`;


  delete process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID;

  delete process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY;


  const validSignature =
    generateMockSignature();


  const validRequest = {

    body: {

      registrationId:
        testRegistrationId,

      paymentId:
        testPaymentId,

      razorpay_payment_id:
        testPaymentId,

      orderId:
        testOrderId,

      razorpay_order_id:
        testOrderId,

      signature:
        validSignature,

      razorpay_signature:
        validSignature

    }

  };


  const validResponse =
    createMockResponse();


  console.log(
    'STEP 7 calling REAL verifyPayment controller with valid payment...'
  );


  await verifyPayment(
    validRequest,
    validResponse.response
  );


  console.log(
    'Valid payment response:',
    {
      statusCode:
        validResponse.getStatus(),

      body:
        validResponse.getBody()

    }
  );


  // ====================================================
  // STEP 8
  // VERIFY SUCCESSFUL PAYMENT STATE
  // ====================================================

  if (
    validResponse.getStatus() !==
    200
  ) {

    throw new Error(
      `Expected successful payment HTTP 200 but received ${validResponse.getStatus()}`
    );

  }


  if (
    validResponse.getBody()?.success !==
    true
  ) {

    throw new Error(
      'Valid payment must return success=true'
    );

  }


  console.log(
    'STEP 8 valid payment verification PASSED'
  );


  // ====================================================
  // STEP 9
  // VERIFY PAID STATE CONSISTENCY
  // ====================================================

  payment =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  registration =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  if (
    payment.status !==
    'paid'
  ) {

    throw new Error(
      `Expected payment status paid but received ${payment.status}`
    );

  }


  if (
    registration.payment_status !==
    'paid'
  ) {

    throw new Error(
      `Expected registration payment status paid but received ${registration.payment_status}`
    );

  }


  if (
    payment.order_id !==
    testOrderId
  ) {

    throw new Error(
      'Payment order ID changed unexpectedly'
    );

  }


  if (
    Number(payment.amount) !==
    PAYMENT_AMOUNT_RUPEES
  ) {

    throw new Error(
      `Payment amount changed unexpectedly: ${payment.amount}`
    );

  }


  if (
    String(payment.currency).toUpperCase() !==
    PAYMENT_CURRENCY
  ) {

    throw new Error(
      `Payment currency changed unexpectedly: ${payment.currency}`
    );

  }


  console.log(
    'STEP 9 payment=paid + registration=paid CONSISTENT PASSED'
  );


  // ====================================================
  // STEP 10
  // DUPLICATE VERIFICATION
  // ====================================================

  const duplicateRequest = {

    body: {

      registrationId:
        testRegistrationId,

      paymentId:
        testPaymentId,

      razorpay_payment_id:
        testPaymentId,

      orderId:
        testOrderId,

      razorpay_order_id:
        testOrderId,

      signature:
        validSignature,

      razorpay_signature:
        validSignature

    }

  };


  const duplicateResponse =
    createMockResponse();


  console.log(
    'STEP 10 testing duplicate verification...'
  );


  await verifyPayment(
    duplicateRequest,
    duplicateResponse.response
  );


  console.log(
    'Duplicate payment response:',
    {
      statusCode:
        duplicateResponse.getStatus(),

      body:
        duplicateResponse.getBody()

    }
  );


  if (
    duplicateResponse.getStatus() !==
    200
  ) {

    throw new Error(
      `Expected duplicate verification HTTP 200 but received ${duplicateResponse.getStatus()}`
    );

  }


  if (
    duplicateResponse.getBody()?.success !==
    true
  ) {

    throw new Error(
      'Duplicate verification should return success=true'
    );

  }


  if (
    duplicateResponse.getBody()?.message !==
    'Payment already verified'
  ) {

    throw new Error(
      `Unexpected duplicate response: ${duplicateResponse.getBody()?.message}`
    );

  }


  console.log(
    'STEP 10 duplicate verification protection PASSED'
  );


  // ====================================================
  // STEP 11
  // VERIFY DUPLICATE DID NOT CHANGE DATABASE
  // ====================================================

  const paymentAfterDuplicate =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  const registrationAfterDuplicate =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  if (
    paymentAfterDuplicate.status !==
    'paid'
  ) {

    throw new Error(
      `Payment changed unexpectedly after duplicate verification: ${paymentAfterDuplicate.status}`
    );

  }


  if (
    registrationAfterDuplicate.payment_status !==
    'paid'
  ) {

    throw new Error(
      `Registration changed unexpectedly after duplicate verification: ${registrationAfterDuplicate.payment_status}`
    );

  }


  console.log(
    'STEP 11 duplicate verification left database state CONSISTENT PASSED'
  );


  // ====================================================
  // STEP 12
  // FINAL CONSISTENCY CHECK
  // ====================================================

  const finalPayment =
    await PaymentModel.getPaymentByOrderId(
      testOrderId
    );


  const finalRegistration =
    await RegistrationModel.getRegistrationById(
      testRegistrationId
    );


  const consistencyChecks = {

    paymentExists:
      Boolean(finalPayment),

    registrationExists:
      Boolean(finalRegistration),

    paymentStatus:
      finalPayment?.status,

    registrationPaymentStatus:
      finalRegistration?.payment_status,

    paymentAmount:
      finalPayment?.amount,

    paymentCurrency:
      finalPayment?.currency,

    paymentOrderId:
      finalPayment?.order_id,

    expectedOrderId:
      testOrderId

  };


  console.log(
    'STEP 12 final database consistency:',
    consistencyChecks
  );


  if (
    !finalPayment ||
    !finalRegistration
  ) {

    throw new Error(
      'Final consistency check failed: payment or registration missing'
    );

  }


  if (
    finalPayment.status !==
    'paid'
  ) {

    throw new Error(
      'Final payment state is not paid'
    );

  }


  if (
    finalRegistration.payment_status !==
    'paid'
  ) {

    throw new Error(
      'Final registration payment state is not paid'
    );

  }


  if (
    Number(finalPayment.amount) !==
    PAYMENT_AMOUNT_RUPEES
  ) {

    throw new Error(
      'Final payment amount mismatch'
    );

  }


  if (
    String(finalPayment.currency).toUpperCase() !==
    PAYMENT_CURRENCY
  ) {

    throw new Error(
      'Final payment currency mismatch'
    );

  }


  if (
    finalPayment.order_id !==
    testOrderId
  ) {

    throw new Error(
      'Final payment order ID mismatch'
    );

  }


  console.log(
    'STEP 12 FINAL DATABASE CONSISTENCY PASSED'
  );


  // ====================================================
  // CLEANUP
  // ====================================================

  delete process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID;

  delete process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY;


  await cleanupPayment(
    testOrderId
  );


  await cleanupRegistration(
    testRegistrationId
  );


  // ====================================================
  // FINAL RESULT
  // ====================================================

  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'DATABASE CONSISTENCY & PAYMENT STATE INTEGRITY TEST PASSED'
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

    delete process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID;

    delete process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY;


    console.error('\n');

    console.error(
      '======================================================'
    );

    console.error(
      'DATABASE CONSISTENCY & PAYMENT STATE INTEGRITY TEST FAILED'
    );

    console.error(
      '======================================================'
    );

    console.error(
      error
    );


    await cleanupPayment(
      testOrderId
    );


    await cleanupRegistration(
      testRegistrationId
    );


    process.exitCode = 1;

  });