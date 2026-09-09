const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({
  path: '.env.local'
});

dotenv.config();


// ======================================================
// RAZORPAY CONFIGURATION
// ======================================================

const RAZORPAY_MOCK_MODE =
  String(
    process.env.RAZORPAY_MOCK_MODE || 'false'
  ).toLowerCase() === 'true';


// ======================================================
// MOCK PAYMENT STATUS
// ======================================================
//
// Used only when RAZORPAY_MOCK_MODE=true.
//
// Default:
// captured
//
// For failed payment security testing:
//
// RAZORPAY_MOCK_PAYMENT_STATUS=failed
//
// ======================================================

const RAZORPAY_MOCK_PAYMENT_STATUS =
  String(
    process.env.RAZORPAY_MOCK_PAYMENT_STATUS ||
    'captured'
  ).toLowerCase();


// ======================================================
// RAZORPAY CLIENT
// ======================================================

const razorpay = new Razorpay({

  key_id:
    process.env.RAZORPAY_KEY_ID,

  key_secret:
    process.env.RAZORPAY_KEY_SECRET

});


// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

const createRazorpayOrder = async ({
  amount,
  currency = 'INR',
  receipt,
  notes = {}
}) => {

  // ====================================================
  // MOCK MODE
  // ====================================================

  if (RAZORPAY_MOCK_MODE) {

    const mockOrder = {

      id:
        `order_mock_${Date.now()}`,

      entity:
        'order',

      amount,

      amount_paid:
        0,

      amount_due:
        amount,

      currency,

      receipt,

      status:
        'created',

      attempts:
        0,

      notes,

      created_at:
        Math.floor(
          Date.now() / 1000
        )

    };


    console.log(
      'RAZORPAY MOCK ORDER CREATED:',
      mockOrder.id
    );


    return mockOrder;

  }


  // ====================================================
  // REAL RAZORPAY MODE
  // ====================================================

  try {

    const options = {

      amount,

      currency,

      receipt,

      notes,

      partial_payment:
        false

    };


    const order =
      await razorpay.orders.create(
        options
      );


    return order;

  }

  catch (error) {

    console.error(
      'Razorpay order creation error:',
      error
    );


    throw error;

  }

};


// ======================================================
// VERIFY RAZORPAY PAYMENT SIGNATURE
// ======================================================
//
// Razorpay payment verification:
//
// HMAC_SHA256(
//   order_id + "|" + payment_id,
//   secret
// )
//
// ======================================================

const verifyRazorpaySignature = ({
  orderId,
  paymentId,
  signature
}) => {

  try {

    // ====================================================
    // MOCK MODE
    // ====================================================

    if (RAZORPAY_MOCK_MODE) {

      const expectedMockSignature =
        'MOCK_SIGNATURE';


      const isValid =
        signature ===
        expectedMockSignature;


      console.log(
        `RAZORPAY MOCK SIGNATURE: ${
          isValid
            ? 'VALID'
            : 'INVALID'
        }`
      );


      return isValid;

    }


    // ====================================================
    // REAL MODE
    // ====================================================

    const secret =
      process.env.RAZORPAY_KEY_SECRET;


    if (!secret) {

      throw new Error(
        'RAZORPAY_KEY_SECRET is not configured'
      );

    }


    if (
      !orderId ||
      !paymentId ||
      !signature
    ) {

      return false;

    }


    const generatedSignature =
      crypto
        .createHmac(
          'sha256',
          secret
        )
        .update(
          `${orderId}|${paymentId}`
        )
        .digest('hex');


    const generatedBuffer =
      Buffer.from(
        generatedSignature,
        'utf8'
      );


    const receivedBuffer =
      Buffer.from(
        signature,
        'utf8'
      );


    // ====================================================
    // Prevent RangeError
    // ====================================================

    if (
      generatedBuffer.length !==
      receivedBuffer.length
    ) {

      console.error(
        'Razorpay signature length mismatch'
      );


      return false;

    }


    return crypto.timingSafeEqual(
      generatedBuffer,
      receivedBuffer
    );

  }

  catch (error) {

    console.error(
      'Razorpay signature verification error:',
      error
    );


    return false;

  }

};


// ======================================================
// VERIFY RAZORPAY WEBHOOK SIGNATURE
// ======================================================
//
// Razorpay webhook signature:
//
// HMAC_SHA256(
//   raw_request_body,
//   RAZORPAY_WEBHOOK_SECRET
// )
//
// IMPORTANT:
//
// The raw request body must be used exactly as received.
// Do NOT use JSON.stringify(req.body).
//
// ======================================================

const verifyRazorpayWebhookSignature = ({
  rawBody,
  signature
}) => {

  try {

    // ====================================================
    // VALIDATION
    // ====================================================

    if (
      rawBody === undefined ||
      rawBody === null ||
      !signature
    ) {

      console.error(
        'Razorpay webhook signature validation failed: missing raw body or signature'
      );

      return false;

    }


    // ====================================================
    // MOCK MODE
    // ====================================================
    //
    // This allows automated webhook security tests
    // without requiring a real Razorpay webhook secret.
    //
    // Expected test signature:
    //
    // MOCK_WEBHOOK_SIGNATURE
    //
    // ====================================================

    if (RAZORPAY_MOCK_MODE) {

      const expectedMockSignature =
        'MOCK_WEBHOOK_SIGNATURE';


      const isValid =
        String(signature) ===
        expectedMockSignature;


      console.log(
        `RAZORPAY MOCK WEBHOOK SIGNATURE: ${
          isValid
            ? 'VALID'
            : 'INVALID'
        }`
      );


      return isValid;

    }


    // ====================================================
    // REAL MODE
    // ====================================================

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET;


    if (!webhookSecret) {

      console.error(
        'RAZORPAY_WEBHOOK_SECRET is not configured'
      );

      return false;

    }


    // ====================================================
    // NORMALIZE RAW BODY
    // ====================================================

    const bodyBuffer =
      Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(
            String(rawBody),
            'utf8'
          );


    // ====================================================
    // GENERATE EXPECTED SIGNATURE
    // ====================================================

    const expectedSignature =
      crypto
        .createHmac(
          'sha256',
          webhookSecret
        )
        .update(bodyBuffer)
        .digest('hex');


    // ====================================================
    // TIMING-SAFE COMPARISON
    // ====================================================

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        'utf8'
      );


    const receivedBuffer =
      Buffer.from(
        String(signature),
        'utf8'
      );


    // ====================================================
    // Prevent timingSafeEqual RangeError
    // ====================================================

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {

      console.error(
        'Razorpay webhook signature length mismatch'
      );

      return false;

    }


    return crypto.timingSafeEqual(
      expectedBuffer,
      receivedBuffer
    );

  }

  catch (error) {

    console.error(
      'Razorpay webhook signature verification error:',
      error
    );


    return false;

  }

};


// ======================================================
// GET RAZORPAY PAYMENT
// ======================================================
//
// This helper is useful for both real and mock
// payment verification.
//
// ======================================================

const getRazorpayPayment = async (
  paymentId,
  {
    orderId,
    amount = 24900,
    currency = 'INR',
    method = 'card'
  } = {}
) => {

  // ====================================================
  // MOCK MODE
  // ====================================================

  if (RAZORPAY_MOCK_MODE) {

    /*
     * Normally the mock payment belongs to the same
     * order ID supplied by the controller.
     *
     * For security testing, the test can temporarily set:
     *
     * RAZORPAY_MOCK_PAYMENT_ORDER_ID
     *
     * This allows us to simulate a Razorpay payment
     * belonging to a DIFFERENT order.
     */

    const mockPaymentOrderId =
      process.env.RAZORPAY_MOCK_PAYMENT_ORDER_ID ||
      orderId;


    /*
     * Normally the mock payment uses the currency
     * supplied by the controller.
     *
     * For currency mismatch security testing,
     * the test can temporarily set:
     *
     * RAZORPAY_MOCK_PAYMENT_CURRENCY=USD
     */

    const mockPaymentCurrency =
      process.env.RAZORPAY_MOCK_PAYMENT_CURRENCY ||
      currency;


    const mockPayment = {

      id:
        paymentId,

      entity:
        'payment',

      amount,

      currency:
        mockPaymentCurrency,

      status:
        RAZORPAY_MOCK_PAYMENT_STATUS,

      order_id:
        mockPaymentOrderId,

      method,

      captured:
        RAZORPAY_MOCK_PAYMENT_STATUS ===
        'captured',

      created_at:
        Math.floor(
          Date.now() / 1000
        )

    };


    console.log(
      'RAZORPAY MOCK PAYMENT FETCH:',
      paymentId
    );


    console.log(
      'RAZORPAY MOCK PAYMENT ORDER ID:',
      mockPaymentOrderId
    );


    console.log(
      'RAZORPAY MOCK PAYMENT CURRENCY:',
      mockPaymentCurrency
    );


    console.log(
      'RAZORPAY MOCK PAYMENT STATUS:',
      RAZORPAY_MOCK_PAYMENT_STATUS
    );


    return mockPayment;

  }


  // ====================================================
  // REAL RAZORPAY MODE
  // ====================================================

  try {

    const payment =
      await razorpay.payments.fetch(
        paymentId
      );


    return payment;

  }

  catch (error) {

    console.error(
      'Razorpay payment fetch error:',
      error
    );


    throw error;

  }

};


// ======================================================
// GENERATE MOCK PAYMENT SIGNATURE
// ======================================================
//
// Used only by automated payment tests.
//
// ======================================================

const generateMockSignature = () => {

  return 'MOCK_SIGNATURE';

};


// ======================================================
// GENERATE MOCK WEBHOOK SIGNATURE
// ======================================================
//
// Used only by automated webhook tests.
//
// ======================================================

const generateMockWebhookSignature = () => {

  return 'MOCK_WEBHOOK_SIGNATURE';

};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  razorpay,

  createRazorpayOrder,

  verifyRazorpaySignature,

  verifyRazorpayWebhookSignature,

  getRazorpayPayment,

  generateMockSignature,

  generateMockWebhookSignature,

  RAZORPAY_MOCK_MODE,

  RAZORPAY_MOCK_PAYMENT_STATUS

};