const nodemailer = require('nodemailer');

const EmailLogModel = require('../models/emailLogModel');
const WebinarModel = require('../models/webinarModel');
const NotificationTemplateModel = require('../models/notificationTemplateModel');

const {
  createWebinarCalendarEvent
} = require('./calendarService');

const EMAIL_MOCK_MODE =
  String(process.env.EMAIL_MOCK_MODE || 'false')
    .toLowerCase() === 'true';

// ==================================================
// AMAZON SES SMTP TRANSPORTER
// ==================================================

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,

  port: Number(process.env.MAIL_PORT || 587),

  secure: Number(process.env.MAIL_PORT) === 465,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  },

  tls: {
    minVersion: 'TLSv1.2'
  }
});

// ==================================================
// VERIFY EMAIL CONNECTION
// ==================================================

async function verifyEmailConnection() {
  if (EMAIL_MOCK_MODE) {
    console.log(
      'EMAIL MOCK MODE: SMTP connection check skipped.'
    );

    return true;
  }

  try {
    await transporter.verify();

    console.log(
      'Amazon SES SMTP connection verified successfully.'
    );

    return true;
  } catch (error) {
    console.error(
      'Amazon SES SMTP connection failed:',
      error.message
    );

    return false;
  }
}

// ==================================================
// CALENDAR DATE/TIME NORMALIZATION
// ==================================================

function normalizeCalendarDate(value) {
  if (!value) {
    return null;
  }

  const stringValue =
    String(value).trim();

  // Already YYYY-MM-DD
  const directMatch =
    stringValue.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (directMatch) {
    return stringValue;
  }

  // ISO datetime / MySQL datetime
  const isoMatch =
    stringValue.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (isoMatch) {
    return (
      `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    );
  }

  return null;
}


function normalizeCalendarTime(value) {
  if (!value) {
    return null;
  }

  const stringValue =
    String(value)
      .trim()
      .toUpperCase();

  // --------------------------------------------------
  // Already HH:mm or HH:mm:ss
  // --------------------------------------------------

  const twentyFourHourMatch =
    stringValue.match(
      /^(\d{1,2}):(\d{2})(?::\d{2})?$/
    );

  if (twentyFourHourMatch) {
    const hour =
      Number(twentyFourHourMatch[1]);

    const minute =
      Number(twentyFourHourMatch[2]);

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return (
        `${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')}`
      );
    }
  }

  // --------------------------------------------------
  // Time range
  //
  // Example:
  // 08:00PM-10:00PM
  // 08:00 PM - 10:00 PM
  // --------------------------------------------------

  const rangeMatch =
    stringValue.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/
    );

  if (rangeMatch) {
    let hour =
      Number(rangeMatch[1]);

    const minute =
      Number(rangeMatch[2]);

    const meridiem =
      rangeMatch[3];

    if (
      meridiem === 'PM' &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      meridiem === 'AM' &&
      hour === 12
    ) {
      hour = 0;
    }

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return (
        `${String(hour).padStart(2, '0')}:` +
        `${String(minute).padStart(2, '0')}`
      );
    }
  }

  return null;
}

// ==================================================
// SEND REGISTRATION CONFIRMATION
// ==================================================

async function sendRegistrationConfirmation({
  registration,
  payment
}) {
  // --------------------------------------------------
  // BASIC VALIDATION
  // --------------------------------------------------

  if (!registration) {
    throw new Error(
      'Registration details are required to send confirmation email.'
    );
  }

  if (!registration.email) {
    throw new Error(
      'Registration email is missing.'
    );
  }

  if (!registration.id) {
    throw new Error(
      'Registration ID is missing.'
    );
  }

  // --------------------------------------------------
  // CREATE OR GET EMAIL LOG
  // --------------------------------------------------

  let emailLog;

  try {
    emailLog =
      await EmailLogModel.createOrGetLog({
        registrationId: registration.id,
        email: registration.email,
        emailType: 'registration_confirmation'
      });

    console.log(
      `Email log ready. Log ID: ${emailLog.id}`
    );
  } catch (logError) {
    console.error(
      'Failed to create/get email log:',
      logError
    );

    throw logError;
  }

  // --------------------------------------------------
  // DUPLICATE EMAIL PROTECTION
  // --------------------------------------------------

  if (emailLog.status === 'sent') {
    console.log(
      `Confirmation email already sent for registration ${registration.id}.`
    );

    console.log(
      'Duplicate email prevented.'
    );

    return {
      success: true,
      alreadySent: true,
      messageId: emailLog.message_id,
      emailLogId: emailLog.id
    };
  }

  // ==================================================
  // PREPARE BASIC EMAIL DATA
  // ==================================================

  const fullName =
    `${registration.first_name || ''} ${registration.last_name || ''}`
      .trim();

  const recipientName =
    fullName || 'Participant';

  const webinarTitle =
    registration.webinar_title ||
    'The Abundance Crossroad™';

  const webinarDate =
    registration.webinar_date ||
    'To be announced';

  const webinarTime =
    registration.webinar_time ||
    'To be announced';

  const webinarDuration =
    registration.webinar_duration ||
    '2 Hours Each Day';

  const webinarPlatform =
    registration.webinar_platform ||
    'Zoom';

  const amount =
    payment?.amount ||
    registration.price ||
    249;

  const currency =
    payment?.currency ||
    'INR';

  const paymentStatus =
    payment?.status ||
    'paid';

  const paymentId =
    payment?.payment_id ||
    'N/A';

  const orderId =
    payment?.order_id ||
    'N/A';

  const paymentMethod =
    payment?.method ||
    'Razorpay';

  // ==================================================
  // ZOOM DETAILS
  // ==================================================

  let zoomMeetingId =
    registration.zoom_meeting_id ||
    null;

  let zoomJoinUrl =
    registration.zoom_join_url ||
    null;

  let zoomStartUrl =
    registration.zoom_start_url ||
    null;

  let zoomPassword =
    registration.zoom_password ||
    null;

  let zoomCreatedAt =
    registration.zoom_created_at ||
    null;

  // --------------------------------------------------
  // FETCH ZOOM DETAILS FROM WEBINAR
  // --------------------------------------------------

  if (
    registration.webinar_id &&
    (
      !zoomMeetingId ||
      !zoomJoinUrl
    )
  ) {
    try {
      const webinar =
        await WebinarModel.getWebinarById(
          registration.webinar_id
        );

      if (webinar) {
        zoomMeetingId =
          zoomMeetingId ||
          webinar.zoom_meeting_id ||
          null;

        zoomJoinUrl =
          zoomJoinUrl ||
          webinar.zoom_join_url ||
          null;

        zoomStartUrl =
          zoomStartUrl ||
          webinar.zoom_start_url ||
          null;

        zoomPassword =
          zoomPassword ||
          webinar.zoom_password ||
          null;

        zoomCreatedAt =
          zoomCreatedAt ||
          webinar.zoom_created_at ||
          null;
      }

      console.log(
        'Zoom details fetched for confirmation email.'
      );

      console.log({
        meetingId: zoomMeetingId,
        joinUrl: zoomJoinUrl,
        startUrl: zoomStartUrl,
        passwordAvailable: Boolean(zoomPassword),
        createdAt: zoomCreatedAt
      });
    } catch (zoomFetchError) {
      console.error(
        'Failed to fetch Zoom details for email:',
        zoomFetchError.message
      );
    }
  }

  // --------------------------------------------------
  // ZOOM AVAILABILITY
  // --------------------------------------------------

  const hasZoomDetails =
    Boolean(zoomJoinUrl);

  if (hasZoomDetails) {
    console.log(
      'Zoom Join URL available for confirmation email.'
    );
  } else {
    console.warn(
      'Zoom Join URL not available. Email will be sent without Zoom details.'
    );
  }

  // ==================================================
  // EMAIL SUBJECT
  // ==================================================

  const confirmationTemplate =
    await NotificationTemplateModel.get(
      'email',
      'confirmation'
    );

  const subject =
    confirmationTemplate?.subject ||
    'Registration Confirmed — The Abundance Crossroad™';

  const confirmationMessage =
    confirmationTemplate?.body ||
    'Your registration for The Abundance Crossroad™ has been successfully confirmed.';

  // ==================================================
  // CALENDAR INVITE
  // ==================================================

  let calendarAttachment = null;

  try {
    /*
     * Calendar service expects:
     *
     * date:
     * YYYY-MM-DD
     *
     * time:
     * HH:mm
     */

    if (
      registration.webinar_date &&
      registration.webinar_time
    ) {
      const normalizedCalendarDate =
        normalizeCalendarDate(
          registration.webinar_date
        );

      const normalizedCalendarTime =
        normalizeCalendarTime(
          registration.webinar_time
        );

      console.log(
        'Calendar date normalization:',
        {
          original:
            registration.webinar_date,

          normalized:
            normalizedCalendarDate
        }
      );

      console.log(
        'Calendar time normalization:',
        {
          original:
            registration.webinar_time,

          normalized:
            normalizedCalendarTime
        }
      );

      // ------------------------------------------------
      // VALIDATE NORMALIZED DATE/TIME
      // ------------------------------------------------

      if (
        !normalizedCalendarDate ||
        !normalizedCalendarTime
      ) {
        console.warn(
          'Invalid webinar date/time for calendar invitation.',
          {
            webinarDate:
              registration.webinar_date,

            webinarTime:
              registration.webinar_time,

            normalizedDate:
              normalizedCalendarDate,

            normalizedTime:
              normalizedCalendarTime
          }
        );
      } else {
        // ----------------------------------------------
        // CREATE CALENDAR EVENT
        // ----------------------------------------------

        const calendarResult =
          await createWebinarCalendarEvent({
            title: webinarTitle,

            description:
              'The 2-Day Experience That Will Transform the Way You Make Decisions About Money, Success, Leadership and Life.',

            date:
              normalizedCalendarDate,

            time:
              normalizedCalendarTime,

            durationMinutes: 120,

            location: webinarPlatform
          });

        if (
          calendarResult &&
          calendarResult.success &&
          calendarResult.calendarContent
        ) {
          calendarAttachment = {
            filename:
              calendarResult.filename ||
              'the-abundance-crossroad.ics',

            content:
              calendarResult.calendarContent,

            contentType:
              'text/calendar; charset=utf-8',

            contentDisposition:
              'attachment'
          };

          console.log(
            'Calendar invitation generated successfully.'
          );

          console.log(
            'Calendar file:',
            calendarAttachment.filename
          );
        } else {
          console.warn(
            'Calendar invitation could not be generated.'
          );
        }
      }
    } else {
      console.warn(
        'Webinar date/time not available. Calendar attachment skipped.'
      );
    }
  } catch (calendarError) {
    /*
     * IMPORTANT:
     *
     * Calendar generation failure should NOT
     * stop the registration confirmation email.
     */

    console.error(
      'Calendar invitation generation failed:',
      calendarError.message
    );

    calendarAttachment = null;
  }

  // ==================================================
  // ZOOM TEXT CONTENT
  // ==================================================

  const zoomText = hasZoomDetails
    ? `
ZOOM WEBINAR
------------

Join Webinar:
${zoomJoinUrl}

Meeting ID: ${zoomMeetingId || 'Available in Zoom link'}
Password: ${zoomPassword || 'No password required'}

Please keep this Zoom link safe. You will need it to join the webinar.
`
    : `
ZOOM WEBINAR
------------

Your Zoom meeting details will be shared with you separately.
`;

  // ==================================================
  // PLAIN TEXT EMAIL
  // ==================================================

  const text = `
Hello ${recipientName},

${confirmationMessage}


REGISTRATION DETAILS
--------------------

Name: ${recipientName}
Email: ${registration.email}


WEBINAR DETAILS
---------------

Webinar: ${webinarTitle}
Date: ${webinarDate}
Time: ${webinarTime}
Duration: ${webinarDuration}
Platform: ${webinarPlatform}


${zoomText}


CALENDAR INVITATION
-------------------

A calendar invitation has been attached to this email.

Attachment:
the-abundance-crossroad.ics


PAYMENT DETAILS
---------------

Amount: ${currency} ${amount}
Payment Status: ${paymentStatus}
Payment Method: ${paymentMethod}
Payment ID: ${paymentId}
Order ID: ${orderId}


Your payment has been successfully received.

We look forward to having you at The Abundance Crossroad™.

Your future is created by the decisions you make at life's crossroads.


Regards,
The Abundance Crossroad™ Team
`;

  // ==================================================
  // HTML ZOOM SECTION
  // ==================================================

  const zoomHtml = hasZoomDetails
    ? `
      <!-- ZOOM DETAILS -->

      <div
        style="
          margin-top:20px;
          padding:25px;
          background:#eef6ff;
          border:1px solid #bfdbfe;
          border-radius:10px;
        "
      >

        <h3
          style="
            margin-top:0;
            color:#1e3a8a;
          "
        >
          🎥 Join the Webinar
        </h3>

        <p
          style="
            line-height:1.7;
          "
        >
          Your Zoom meeting is ready.
          Please use the button below to join the webinar.
        </p>

        <div
          style="
            text-align:center;
            margin:25px 0;
          "
        >

          <a
            href="${zoomJoinUrl}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display:inline-block;
              padding:14px 28px;
              background:#2563eb;
              color:#ffffff;
              text-decoration:none;
              border-radius:8px;
              font-weight:bold;
              font-size:16px;
            "
          >
            🔗 Join Webinar on Zoom
          </a>

        </div>

        <div
          style="
            background:#ffffff;
            padding:18px;
            border-radius:8px;
            line-height:1.8;
          "
        >

          <p>
            <strong>Meeting ID:</strong>
            ${zoomMeetingId || 'Available in Zoom link'}
          </p>

          <p>
            <strong>Password:</strong>
            ${zoomPassword || 'No password required'}
          </p>

          ${
            zoomStartUrl
              ? `
                <p>
                  <strong>Host Start Link:</strong>
                  ${zoomStartUrl}
                </p>
              `
              : ''
          }

        </div>

        <p
          style="
            margin-bottom:0;
            font-size:13px;
            color:#4b5563;
            line-height:1.6;
          "
        >
          Please keep this email safe. You will need the Zoom
          join link when attending the webinar.
        </p>

      </div>
    `
    : `
      <!-- ZOOM DETAILS NOT AVAILABLE -->

      <div
        style="
          margin-top:20px;
          padding:22px;
          background:#fff7ed;
          border-left:4px solid #f97316;
          border-radius:8px;
        "
      >

        <h3
          style="
            margin-top:0;
            color:#9a3412;
          "
        >
          🎥 Zoom Webinar
        </h3>

        <p
          style="
            margin-bottom:0;
            line-height:1.7;
          "
        >
          Your registration is confirmed.
          Zoom joining details will be shared with you separately.
        </p>

      </div>
    `;

  // ==================================================
  // HTML EMAIL
  // ==================================================

  const html = `
<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    Registration Confirmed
  </title>

</head>


<body
  style="
    margin:0;
    padding:0;
    background:#f4f4f7;
    font-family:Arial,Helvetica,sans-serif;
  "
>

  <div
    style="
      max-width:650px;
      margin:30px auto;
      background:#ffffff;
      border-radius:12px;
      overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.08);
    "
  >

    <!-- HEADER -->

    <div
      style="
        background:#111827;
        padding:30px;
        text-align:center;
        color:#ffffff;
      "
    >

      <h1
        style="
          margin:0;
          font-size:28px;
        "
      >
        The Abundance Crossroad™
      </h1>

      <p
        style="
          margin:10px 0 0;
          font-size:15px;
          opacity:0.9;
        "
      >
        Registration Confirmation
      </p>

    </div>


    <!-- CONTENT -->

    <div
      style="
        padding:35px;
        color:#333333;
      "
    >

      <h2
        style="
          margin-top:0;
          color:#111827;
        "
      >
        Hello ${recipientName},
      </h2>


      <p
        style="
          font-size:16px;
          line-height:1.7;
        "
      >
        ${confirmationMessage}
      </p>


      <!-- WEBINAR DETAILS -->

      <div
        style="
          margin-top:25px;
          padding:22px;
          background:#f9fafb;
          border-radius:10px;
        "
      >

        <h3
          style="
            margin-top:0;
            color:#111827;
          "
        >
          Webinar Details
        </h3>


        <p>
          <strong>Webinar:</strong>
          ${webinarTitle}
        </p>


        <p>
          <strong>Date:</strong>
          ${webinarDate}
        </p>


        <p>
          <strong>Time:</strong>
          ${webinarTime}
        </p>


        <p>
          <strong>Duration:</strong>
          ${webinarDuration}
        </p>


        <p>
          <strong>Platform:</strong>
          ${webinarPlatform}
        </p>

      </div>


      ${zoomHtml}


      <!-- CALENDAR INVITATION -->

      <div
        style="
          margin-top:20px;
          padding:22px;
          background:#eff6ff;
          border-left:4px solid #2563eb;
          border-radius:8px;
        "
      >

        <h3
          style="
            margin-top:0;
            color:#1e3a8a;
          "
        >
          📅 Add to Your Calendar
        </h3>


        <p
          style="
            line-height:1.7;
            margin-bottom:8px;
          "
        >
          A calendar invitation for
          <strong>
            ${webinarTitle}
          </strong>
          is attached to this email.
        </p>


        <p
          style="
            margin-bottom:0;
            line-height:1.7;
          "
        >
          Please download or open the
          <strong>
            .ics calendar file
          </strong>
          to add the webinar to your calendar.
        </p>

      </div>


      <!-- PAYMENT DETAILS -->

      <div
        style="
          margin-top:20px;
          padding:22px;
          background:#f9fafb;
          border-radius:10px;
        "
      >

        <h3
          style="
            margin-top:0;
            color:#111827;
          "
        >
          Payment Details
        </h3>


        <p>
          <strong>Amount:</strong>
          ${currency} ${amount}
        </p>


        <p>
          <strong>Status:</strong>

          <span
            style="
              color:#15803d;
              font-weight:bold;
            "
          >
            ${paymentStatus}
          </span>

        </p>


        <p>
          <strong>Payment Method:</strong>
          ${paymentMethod}
        </p>


        <p>
          <strong>Payment ID:</strong>
          ${paymentId}
        </p>


        <p>
          <strong>Order ID:</strong>
          ${orderId}
        </p>

      </div>


      <!-- SUCCESS MESSAGE -->

      <div
        style="
          margin-top:25px;
          padding:20px;
          background:#ecfdf5;
          border-left:4px solid #16a34a;
          border-radius:6px;
        "
      >

        <strong>
          Payment successfully received.
        </strong>


        <p
          style="
            margin-bottom:0;
            line-height:1.6;
          "
        >
          Your registration is confirmed.
          Please keep this email for your records.
        </p>

      </div>


      <p
        style="
          margin-top:30px;
          line-height:1.7;
        "
      >
        We look forward to having you at
        <strong>
          The Abundance Crossroad™
        </strong>.
      </p>


      <p
        style="
          margin-top:25px;
          font-style:italic;
          line-height:1.7;
        "
      >
        Your future is created by the decisions
        you make at life's crossroads.
      </p>


      <p
        style="
          margin-top:30px;
        "
      >
        Regards,<br>

        <strong>
          The Abundance Crossroad™ Team
        </strong>

      </p>

    </div>


    <!-- FOOTER -->

    <div
      style="
        padding:20px;
        text-align:center;
        background:#f9fafb;
        color:#6b7280;
        font-size:12px;
      "
    >

      This is an automated registration confirmation email.

    </div>

  </div>

</body>

</html>
`;

  // ==================================================
  // SEND EMAIL THROUGH AMAZON SES
  // ==================================================

  if (EMAIL_MOCK_MODE) {
    const messageId =
      `<mock-email-${Date.now()}@example.com>`;

    await EmailLogModel.markAsSent(
      emailLog.id,
      messageId
    );

    console.log(
      'EMAIL MOCK MODE: registration confirmation captured.'
    );

    console.log(
      'To:',
      registration.email
    );

    console.log(
      'Calendar attached:',
      Boolean(calendarAttachment)
    );

    console.log(
      'Zoom details included:',
      Boolean(hasZoomDetails)
    );

    return {
      success: true,
      alreadySent: false,
      mock: true,
      messageId,
      emailLogId: emailLog.id,
      calendarAttached: Boolean(calendarAttachment),
      zoomIncluded: Boolean(hasZoomDetails),
      zoomMeetingId,
      zoomJoinUrl
    };
  }

  try {
    const mailOptions = {
      from:
        process.env.MAIL_FROM,

      to:
        registration.email,

      subject,

      text,

      html
    };

    // --------------------------------------------------
    // ADD CALENDAR ATTACHMENT
    // --------------------------------------------------

    if (calendarAttachment) {
      mailOptions.attachments = [
        calendarAttachment
      ];

      console.log(
        'Calendar attachment added to email.'
      );
    }

    // --------------------------------------------------
    // SEND EMAIL
    // --------------------------------------------------

    const info =
      await transporter.sendMail(
        mailOptions
      );

    // --------------------------------------------------
    // MARK EMAIL AS SENT
    // --------------------------------------------------

    await EmailLogModel.markAsSent(
      emailLog.id,
      info.messageId || null
    );

    console.log(
      'Registration confirmation email sent successfully.'
    );

    console.log(
      'Email:',
      registration.email
    );

    console.log(
      'Message ID:',
      info.messageId
    );

    if (calendarAttachment) {
      console.log(
        'Calendar attachment sent successfully.'
      );
    }

    if (hasZoomDetails) {
      console.log(
        'Zoom Join URL included in email successfully.'
      );
    }

    return {
      success: true,

      alreadySent: false,

      messageId:
        info.messageId,

      emailLogId:
        emailLog.id,

      calendarAttached:
        Boolean(calendarAttachment),

      zoomIncluded:
        Boolean(hasZoomDetails),

      zoomMeetingId:
        zoomMeetingId,

      zoomJoinUrl:
        zoomJoinUrl
    };

  } catch (emailError) {
    // --------------------------------------------------
    // MARK EMAIL AS FAILED
    // --------------------------------------------------

    const errorMessage =
      emailError?.message ||
      'Unknown email sending error';

    try {
      await EmailLogModel.markAsFailed(
        emailLog.id,
        errorMessage
      );
    } catch (logError) {
      console.error(
        'Failed to update email log:',
        logError
      );
    }

    console.error(
      'Registration confirmation email failed:',
      emailError
    );

    // --------------------------------------------------
    // IMPORTANT
    // --------------------------------------------------
    // Payment remains successful.
    // paymentController catches this error.
    // --------------------------------------------------

    throw emailError;
  }
}

// ==================================================
// SEND WEBINAR RECORDING
// ==================================================
//
// AttendanceService calls this only for paid registrants
// whose absence was confirmed by Zoom or an administrator.
// Delivery state is kept in webinar_attendance so a recording
// is never sent again after a successful delivery.
//
// ==================================================

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

async function sendWebinarRecording({
  recipient,
  webinar,
  recordingUrl
}) {
  if (!recipient?.email) {
    throw new Error('Recording recipient email is missing.');
  }

  if (!webinar?.title) {
    throw new Error('Webinar title is missing.');
  }

  let safeRecordingUrl;

  try {
    const url = new URL(recordingUrl);

    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error('Invalid recording URL protocol.');
    }

    safeRecordingUrl = url.toString();
  } catch (error) {
    throw new Error('A valid recording URL is required.');
  }

  const firstName =
    escapeHtml(recipient.first_name) ||
    'there';

  const webinarTitle =
    escapeHtml(webinar.title);

  const subject =
    `Your webinar recording: ${webinar.title}`;

  const text = [
    `Hi ${recipient.first_name || 'there'},`,
    '',
    `We missed you at ${webinar.title}.`,
    'Your recording is ready:',
    safeRecordingUrl,
    '',
    'The Abundance Crossroad Team'
  ].join('\n');

  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#1f2937;line-height:1.6">
      <div style="padding:32px;background:#f3e8ff;border-radius:16px 16px 0 0">
        <p style="margin:0 0 8px;color:#6b21a8;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Webinar recording</p>
        <h1 style="margin:0;font-size:26px;color:#111827">Your recording is ready</h1>
      </div>
      <div style="padding:30px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px">
        <p>Hi ${firstName},</p>
        <p>We missed you at <strong>${webinarTitle}</strong>. You can watch the full recording at a time that works for you.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(safeRecordingUrl)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#6b21a8;color:#fff;font-weight:700;text-decoration:none">Watch the recording</a>
        </p>
        <p style="font-size:13px;color:#6b7280">If the button does not open, copy this link into your browser:<br><a href="${escapeHtml(safeRecordingUrl)}" style="color:#6b21a8;word-break:break-all">${escapeHtml(safeRecordingUrl)}</a></p>
        <p>Regards,<br><strong>The Abundance Crossroad Team</strong></p>
      </div>
    </div>
  `;

  if (EMAIL_MOCK_MODE) {
    const messageId =
      `<mock-recording-${Date.now()}@example.com>`;

    console.log(
      'EMAIL MOCK MODE: webinar recording captured for:',
      recipient.email
    );

    return {
      success: true,
      mock: true,
      messageId
    };
  }

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: recipient.email,
    subject,
    text,
    html
  });

  return {
    success: true,
    mock: false,
    messageId: info.messageId || null
  };
}

// ==================================================
// EXPORT
// ==================================================

module.exports = {
  transporter,

  verifyEmailConnection,

  sendRegistrationConfirmation,

  sendWebinarRecording
};
