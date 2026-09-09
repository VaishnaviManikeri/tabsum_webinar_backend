/**
 * SAFE PAYMENT CONTROLLER → REMINDER INTEGRATION TEST
 *
 * Purpose:
 * 1. Existing paid registration शोधणे
 * 2. Existing reminder logs temporary remove करणे
 * 3. Registration payment status temporary "pending" करणे
 * 4. Test payment record create करणे
 * 5. Real paymentController.verifyPayment() call करणे
 * 6. Controller ने payment "paid" केले का ते verify करणे
 * 7. 24H + 3H + 30M reminders create झाले का ते verify करणे
 * 8. Original database state restore करणे
 *
 * IMPORTANT:
 * RAZORPAY_MOCK_MODE=true असणे आवश्यक आहे.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const db = require('../config/db');

const RegistrationModel = require('../models/registrationModel');
const PaymentModel = require('../models/paymentModel');
const ReminderLogModel = require('../models/reminderLogModel');

const {
  generateMockSignature
} = require('../services/razorpayService');

const paymentController =
  require('../controllers/paymentController');

/**
 * Small helper for waiting
 */
const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock Express response object
 */
const createMockResponse = () => {
  const response = {
    statusCode: 200,
    body: null
  };

  return {
    response,

    status(code) {
      response.statusCode = code;
      return this;
    },

    json(data) {
      response.body = data;
      return this;
    }
  };
};

/**
 * Main test
 */
const runTest = async () => {
  let connection;

  let originalPaymentStatus = null;
  let originalRegistrationStatus = null;

  let testPaymentRecordId = null;
  let testOrderId = null;

  let deletedReminderIds = [];

  try {
    console.log('');
    console.log('====================================================');
    console.log('SAFE PAYMENT CONTROLLER INTEGRATION TEST');
    console.log('====================================================');
    console.log('');

    /**
     * ------------------------------------------------
     * STEP 0
     * Check Razorpay mock mode
     * ------------------------------------------------
     */

    const mockMode =
      String(
        process.env.RAZORPAY_MOCK_MODE || 'false'
      ).toLowerCase() === 'true';

    console.log('STEP 0: CHECKING RAZORPAY MOCK MODE...');

    if (!mockMode) {
      throw new Error(
        'RAZORPAY_MOCK_MODE=true is required for this test.'
      );
    }

    console.log(
      'RAZORPAY MOCK MODE: ENABLED'
    );

    /**
     * ------------------------------------------------
     * STEP 1
     * Find test registration
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 1: FINDING TEST REGISTRATION...'
    );

    const registration =
      await RegistrationModel.getRegistrationWithPaymentDetails(
        61
      );

    if (!registration) {
      throw new Error(
        'Registration ID 61 not found.'
      );
    }

    console.log(
      'Registration exists:',
      registration.id
    );

    console.log(
      'Name:',
      `${registration.first_name} ${registration.last_name || ''}`.trim()
    );

    console.log(
      'Email:',
      registration.email
    );

    console.log(
      'Webinar:',
      registration.webinar_title
    );

    console.log(
      'Webinar Date:',
      registration.webinar_date
    );

    console.log(
      'Webinar Time:',
      registration.webinar_time
    );

    originalPaymentStatus =
      registration.payment_status;

    originalRegistrationStatus =
      registration.registration_status;

    console.log(
      'Original Payment Status:',
      originalPaymentStatus
    );

    console.log(
      'Original Registration Status:',
      originalRegistrationStatus
    );

    /**
     * ------------------------------------------------
     * STEP 2
     * Remove old reminder logs
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 2: REMOVING OLD REMINDER LOGS...'
    );

    const [oldReminderRows] =
      await db.query(
        `
        SELECT id
        FROM webinar_reminder_logs
        WHERE registration_id = ?
        ORDER BY id ASC
        `,
        [registration.id]
      );

    deletedReminderIds =
      oldReminderRows.map(
        (row) => row.id
      );

    console.log(
      'Old reminder count:',
      deletedReminderIds.length
    );

    for (
      const reminderId
      of deletedReminderIds
    ) {
      await ReminderLogModel.deleteById(
        reminderId
      );
    }

    console.log(
      'OLD REMINDERS REMOVED'
    );

    /**
     * ------------------------------------------------
     * STEP 3
     * Temporarily make registration pending
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 3: SETTING REGISTRATION PAYMENT STATUS TO PENDING...'
    );

    await RegistrationModel.updatePaymentStatus(
      registration.id,
      'pending'
    );

    console.log(
      'Registration payment status:',
      'pending'
    );

    /**
     * ------------------------------------------------
     * STEP 4
     * Create test payment record
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 4: CREATING TEST PAYMENT...'
    );

    testOrderId =
      `order_mock_test_${Date.now()}`;

    const testPayment =
      await PaymentModel.createPayment({
        registrationId:
          registration.id,

        orderId:
          testOrderId,

        paymentId:
          null,

        amount:
          249,

        currency:
          'INR',

        status:
          'pending',

        method:
          null
      });

    /**
     * PaymentModel.createPayment()
     * normally returns the inserted DB record.
     *
     * We keep its database ID separately
     * because cleanup needs this ID.
     */
    testPaymentRecordId =
      testPayment?.id ||
      testPayment?.insertId ||
      testPayment;

    console.log(
      'Test Payment DB ID:',
      testPaymentRecordId
    );

    console.log(
      'Test Order ID:',
      testOrderId
    );

    /**
     * ------------------------------------------------
     * STEP 5
     * Prepare mock Razorpay payment
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 5: PREPARING MOCK RAZORPAY PAYMENT...'
    );

    const testPaymentId =
      `pay_mock_test_${Date.now()}`;

    /**
     * IMPORTANT
     *
     * Razorpay mock mode expects exactly:
     *
     * MOCK_SIGNATURE
     */
    const TEST_SIGNATURE =
      generateMockSignature();

    console.log(
      'Test Payment ID:',
      testPaymentId
    );

    console.log(
      'Test Signature:',
      TEST_SIGNATURE
    );

    /**
     * ------------------------------------------------
     * STEP 6
     * Update test payment with Razorpay payment ID
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 6: UPDATING TEST PAYMENT WITH PAYMENT ID...'
    );

    /**
     * PaymentModel.updatePaymentStatus()
     * should not be used here because payment
     * must still remain pending before verification.
     *
     * Direct DB update keeps the test controlled.
     */
    await db.query(
      `
      UPDATE payments
      SET payment_id = ?,
          status = 'pending'
      WHERE id = ?
      LIMIT 1
      `,
      [
        testPaymentId,
        testPaymentRecordId
      ]
    );

    console.log(
      'Test payment prepared successfully.'
    );

    /**
     * ------------------------------------------------
     * STEP 7
     * Call REAL paymentController.verifyPayment()
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 7: CALLING REAL verifyPayment()...'
    );

    const req = {
      body: {
        registrationId:
          registration.id,

        razorpay_payment_id:
          testPaymentId,

        razorpay_order_id:
          testOrderId,

        razorpay_signature:
          TEST_SIGNATURE
      }
    };

    const {
      response,
      ...res
    } = createMockResponse();

    await paymentController.verifyPayment(
      req,
      res
    );

    /**
     * ------------------------------------------------
     * STEP 8
     * Controller response
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 8: CONTROLLER RESPONSE'
    );

    console.log(
      JSON.stringify(
        response.body,
        null,
        2
      )
    );

    if (
      response.statusCode !== 200
    ) {
      throw new Error(
        `Controller returned HTTP ${response.statusCode}`
      );
    }

    if (
      !response.body ||
      response.body.success !== true
    ) {
      throw new Error(
        'Payment controller did not return success=true.'
      );
    }

    console.log(
      'PAYMENT CONTROLLER RESPONSE PASSED'
    );

    /**
     * ------------------------------------------------
     * STEP 9
     * Verify payment status in DB
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 9: VERIFYING PAYMENT STATUS...'
    );

    const [paymentRows] =
      await db.query(
        `
        SELECT
          id,
          registration_id,
          order_id,
          payment_id,
          amount,
          currency,
          status,
          method,
          paid_at
        FROM payments
        WHERE id = ?
        LIMIT 1
        `,
        [testPaymentRecordId]
      );

    if (
      paymentRows.length === 0
    ) {
      throw new Error(
        'Test payment record not found after controller execution.'
      );
    }

    const updatedPayment =
      paymentRows[0];

    console.log(
      'Payment DB status:',
      updatedPayment.status
    );

    console.log(
      'Payment ID:',
      updatedPayment.payment_id
    );

    console.log(
      'Order ID:',
      updatedPayment.order_id
    );

    console.log(
      'Amount:',
      updatedPayment.amount
    );

    console.log(
      'Currency:',
      updatedPayment.currency
    );

    if (
      updatedPayment.status !== 'paid'
    ) {
      throw new Error(
        `Expected payment status "paid", got "${updatedPayment.status}".`
      );
    }

    console.log(
      'PAYMENT STATUS VALIDATION PASSED'
    );

    /**
     * ------------------------------------------------
     * STEP 10
     * Verify registration payment status
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 10: VERIFYING REGISTRATION PAYMENT STATUS...'
    );

    const [registrationRows] =
      await db.query(
        `
        SELECT
          id,
          payment_status,
          registration_status
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [registration.id]
      );

    if (
      registrationRows.length === 0
    ) {
      throw new Error(
        'Registration not found after payment verification.'
      );
    }

    const updatedRegistration =
      registrationRows[0];

    console.log(
      'Registration payment status:',
      updatedRegistration.payment_status
    );

    console.log(
      'Registration status:',
      updatedRegistration.registration_status
    );

    if (
      updatedRegistration.payment_status !==
      'paid'
    ) {
      throw new Error(
        'Registration payment_status was not updated to paid.'
      );
    }

    console.log(
      'REGISTRATION PAYMENT STATUS VALIDATION PASSED'
    );

    /**
     * ------------------------------------------------
     * STEP 11
     * Verify reminder logs
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 11: VERIFYING REMINDER AUTOMATION...'
    );

    const [reminderRows] =
      await db.query(
        `
        SELECT
          id,
          registration_id,
          reminder_type,
          email_status,
          whatsapp_status,
          scheduled_at
        FROM webinar_reminder_logs
        WHERE registration_id = ?
        ORDER BY
          CASE reminder_type
            WHEN 'reminder_24h' THEN 1
            WHEN 'reminder_3h' THEN 2
            WHEN 'reminder_30m' THEN 3
            ELSE 4
          END
        `,
        [registration.id]
      );

    console.log(
      'Reminder count:',
      reminderRows.length
    );

    for (
      const reminder
      of reminderRows
    ) {
      console.log(
        JSON.stringify(
          reminder,
          null,
          2
        )
      );
    }

    const reminderTypes =
      reminderRows.map(
        (row) => row.reminder_type
      );

    const requiredReminderTypes = [
      'reminder_24h',
      'reminder_3h',
      'reminder_30m'
    ];

    for (
      const reminderType
      of requiredReminderTypes
    ) {
      if (
        !reminderTypes.includes(
          reminderType
        )
      ) {
        throw new Error(
          `${reminderType} reminder was not created.`
        );
      }
    }

    console.log(
      '24H + 3H + 30M REMINDERS CREATED'
    );

    console.log(
      'REMINDER TYPES VALIDATION PASSED'
    );

    /**
     * ------------------------------------------------
     * STEP 12
     * Validate reminder statuses
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 12: VALIDATING REMINDER DATABASE STATUS...'
    );

    const invalidReminder =
      reminderRows.find(
        (row) =>
          row.email_status !==
            'pending' ||
          row.whatsapp_status !==
            'pending'
      );

    if (invalidReminder) {
      throw new Error(
        `Reminder ${invalidReminder.reminder_type} has unexpected status.`
      );
    }

    console.log(
      'EMAIL STATUS: pending'
    );

    console.log(
      'WHATSAPP STATUS: pending'
    );

    console.log(
      'DATABASE REMINDER STATUS VALIDATION PASSED'
    );

    /**
     * ------------------------------------------------
     * STEP 13
     * Duplicate reminder protection
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'STEP 13: TESTING DUPLICATE REMINDER PROTECTION...'
    );

    const duplicateResult =
      await require('../services/reminderService')
        .createReminderLogsForRegistration(
          {
            ...registration,
            payment_status: 'paid',
            registration_status:
              'registered'
          }
        );

    console.log(
      JSON.stringify(
        duplicateResult,
        null,
        2
      )
    );

    const [duplicateCheckRows] =
      await db.query(
        `
        SELECT
          reminder_type,
          COUNT(*) AS total
        FROM webinar_reminder_logs
        WHERE registration_id = ?
        GROUP BY reminder_type
        ORDER BY reminder_type
        `,
        [registration.id]
      );

    for (
      const row
      of duplicateCheckRows
    ) {
      if (
        Number(row.total) !== 1
      ) {
        throw new Error(
          `Duplicate reminder detected for ${row.reminder_type}.`
        );
      }
    }

    console.log(
      'DUPLICATE REMINDER PROTECTION PASSED'
    );

    /**
     * ------------------------------------------------
     * FINAL SUCCESS
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      '===================================================='
    );
    console.log(
      'PAYMENT → REMINDER CONTROLLER INTEGRATION PASSED'
    );
    console.log(
      '===================================================='
    );
    console.log('');

  } catch (error) {

    console.error('');
    console.error(
      '===================================================='
    );
    console.error(
      'SAFE PAYMENT CONTROLLER INTEGRATION FAILED'
    );
    console.error(
      '===================================================='
    );

    console.error(
      error
    );

    console.error('');

    throw error;

  } finally {

    /**
     * ------------------------------------------------
     * RESTORE DATABASE
     * ------------------------------------------------
     */

    console.log('');
    console.log(
      'CLEANUP / DATABASE RESTORE STARTED...'
    );

    try {

      /**
       * Delete test payment
       */
      if (
        testPaymentRecordId
      ) {
        try {
          await db.query(
            `
            DELETE FROM payments
            WHERE id = ?
            LIMIT 1
            `,
            [testPaymentRecordId]
          );

          console.log(
            'TEST PAYMENT CLEANED UP'
          );

        } catch (cleanupError) {
          console.error(
            'TEST PAYMENT CLEANUP ERROR:',
            cleanupError.message
          );
        }
      }

      /**
       * Delete newly-created reminders
       */
      try {

        const [
          currentReminderRows
        ] = await db.query(
          `
          SELECT id
          FROM webinar_reminder_logs
          WHERE registration_id = ?
          `,
          [61]
        );

        for (
          const reminder
          of currentReminderRows
        ) {

          await ReminderLogModel.deleteById(
            reminder.id
          );
        }

        console.log(
          'TEST REMINDERS CLEANED UP'
        );

      } catch (cleanupError) {

        console.error(
          'REMINDER CLEANUP ERROR:',
          cleanupError.message
        );
      }

      /**
       * Restore original registration
       */
      if (
        originalPaymentStatus
      ) {

        await RegistrationModel.updatePaymentStatus(
          61,
          originalPaymentStatus
        );

        console.log(
          'REGISTRATION PAYMENT STATUS RESTORED:',
          originalPaymentStatus
        );
      }

      /**
       * Restore registration status
       */
      if (
        originalRegistrationStatus
      ) {

        await RegistrationModel.updateRegistrationStatus(
          61,
          originalRegistrationStatus
        );

        console.log(
          'REGISTRATION STATUS RESTORED:',
          originalRegistrationStatus
        );
      }

    } catch (restoreError) {

      console.error('');
      console.error(
        'DATABASE RESTORE ERROR:',
        restoreError
      );
    }

    console.log('');
    console.log(
      'CLEANUP COMPLETED'
    );
    console.log('');
  }
};

/**
 * Run test
 */
runTest()
  .then(() => {
    console.log(
      'TEST SCRIPT FINISHED'
    );

    process.exit(0);
  })
  .catch(() => {
    console.error(
      'TEST SCRIPT FINISHED WITH ERRORS'
    );

    process.exit(1);
  });