const db = require("../config/db");
const EmailLogModel = require("../models/emailLogModel");
const emailService = require("../services/emailService");

const REGISTRATION_ID = 87;

async function runTest() {
  let originalCreateOrGetLog;
  let originalMarkAsSent;
  let originalMarkAsFailed;
  let originalSendMail;

  try {
    console.log("\n========================================");
    console.log("CALENDAR + EMAIL INTEGRATION TEST");
    console.log("========================================\n");

    // --------------------------------------------------
    // 1. Get actual registration from database
    // --------------------------------------------------
    const [rows] = await db.query(
      `
      SELECT
        r.*,
        COALESCE(r.webinar_title_snapshot, w.title) AS webinar_title,
        COALESCE(r.webinar_subtitle_snapshot, w.subtitle) AS webinar_subtitle,
        COALESCE(r.webinar_date_snapshot, w.date) AS webinar_date,
        COALESCE(r.webinar_time_snapshot, w.time) AS webinar_time,
        COALESCE(r.webinar_duration_snapshot, w.duration) AS webinar_duration,
        COALESCE(r.webinar_language_snapshot, w.language) AS webinar_language,
        COALESCE(r.webinar_platform_snapshot, w.platform) AS webinar_platform,
        COALESCE(r.webinar_price_snapshot, w.price) AS webinar_price
      FROM registrations r
      LEFT JOIN webinars w
        ON r.webinar_id = w.id
      WHERE r.id = ?
      LIMIT 1
      `,
      [REGISTRATION_ID]
    );

    if (!rows.length) {
      throw new Error(`Registration ${REGISTRATION_ID} not found`);
    }

    const registration = rows[0];

    console.log("Registration ID:", registration.id);
    console.log("Name:", registration.first_name, registration.last_name);
    console.log("Email:", registration.email);
    console.log("Payment Status:", registration.payment_status);
    console.log("Registration Status:", registration.registration_status);
    console.log("Webinar Date:", registration.webinar_date);
    console.log("Webinar Time:", registration.webinar_time);

    // --------------------------------------------------
    // 2. Validate registration
    // --------------------------------------------------
    if (registration.payment_status !== "paid") {
      throw new Error("Registration is not PAID");
    }

    if (registration.registration_status !== "registered") {
      throw new Error("Registration is not REGISTERED");
    }

    // --------------------------------------------------
    // 3. Mock email log functions
    //    No database changes
    // --------------------------------------------------
    originalCreateOrGetLog = EmailLogModel.createOrGetLog;
    originalMarkAsSent = EmailLogModel.markAsSent;
    originalMarkAsFailed = EmailLogModel.markAsFailed;

    EmailLogModel.createOrGetLog = async () => {
      console.log("\n[MOCK] Email log created");
      return {
        id: 999999,
        status: "pending",
        message_id: null
      };
    };

    EmailLogModel.markAsSent = async (...args) => {
      console.log("[MOCK] Email marked as sent");
      return args;
    };

    EmailLogModel.markAsFailed = async (...args) => {
      console.log("[MOCK] Email marked as failed");
      return args;
    };

    // --------------------------------------------------
    // 4. Mock SMTP sendMail
    // --------------------------------------------------
    if (!emailService.transporter) {
      throw new Error(
        "emailService.transporter is not exported. We need to adjust emailService.js for testing."
      );
    }

    originalSendMail = emailService.transporter.sendMail;

    let capturedMailOptions = null;

    emailService.transporter.sendMail = async (mailOptions) => {
      capturedMailOptions = mailOptions;

      console.log("\n[MOCK SMTP] sendMail called");
      console.log("To:", mailOptions.to);
      console.log(
        "Attachments:",
        Array.isArray(mailOptions.attachments)
          ? mailOptions.attachments.length
          : 0
      );

      return {
        messageId: "<calendar-integration-test@example.com>"
      };
    };

    // --------------------------------------------------
    // 5. Get payment information
    // --------------------------------------------------
    const [paymentRows] = await db.query(
      `
      SELECT *
      FROM payments
      WHERE registration_id = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [REGISTRATION_ID]
    );

    const payment = paymentRows[0] || null;

    console.log("\nPayment Record:", payment ? "FOUND ✅" : "NOT FOUND");

    // --------------------------------------------------
    // 6. Call actual Email Service
    // --------------------------------------------------
    console.log("\nCalling sendRegistrationConfirmation()...\n");

    const result = await emailService.sendRegistrationConfirmation({
      registration,
      payment
    });

    console.log("\nEmail Service Result:");
    console.log(result);

    // --------------------------------------------------
    // 7. Validate captured email
    // --------------------------------------------------
    if (!capturedMailOptions) {
      throw new Error("SMTP mock did not capture email");
    }

    if (!Array.isArray(capturedMailOptions.attachments)) {
      throw new Error("Email attachments array not found");
    }

    const calendarAttachment =
      capturedMailOptions.attachments.find(
        (attachment) =>
          attachment.filename === "the-abundance-crossroad.ics"
      );

    if (!calendarAttachment) {
      throw new Error(
        "the-abundance-crossroad.ics attachment NOT FOUND"
      );
    }

    console.log("\nCalendar attachment found ✅");
    console.log("Filename:", calendarAttachment.filename);

    const calendarContent =
      calendarAttachment.content?.toString() || "";

    if (!calendarContent.includes("BEGIN:VCALENDAR")) {
      throw new Error("BEGIN:VCALENDAR not found");
    }

    if (!calendarContent.includes("DTSTART:")) {
      throw new Error("DTSTART not found");
    }

    if (!calendarContent.includes("DURATION:PT2H")) {
      throw new Error("DURATION:PT2H not found");
    }

    if (!calendarContent.includes("END:VCALENDAR")) {
      throw new Error("END:VCALENDAR not found");
    }

    console.log("BEGIN:VCALENDAR: FOUND ✅");
    console.log("DTSTART: FOUND ✅");
    console.log("DURATION:PT2H: FOUND ✅");
    console.log("END:VCALENDAR: FOUND ✅");

    console.log("\n========================================");
    console.log("EMAIL SERVICE INTEGRATION TEST PASSED ✅");
    console.log("========================================");
    console.log("Calendar attachment: FOUND ✅");
    console.log("Real email sent: NO ✅");
    console.log("Database email log changed: NO ✅");
    console.log("========================================\n");

  } catch (error) {
    console.error("\n========================================");
    console.error("EMAIL SERVICE INTEGRATION TEST FAILED ❌");
    console.error("========================================");
    console.error(error);
    console.error("========================================\n");

    process.exitCode = 1;

  } finally {
    // Restore mocked functions
    if (originalCreateOrGetLog) {
      EmailLogModel.createOrGetLog = originalCreateOrGetLog;
    }

    if (originalMarkAsSent) {
      EmailLogModel.markAsSent = originalMarkAsSent;
    }

    if (originalMarkAsFailed) {
      EmailLogModel.markAsFailed = originalMarkAsFailed;
    }

    if (
      originalSendMail &&
      emailService.transporter
    ) {
      emailService.transporter.sendMail = originalSendMail;
    }

   
  }
}

runTest();