require('dotenv').config({
  path: ['.env.local', '.env']
});

const db = require('../config/db');

const emailService =
  require('../services/emailService');

const EmailLogModel =
  require('../models/emailLogModel');


async function testEmailServiceDuplicate() {

  let testLogId = null;

  let originalSendMail = null;

  let sendMailCallCount = 0;

  let capturedMailOptions = null;


  try {

    console.log('\n======================================');
    console.log('EMAIL SERVICE + CALENDAR ATTACHMENT TEST');
    console.log('======================================\n');


    // ==================================================
    // STEP 1: FIND EXISTING REGISTRATION
    // ==================================================

    const [registrations] = await db.query(
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
        DATE_FORMAT(w.date, '%Y-%m-%d') AS webinar_date,
        TIME_FORMAT(w.time, '%H:%i') AS webinar_time,
        w.duration AS webinar_duration,
        w.platform AS webinar_platform,
        w.price AS webinar_price

      FROM registrations r

      LEFT JOIN webinars w
        ON r.webinar_id = w.id

      ORDER BY r.id ASC

      LIMIT 1
      `
    );


    // --------------------------------------------------
    // CHECK REGISTRATION
    // --------------------------------------------------

    if (registrations.length === 0) {

      console.error(
        '❌ No registration found.'
      );

      process.exit(1);
    }


    const registration =
      registrations[0];


    // --------------------------------------------------
    // SHOW REGISTRATION
    // --------------------------------------------------

    console.log(
      'Using registration:'
    );


    console.log({

      id:
        registration.id,

      name:
        `${registration.first_name || ''} ${registration.last_name || ''}`
          .trim(),

      email:
        registration.email,

      webinar_id:
        registration.webinar_id,

      webinar_title:
        registration.webinar_title,

      webinar_date:
        registration.webinar_date,

      webinar_time:
        registration.webinar_time,

      webinar_duration:
        registration.webinar_duration,

      webinar_platform:
        registration.webinar_platform,

      webinar_price:
        registration.webinar_price

    });


    // ==================================================
    // STEP 2: CHECK WEBINAR DATA
    // ==================================================

    if (
      !registration.webinar_title
    ) {

      console.log(
        '\n⚠️ Webinar title not found.'
      );

      registration.webinar_title =
        'The Abundance Crossroad™';
    }


    if (
      !registration.webinar_date
    ) {

      console.log(
        '\n⚠️ Webinar date not found.'
      );

      console.log(
        'Using temporary test date: 2026-10-15'
      );

      registration.webinar_date =
        '2026-10-15';
    }


    if (
      !registration.webinar_time
    ) {

      console.log(
        '\n⚠️ Webinar time not found.'
      );

      console.log(
        'Using temporary test time: 10:00'
      );

      registration.webinar_time =
        '10:00';
    }


    if (
      !registration.webinar_duration
    ) {

      registration.webinar_duration =
        '2 Hours Each Day';
    }


    if (
      !registration.webinar_platform
    ) {

      registration.webinar_platform =
        'Zoom';
    }


    if (
      !registration.webinar_price
    ) {

      registration.webinar_price =
        249;
    }


    // ==================================================
    // STEP 3: REMOVE OLD TEST EMAIL LOG
    // ==================================================

    await db.query(
      `
      DELETE FROM email_logs

      WHERE registration_id = ?

        AND email_type =
          'registration_confirmation'
      `,
      [
        registration.id
      ]
    );


    console.log(
      '\nOld test email log removed if it existed.'
    );


    // ==================================================
    // STEP 4: MOCK NODEMAILER sendMail()
    // ==================================================

    originalSendMail =
      emailService.transporter.sendMail;


    emailService.transporter.sendMail =
      async function fakeSendMail(
        mailOptions
      ) {

        sendMailCallCount++;

        capturedMailOptions =
          mailOptions;


        console.log(
          `\nFAKE SES sendMail() called: ${sendMailCallCount}`
        );


        console.log({

          to:
            mailOptions.to,

          subject:
            mailOptions.subject,

          hasAttachments:
            Boolean(
              mailOptions.attachments
            ),

          attachmentCount:
            mailOptions.attachments
              ? mailOptions.attachments.length
              : 0

        });


        // ------------------------------------------------
        // DISPLAY ATTACHMENT INFORMATION
        // ------------------------------------------------

        if (
          mailOptions.attachments &&
          mailOptions.attachments.length > 0
        ) {

          console.log(
            '\nCALENDAR ATTACHMENT FOUND:'
          );


          mailOptions.attachments
            .forEach(
              (
                attachment,
                index
              ) => {

                console.log({

                  index:
                    index + 1,

                  filename:
                    attachment.filename,

                  contentType:
                    attachment.contentType,

                  contentDisposition:
                    attachment.contentDisposition,

                  contentLength:
                    attachment.content
                      ? attachment.content.length
                      : 0

                });

              }
            );
        }


        // ------------------------------------------------
        // FAKE SES RESPONSE
        // ------------------------------------------------

        return {

          messageId:
            '<fake-test-message-id@example.com>'

        };

      };


    // ==================================================
    // STEP 5: PAYMENT TEST DATA
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
        'test_payment_123',

      order_id:
        'test_order_123',

      method:
        'netbanking'

    };


    // ==================================================
    // STEP 6: FIRST EMAIL CALL
    // ==================================================

    console.log(
      '\n--------------------------------------'
    );


    console.log(
      'FIRST EMAIL CALL'
    );


    console.log(
      '--------------------------------------'
    );


    const firstResult =
      await emailService
        .sendRegistrationConfirmation({

          registration,

          payment

        });


    console.log(
      '\nFIRST CALL RESULT ✅'
    );


    console.log(
      firstResult
    );


    // ==================================================
    // STEP 7: VERIFY sendMail() WAS CALLED
    // ==================================================

    if (
      !capturedMailOptions
    ) {

      throw new Error(
        'sendMail() was not called.'
      );
    }


    if (
      sendMailCallCount !== 1
    ) {

      throw new Error(
        `Expected 1 sendMail call, got ${sendMailCallCount}`
      );
    }


    console.log(
      '\nEMAIL SEND CALL VALIDATION PASSED ✅'
    );


    // ==================================================
    // STEP 8: VERIFY CALENDAR ATTACHMENT
    // ==================================================

    if (
      !capturedMailOptions.attachments
    ) {

      throw new Error(
        'No email attachments found.'
      );
    }


    if (
      capturedMailOptions.attachments.length !== 1
    ) {

      throw new Error(
        `Expected 1 attachment, found ${capturedMailOptions.attachments.length}`
      );
    }


    const calendarAttachment =
      capturedMailOptions.attachments[0];


    // --------------------------------------------------
    // FILENAME
    // --------------------------------------------------

    if (
      calendarAttachment.filename !==
      'the-abundance-crossroad.ics'
    ) {

      throw new Error(
        `Unexpected calendar filename: ${calendarAttachment.filename}`
      );
    }


    // --------------------------------------------------
    // CONTENT
    // --------------------------------------------------

    if (
      !calendarAttachment.content
    ) {

      throw new Error(
        'Calendar attachment content is missing.'
      );
    }


    // --------------------------------------------------
    // BEGIN:VCALENDAR
    // --------------------------------------------------

    if (
      !calendarAttachment.content.includes(
        'BEGIN:VCALENDAR'
      )
    ) {

      throw new Error(
        'Calendar attachment does not contain BEGIN:VCALENDAR.'
      );
    }


    // --------------------------------------------------
    // END:VCALENDAR
    // --------------------------------------------------

    if (
      !calendarAttachment.content.includes(
        'END:VCALENDAR'
      )
    ) {

      throw new Error(
        'Calendar attachment does not contain END:VCALENDAR.'
      );
    }


    // --------------------------------------------------
    // BEGIN:VEVENT
    // --------------------------------------------------

    if (
      !calendarAttachment.content.includes(
        'BEGIN:VEVENT'
      )
    ) {

      throw new Error(
        'Calendar attachment does not contain BEGIN:VEVENT.'
      );
    }


    // --------------------------------------------------
    // END:VEVENT
    // --------------------------------------------------

    if (
      !calendarAttachment.content.includes(
        'END:VEVENT'
      )
    ) {

      throw new Error(
        'Calendar attachment does not contain END:VEVENT.'
      );
    }


    // --------------------------------------------------
    // CONTENT TYPE
    // --------------------------------------------------

    if (
      calendarAttachment.contentType !==
      'text/calendar; charset=utf-8'
    ) {

      throw new Error(
        `Unexpected calendar content type: ${calendarAttachment.contentType}`
      );
    }


    // --------------------------------------------------
    // CONTENT DISPOSITION
    // --------------------------------------------------

    if (
      calendarAttachment.contentDisposition !==
      'attachment'
    ) {

      throw new Error(
        `Unexpected content disposition: ${calendarAttachment.contentDisposition}`
      );
    }


    console.log(
      '\nCALENDAR ATTACHMENT VALIDATION PASSED ✅'
    );


    // ==================================================
    // STEP 9: VERIFY FIRST RESULT
    // ==================================================

    if (
      firstResult.success !== true
    ) {

      throw new Error(
        'First email call did not return success.'
      );
    }


    if (
      firstResult.alreadySent !== false
    ) {

      throw new Error(
        'First email call incorrectly reported alreadySent.'
      );
    }


    if (
      firstResult.calendarAttached !== true
    ) {

      throw new Error(
        'calendarAttached was not true.'
      );
    }


    console.log(
      '\nFIRST EMAIL RESULT VALIDATED ✅'
    );


    // ==================================================
    // STEP 10: GET EMAIL LOG
    // ==================================================

    const firstLog =
      await EmailLogModel
        .getByRegistrationAndType(
          registration.id,
          'registration_confirmation'
        );


    if (
      !firstLog
    ) {

      throw new Error(
        'Email log was not created after first call.'
      );
    }


    testLogId =
      firstLog.id;


    console.log(
      '\nFIRST EMAIL LOG:'
    );


    console.log({

      id:
        firstLog.id,

      status:
        firstLog.status,

      message_id:
        firstLog.message_id,

      retry_count:
        firstLog.retry_count

    });


    // ==================================================
    // STEP 11: VERIFY EMAIL LOG
    // ==================================================

    if (
      firstLog.status !==
      'sent'
    ) {

      throw new Error(
        'First email was not marked as sent.'
      );
    }


    if (
      !firstLog.message_id
    ) {

      throw new Error(
        'SES message ID was not saved.'
      );
    }


    console.log(
      '\nFIRST EMAIL SENT AND LOGGED ✅'
    );


    // ==================================================
    // STEP 12: SECOND EMAIL CALL
    // ==================================================

    console.log(
      '\n--------------------------------------'
    );


    console.log(
      'SECOND EMAIL CALL'
    );


    console.log(
      '--------------------------------------'
    );


    const secondResult =
      await emailService
        .sendRegistrationConfirmation({

          registration,

          payment

        });


    console.log(
      '\nSECOND CALL RESULT ✅'
    );


    console.log(
      secondResult
    );


    // ==================================================
    // STEP 13: VERIFY DUPLICATE PROTECTION
    // ==================================================

    if (
      secondResult.alreadySent !== true
    ) {

      throw new Error(
        'Duplicate email was NOT blocked.'
      );
    }


    if (
      sendMailCallCount !== 1
    ) {

      throw new Error(
        `Duplicate email was sent. sendMail calls: ${sendMailCallCount}`
      );
    }


    console.log(
      '\nDUPLICATE EMAIL BLOCKED SUCCESSFULLY ✅'
    );


    // ==================================================
    // STEP 14: CHECK DATABASE
    // ==================================================

    const [rows] =
      await db.query(
        `
        SELECT COUNT(*) AS total

        FROM email_logs

        WHERE registration_id = ?

          AND email_type =
            'registration_confirmation'
        `,
        [
          registration.id
        ]
      );


    const totalLogs =
      Number(
        rows[0].total
      );


    console.log(
      '\nDATABASE EMAIL LOG COUNT:'
    );


    console.log(
      totalLogs
    );


    if (
      totalLogs !== 1
    ) {

      throw new Error(
        `Expected 1 email log, found ${totalLogs}`
      );
    }


    console.log(
      '\nONLY ONE EMAIL LOG EXISTS ✅'
    );


    // ==================================================
    // STEP 15: RESTORE ORIGINAL sendMail()
    // ==================================================

    emailService.transporter.sendMail =
      originalSendMail;


    // ==================================================
    // STEP 16: CLEANUP TEST RECORD
    // ==================================================

    if (
      testLogId
    ) {

      await db.query(
        `
        DELETE FROM email_logs

        WHERE id = ?
        `,
        [
          testLogId
        ]
      );


      console.log(
        '\nTEST EMAIL LOG CLEANED UP ✅'
      );
    }


    // ==================================================
    // FINAL RESULT
    // ==================================================

    console.log(
      '\n======================================'
    );


    console.log(
      'EMAIL SERVICE + CALENDAR TEST PASSED ✅'
    );


    console.log(
      '======================================\n'
    );


    process.exit(0);


  } catch (error) {


    // ==================================================
    // RESTORE ORIGINAL sendMail()
    // ==================================================

    if (
      originalSendMail
    ) {

      emailService.transporter.sendMail =
        originalSendMail;
    }


    // ==================================================
    // CLEANUP
    // ==================================================

    if (
      testLogId
    ) {

      try {

        await db.query(
          `
          DELETE FROM email_logs

          WHERE id = ?
          `,
          [
            testLogId
          ]
        );


        console.log(
          'Test email log cleaned up.'
        );

      } catch (cleanupError) {

        console.error(
          'Cleanup failed:',
          cleanupError
        );
      }
    }


    // ==================================================
    // ERROR
    // ==================================================

    console.error(
      '\nEMAIL SERVICE + CALENDAR TEST FAILED ❌'
    );


    console.error(
      'Error:',
      error.message
    );


    console.error(
      error
    );


    process.exit(1);
  }
}


testEmailServiceDuplicate();