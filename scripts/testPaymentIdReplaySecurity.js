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

const ORIGINAL_REGISTRATION_ID = 17;


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
      'TEST PAYMENT DELETED:',
      orderId
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
// CREATE SECOND TEST REGISTRATION
// ======================================================

const createSecondTestRegistration = async () => {

  const result =
    await RegistrationModel.createRegistration({

      firstName:
        'Payment',

      lastName:
        'ReplayTest',

      email:
        `payment.replay.${Date.now()}@example.com`,

      phone:
        '9999999999',

      city:
        'Test City',

      role:
        'Tester',

      goal:
        'Payment replay security testing',

      consent:
        true,

      webinarId:
        1

    });


  return result.registrationId;

};


// ======================================================
// MAIN TEST
// ======================================================

const runTest = async () => {

  let secondRegistrationId = null;

  let originalTestOrderId = null;

  let replayTestOrderId = null;


  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'STEP 14.7.3J - PAYMENT ID REPLAY / CROSS-ORDER SECURITY TEST'
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
  // VERIFY ORIGINAL REGISTRATION
  // ====================================================

  const originalRegistration =
    await RegistrationModel.getRegistrationById(
      ORIGINAL_REGISTRATION_ID
    );


  if (!originalRegistration) {

    throw new Error(
      `Original registration ${ORIGINAL_REGISTRATION_ID} not found`
    );

  }


  console.log(
    'STEP 1 original registration exists:',
    ORIGINAL_REGISTRATION_ID
  );


  // ====================================================
  // STEP 2
  // CREATE SECOND TEST REGISTRATION
  // ====================================================

  secondRegistrationId =
    await createSecondTestRegistration();


  if (!secondRegistrationId) {

    throw new Error(
      'Failed to create second test registration'
    );

  }


  console.log(
    'STEP 2 second test registration created:',
    secondRegistrationId
  );


  // ====================================================
  // STEP 3
  // VERIFY SECOND REGISTRATION
  // ====================================================

  const secondRegistration =
    await RegistrationModel.getRegistrationById(
      secondRegistrationId
    );


  if (!secondRegistration) {

    throw new Error(
      'Second test registration was not found'
    );

  }


  console.log(
    'STEP 3 second registration verified:',
    {
      id:
        secondRegistration.id,

      paymentStatus:
        secondRegistration.payment_status,

      registrationStatus:
        secondRegistration.registration_status

    }
  );


  if (
    secondRegistration.payment_status !==
    'pending'
  ) {

    throw new Error(
      'Second registration payment must be pending'
    );

  }


  // ====================================================
  // STEP 4
  // CREATE ORIGINAL PAYMENT
  // ====================================================

  originalTestOrderId =
    `order_replay_original_${Date.now()}`;


  const originalPayment =
    await PaymentModel.createPayment({

      registrationId:
        ORIGINAL_REGISTRATION_ID,

      orderId:
        originalTestOrderId,

      amount:
        249,

      currency:
        'INR',

      status:
        'paid'

    });


  console.log(
    'STEP 4 original test payment created:',
    {
      paymentId:
        originalPayment.id,

      orderId:
        originalTestOrderId,

      registrationId:
        ORIGINAL_REGISTRATION_ID,

      status:
        'paid'

    }
  );


  // ====================================================
  // STEP 5
  // CREATE SECOND PENDING PAYMENT
  // ====================================================

  replayTestOrderId =
    `order_replay_target_${Date.now()}`;


  const replayTargetPayment =
    await PaymentModel.createPayment({

      registrationId:
        secondRegistrationId,

      orderId:
        replayTestOrderId,

      amount:
        249,

      currency:
        'INR',

      status:
        'pending'

    });


  console.log(
    'STEP 5 second pending payment created:',
    {
      paymentId:
        replayTargetPayment.id,

      orderId:
        replayTestOrderId,

      registrationId:
        secondRegistrationId,

      status:
        'pending'

    }
  );


  // ====================================================
  // STEP 6
  // PREPARE PAYMENT ID REPLAY ATTACK
  // ====================================================

  const originalPaymentId =
    `pay_original_replay_${Date.now()}`;


  const signature =
    generateMockSignature();


  /*
   * IMPORTANT:
   *
   * The attacker attempts to use the ORIGINAL payment ID
   * with the SECOND / TARGET order.
   *
   * Razorpay mock will return the payment as belonging
   * to the ORIGINAL order.
   *
   * Controller must compare:
   *
   * razorpayPayment.order_id
   *
   * against:
   *
   * target database payment.order_id
   *
   * and reject the request.
   */


  process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID =
    originalTestOrderId;


  console.log(
    'STEP 6 payment ID replay attack prepared:',
    {
      originalPaymentId,

      originalOrderId:
        originalTestOrderId,

      targetOrderId:
        replayTestOrderId,

      targetRegistrationId:
        secondRegistrationId

    }
  );


  // ====================================================
  // STEP 7
  // PREPARE VERIFICATION REQUEST
  // ====================================================

  const request = {

    body: {

      registrationId:
        secondRegistrationId,

      paymentId:
        originalPaymentId,

      razorpay_payment_id:
        originalPaymentId,

      orderId:
        replayTestOrderId,

      razorpay_order_id:
        replayTestOrderId,

      signature,

      razorpay_signature:
        signature

    }

  };


  let responseStatus = null;

  let responseBody = null;


  const response = {

    status(code) {

      responseStatus =
        code;

      return this;

    },

    json(data) {

      responseBody =
        data;

      return data;

    }

  };


  console.log(
    'STEP 7 calling REAL verifyPayment controller...'
  );


  // ====================================================
  // STEP 8
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
  // STEP 9
  // VERIFY REPLAY ATTACK REJECTED
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
      'Payment replay must return success=false'
    );

  }


  if (
    responseBody.message !==
    'Payment order mismatch'
  ) {

    throw new Error(
      `Unexpected response message: ${responseBody.message}`
    );

  }


  console.log(
    'STEP 9 HTTP 400 + success=false + Payment order mismatch PASSED'
  );


  // ====================================================
  // STEP 10
  // VERIFY TARGET PAYMENT REMAINS PENDING
  // ====================================================

  const targetPaymentAfterReplay =
    await PaymentModel.getPaymentByOrderId(
      replayTestOrderId
    );


  if (!targetPaymentAfterReplay) {

    throw new Error(
      'Target payment disappeared unexpectedly'
    );

  }


  if (
    targetPaymentAfterReplay.status !==
    'pending'
  ) {

    throw new Error(
      `Target payment status changed unexpectedly: ${targetPaymentAfterReplay.status}`
    );

  }


  if (
    Number(targetPaymentAfterReplay.amount) !==
    249
  ) {

    throw new Error(
      `Target payment amount changed unexpectedly: ${targetPaymentAfterReplay.amount}`
    );

  }


  if (
    String(targetPaymentAfterReplay.currency).toUpperCase() !==
    'INR'
  ) {

    throw new Error(
      `Target payment currency changed unexpectedly: ${targetPaymentAfterReplay.currency}`
    );

  }


  if (
    targetPaymentAfterReplay.order_id !==
    replayTestOrderId
  ) {

    throw new Error(
      'Target payment order ID changed unexpectedly'
    );

  }


  console.log(
    'STEP 10 target payment remains pending, ₹249, INR and target order ID unchanged PASSED'
  );


  // ====================================================
  // STEP 11
  // VERIFY TARGET REGISTRATION UNCHANGED
  // ====================================================

  const targetRegistrationAfterReplay =
    await RegistrationModel.getRegistrationById(
      secondRegistrationId
    );


  if (!targetRegistrationAfterReplay) {

    throw new Error(
      'Target registration disappeared unexpectedly'
    );

  }


  if (
    targetRegistrationAfterReplay.payment_status !==
    'pending'
  ) {

    throw new Error(
      `Target registration payment status changed unexpectedly: ${targetRegistrationAfterReplay.payment_status}`
    );

  }


  if (
    targetRegistrationAfterReplay.registration_status !==
    'registered'
  ) {

    throw new Error(
      `Target registration status changed unexpectedly: ${targetRegistrationAfterReplay.registration_status}`
    );

  }


  console.log(
    'STEP 11 target registration remains pending/registered PASSED'
  );


  // ====================================================
  // STEP 12
  // VERIFY ORIGINAL PAYMENT WAS NOT MODIFIED
  // ====================================================

  const originalPaymentAfterReplay =
    await PaymentModel.getPaymentByOrderId(
      originalTestOrderId
    );


  if (!originalPaymentAfterReplay) {

    throw new Error(
      'Original payment disappeared unexpectedly'
    );

  }


  if (
    originalPaymentAfterReplay.status !==
    'paid'
  ) {

    throw new Error(
      `Original payment status changed unexpectedly: ${originalPaymentAfterReplay.status}`
    );

  }


  console.log(
    'STEP 12 original payment remains paid and unchanged PASSED'
  );


  // ====================================================
  // STEP 13
  // VERIFY AUTOMATION NOT TRIGGERED
  // ====================================================

  if (
    responseBody &&
    responseBody.success === true
  ) {

    throw new Error(
      'Payment replay unexpectedly triggered success flow'
    );

  }


  console.log(
    'STEP 13 payment replay rejected before success flow'
  );


  console.log(
    'EMAIL / WHATSAPP / REMINDER AUTOMATION NOT TRIGGERED PASSED'
  );


  // ====================================================
  // CLEANUP ENVIRONMENT
  // ====================================================

  delete process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID;


  // ====================================================
  // CLEANUP PAYMENTS
  // ====================================================

  await cleanupTestPayment(
    originalTestOrderId
  );


  await cleanupTestPayment(
    replayTestOrderId
  );


  // ====================================================
  // CLEANUP SECOND REGISTRATION
  // ====================================================

  if (secondRegistrationId) {

    try {

      await db.query(
        'DELETE FROM registrations WHERE id = ?',
        [secondRegistrationId]
      );


      console.log(
        'SECOND TEST REGISTRATION DELETED:',
        secondRegistrationId
      );

    }

    catch (error) {

      console.error(
        'Second registration cleanup failed:',
        error.message
      );

    }

  }


  console.log('\n');

  console.log(
    '======================================================'
  );

  console.log(
    'PAYMENT ID REPLAY / CROSS-ORDER SECURITY TEST PASSED'
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


    console.error('\n');

    console.error(
      '======================================================'
    );

    console.error(
      'PAYMENT ID REPLAY / CROSS-ORDER SECURITY TEST FAILED'
    );

    console.error(
      '======================================================'
    );

    console.error(
      error
    );


    await cleanupTestPayment(
      originalTestOrderId
    );


    await cleanupTestPayment(
      replayTestOrderId
    );


    if (secondRegistrationId) {

      try {

        await db.query(
          'DELETE FROM registrations WHERE id = ?',
          [secondRegistrationId]
        );

        console.log(
          'SECOND TEST REGISTRATION CLEANED UP:',
          secondRegistrationId
        );

      }

      catch (cleanupError) {

        console.error(
          'Registration cleanup failed:',
          cleanupError.message
        );

      }

    }


    process.exitCode = 1;

  });