const ReminderLogModel =
  require('../models/reminderLogModel');

const {
  sendWhatsAppTemplate
} = require('./whatsappService');


// ======================================================
// DEFAULT CONFIGURATION
// ======================================================

const DEFAULT_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
  'en_US';


// ======================================================
// REMINDER TEMPLATE CONFIGURATION
// ======================================================
//
// You can change these template names later from .env
// when the actual Meta WhatsApp templates are approved.
//
// ======================================================

const REMINDER_TEMPLATES = {

  reminder_24h:
    process.env.WHATSAPP_REMINDER_24H_TEMPLATE ||
    'reminder_24h',

  reminder_3h:
    process.env.WHATSAPP_REMINDER_3H_TEMPLATE ||
    'reminder_3h',

  reminder_30m:
    process.env.WHATSAPP_REMINDER_30M_TEMPLATE ||
    'reminder_30m'

};


// ======================================================
// GET TEMPLATE NAME
// ======================================================

const getReminderTemplateName = (
  reminderType
) => {

  const templateName =
    REMINDER_TEMPLATES[
      reminderType
    ];


  if (!templateName) {

    throw new Error(
      `Unsupported WhatsApp reminder type: ${reminderType}`
    );

  }


  return templateName;

};


// ======================================================
// FORMAT DATE FOR WHATSAPP
// ======================================================

const formatWebinarDate = (
  date
) => {

  if (!date) {

    return 'To be announced';

  }


  const dateString =
    String(date)
      .substring(0, 10);


  const parts =
    dateString.split('-');


  if (
    parts.length !== 3
  ) {

    return String(date);

  }


  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);


  const dateObject =
    new Date(
      year,
      month - 1,
      day
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
// FORMAT TIME FOR WHATSAPP
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
// GET REMINDER MESSAGE
// ======================================================

const getReminderMessage = (
  reminderType
) => {

  switch (reminderType) {

    case 'reminder_24h':

      return (
        'Your webinar is happening tomorrow. We are excited to have you with us!'
      );


    case 'reminder_3h':

      return (
        'Your webinar starts in 3 hours. Please keep your Zoom details ready.'
      );


    case 'reminder_30m':

      return (
        'Your webinar starts in 30 minutes. Please join on time.'
      );


    default:

      return (
        'Your webinar is coming up soon.'
      );

  }

};


// ======================================================
// BUILD WHATSAPP TEMPLATE PARAMETERS
// ======================================================
//
// Template:
//
// {{1}} Participant Name
// {{2}} Webinar Name
// {{3}} Date
// {{4}} Time
// {{5}} Duration
// {{6}} Platform
// {{7}} Zoom Join URL
// {{8}} Meeting ID
// {{9}} Password
//
// ======================================================

const buildReminderParameters = ({
  registration
}) => {

  if (!registration) {

    throw new Error(
      'Registration details are required.'
    );

  }


  const customerName =
    `${registration.first_name || ''} ${registration.last_name || ''}`
      .trim() ||
    'Participant';


  const webinarTitle =
    registration.webinar_title ||
    'The Abundance Crossroad™';


  const webinarDate =
    formatWebinarDate(
      registration.webinar_date
    );


  const webinarTime =
    formatWebinarTime(
      registration.webinar_time
    );


  const duration =
    registration.webinar_duration ||
    '2 Hours Each Day';


  const platform =
    registration.webinar_platform ||
    'Zoom';


  const zoomJoinUrl =
    registration.zoom_join_url ||
    'Zoom joining details will be shared separately.';


  const zoomMeetingId =
    registration.zoom_meeting_id ||
    'Available in Zoom link';


  const zoomPassword =
    registration.zoom_password ||
    'No password required';


  return [

    customerName,

    webinarTitle,

    webinarDate,

    webinarTime,

    duration,

    platform,

    zoomJoinUrl,

    zoomMeetingId,

    zoomPassword

  ];

};


// ======================================================
// SEND REMINDER WHATSAPP
// ======================================================

const sendReminderWhatsApp = async ({
  registration,
  reminderLog,
  reminderType
}) => {

  // ====================================================
  // VALIDATION
  // ====================================================

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


  if (!registration.phone) {

    throw new Error(
      'Registration phone number is required.'
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
  // DUPLICATE PROTECTION
  // ====================================================

  if (
    reminderLog.whatsapp_status ===
    'sent'
  ) {

    console.log(

      `Reminder WhatsApp already sent for registration ${registration.id}, type ${reminderType}.`

    );


    return {

      success: true,

      alreadySent: true,

      messageId:
        reminderLog.whatsapp_message_id,

      whatsappLogId:
        reminderLog.id,

      reminderType

    };

  }


  // ====================================================
  // GET TEMPLATE
  // ====================================================

  const templateName =
    getReminderTemplateName(
      reminderType
    );


  // ====================================================
  // BUILD PARAMETERS
  // ====================================================

  const parameters =
    buildReminderParameters({

      registration

    });


  // ====================================================
  // SEND WHATSAPP
  // ====================================================

  try {

    const result =
      await sendWhatsAppTemplate({

        phone:
          registration.phone,

        templateName,

        languageCode:
          DEFAULT_TEMPLATE_LANGUAGE,

        parameters

      });


    // ==================================================
    // UPDATE REMINDER LOG
    // ==================================================

  await ReminderLogModel.markWhatsAppAsSent({
  reminderId: reminderLog.id,
  messageId: result.messageId
});


    console.log(
      '\n========================================'
    );

    console.log(
      'REMINDER WHATSAPP SENT'
    );

    console.log(
      '========================================'
    );

    console.log(
      'Registration:',
      registration.id
    );

    console.log(
      'Phone:',
      result.phone
    );

    console.log(
      'Reminder:',
      reminderType
    );

    console.log(
      'Template:',
      templateName
    );

    console.log(
      'Message ID:',
      result.messageId
    );

    console.log(
      '========================================\n'
    );


    return {

      success: true,

      alreadySent: false,

      mock:
        result.mock || false,

      messageId:
        result.messageId,

      whatsappLogId:
        reminderLog.id,

      phone:
        result.phone,

      templateName,

      languageCode:
        DEFAULT_TEMPLATE_LANGUAGE,

      reminderType,

      parameters,

      webinar: {

        title:
          registration.webinar_title ||
          'The Abundance Crossroad™',

        date:
          registration.webinar_date ||
          null,

        time:
          registration.webinar_time ||
          null,

        duration:
          registration.webinar_duration ||
          '2 Hours Each Day',

        platform:
          registration.webinar_platform ||
          'Zoom'

      },

      zoom: {

        meetingId:
          registration.zoom_meeting_id ||
          null,

        joinUrl:
          registration.zoom_join_url ||
          null,

        password:
          registration.zoom_password ||
          null

      }

    };

  }


  catch (error) {

    const errorMessage =
      error?.message ||
      'Reminder WhatsApp sending failed.';


    // ==================================================
    // UPDATE FAILURE
    // ==================================================

    try {

     await ReminderLogModel.markWhatsAppAsFailed({
  reminderId: reminderLog.id,
  errorMessage
});

    }


    catch (logError) {

      console.error(

        'Failed to update WhatsApp reminder failure log:',

        logError

      );

    }


    console.error(
      'Reminder WhatsApp failed:',
      errorMessage
    );


    throw error;

  }

};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  REMINDER_TEMPLATES,

  getReminderTemplateName,

  formatWebinarDate,

  formatWebinarTime,

  getReminderMessage,

  buildReminderParameters,

  sendReminderWhatsApp

};