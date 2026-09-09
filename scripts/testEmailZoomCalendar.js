const db = require('../config/db');

const RegistrationModel =
  require('../models/registrationModel');

const PaymentModel =
  require('../models/paymentModel');

const EmailLogModel =
  require('../models/emailLogModel');

const {
  sendRegistrationConfirmation
} = require('../services/emailService');

const TEST_EMAIL =
  'vaishnavimanikeri@gmail.com';

const TEST_EMAIL_TYPE =
  'registration_confirmation';

const runTest = async () => {
  console.log('');
  console.log('========================================');
  console.log('EMAIL + ZOOM + CALENDAR INTEGRATION TEST');
  console.log('========================================');
  console.log('');

  try {
    // =====================================================
    // 1. Find test registration
    // =====================================================

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.webinar_id,
        r.payment_status,

        w.title AS webinar_title,
        w.date AS webinar_date,
        w.time AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price,

        w.zoom_meeting_id,
        w.zoom_join_url,
        w.zoom_start_url,
        w.zoom_password,
        w.zoom_created_at

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE r.email = ?

      ORDER BY r.id DESC

      LIMIT 1
      `,
      [TEST_EMAIL]
    );

    if (!rows.length) {
      throw new Error(
        `No registration found for ${TEST_EMAIL}`
      );
    }

    const registration = rows[0];

    console.log('TEST REGISTRATION FOUND');

    console.log({
      id: registration.id,
      name:
        `${registration.first_name || ''} ${registration.last_name || ''}`
          .trim(),
      email: registration.email,
      webinarId: registration.webinar_id,
      webinarTitle: registration.webinar_title,
      webinarDate: registration.webinar_date,
      webinarTime: registration.webinar_time,
      zoomMeetingId: registration.zoom_meeting_id,
      zoomJoinUrl: registration.zoom_join_url,
      zoomPassword:
        registration.zoom_password
    });

    // =====================================================
    // 2. Validate Zoom details
    // =====================================================

    if (!registration.zoom_meeting_id) {
      throw new Error(
        'Zoom Meeting ID not found in webinar.'
      );
    }

    if (!registration.zoom_join_url) {
      throw new Error(
        'Zoom Join URL not found in webinar.'
      );
    }

    if (!registration.zoom_password) {
      throw new Error(
        'Zoom password not found in webinar.'
      );
    }

    console.log('');
    console.log(
      'ZOOM DETAILS VALIDATION PASSED'
    );

    // =====================================================
    // 3. Validate webinar date/time
    // =====================================================

    if (!registration.webinar_date) {
      throw new Error(
        'Webinar date is missing.'
      );
    }

    if (!registration.webinar_time) {
      throw new Error(
        'Webinar time is missing.'
      );
    }

    console.log(
      'WEBINAR DATE/TIME VALIDATION PASSED'
    );

    // =====================================================
    // 4. Get payment
    // =====================================================

    const payment =
      await PaymentModel.getPaymentByRegistrationId(
        registration.id
      );

    if (!payment) {
      throw new Error(
        `Payment not found for registration ${registration.id}`
      );
    }

    console.log('');
    console.log('PAYMENT FOUND');

    console.log({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentId: payment.payment_id,
      orderId: payment.order_id,
      method: payment.method
    });

    // =====================================================
    // 5. Remove existing test email log
    // =====================================================

    await db.query(
      `
      DELETE FROM email_logs
      WHERE registration_id = ?
      AND email_type = ?
      `,
      [
        registration.id,
        TEST_EMAIL_TYPE
      ]
    );

    console.log('');
    console.log(
      'OLD TEST EMAIL LOG REMOVED'
    );

    // =====================================================
    // 6. Send confirmation email
    // =====================================================

    console.log('');
    console.log(
      'SENDING EMAIL THROUGH EMAIL SERVICE...'
    );

    const result =
      await sendRegistrationConfirmation({
        registration,
        payment
      });

    console.log('');
    console.log('EMAIL RESULT');
    console.log(result);

    // =====================================================
    // 7. Validate email result
    // =====================================================

    if (!result.success) {
      throw new Error(
        'Email service returned success=false.'
      );
    }

    if (result.alreadySent) {
      throw new Error(
        'Email was unexpectedly treated as duplicate.'
      );
    }

    if (!result.messageId) {
      throw new Error(
        'Email Message ID missing.'
      );
    }

    if (!result.calendarAttached) {
      throw new Error(
        'Calendar attachment was not added.'
      );
    }

    if (!result.zoomIncluded) {
      throw new Error(
        'Zoom details were not included in email.'
      );
    }

    if (
      result.zoomMeetingId !==
      registration.zoom_meeting_id
    ) {
      throw new Error(
        'Zoom Meeting ID mismatch.'
      );
    }

    if (
      result.zoomJoinUrl !==
      registration.zoom_join_url
    ) {
      throw new Error(
        'Zoom Join URL mismatch.'
      );
    }

    console.log('');
    console.log(
      'EMAIL SEND VALIDATION PASSED'
    );

    console.log(
      'Zoom details included: YES'
    );

    console.log(
      'Calendar attached: YES'
    );

    // =====================================================
    // 8. Check email log
    // =====================================================

    const emailLog =
      await EmailLogModel.getByRegistrationAndType(
        registration.id,
        TEST_EMAIL_TYPE
      );

    if (!emailLog) {
      throw new Error(
        'Email log was not found.'
      );
    }

    console.log('');
    console.log('EMAIL LOG');

    console.log({
      id: emailLog.id,
      registrationId:
        emailLog.registration_id,
      email: emailLog.email,
      type: emailLog.email_type,
      status: emailLog.status,
      messageId: emailLog.message_id,
      retryCount:
        emailLog.retry_count
    });

    if (emailLog.status !== 'sent') {
      throw new Error(
        `Expected email log status sent, got ${emailLog.status}`
      );
    }

    if (!emailLog.message_id) {
      throw new Error(
        'Email log Message ID is missing.'
      );
    }

    console.log('');
    console.log(
      'EMAIL LOG VALIDATION PASSED'
    );

    // =====================================================
    // 9. Duplicate protection
    // =====================================================

    console.log('');
    console.log(
      'TESTING DUPLICATE EMAIL PROTECTION...'
    );

    const secondResult =
      await sendRegistrationConfirmation({
        registration,
        payment
      });

    console.log('');
    console.log('SECOND EMAIL RESULT');

    console.log(secondResult);

    if (!secondResult.success) {
      throw new Error(
        'Duplicate request returned success=false.'
      );
    }

    if (!secondResult.alreadySent) {
      throw new Error(
        'Duplicate email was not blocked.'
      );
    }

    console.log('');
    console.log(
      'DUPLICATE EMAIL PROTECTION PASSED'
    );

    // =====================================================
    // 10. Count email logs
    // =====================================================

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS count
      FROM email_logs
      WHERE registration_id = ?
      AND email_type = ?
      `,
      [
        registration.id,
        TEST_EMAIL_TYPE
      ]
    );

    const emailLogCount =
      Number(countRows[0].count);

    console.log('');
    console.log(
      'DATABASE EMAIL LOG COUNT:',
      emailLogCount
    );

    if (emailLogCount !== 1) {
      throw new Error(
        `Expected exactly 1 email log, found ${emailLogCount}`
      );
    }

    console.log(
      'ONLY ONE EMAIL LOG EXISTS'
    );

    // =====================================================
    // FINAL
    // =====================================================

    console.log('');
    console.log('========================================');
    console.log(
      'EMAIL + ZOOM + CALENDAR INTEGRATION PASSED'
    );
    console.log('========================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error(
      'EMAIL + ZOOM + CALENDAR TEST FAILED'
    );
    console.error('========================================');
    console.error('');
    console.error(error);
    console.error('');

    process.exitCode = 1;
  } finally {
    try {
      await db.end();
    } catch (error) {
      // Ignore database close error
    }
  }
};

runTest();