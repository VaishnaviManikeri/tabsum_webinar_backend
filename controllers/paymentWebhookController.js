const PaymentModel =
  require('../models/paymentModel');

const RegistrationModel =
  require('../models/registrationModel');

const PaymentWebhookModel =
  require('../models/paymentWebhookModel');

const {
  verifyRazorpayWebhookSignature,
  getRazorpayPayment
} = require('../services/razorpayService');

const {
  sendRegistrationConfirmation
} = require('../services/emailService');

const {
  sendWhatsAppRegistrationConfirmation
} = require('../services/whatsappService');

const {
  createReminderLogsForRegistration
} = require('../services/reminderService');


// =====================================================
// PAYMENT WEBHOOK CONTROLLER
// =====================================================

const handleRazorpayWebhook = async (
  req,
  res
) => {

  let eventId = null;

  try {

    // =================================================
    // STEP 1: GET WEBHOOK SIGNATURE
    // =================================================

    const signature =
      req.headers[
        'x-razorpay-signature'
      ];


    // =================================================
    // STEP 2: GET RAW BODY
    // =================================================

    const rawBody =
      req.rawBody;


    if (!rawBody) {

      console.error(
        'Razorpay webhook raw body is missing'
      );

      return res.status(400).json({

        success: false,

        message:
          'Webhook raw body is missing'

      });

    }


    // =================================================
    // STEP 3: VERIFY SIGNATURE
    // =================================================

    const signatureValid =
      verifyRazorpayWebhookSignature({

        rawBody,

        signature

      });


    if (!signatureValid) {

      console.error(
        'Razorpay webhook signature verification failed'
      );

      return res.status(400).json({

        success: false,

        message:
          'Invalid webhook signature'

      });

    }


    // =================================================
    // STEP 4: PARSE BODY
    // =================================================

    let payload;

    try {

      payload =
        JSON.parse(
          rawBody.toString('utf8')
        );

    }

    catch (parseError) {

      console.error(
        'Razorpay webhook JSON parse error:',
        parseError
      );

      return res.status(400).json({

        success: false,

        message:
          'Invalid webhook payload'

      });

    }


    // =================================================
    // STEP 5: GET EVENT ID
    // =================================================

    eventId =
      payload?.id ||
      req.headers[
        'x-razorpay-event-id'
      ] ||
      null;


    const eventType =
      payload?.event ||
      'unknown';


    if (!eventId) {

      console.error(
        'Razorpay webhook event ID is missing'
      );

      return res.status(400).json({

        success: false,

        message:
          'Webhook event ID is missing'

      });

    }


    // =================================================
    // STEP 6: CHECK DUPLICATE EVENT
    // =================================================

    const existingEvent =
      await PaymentWebhookModel.getByEventId(
        eventId
      );


    if (existingEvent) {

      console.log(
        'Duplicate Razorpay webhook received:',
        eventId
      );


      if (
        existingEvent.processing_status ===
        'processed'
      ) {

        return res.status(200).json({

          success: true,

          message:
            'Webhook already processed',

          duplicate: true,

          eventId

        });

      }


      if (
        existingEvent.processing_status ===
        'skipped'
      ) {

        return res.status(200).json({

          success: true,

          message:
            'Webhook already skipped',

          duplicate: true,

          eventId

        });

      }

    }


    // =================================================
    // STEP 7: EXTRACT PAYMENT DATA
    // =================================================

    const paymentEntity =
      payload?.payload?.payment?.entity ||
      null;


    const paymentId =
      paymentEntity?.id ||
      null;


    const orderId =
      paymentEntity?.order_id ||
      null;


    // IMPORTANT:
    // Razorpay webhook amount is in paise.
    const webhookAmount =
      paymentEntity?.amount ??
      null;


    const webhookCurrency =
      paymentEntity?.currency ||
      null;


    // =================================================
    // STEP 8: CREATE WEBHOOK LOG
    // =================================================

    if (!existingEvent) {

      await PaymentWebhookModel.createEvent({

        eventId,

        eventType,

        paymentId,

        orderId,

        signatureValid: true,

        processingStatus:
          'received'

      });

    }


    // =================================================
    // STEP 9: HANDLE ONLY PAYMENT CAPTURE EVENTS
    // =================================================

    if (
      eventType !==
        'payment.captured' &&
      eventType !==
        'order.paid'
    ) {

      await PaymentWebhookModel.markSkipped({

        eventId,

        reason:
          `Unsupported webhook event: ${eventType}`

      });


      return res.status(200).json({

        success: true,

        message:
          'Webhook received but event is not handled',

        eventId,

        eventType,

        skipped: true

      });

    }


    // =================================================
    // STEP 10: PAYMENT DATA VALIDATION
    // =================================================

    if (!paymentId) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Razorpay payment ID is missing'

      });


      return res.status(400).json({

        success: false,

        message:
          'Razorpay payment ID is missing'

      });

    }


    // =================================================
    // STEP 11: FIND PAYMENT RECORD
    // =================================================

    let payment = null;


    if (orderId) {

      payment =
        await PaymentModel.getPaymentByOrderId(
          orderId
        );

    }


    if (!payment) {

      payment =
        await PaymentModel.getPaymentByPaymentId(
          paymentId
        );

    }


    if (!payment) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Payment record not found'

      });


      return res.status(404).json({

        success: false,

        message:
          'Payment record not found'

      });

    }


    // =================================================
    // STEP 12: VALIDATE PAYMENT OWNERSHIP
    // =================================================

    if (
      payment.payment_id &&
      String(payment.payment_id) !==
        String(paymentId)
    ) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Payment ID does not match stored payment'

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment ID mismatch'

      });

    }


    // =================================================
    // STEP 13: VALIDATE ORDER
    // =================================================

    if (
      orderId &&
      String(payment.order_id) !==
        String(orderId)
    ) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Payment order does not match stored order'

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment order mismatch'

      });

    }


    // =================================================
    // STEP 14: VALIDATE WEBHOOK AMOUNT
    // =================================================
    //
    // Razorpay sends amount in paise.
    //
    // Example:
    // DB amount       = ₹249
    // Expected paise  = 24900
    // Webhook amount  = 24900
    //
    // If webhook sends 10000:
    // 10000 !== 24900
    // Payment must be rejected.
    // =================================================

    const expectedWebhookAmountPaise =
      Math.round(
        Number(payment.amount) *
        100
      );


    const receivedWebhookAmountPaise =
      Number(webhookAmount);


    if (
      !Number.isFinite(
        receivedWebhookAmountPaise
      ) ||
      receivedWebhookAmountPaise !==
        expectedWebhookAmountPaise
    ) {

      console.error(
        'Webhook payment amount mismatch:',
        {
          expected:
            expectedWebhookAmountPaise,

          received:
            webhookAmount
        }
      );


      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          `Webhook payment amount mismatch. Expected ${expectedWebhookAmountPaise}, received ${webhookAmount}`

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment amount mismatch'

      });

    }


    // =================================================
    // STEP 15: VALIDATE WEBHOOK CURRENCY
    // =================================================

    if (
      !webhookCurrency ||
      String(
        webhookCurrency
      ).toUpperCase() !==
        String(
          payment.currency
        ).toUpperCase()
    ) {

      console.error(
        'Webhook payment currency mismatch:',
        {
          expected:
            payment.currency,

          received:
            webhookCurrency
        }
      );


      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          `Webhook payment currency mismatch. Expected ${payment.currency}, received ${webhookCurrency || 'missing'}`

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment currency mismatch'

      });

    }
// =================================================
// STEP 16: VALIDATE WEBHOOK PAYMENT STATUS
// =================================================
//
// Validate the status directly from the webhook
// payload before trusting the Razorpay payment
// lookup/mock response.
//
// A successful payment webhook must contain:
//
// status   = captured
// captured = true
//
// Any other combination is rejected.
// =================================================

const webhookPaymentStatus =
  String(
    paymentEntity?.status || ''
  ).toLowerCase();

const webhookCaptured =
  paymentEntity?.captured === true;

if (
  webhookPaymentStatus !== 'captured' ||
  webhookCaptured !== true
) {

  console.error(
    'Webhook payment is not captured:',
    {
      status:
        paymentEntity?.status,
      captured:
        paymentEntity?.captured
    }
  );

  await PaymentWebhookModel.markFailed({
    eventId,

    errorMessage:
      `Webhook payment is not captured. Status: ${
        paymentEntity?.status || 'unknown'
      }, captured: ${
        paymentEntity?.captured
      }`
  });

  return res.status(400).json({
    success: false,

    message:
      `Payment is not captured. Current status: ${
        paymentEntity?.status || 'unknown'
      }`
  });
}


// =================================================
// STEP 17: GET RAZORPAY PAYMENT
// =================================================

const razorpayPayment =
  await getRazorpayPayment(
    paymentId,
    {
      orderId:
        payment.order_id,

      amount:
        Math.round(
          Number(payment.amount) *
          100
        ),

      currency:
        payment.currency,

      method:
        payment.method ||
        'card'
    }
  );

    // =================================================
    // STEP 16: GET RAZORPAY PAYMENT
    // =================================================



    // =================================================
    // STEP 17: VALIDATE RAZORPAY ORDER
    // =================================================

    if (
      razorpayPayment.order_id &&
      String(
        razorpayPayment.order_id
      ) !==
        String(
          payment.order_id
        )
    ) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Razorpay payment order mismatch'

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment order mismatch'

      });

    }


    // =================================================
    // STEP 18: VALIDATE RAZORPAY AMOUNT
    // =================================================

    const expectedAmountPaise =
      Math.round(
        Number(payment.amount) *
        100
      );


    const actualAmountPaise =
      Number(
        razorpayPayment.amount
      );


    if (
      actualAmountPaise !==
      expectedAmountPaise
    ) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Payment amount mismatch'

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment amount mismatch'

      });

    }


    // =================================================
    // STEP 19: VALIDATE RAZORPAY CURRENCY
    // =================================================

    if (
      String(
        razorpayPayment.currency
      ).toUpperCase() !==
      String(
        payment.currency
      ).toUpperCase()
    ) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Payment currency mismatch'

      });


      return res.status(400).json({

        success: false,

        message:
          'Payment currency mismatch'

      });

    }


    // =================================================
    // STEP 20: VALIDATE CAPTURED STATUS
    // =================================================

    const isCaptured =
      razorpayPayment.captured === true ||
      razorpayPayment.status ===
        'captured';


    if (!isCaptured) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          `Payment is not captured. Current status: ${
            razorpayPayment.status ||
            'unknown'
          }`

      });


      return res.status(400).json({

        success: false,

        message:
          `Payment is not captured. Current status: ${
            razorpayPayment.status ||
            'unknown'
          }`

      });

    }


    // =================================================
    // STEP 21: ALREADY PAID CHECK
    // =================================================

    if (
      payment.status ===
      'paid'
    ) {

      await PaymentWebhookModel.markProcessed(
        eventId
      );


      return res.status(200).json({

        success: true,

        message:
          'Payment already processed',

        duplicate: true,

        registrationId:
          payment.registration_id,

        paymentId,

        orderId:
          payment.order_id,

        eventId

      });

    }


    // =================================================
    // STEP 22: UPDATE PAYMENT
    // =================================================

    await PaymentModel.updatePayment({

      orderId:
        payment.order_id,

      paymentId,

      status:
        'paid',

      method:
        razorpayPayment.method ||
        payment.method ||
        'card'

    });


    // =================================================
    // STEP 23: UPDATE REGISTRATION
    // =================================================

    const registration =
      await RegistrationModel.getRegistrationById(
        payment.registration_id
      );


    if (!registration) {

      await PaymentWebhookModel.markFailed({

        eventId,

        errorMessage:
          'Registration not found'

      });


      return res.status(404).json({

        success: false,

        message:
          'Registration not found'

      });

    }


    await RegistrationModel.updatePaymentStatus(

      payment.registration_id,

      'paid'

    );


    // =================================================
    // STEP 24: CREATE REMINDERS
    // =================================================

    try {

      await createReminderLogsForRegistration(
        payment.registration_id
      );

    }

    catch (reminderError) {

      console.error(
        'Webhook payment successful but reminder creation failed:',
        reminderError
      );

    }


    // =================================================
    // STEP 25: SEND EMAIL
    // =================================================

    try {

      const paymentDetails =
        await PaymentModel.getPaymentByRegistrationId(
          payment.registration_id
        );


      if (
        registration &&
        paymentDetails
      ) {

        await sendRegistrationConfirmation({

          registration,

          payment:
            paymentDetails

        });

      }

    }

    catch (emailError) {

      console.error(
        'Webhook payment successful but confirmation email failed:',
        emailError
      );

    }


    // =================================================
    // STEP 26: SEND WHATSAPP
    // =================================================

    try {

      await sendWhatsAppRegistrationConfirmation({

        registration

      });

    }

    catch (whatsappError) {

      console.error(
        'Webhook payment successful but WhatsApp confirmation failed:',
        whatsappError
      );

    }


    // =================================================
    // STEP 27: MARK WEBHOOK PROCESSED
    // =================================================

    await PaymentWebhookModel.markProcessed(
      eventId
    );


    // =================================================
    // STEP 28: SUCCESS RESPONSE
    // =================================================

    console.log(
      'RAZORPAY WEBHOOK PAYMENT PROCESSED:',
      {
        eventId,

        eventType,

        paymentId,

        orderId,

        registrationId:
          payment.registration_id

      }
    );


    return res.status(200).json({

      success: true,

      message:
        'Payment webhook processed successfully',

      eventId,

      eventType,

      paymentId,

      orderId,

      registrationId:
        payment.registration_id

    });

  }

  catch (error) {

    console.error(
      'Razorpay webhook processing error:',
      error
    );


    // ===============================================
    // TRY TO MARK EVENT FAILED
    // ===============================================

    if (eventId) {

      try {

        await PaymentWebhookModel.markFailed({

          eventId,

          errorMessage:
            error?.message ||
            'Webhook processing failed'

        });

      }

      catch (logError) {

        console.error(
          'Webhook failure logging error:',
          logError
        );

      }

    }


    return res.status(500).json({

      success: false,

      message:
        'Webhook processing failed'

    });

  }

};


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  handleRazorpayWebhook

};