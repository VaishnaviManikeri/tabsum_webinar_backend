require('dotenv').config({
  path: ['.env.local', '.env']
});

const db = require('../config/db');

const emailService =
  require('../services/emailService');


async function testRealCalendarEmail() {

  try {

    console.log('\n========================================');
    console.log('REAL SES CALENDAR EMAIL TEST');
    console.log('========================================\n');


    // ==================================================
    // STEP 1: FIND TEST REGISTRATION
    // ==================================================

    const [registrations] = await db.query(
      `
      SELECT
        r.id,
        r.first_name,
        r.last_name,
        r.email,
        r.webinar_id,
        r.payment_status,

        w.title AS webinar_title,
        DATE_FORMAT(w.date, '%Y-%m-%d') AS webinar_date,
        TIME_FORMAT(w.time, '%H:%i') AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      WHERE r.email = ?

      ORDER BY r.id DESC

      LIMIT 1
      `,
      [
        'vaishnavimanikeri@gmail.com'
      ]
    );


    if (registrations.length === 0) {

      throw new Error(
        'No test registration found for vaishnavimanikeri@gmail.com.'
      );
    }


    const registration =
      registrations[0];


    console.log(
      'Test registration found:'
    );


    console.log({

      id:
        registration.id,

      name:
        `${registration.first_name || ''} ${registration.last_name || ''}`
          .trim(),

      email:
        registration.email,

      webinar:
        registration.webinar_title,

      date:
        registration.webinar_date,

      time:
        registration.webinar_time,

      duration:
        registration.webinar_duration,

      platform:
        registration.webinar_platform

    });


    // ==================================================
    // STEP 2: TEMPORARY TEST DATE
    // ==================================================

    if (
      !registration.webinar_date
    ) {

      console.log(
        '\n⚠️ Webinar date is NULL.'
      );

      console.log(
        'Using temporary test date: 2026-10-15'
      );

      registration.webinar_date =
        '2026-10-15';
    }


    // ==================================================
    // STEP 3: TEMPORARY TEST TIME
    // ==================================================

    if (
      !registration.webinar_time ||
      registration.webinar_time === '00:00'
    ) {

      console.log(
        '\n⚠️ Webinar time is missing/00:00.'
      );

      console.log(
        'Using temporary test time: 10:00'
      );

      registration.webinar_time =
        '10:00';
    }


    // ==================================================
    // STEP 4: PAYMENT TEST DATA
    // ==================================================

    const payment = {

      amount:
        Number(
          registration.webinar_price || 249
        ),

      currency:
        'INR',

      status:
        'paid',

      payment_id:
        'real_calendar_email_test',

      order_id:
        'real_calendar_order_test',

      method:
        'test'

    };


    // ==================================================
    // STEP 5: SEND REAL EMAIL
    // ==================================================

    console.log(
      '\n----------------------------------------'
    );

    console.log(
      'SENDING REAL EMAIL THROUGH AMAZON SES'
    );

    console.log(
      '----------------------------------------\n'
    );


    const result =
      await emailService
        .sendRegistrationConfirmation({

          registration,

          payment

        });


    // ==================================================
    // STEP 6: DISPLAY RESULT
    // ==================================================

    console.log(
      '\nREAL SES EMAIL RESULT:'
    );


    console.log(
      result
    );


    // ==================================================
    // STEP 7: VALIDATE RESULT
    // ==================================================

    if (
      result.success !== true
    ) {

      throw new Error(
        'Real SES email was not successful.'
      );
    }


    if (
      result.alreadySent === true
    ) {

      console.log(
        '\n⚠️ Email was already sent for this registration.'
      );

      console.log(
        'No new email was sent because duplicate protection is active.'
      );

      console.log(
        'Create/use a fresh registration for another real email test.'
      );

    } else {

      if (
        result.calendarAttached !== true
      ) {

        throw new Error(
          'Real email was sent but calendar attachment was not confirmed.'
        );
      }


      console.log(
        '\nREAL SES EMAIL SENT SUCCESSFULLY ✅'
      );


      console.log(
        'Calendar attachment included ✅'
      );


      console.log(
        'Message ID:',
        result.messageId
      );

    }


    // ==================================================
    // FINAL
    // ==================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'REAL SES CALENDAR EMAIL TEST COMPLETED ✅'
    );

    console.log(
      '========================================\n'
    );


    process.exit(0);


  } catch (error) {

    console.error(
      '\n========================================'
    );

    console.error(
      'REAL SES CALENDAR EMAIL TEST FAILED ❌'
    );

    console.error(
      'Error:',
      error.message
    );

    console.error(
      '========================================\n'
    );


    process.exit(1);
  }
}


testRealCalendarEmail();