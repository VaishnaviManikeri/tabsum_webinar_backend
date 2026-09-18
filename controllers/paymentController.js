const PaymentModel =
  require('../models/paymentModel');

const RegistrationModel =
  require('../models/registrationModel');

const WebinarModel =
  require('../models/webinarModel');


// ======================================================
// RAZORPAY SERVICE
// ======================================================

const {
  razorpay,
  createRazorpayOrder,
  verifyRazorpaySignature,
  getRazorpayPayment
} = require('../services/razorpayService');


// ======================================================
// AMAZON SES EMAIL SERVICE
// ======================================================

const {
  sendRegistrationConfirmation
} = require('../services/emailService');


// ======================================================
// WHATSAPP SERVICE
// ======================================================

const {
  sendWhatsAppRegistrationConfirmation
} = require('../services/whatsappService');


// ======================================================
// REMINDER SERVICE
// ======================================================

const {
  createReminderLogsForRegistration
} = require('../services/reminderService');


// ======================================================
// PAYMENT CONFIGURATION
// ======================================================

// IMPORTANT:
// Webinar price is NOT hard-coded here.
// Current price is fetched from webinars table.

const PAYMENT_CURRENCY = 'INR';


// ======================================================
// CREATE RAZORPAY ORDER
// ======================================================

const createPaymentOrder = async (req, res) => {

  try {

    const {
      registrationId
    } = req.body;


    // --------------------------------------------------
    // Validate registration ID
    // --------------------------------------------------

    if (
      registrationId === undefined ||
      registrationId === null ||
      registrationId === ''
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Registration ID is required'

      });

    }


    // --------------------------------------------------
    // Validate registration ID type
    // --------------------------------------------------

    const numericRegistrationId =
      Number(registrationId);


    if (
      typeof registrationId === 'boolean' ||
      typeof registrationId === 'object' ||
      !Number.isInteger(numericRegistrationId) ||
      numericRegistrationId <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Please provide a valid registration ID'

      });

    }


    // --------------------------------------------------
    // Check registration exists
    // --------------------------------------------------

    const registration =
      await RegistrationModel.getRegistrationById(
        numericRegistrationId
      );


    if (!registration) {

      return res.status(404).json({

        success: false,

        message:
          'Registration not found'

      });

    }


    // --------------------------------------------------
    // Check existing payment
    // --------------------------------------------------

    const existingPayment =
      await PaymentModel.getPaymentByRegistrationId(
        numericRegistrationId
      );


    // --------------------------------------------------
    // Prevent duplicate paid payment
    // --------------------------------------------------

    if (
      existingPayment &&
      existingPayment.status === 'paid'
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Payment is already completed'

      });

    }


    // --------------------------------------------------
    // Get CURRENT webinar
    // --------------------------------------------------

    const webinar =
      await WebinarModel.getWebinarById(
        registration.webinar_id
      );


    if (!webinar) {

      return res.status(404).json({

        success: false,

        message:
          'Webinar not found for this registration'

      });

    }


    // --------------------------------------------------
    // Get CURRENT ADMIN-CONFIGURED PRICE
    // --------------------------------------------------

    const currentPrice =
      Number(webinar.price);


    if (
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Webinar price is not configured correctly'

      });

    }


    // --------------------------------------------------
    // Convert Rupees to Paise
    // --------------------------------------------------

    const currentPricePaise =
      Math.round(currentPrice * 100);


    if (
      !Number.isInteger(currentPricePaise) ||
      currentPricePaise <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Invalid webinar payment amount'

      });

    }


    // --------------------------------------------------
    // Razorpay receipt
    // --------------------------------------------------

    const receipt =
      `webinar_reg_${numericRegistrationId}_${Date.now()}`;


    // --------------------------------------------------
    // Create Razorpay order
    // --------------------------------------------------

    const order =
      await createRazorpayOrder({

        amount:
          currentPricePaise,

        currency:
          PAYMENT_CURRENCY,

        receipt,

        notes: {

          registration_id:
            String(numericRegistrationId),

          webinar_id:
            String(webinar.id),

          webinar_price:
            String(currentPrice)

        }

      });


    // --------------------------------------------------
    // Validate Razorpay order amount
    // --------------------------------------------------

    if (
      !order ||
      !order.id ||
      Number(order.amount) !== currentPricePaise
    ) {

      console.error(
        'Razorpay order amount mismatch:',
        {
          registrationId:
            numericRegistrationId,

          expectedAmount:
            currentPricePaise,

          razorpayAmount:
            order?.amount

        }
      );


      return res.status(500).json({

        success: false,

        message:
          'Payment order amount validation failed'

      });

    }


    let paymentRecordId;


    // --------------------------------------------------
    // Update existing payment record
    // --------------------------------------------------

    if (existingPayment) {

      await PaymentModel.updatePaymentOrder({

        paymentRecordId:
          existingPayment.id,

        orderId:
          order.id,

        amount:
          currentPrice,

        currency:
          PAYMENT_CURRENCY

      });


      paymentRecordId =
        existingPayment.id;

    }


    // --------------------------------------------------
    // Create new payment record
    // --------------------------------------------------

    else {

      paymentRecordId =
        await PaymentModel.createPayment({

          registrationId:
            numericRegistrationId,

          orderId:
            order.id,

          amount:
            currentPrice,

          currency:
            PAYMENT_CURRENCY,

          status:
            'pending'

        });

    }


    // --------------------------------------------------
    // Send response
    // --------------------------------------------------

    return res.status(201).json({

      success: true,

      message:
        'Payment order created successfully',

      data: {

        paymentRecordId,

        orderId:
          order.id,

        amount:
          order.amount,

        currency:
          order.currency,

        status:
          'pending',

        keyId:
          process.env.RAZORPAY_KEY_ID

      }

    });

  }


  catch (error) {

    console.error(
      'Create payment order error:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        'Unable to create payment order',

      error:
        error.message

    });

  }

};


// ======================================================
// VERIFY RAZORPAY PAYMENT
// ======================================================

const verifyPayment = async (req, res) => {

  try {

    const {

      registrationId,

      razorpay_payment_id,

      razorpay_order_id,

      razorpay_signature

    } = req.body;


    // --------------------------------------------------
    // Validate required fields
    // --------------------------------------------------

    if (

      !registrationId ||

      !razorpay_payment_id ||

      !razorpay_order_id ||

      !razorpay_signature

    ) {

      return res.status(400).json({

        success: false,

        message:
          'Registration ID, payment ID, order ID and signature are required'

      });

    }


    // --------------------------------------------------
    // Validate registration ID
    // --------------------------------------------------

    const numericRegistrationId =
      Number(registrationId);


    if (
      typeof registrationId === 'boolean' ||
      typeof registrationId === 'object' ||
      !Number.isInteger(numericRegistrationId) ||
      numericRegistrationId <= 0
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Please provide a valid registration ID'

      });

    }


    // --------------------------------------------------
    // Find payment using Razorpay order ID
    // --------------------------------------------------

    const payment =
      await PaymentModel.getPaymentByOrderId(
        razorpay_order_id
      );


    if (!payment) {

      return res.status(404).json({

        success: false,

        message:
          'Payment record not found'

      });

    }


    // --------------------------------------------------
    // Verify registration ownership
    // --------------------------------------------------

    if (
      Number(payment.registration_id) !==
      numericRegistrationId
    ) {

      return res.status(403).json({

        success: false,

        message:
          'Payment does not belong to this registration'

      });

    }


    // --------------------------------------------------
    // Prevent duplicate verification
    // --------------------------------------------------

    if (
      payment.status === 'paid'
    ) {

      return res.status(200).json({

        success: true,

        message:
          'Payment already verified',

        data: {

          registrationId:
            numericRegistrationId,

          paymentId:
            payment.payment_id,

          orderId:
            payment.order_id,

          status:
            'paid',

          communication: {

            email:
              'already_processed',

            whatsapp:
              'already_processed'

          }

        }

      });

    }


    // ==================================================
    // SECURITY CHECK 1
    // VERIFY STORED PAYMENT AMOUNT
    // ==================================================

    const storedPaymentAmount =
      Number(payment.amount);


    if (
      !Number.isFinite(storedPaymentAmount) ||
      storedPaymentAmount <= 0
    ) {

      console.error(
        'Invalid stored payment amount:',
        {
          registrationId:
            numericRegistrationId,

          paymentId:
            payment.id,

          storedAmount:
            payment.amount

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Invalid stored payment amount'

      });

    }


    // --------------------------------------------------
    // Convert stored amount to paise
    // --------------------------------------------------

    const storedPaymentAmountPaise =
      Math.round(
        storedPaymentAmount * 100
      );


    // ==================================================
    // SECURITY CHECK 2
    // VERIFY STORED PAYMENT CURRENCY
    // ==================================================

    if (
      String(payment.currency).toUpperCase() !==
      PAYMENT_CURRENCY
    ) {

      console.error(
        'Stored payment currency mismatch:',
        {
          registrationId:
            numericRegistrationId,

          paymentId:
            payment.id,

          storedCurrency:
            payment.currency,

          expectedCurrency:
            PAYMENT_CURRENCY

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Payment currency mismatch'

      });

    }


    // ==================================================
    // STORED ORDER ID
    // ==================================================

    const storedOrderId =
      payment.order_id;


    // ==================================================
    // SECURITY CHECK 3
    // VERIFY RAZORPAY SIGNATURE
    // ==================================================

    const isSignatureValid =
      verifyRazorpaySignature({

        orderId:
          storedOrderId,

        paymentId:
          razorpay_payment_id,

        signature:
          razorpay_signature

      });


    if (!isSignatureValid) {

      return res.status(400).json({

        success: false,

        message:
          'Payment verification failed'

      });

    }


    // ==================================================
    // FETCH PAYMENT FROM RAZORPAY
    // ==================================================

    let razorpayPayment;


    try {

      razorpayPayment =
        await getRazorpayPayment(

          razorpay_payment_id,

          {

            orderId:
              storedOrderId,

            amount:
              storedPaymentAmountPaise,

            currency:
              PAYMENT_CURRENCY,

            method:
              'card'

          }

        );

    }


    catch (razorpayError) {

      console.error(
        'Razorpay payment fetch error:',
        razorpayError
      );


      return res.status(400).json({

        success: false,

        message:
          'Unable to verify payment status with Razorpay'

      });

    }


    // ==================================================
    // SECURITY CHECK 4
    // VERIFY RAZORPAY PAYMENT ORDER
    // ==================================================

    if (
      razorpayPayment.order_id !==
      storedOrderId
    ) {

      console.error(
        'Razorpay payment order mismatch:',
        {
          registrationId:
            numericRegistrationId,

          paymentId:
            razorpay_payment_id,

          razorpayOrderId:
            razorpayPayment.order_id,

          expectedOrderId:
            storedOrderId

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Payment order mismatch'

      });

    }


    // ==================================================
    // SECURITY CHECK 5
    // VERIFY RAZORPAY PAYMENT CURRENCY
    // ==================================================

    if (
      String(
        razorpayPayment.currency
      ).toUpperCase() !==
      PAYMENT_CURRENCY
    ) {

      console.error(
        'Razorpay payment currency mismatch:',
        {
          registrationId:
            numericRegistrationId,

          paymentId:
            razorpay_payment_id,

          razorpayCurrency:
            razorpayPayment.currency,

          expectedCurrency:
            PAYMENT_CURRENCY

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Payment currency mismatch'

      });

    }


    // ==================================================
    // SECURITY CHECK 6
    // VERIFY RAZORPAY PAYMENT AMOUNT
    // ==================================================

    if (
      Number(razorpayPayment.amount) !==
      storedPaymentAmountPaise
    ) {

      console.error(
        'Razorpay payment amount mismatch:',
        {
          registrationId:
            numericRegistrationId,

          paymentId:
            razorpay_payment_id,

          razorpayAmount:
            razorpayPayment.amount,

          expectedAmount:
            storedPaymentAmountPaise

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Payment amount mismatch'

      });

    }


    // ==================================================
    // SECURITY CHECK 7
    // VERIFY CAPTURED STATUS
    // ==================================================

    if (
      razorpayPayment.status !==
      'captured'
    ) {

      return res.status(400).json({

        success: false,

        message:
          `Payment is not captured. Current status: ${razorpayPayment.status}`

      });

    }


   // ==================================================
// UPDATE PAYMENT RECORD
// ==================================================
// IMPORTANT:
// PaymentModel performs an atomic update:
//
// WHERE order_id = ?
// AND status = 'pending'
//
// Therefore only the FIRST verification request
// can change the payment from pending -> paid.
//
// If affectedRows is 0, another request has already
// processed this payment. Stop before running any
// registration/reminder/email/WhatsApp automation.
// ==================================================

const updateResult =
  await PaymentModel.updatePayment({

    orderId:
      storedOrderId,

    paymentId:
      razorpay_payment_id,

    status:
      'paid',

    method:
      razorpayPayment.method ||
      null

  });


// ==================================================
// IDEMPOTENCY / DUPLICATE VERIFICATION PROTECTION
// ==================================================

if (
  !updateResult ||
  updateResult.affectedRows !== 1
) {

  console.log(
    'Payment already processed or update was not applied:',
    {
      registrationId:
        numericRegistrationId,

      orderId:
        storedOrderId,

      paymentId:
        razorpay_payment_id,

      affectedRows:
        updateResult?.affectedRows ?? 0
    }
  );


  return res.status(200).json({

    success:
      true,

    message:
      'Payment already processed',

    data: {

      registrationId:
        numericRegistrationId,

      paymentId:
        razorpay_payment_id,

      orderId:
        storedOrderId,

      status:
        'paid',

      alreadyProcessed:
        true,

      communication: {

        email:
          'already_processed',

        whatsapp:
          'already_processed'

      }

    }

  });

}

    // ==================================================
    // UPDATE REGISTRATION PAYMENT STATUS
    // ==================================================

    const updatedRegistration =
      await RegistrationModel.updatePaymentStatus(

        numericRegistrationId,

        'paid'

      );


    if (!updatedRegistration) {

      console.error(
        'Registration not found after payment:',
        numericRegistrationId
      );

    }


    // ==================================================
    // FETCH COMPLETE REGISTRATION DETAILS
    // ==================================================

    const registration =
      await RegistrationModel
        .getRegistrationWithPaymentDetails(
          numericRegistrationId
        );


    // ==================================================
    // FETCH COMPLETE PAYMENT DETAILS
    // ==================================================

    const paymentDetails =
      await PaymentModel
        .getPaymentByRegistrationId(
          numericRegistrationId
        );


    // ==================================================
    // PAYMENT IS NOW CONFIRMED
    //
    // IMPORTANT:
    //
    // At this point payment is already PAID.
    //
    // Reminder/email/WhatsApp failure must NEVER
    // change payment status back to failed.
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'PAYMENT SUCCESSFUL'
    );

    console.log(
      '========================================'
    );

    console.log(
      'Registration ID:',
      numericRegistrationId
    );

    console.log(
      'Payment ID:',
      razorpay_payment_id
    );

    console.log(
      'Order ID:',
      storedOrderId
    );

    console.log(
      'Payment Amount:',
      storedPaymentAmount,
      PAYMENT_CURRENCY
    );

    console.log(
      'Payment Status: PAID'
    );

    console.log(
      '========================================\n'
    );


    // ==================================================
    // AUTOMATIC REMINDER CREATION
    // ==================================================

    const reminderAutomation = {

      attempted:
        false,

      success:
        false,

      created:
        0,

      skipped:
        0,

      reminders:
        [],

      error:
        null

    };


    try {

      if (registration) {

        reminderAutomation.attempted =
          true;


        const reminderResult =
          await createReminderLogsForRegistration(registration.id);


        reminderAutomation.success =
          Boolean(
            reminderResult?.success
          );


        reminderAutomation.created =
          Number(
            reminderResult?.created ||
            0
          );


        reminderAutomation.skipped =
          Number(
            reminderResult?.skippedCount ||
            0
          );


        reminderAutomation.reminders =
          reminderResult?.reminders ||
          [];


        console.log(
          '\n========================================'
        );

        console.log(
          'REMINDER AUTOMATION SUCCESS'
        );

        console.log(
          '========================================'
        );

        console.log(
          'Registration ID:',
          numericRegistrationId
        );

        console.log(
          'Created:',
          reminderAutomation.created
        );

        console.log(
          'Skipped:',
          reminderAutomation.skipped
        );

        console.log(
          'Reminders:',
          reminderAutomation.reminders
        );

        console.log(
          '========================================\n'
        );

      }


      else {

        reminderAutomation.error =
          'Unable to get registration details for reminder creation.';


        console.error(
          reminderAutomation.error
        );

      }

    }


    catch (reminderError) {

      reminderAutomation.error =
        reminderError?.message ||
        'Reminder creation failed.';


      console.error(
        'Payment successful, but reminder creation failed:',
        reminderError
      );

    }


    // ==================================================
    // COMMUNICATION STATUS
    // ==================================================

    const communication = {

      email: {

        attempted:
          false,

        success:
          false,

        alreadySent:
          false,

        messageId:
          null,

        error:
          null

      },


      whatsapp: {

        attempted:
          false,

        success:
          false,

        alreadySent:
          false,

        messageId:
          null,

        error:
          null

      }

    };


    // ==================================================
    // SEND CONFIRMATION EMAIL
    // ==================================================

    try {

      if (
        registration &&
        paymentDetails
      ) {

        communication.email.attempted =
          true;


        const emailResult =
          await sendRegistrationConfirmation({

            registration,

            payment:
              paymentDetails

          });


        communication.email.success =
          Boolean(
            emailResult?.success
          );


        communication.email.alreadySent =
          Boolean(
            emailResult?.alreadySent
          );


        communication.email.messageId =
          emailResult?.messageId ||
          null;


        console.log(
          '\nEMAIL AUTOMATION SUCCESS'
        );

        console.log(
          'Email Result:',
          emailResult
        );

      }


      else {

        communication.email.error =
          'Unable to get registration/payment details for email.';


        console.error(
          communication.email.error
        );

      }

    }


    catch (emailError) {

      communication.email.error =
        emailError?.message ||
        'Email sending failed.';


      console.error(
        'Payment successful, but confirmation email failed:',
        emailError
      );

    }


    // ==================================================
    // SEND WHATSAPP CONFIRMATION
    // ==================================================

    try {

      if (
        registration
      ) {

        communication.whatsapp.attempted =
          true;


        const whatsappResult =
          await sendWhatsAppRegistrationConfirmation({

            registration

          });


        communication.whatsapp.success =
          Boolean(
            whatsappResult?.success
          );


        communication.whatsapp.alreadySent =
          Boolean(
            whatsappResult?.alreadySent
          );


        communication.whatsapp.messageId =
          whatsappResult?.messageId ||
          null;


        console.log(
          '\nWHATSAPP AUTOMATION SUCCESS'
        );

        console.log(
          'WhatsApp Result:',
          whatsappResult
        );

      }


      else {

        communication.whatsapp.error =
          'Unable to get registration details for WhatsApp.';


        console.error(
          communication.whatsapp.error
        );

      }

    }


    catch (whatsappError) {

      communication.whatsapp.error =
        whatsappError?.message ||
        'WhatsApp sending failed.';


      console.error(
        'Payment successful, but WhatsApp confirmation failed:',
        whatsappError
      );

    }


    // ==================================================
    // AUTOMATION SUMMARY
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'POST-PAYMENT AUTOMATION SUMMARY'
    );

    console.log(
      '========================================'
    );

    console.log(
      'Payment:',
      'PAID'
    );

    console.log(
      'Amount:',
      storedPaymentAmount,
      PAYMENT_CURRENCY
    );

    console.log(
      'Reminders:',
      reminderAutomation.success
        ? `${reminderAutomation.created} CREATED`
        : 'FAILED / NOT CREATED'
    );

    console.log(
      'Email:',
      communication.email.success
        ? 'SUCCESS'
        : communication.email.alreadySent
          ? 'ALREADY SENT'
          : 'FAILED / NOT SENT'
    );

    console.log(
      'WhatsApp:',
      communication.whatsapp.success
        ? 'SUCCESS'
        : communication.whatsapp.alreadySent
          ? 'ALREADY SENT'
          : 'FAILED / NOT SENT'
    );

    console.log(
      '========================================\n'
    );


    // ==================================================
    // FINAL SUCCESS RESPONSE
    // ==================================================

    return res.status(200).json({

      success: true,

      message:
        'Payment verified successfully',

      data: {

        registrationId:
          numericRegistrationId,

        paymentId:
          razorpay_payment_id,

        orderId:
          storedOrderId,

        amount:
          storedPaymentAmount,

        currency:
          PAYMENT_CURRENCY,

        status:
          'paid',

        method:
          razorpayPayment.method ||
          null,

        reminders:
          reminderAutomation,

        communication

      }

    });

  }


  catch (error) {

    console.error(
      'Verify payment error:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        'Payment verification failed',

      error:
        error.message

    });

  }

};


// ======================================================
// EXPORT CONTROLLERS
// ======================================================

module.exports = {

  createPaymentOrder,

  verifyPayment

};