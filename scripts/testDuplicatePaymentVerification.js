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

const TEST_REGISTRATION_ID = 17;

const TEST_PAYMENT_ID =
  `pay_duplicate_test_${Date.now()}`;

const TEST_ORDER_ID =
  `order_duplicate_test_${Date.now()}`;

const TEST_SIGNATURE =
  'MOCK_SIGNATURE';


/*
|--------------------------------------------------------------------------
| MOCK REQUEST
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| MOCK RESPONSE
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

  let testPaymentDbId = null;

  let originalRegistration = null;


  try {

    console.log(
      '\n===================================================='
    );

    console.log(
      'DUPLICATE PAYMENT VERIFICATION TEST'
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
    */

    console.log(
      '\nSTEP 1: FINDING TEST REGISTRATION...'
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
      'Registration exists:',
      TEST_REGISTRATION_ID
    );

    console.log(
      'Name:',
      `${originalRegistration.first_name} ${originalRegistration.last_name || ''}`.trim()
    );

    console.log(
      'Email:',
      originalRegistration.email
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 2
    |--------------------------------------------------------------------------
    | Create an already-paid payment.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 2: CREATING ALREADY-PAID TEST PAYMENT...'
    );


    testPaymentDbId =
      await PaymentModel.createPayment({

        registrationId:
          TEST_REGISTRATION_ID,

        orderId:
          TEST_ORDER_ID,

        amount:
          249,

        currency:
          'INR',

        status:
          'paid'

      });


    console.log(
      'Test Payment DB ID:',
      testPaymentDbId
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 3
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 3: VERIFYING TEST PAYMENT RECORD...'
    );


    const payment =
      await PaymentModel.getPaymentByOrderId(
        TEST_ORDER_ID
      );


    if (!payment) {

      throw new Error(
        'Test payment was not found.'
      );

    }


    console.log(
      'Payment Status:',
      payment.status
    );

    console.log(
      'Payment ID:',
      payment.payment_id
    );

    console.log(
      'Order ID:',
      payment.order_id
    );


    if (
      payment.status !==
      'paid'
    ) {

      throw new Error(
        `Expected payment status paid, received ${payment.status}`
      );

    }


    console.log(
      'ALREADY-PAID PAYMENT RECORD → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 4
    |--------------------------------------------------------------------------
    | Call the real controller.
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | STEP 5
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | STEP 6
    |--------------------------------------------------------------------------
    | Validate HTTP response.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 6: VALIDATING DUPLICATE PAYMENT PROTECTION...'
    );


    if (
      res.statusCode !==
      200
    ) {

      throw new Error(
        `Expected HTTP 200, received ${res.statusCode}`
      );

    }


    if (
      !res.responseBody ||
      res.responseBody.success !== true
    ) {

      throw new Error(
        'Expected success=true.'
      );

    }


    if (
      res.responseBody.message !==
      'Payment already verified'
    ) {

      throw new Error(
        `Unexpected message: ${res.responseBody.message}`
      );

    }


    console.log(
      'HTTP 200 → PASSED'
    );

    console.log(
      'success=true → PASSED'
    );

    console.log(
      'Payment already verified → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 7
    |--------------------------------------------------------------------------
    | Communication must not run again.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 7: VALIDATING EMAIL/WHATSAPP DUPLICATE PROTECTION...'
    );


    const communication =
      res.responseBody.data?.communication;


    if (!communication) {

      throw new Error(
        'Communication status is missing.'
      );

    }


    if (
      communication.email !==
      'already_processed'
    ) {

      throw new Error(
        `Unexpected email status: ${communication.email}`
      );

    }


    if (
      communication.whatsapp !==
      'already_processed'
    ) {

      throw new Error(
        `Unexpected WhatsApp status: ${communication.whatsapp}`
      );

    }


    console.log(
      'Email duplicate protection → PASSED'
    );

    console.log(
      'WhatsApp duplicate protection → PASSED'
    );


    /*
    |--------------------------------------------------------------------------
    | STEP 8
    |--------------------------------------------------------------------------
    | Verify payment still remains paid.
    |--------------------------------------------------------------------------
    */

    console.log(
      '\nSTEP 8: VERIFYING PAYMENT REMAINS PAID...'
    );


    const finalPayment =
      await PaymentModel.getPaymentByOrderId(
        TEST_ORDER_ID
      );


    if (!finalPayment) {

      throw new Error(
        'Test payment was unexpectedly removed.'
      );

    }


    console.log(
      'Final Payment Status:',
      finalPayment.status
    );


    if (
      finalPayment.status !==
      'paid'
    ) {

      throw new Error(
        'Payment status changed unexpectedly.'
      );

    }


    console.log(
      'PAYMENT REMAINS PAID → PASSED'
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
      'DUPLICATE PAYMENT VERIFICATION PASSED'
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
      'DUPLICATE PAYMENT VERIFICATION FAILED'
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


runTest();