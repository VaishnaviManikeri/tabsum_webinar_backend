const {
  transporter
} = require('./emailService');

const ReminderLogModel =
  require('../models/reminderLogModel');


// ======================================================
// CONFIGURATION
// ======================================================

const DEFAULT_WEBINAR_TITLE =
  'The Abundance Crossroad™';

const DEFAULT_PLATFORM =
  'Zoom';


// ======================================================
// GET REMINDER LABEL
// ======================================================

const getReminderLabel = (
  reminderType
) => {

  switch (reminderType) {

    case 'reminder_24h':
      return '24-Hour Reminder';

    case 'reminder_3h':
      return '3-Hour Reminder';

    case 'reminder_30m':
      return '30-Minute Reminder';

    default:
      return 'Webinar Reminder';

  }

};


// ======================================================
// GET REMINDER MESSAGE
// ======================================================

const getReminderMessage = (
  reminderType
) => {

  switch (reminderType) {

    case 'reminder_24h':
      return 'Your webinar is happening tomorrow. We are excited to have you with us!';

    case 'reminder_3h':
      return 'Your webinar starts in 3 hours. Please keep your Zoom link ready.';

    case 'reminder_30m':
      return 'Your webinar starts in 30 minutes. Please join on time.';

    default:
      return 'Your webinar is coming up soon.';

  }

};


// ======================================================
// FORMAT DATE FOR EMAIL
// ======================================================

const formatWebinarDate = (
  date
) => {

  if (!date) {

    return 'To be announced';

  }


  const dateString =
    String(date).substring(
      0,
      10
    );


  const parts =
    dateString.split('-');


  if (
    parts.length !== 3
  ) {

    return String(date);

  }


  const [
    year,
    month,
    day
  ] = parts;


  const dateObject =
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );


  if (
    Number.isNaN(
      dateObject.getTime()
    )
  ) {

    return String(date);

  }


  return dateObject.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  );

};


// ======================================================
// FORMAT TIME FOR EMAIL
// ======================================================

const formatWebinarTime = (
  time
) => {

  if (!time) {

    return 'To be announced';

  }


  const timeString =
    String(time)
      .substring(0, 5);


  const match =
    timeString.match(
      /^(\d{2}):(\d{2})$/
    );


  if (!match) {

    return String(time);

  }


  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);


  const date =
    new Date();

  date.setHours(
    hours,
    minutes,
    0,
    0
  );


  return date.toLocaleTimeString(
    'en-IN',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
  );

};


// ======================================================
// BUILD REMINDER EMAIL TEXT
// ======================================================

const buildReminderText = ({
  recipientName,
  webinarTitle,
  webinarDate,
  webinarTime,
  webinarDuration,
  webinarPlatform,
  zoomMeetingId,
  zoomJoinUrl,
  zoomPassword,
  reminderType
}) => {

  const reminderLabel =
    getReminderLabel(
      reminderType
    );


  const reminderMessage =
    getReminderMessage(
      reminderType
    );


  return `
Hello ${recipientName},

${reminderMessage}

This is your ${reminderLabel} for:

${webinarTitle}

WEBINAR DETAILS
---------------

Date: ${webinarDate}
Time: ${webinarTime}
Duration: ${webinarDuration}
Platform: ${webinarPlatform}

ZOOM WEBINAR
------------

Join Webinar:
${zoomJoinUrl || 'Zoom joining details will be shared separately.'}

Meeting ID:
${zoomMeetingId || 'Available in Zoom link'}

Password:
${zoomPassword || 'No password required'}

IMPORTANT
---------

Please keep your Zoom details ready and join the webinar on time.

We look forward to seeing you at The Abundance Crossroad™.

Your future is created by the decisions you make at life's crossroads.

Regards,
The Abundance Crossroad™ Team
`;

};


// ======================================================
// BUILD REMINDER EMAIL HTML
// ======================================================

const buildReminderHtml = ({
  recipientName,
  webinarTitle,
  webinarDate,
  webinarTime,
  webinarDuration,
  webinarPlatform,
  zoomMeetingId,
  zoomJoinUrl,
  zoomPassword,
  reminderType
}) => {

  const reminderLabel =
    getReminderLabel(
      reminderType
    );


  const reminderMessage =
    getReminderMessage(
      reminderType
    );


  const hasZoomLink =
    Boolean(zoomJoinUrl);


  const zoomSection =
    hasZoomLink

      ? `
        <div style="
          margin-top:25px;
          padding:25px;
          background:#eef6ff;
          border:1px solid #bfdbfe;
          border-radius:10px;
        ">

          <h3 style="
            margin-top:0;
            color:#1e3a8a;
          ">
            🎥 Join the Webinar
          </h3>

          <p style="
            line-height:1.7;
          ">
            Your Zoom meeting is ready.
            Please join on time.
          </p>

          <div style="
            text-align:center;
            margin:25px 0;
          ">

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

          <div style="
            background:#ffffff;
            padding:18px;
            border-radius:8px;
            line-height:1.8;
          ">

            <p>
              <strong>Meeting ID:</strong>
              ${zoomMeetingId || 'Available in Zoom link'}
            </p>

            <p>
              <strong>Password:</strong>
              ${zoomPassword || 'No password required'}
            </p>

          </div>

        </div>
      `

      : `
        <div style="
          margin-top:25px;
          padding:22px;
          background:#fff7ed;
          border-left:4px solid #f97316;
          border-radius:8px;
        ">

          <h3 style="
            margin-top:0;
            color:#9a3412;
          ">
            🎥 Zoom Webinar
          </h3>

          <p style="
            margin-bottom:0;
            line-height:1.7;
          ">
            Your webinar is approaching.
            Zoom joining details will be shared separately.
          </p>

        </div>
      `;


  return `
<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${reminderLabel} - ${webinarTitle}
  </title>

</head>


<body style="
  margin:0;
  padding:0;
  background:#f4f4f7;
  font-family:Arial,Helvetica,sans-serif;
">


  <div style="
    max-width:650px;
    margin:30px auto;
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,0.08);
  ">


    <!-- HEADER -->

    <div style="
      background:#111827;
      padding:30px;
      text-align:center;
      color:#ffffff;
    ">

      <h1 style="
        margin:0;
        font-size:28px;
      ">
        The Abundance Crossroad™
      </h1>

      <p style="
        margin:10px 0 0;
        font-size:15px;
        opacity:0.9;
      ">
        ${reminderLabel}
      </p>

    </div>


    <!-- CONTENT -->

    <div style="
      padding:35px;
      color:#333333;
    ">


      <h2 style="
        margin-top:0;
        color:#111827;
      ">
        Hello ${recipientName},
      </h2>


      <div style="
        padding:18px;
        background:#eff6ff;
        border-left:4px solid #2563eb;
        border-radius:8px;
      ">

        <p style="
          margin:0;
          font-size:16px;
          line-height:1.7;
        ">
          ${reminderMessage}
        </p>

      </div>


      <!-- WEBINAR DETAILS -->

      <div style="
        margin-top:25px;
        padding:22px;
        background:#f9fafb;
        border-radius:10px;
      ">

        <h3 style="
          margin-top:0;
          color:#111827;
        ">
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


      ${zoomSection}


      <!-- IMPORTANT -->

      <div style="
        margin-top:25px;
        padding:20px;
        background:#ecfdf5;
        border-left:4px solid #16a34a;
        border-radius:6px;
      ">

        <strong>
          Please join on time.
        </strong>

        <p style="
          margin-bottom:0;
          line-height:1.6;
        ">
          Keep this email available so you can
          quickly access your Zoom meeting.
        </p>

      </div>


      <p style="
        margin-top:30px;
        line-height:1.7;
      ">

        We look forward to seeing you at
        <strong>
          The Abundance Crossroad™
        </strong>.

      </p>


      <p style="
        margin-top:25px;
        font-style:italic;
        line-height:1.7;
      ">

        Your future is created by the decisions
        you make at life's crossroads.

      </p>


      <p style="
        margin-top:30px;
      ">

        Regards,<br>

        <strong>
          The Abundance Crossroad™ Team
        </strong>

      </p>


    </div>


    <!-- FOOTER -->

    <div style="
      padding:20px;
      text-align:center;
      background:#f9fafb;
      color:#6b7280;
      font-size:12px;
    ">

      This is an automated webinar reminder email.

    </div>


  </div>


</body>

</html>
`;

};


// ======================================================
// SEND REMINDER EMAIL
// ======================================================

const sendReminderEmail = async ({
  registration,
  reminderLog,
  reminderType
}) => {

  if (!registration) {

    throw new Error(
      'Registration details are required.'
    );

  }


  if (!registration.id) {

    throw new Error(
      'Registration ID is required.'
    );

  }


  if (!registration.email) {

    throw new Error(
      'Registration email is required.'
    );

  }


  if (!reminderLog) {

    throw new Error(
      'Reminder log is required.'
    );

  }


  if (!reminderLog.id) {

    throw new Error(
      'Reminder log ID is required.'
    );

  }


  if (!reminderType) {

    throw new Error(
      'Reminder type is required.'
    );

  }


  // ====================================================
  // CHECK DUPLICATE EMAIL
  // ====================================================

  if (
    reminderLog.email_status ===
    'sent'
  ) {

    console.log(

      `Reminder email already sent for registration ${registration.id}, type ${reminderType}.`

    );


    return {

      success: true,

      alreadySent: true,

      messageId:
        reminderLog.email_message_id,

      reminderLogId:
        reminderLog.id

    };

  }


  // ====================================================
  // PREPARE DATA
  // ====================================================

  const recipientName =
    `${registration.first_name || ''} ${registration.last_name || ''}`
      .trim() ||
    'Participant';


  const webinarTitle =
    registration.webinar_title ||
    DEFAULT_WEBINAR_TITLE;


  const webinarDate =
    formatWebinarDate(
      registration.webinar_date
    );


  const webinarTime =
    formatWebinarTime(
      registration.webinar_time
    );


  const webinarDuration =
    registration.webinar_duration ||
    '2 Hours Each Day';


  const webinarPlatform =
    registration.webinar_platform ||
    DEFAULT_PLATFORM;


  const zoomMeetingId =
    registration.zoom_meeting_id ||
    null;


  const zoomJoinUrl =
    registration.zoom_join_url ||
    null;


  const zoomPassword =
    registration.zoom_password ||
    null;


  const reminderLabel =
    getReminderLabel(
      reminderType
    );


  const subject =
    `${reminderLabel} — ${webinarTitle}`;


  // ====================================================
  // BUILD EMAIL
  // ====================================================

  const text =
    buildReminderText({

      recipientName,

      webinarTitle,

      webinarDate,

      webinarTime,

      webinarDuration,

      webinarPlatform,

      zoomMeetingId,

      zoomJoinUrl,

      zoomPassword,

      reminderType

    });


  const html =
    buildReminderHtml({

      recipientName,

      webinarTitle,

      webinarDate,

      webinarTime,

      webinarDuration,

      webinarPlatform,

      zoomMeetingId,

      zoomJoinUrl,

      zoomPassword,

      reminderType

    });


  // ====================================================
  // SEND THROUGH AMAZON SES
  // ====================================================

  try {

    const info =
      await transporter.sendMail({

        from:
          process.env.MAIL_FROM,

        to:
          registration.email,

        subject,

        text,

        html

      });


    // ==================================================
    // UPDATE REMINDER LOG
    // ==================================================

    await ReminderLogModel.markEmailAsSent({

      reminderId:
        reminderLog.id,

      messageId:
        info.messageId ||
        null

    });


    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER EMAIL SENT'
    );

    console.log(
      '========================================'
    );

    console.log(
      'Registration:',
      registration.id
    );

    console.log(
      'Email:',
      registration.email
    );

    console.log(
      'Reminder:',
      reminderType
    );

    console.log(
      'Subject:',
      subject
    );

    console.log(
      'Message ID:',
      info.messageId
    );

    console.log(
      'Zoom Included:',
      Boolean(zoomJoinUrl)
    );

    console.log(
      '========================================\n'
    );


    return {

      success: true,

      alreadySent: false,

      messageId:
        info.messageId ||
        null,

      reminderLogId:
        reminderLog.id,

      reminderType,

      email:
        registration.email,

      zoomIncluded:
        Boolean(zoomJoinUrl),

      zoomMeetingId,

      zoomJoinUrl

    };

  }


  catch (error) {

    const errorMessage =
      error?.message ||
      'Reminder email sending failed.';


    // ==================================================
    // UPDATE FAILURE IN REMINDER LOG
    // ==================================================

    try {

      await ReminderLogModel
        .markEmailAsFailed({

          reminderId:
            reminderLog.id,

          errorMessage

        });

    }


    catch (logError) {

      console.error(

        'Failed to update reminder email failure log:',

        logError

      );

    }


    console.error(
      'Reminder email failed:',
      errorMessage
    );


    throw error;

  }

};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  getReminderLabel,

  getReminderMessage,

  formatWebinarDate,

  formatWebinarTime,

  buildReminderText,

  buildReminderHtml,

  sendReminderEmail

};