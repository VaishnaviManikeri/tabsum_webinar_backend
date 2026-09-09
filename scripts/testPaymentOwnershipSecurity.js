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


/*
|--------------------------------------------------------------------------
| TEST CONFIGURATION
|--------------------------------------------------------------------------
*/

const ORIGINAL_REGISTRATION_ID = 17;

const TEST_EMAIL =
  `ownership_test_${Date.now()}@example.com`;

const TEST_PHONE =
  `90000${String(Date.now()).slice(-5)}`;

const TEST_ORDER_ID =
  `order_ownership_test_${Date.now()}`;

const TEST_PAYMENT_ID =
  `pay_ownership_test_${Date.now()}`;

const TEST_SIGNATURE =
  'MOCK_SIGNATURE';


/*
|--------------------------------------------------------------------------
| MOCK EXPRESS REQUEST
|--------------------------------------------------------------------------
*/

const createMockRequest = (
  wrongRegistrationId
) => {

  return {

    body: {

      registrationId:
        wrongRegistrationId,

      razorpay_payment_id:
        TEST_PAYMENT_ID,

      razorpay_order_id:
        TEST_ORDER_ID,

      razorpay_signature:
        TEST_SIGNATURE

    }

  };

};


/*
|--------------------------------------------------------------------------
| MOCK EXPRESS RESPONSE
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| MAIN TEST
|--------------------------------------------------------------------------
*/

const runTest = async () => {

  let temporaryRegistrationId = null;

  let testPaymentDbId = null;

  let originalRegistration = null;


  try {

    console.log(
      '\n===================================================='
    );

    console.log(
      'PAYMENT OWNERSHIP SECURITY TEST'
    );

    console.log(
      '===================================================='
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 0
    |--------------------------------------------------------------------------
    */

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


    console.log(
      'RAZORPAY MOCK MODE: ENABLED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 1
    |--------------------------------------------------------------------------
    | Verify original registration exists.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 1: CHECKING ORIGINAL REGISTRATION...'
    );


    originalRegistration =
      await RegistrationModel.getRegistrationById(
        ORIGINAL_REGISTRATION_ID
      );


    if (!originalRegistration) {

      throw new Error(
        `Original registration ${ORIGINAL_REGISTRATION_ID} not found.`
      );

    }


    console.log(
      'Original Registration ID:',
      ORIGINAL_REGISTRATION_ID
    );

    console.log(
      'Original Payment Status:',
      originalRegistration.payment_status
    );

    console.log(
      'Original Registration Status:',
      originalRegistration.registration_status
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 2
    |--------------------------------------------------------------------------
    | Create temporary second registration.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 2: CREATING TEMPORARY SECOND REGISTRATION...'
    );


    const createdRegistration =
      await RegistrationModel.createRegistration({

        webinarId:
          originalRegistration.webinar_id,

        firstName:
          'Ownership',

        lastName:
          'SecurityTest',

        email:
          TEST_EMAIL,

        phone:
          TEST_PHONE,

        city:
          'Test City',

        role:
          'Professional',

        goal:
          'Security testing',

        consent:
          1

      });


    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    | createRegistration() returns:
    |
    | {
    |   leadId,
    |   registrationId,
    |   webinarId
    | }
    |--------------------------------------------------------------------------
    */

    temporaryRegistrationId =
      createdRegistration?.registrationId;


    console.log(
      'Create Registration Result:',
      createdRegistration
    );

    console.log(
      'Temporary Registration ID:',
      temporaryRegistrationId
    );


    if (!temporaryRegistrationId) {

      throw new Error(
        'Temporary registration ID was not returned.'
      );

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 3
    |--------------------------------------------------------------------------
    | Verify temporary registration.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 3: VERIFYING TEMPORARY REGISTRATION...'
    );


    const temporaryRegistration =
      await RegistrationModel.getRegistrationById(
        temporaryRegistrationId
      );


    if (!temporaryRegistration) {

      throw new Error(
        'Temporary registration could not be fetched.'
      );

    }


    console.log(
      'Temporary Registration:',
      temporaryRegistration.id
    );

    console.log(
      'Payment Status:',
      temporaryRegistration.payment_status
    );

    console.log(
      'Registration Status:',
      temporaryRegistration.registration_status
    );


    if (
      temporaryRegistration.payment_status !==
      'pending'
    ) {

      throw new Error(
        `Expected temporary registration payment status pending, received ${temporaryRegistration.payment_status}`
      );

    }


    console.log(
      'TEMPORARY REGISTRATION VALIDATION → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 4
    |--------------------------------------------------------------------------
    | Create payment belonging to ORIGINAL registration.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 4: CREATING PAYMENT FOR ORIGINAL REGISTRATION...'
    );


    testPaymentDbId =
      await PaymentModel.createPayment({

        registrationId:
          ORIGINAL_REGISTRATION_ID,

        orderId:
          TEST_ORDER_ID,

        amount:
          249,

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


    /*
    |--------------------------------------------------------------------------
    | STEP 5
    |--------------------------------------------------------------------------
    | Confirm payment belongs to original registration.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 5: VERIFYING PAYMENT OWNERSHIP...'
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
      'Payment Registration ID:',
      payment.registration_id
    );

    console.log(
      'Original Registration ID:',
      ORIGINAL_REGISTRATION_ID
    );

    console.log(
      'Wrong Registration ID:',
      temporaryRegistrationId
    );


    if (
      Number(payment.registration_id) !==
      Number(ORIGINAL_REGISTRATION_ID)
    ) {

      throw new Error(
        'Payment does not belong to the original registration.'
      );

    }


    if (
      Number(payment.registration_id) ===
      Number(temporaryRegistrationId)
    ) {

      throw new Error(
        'Payment incorrectly belongs to temporary registration.'
      );

    }


    console.log(
      'PAYMENT OWNERSHIP SETUP → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 6
    |--------------------------------------------------------------------------
    | Send ORIGINAL payment with WRONG registration ID.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 6: CALLING verifyPayment() WITH WRONG REGISTRATION...'
    );


    const req =
      createMockRequest(
        temporaryRegistrationId
      );


    const res =
      createMockResponse();


    await verifyPayment(
      req,
      res
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 7
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 7: CONTROLLER RESPONSE'
    );


    console.log(
      JSON.stringify(
        res.responseBody,
        null,
        2
      )
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 8
    |--------------------------------------------------------------------------
    | Validate 403 response.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 8: VALIDATING OWNERSHIP PROTECTION...'
    );


    if (
      res.statusCode !==
      403
    ) {

      throw new Error(
        `Expected HTTP 403, received ${res.statusCode}`
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


    if (
      res.responseBody.message !==
      'Payment does not belong to this registration'
    ) {

      throw new Error(
        `Unexpected message: ${res.responseBody.message}`
      );

    }


    console.log(
      'HTTP 403 → PASSED'
    );

    console.log(
      'success=false → PASSED'
    );

    console.log(
      'Ownership error message → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 9
    |--------------------------------------------------------------------------
    | Verify payment was NOT modified.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 9: VERIFYING PAYMENT WAS NOT MODIFIED...'
    );


    const finalPayment =
      await PaymentModel.getPaymentByOrderId(
        TEST_ORDER_ID
      );


    if (!finalPayment) {

      throw new Error(
        'Test payment unexpectedly disappeared.'
      );

    }


    console.log(
      'Payment Status:',
      finalPayment.status
    );

    console.log(
      'Payment ID:',
      finalPayment.payment_id
    );

    console.log(
      'Payment Registration ID:',
      finalPayment.registration_id
    );


    if (
      finalPayment.status !==
      'pending'
    ) {

      throw new Error(
        `Payment was modified unexpectedly. Status: ${finalPayment.status}`
      );

    }


    if (
      Number(finalPayment.registration_id) !==
      Number(ORIGINAL_REGISTRATION_ID)
    ) {

      throw new Error(
        'Payment ownership was modified unexpectedly.'
      );

    }


    console.log(
      'PAYMENT REMAINED PENDING → PASSED'
    );

    console.log(
      'PAYMENT OWNER REMAINED UNCHANGED → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 10
    |--------------------------------------------------------------------------
    | Verify temporary registration was NOT paid.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 10: VERIFYING WRONG REGISTRATION WAS NOT PAID...'
    );


    const finalTemporaryRegistration =
      await RegistrationModel.getRegistrationById(
        temporaryRegistrationId
      );


    if (!finalTemporaryRegistration) {

      throw new Error(
        'Temporary registration disappeared before cleanup.'
      );

    }


    console.log(
      'Temporary Registration Payment Status:',
      finalTemporaryRegistration.payment_status
    );

    console.log(
      'Temporary Registration Status:',
      finalTemporaryRegistration.registration_status
    );


    if (
      finalTemporaryRegistration.payment_status !==
      'pending'
    ) {

      throw new Error(
        `Wrong registration payment status changed unexpectedly: ${finalTemporaryRegistration.payment_status}`
      );

    }


    console.log(
      'WRONG REGISTRATION REMAINED PENDING → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 11
    |--------------------------------------------------------------------------
    | Verify original registration was not changed.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 11: VERIFYING ORIGINAL REGISTRATION...'
    );


    const finalOriginalRegistration =
      await RegistrationModel.getRegistrationById(
        ORIGINAL_REGISTRATION_ID
      );


    if (!finalOriginalRegistration) {

      throw new Error(
        'Original registration disappeared unexpectedly.'
      );

    }


    console.log(
      'Original Registration Payment Status:',
      finalOriginalRegistration.payment_status
    );

    console.log(
      'Original Registration Status:',
      finalOriginalRegistration.registration_status
    );


    if (
      finalOriginalRegistration.payment_status !==
      originalRegistration.payment_status
    ) {

      throw new Error(
        'Original registration payment status changed unexpectedly.'
      );

    }


    if (
      finalOriginalRegistration.registration_status !==
      originalRegistration.registration_status
    ) {

      throw new Error(
        'Original registration status changed unexpectedly.'
      );

    }


    console.log(
      'ORIGINAL REGISTRATION UNCHANGED → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | FINAL SUCCESS
    |--------------------------------------------------------------------------
    */

    console.log(
      '\n===================================================='
    );

    console.log(
      'PAYMENT OWNERSHIP SECURITY TEST PASSED'
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
      'PAYMENT OWNERSHIP SECURITY TEST FAILED'
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

    /*
    |--------------------------------------------------------------------------
    | CLEANUP
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nCLEANUP / DATABASE RESTORE STARTED...'
    );


    try {

      const db =
        require('../config/db');


      /*
      |--------------------------------------------------------------------------
      | Remove test payment
      |--------------------------------------------------------------------------
      */

      if (testPaymentDbId) {

        await db.execute(
          'DELETE FROM payments WHERE id = ?',
          [testPaymentDbId]
        );

        console.log(
          'TEST PAYMENT CLEANED UP'
        );

      }


      /*
      |--------------------------------------------------------------------------
      | Remove temporary registration
      |--------------------------------------------------------------------------
      */

      if (temporaryRegistrationId) {

        await db.execute(
          'DELETE FROM registrations WHERE id = ?',
          [temporaryRegistrationId]
        );

        console.log(
          'TEMPORARY REGISTRATION CLEANED UP'
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


runTest();