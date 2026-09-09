const PaymentModel =
  require('../models/paymentModel');


const RegistrationModel =
  require('../models/registrationModel');


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

const PAYMENT_AMOUNT_RUPEES = 249;

const PAYMENT_AMOUNT_PAISE = 24900;

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
        registrationId
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
    // Razorpay receipt
    // --------------------------------------------------

    const receipt =
      `webinar_reg_${registrationId}_${Date.now()}`;


    // --------------------------------------------------
    // Create Razorpay order
    // --------------------------------------------------

    const order =
      await createRazorpayOrder({

        amount:
          PAYMENT_AMOUNT_PAISE,

        currency:
          PAYMENT_CURRENCY,

        receipt,

        notes: {

          registration_id:
            String(registrationId)

        }

      });


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
          PAYMENT_AMOUNT_RUPEES,

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

          registrationId,

          orderId:
            order.id,

          amount:
            PAYMENT_AMOUNT_RUPEES,

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

      Number(registrationId)

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

          registrationId,

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

    if (
      Number(payment.amount) !==
      PAYMENT_AMOUNT_RUPEES
    ) {

      console.error(
        'Stored payment amount mismatch:',
        {
          registrationId,

          paymentId:
            payment.id,

          storedAmount:
            payment.amount,

          expectedAmount:
            PAYMENT_AMOUNT_RUPEES

        }
      );


      return res.status(400).json({

        success: false,

        message:
          'Payment amount mismatch'

      });

    }


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
          registrationId,

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
              PAYMENT_AMOUNT_PAISE,

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
          registrationId,

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
      String(razorpayPayment.currency).toUpperCase() !==
      PAYMENT_CURRENCY
    ) {

      console.error(
        'Razorpay payment currency mismatch:',
        {
          registrationId,

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
      PAYMENT_AMOUNT_PAISE
    ) {

      console.error(
        'Razorpay payment amount mismatch:',
        {
          registrationId,

          paymentId:
            razorpay_payment_id,

          razorpayAmount:
            razorpayPayment.amount,

          expectedAmount:
            PAYMENT_AMOUNT_PAISE

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
    // UPDATE REGISTRATION PAYMENT STATUS
    // ==================================================

    const updatedRegistration =
      await RegistrationModel.updatePaymentStatus(

        registrationId,

        'paid'

      );


    if (!updatedRegistration) {

      console.error(
        'Registration not found after payment:',
        registrationId
      );

    }


    // ==================================================
    // FETCH COMPLETE REGISTRATION DETAILS
    // ==================================================

    const registration =
      await RegistrationModel
        .getRegistrationWithPaymentDetails(
          registrationId
        );


    // ==================================================
    // FETCH COMPLETE PAYMENT DETAILS
    // ==================================================

    const paymentDetails =
      await PaymentModel
        .getPaymentByRegistrationId(
          registrationId
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
      registrationId
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
          await createReminderLogsForRegistration(
            registration
          );


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
          registrationId
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

        registrationId,

        paymentId:
          razorpay_payment_id,

        orderId:
          storedOrderId,

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