const WhatsAppLogModel = require('../models/whatsappLogModel');
const WebinarModel = require('../models/webinarModel');


// ======================================================
// CONFIGURATION
// ======================================================

const WHATSAPP_API_VERSION =
  process.env.WHATSAPP_API_VERSION || '';

const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || '';

const WHATSAPP_ACCESS_TOKEN =
  process.env.WHATSAPP_ACCESS_TOKEN || '';

const WHATSAPP_MOCK_MODE =
  String(process.env.WHATSAPP_MOCK_MODE || 'true')
    .toLowerCase() === 'true';


// ======================================================
// NORMALIZE INDIAN PHONE NUMBER
// ======================================================

const normalizeIndianPhone = (phone) => {

  if (!phone) {
    throw new Error(
      'WhatsApp phone number is required.'
    );
  }

  let cleanedPhone = String(phone)
    .replace(/\D/g, '');

  // Example:
  // 08237370045
  // becomes:
  // 918237370045

  if (
    cleanedPhone.length === 11 &&
    cleanedPhone.startsWith('0')
  ) {

    cleanedPhone =
      `91${cleanedPhone.substring(1)}`;

  }

  // Example:
  // 8237370045
  // becomes:
  // 918237370045

  else if (
    cleanedPhone.length === 10
  ) {

    cleanedPhone =
      `91${cleanedPhone}`;

  }

  // Already starts with country code

  else if (
    cleanedPhone.length === 12 &&
    cleanedPhone.startsWith('91')
  ) {

    // Keep as it is

  }

  else {

    throw new Error(
      'Invalid Indian WhatsApp phone number.'
    );

  }

  return cleanedPhone;
};


// ======================================================
// SEND WHATSAPP TEMPLATE MESSAGE
// ======================================================

const sendWhatsAppTemplate = async ({
  phone,
  templateName,
  languageCode = 'en_US',
  parameters = []
}) => {

  const normalizedPhone =
    normalizeIndianPhone(phone);


  // ====================================================
  // MOCK MODE
  // ====================================================

  if (WHATSAPP_MOCK_MODE) {

    console.log(
      '\n========================================'
    );

    console.log(
      'WHATSAPP MOCK MODE'
    );

    console.log(
      '========================================'
    );

    console.log(
      'To:',
      normalizedPhone
    );

    console.log(
      'Template:',
      templateName
    );

    console.log(
      'Language:',
      languageCode
    );

    console.log(
      'Parameters:',
      parameters
    );

    console.log(
      '========================================\n'
    );


    return {
      success: true,
      mock: true,
      messageId:
        `<mock-whatsapp-${Date.now()}@example.com>`,
      phone: normalizedPhone,
      templateName,
      parameters
    };
  }


  // ====================================================
  // REAL META API VALIDATION
  // ====================================================

  if (!WHATSAPP_API_VERSION) {

    throw new Error(
      'WHATSAPP_API_VERSION is not configured.'
    );

  }


  if (!WHATSAPP_PHONE_NUMBER_ID) {

    throw new Error(
      'WHATSAPP_PHONE_NUMBER_ID is not configured.'
    );

  }


  if (!WHATSAPP_ACCESS_TOKEN) {

    throw new Error(
      'WHATSAPP_ACCESS_TOKEN is not configured.'
    );

  }


  // ====================================================
  // META GRAPH API URL
  // ====================================================

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;


  // ====================================================
  // TEMPLATE PARAMETERS
  // ====================================================

  const components = [];


  if (parameters.length > 0) {

    components.push({

      type: 'body',

      parameters: parameters.map(value => ({

        type: 'text',

        text: String(value)

      }))

    });

  }


  // ====================================================
  // REQUEST BODY
  // ====================================================

  const requestBody = {

    messaging_product: 'whatsapp',

    to: normalizedPhone,

    type: 'template',

    template: {

      name: templateName,

      language: {

        code: languageCode

      }

    }

  };


  if (components.length > 0) {

    requestBody.template.components =
      components;

  }


  // ====================================================
  // SEND REQUEST TO META
  // ====================================================

  const response =
    await fetch(
      url,
      {

        method: 'POST',

        headers: {

          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${WHATSAPP_ACCESS_TOKEN}`

        },

        body:
          JSON.stringify(requestBody)

      }
    );


  const responseData =
    await response.json();


  // ====================================================
  // HANDLE API ERROR
  // ====================================================

  if (!response.ok) {

    const errorMessage =
      responseData?.error?.message ||
      'WhatsApp API request failed.';

    throw new Error(
      errorMessage
    );

  }


  // ====================================================
  // GET MESSAGE ID
  // ====================================================

  const messageId =
    responseData?.messages?.[0]?.id ||
    null;


  return {

    success: true,

    mock: false,

    messageId,

    phone: normalizedPhone,

    templateName,

    parameters,

    response:
      responseData

  };

};


// ======================================================
// GET ZOOM DETAILS FOR REGISTRATION
// ======================================================

const getZoomDetailsForRegistration = async (
  registration
) => {

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


  // ====================================================
  // FETCH FROM WEBINAR IF NOT AVAILABLE
  // ====================================================

  if (
    registration.webinar_id &&
    (!zoomMeetingId || !zoomJoinUrl)
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
        'Zoom details fetched for WhatsApp confirmation.'
      );


      console.log({

        meetingId:
          zoomMeetingId,

        joinUrl:
          zoomJoinUrl,

        startUrl:
          zoomStartUrl,

        passwordAvailable:
          Boolean(zoomPassword),

        createdAt:
          zoomCreatedAt

      });

    }

    catch (zoomFetchError) {

      console.error(
        'Failed to fetch Zoom details for WhatsApp:',
        zoomFetchError.message
      );

    }

  }


  return {

    zoomMeetingId,

    zoomJoinUrl,

    zoomStartUrl,

    zoomPassword,

    zoomCreatedAt

  };

};


// ======================================================
// SEND REGISTRATION CONFIRMATION
// ======================================================

const sendWhatsAppRegistrationConfirmation = async ({
  registration
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


  if (!registration.phone) {

    throw new Error(
      'Registration phone number is required.'
    );

  }


  const templateName =
    process.env.WHATSAPP_CONFIRMATION_TEMPLATE ||
    'registration_confirmation';


  // ====================================================
  // CREATE / GET WHATSAPP LOG
  // ====================================================

  const whatsappLog =
    await WhatsAppLogModel.createOrGetLog({

      registrationId:
        registration.id,

      phone:
        registration.phone,

      whatsappType:
        'registration_confirmation'

    });


  if (!whatsappLog) {

    throw new Error(
      'Unable to create WhatsApp log.'
    );

  }


  console.log(
    'WhatsApp log ready. Log ID:',
    whatsappLog.id
  );


  // ====================================================
  // DUPLICATE PROTECTION
  // ====================================================

  if (
    whatsappLog.status === 'sent'
  ) {

    console.log(
      `WhatsApp confirmation already sent for registration ${registration.id}.`
    );

    console.log(
      'Duplicate WhatsApp prevented.'
    );


    return {

      success: true,

      alreadySent: true,

      messageId:
        whatsappLog.message_id,

      whatsappLogId:
        whatsappLog.id

    };

  }


  // ====================================================
  // CUSTOMER DETAILS
  // ====================================================

  const customerName =
    `${registration.first_name || ''} ${registration.last_name || ''}`
      .trim() ||
    'Participant';


  const webinarTitle =
    registration.webinar_title ||
    'The Abundance Crossroad™';


  const webinarDate =
    registration.webinar_date ||
    'To be announced';


  const webinarTime =
    registration.webinar_time ||
    'To be announced';


  const duration =
    registration.webinar_duration ||
    '2 Hours Each Day';


  const platform =
    registration.webinar_platform ||
    'Zoom';


  // ====================================================
  // GET ZOOM DETAILS
  // ====================================================

  const zoomDetails =
    await getZoomDetailsForRegistration(
      registration
    );


  const zoomMeetingId =
    zoomDetails.zoomMeetingId ||
    'Available in Zoom link';


  const zoomJoinUrl =
    zoomDetails.zoomJoinUrl ||
    'Zoom link will be shared separately';


  const zoomPassword =
    zoomDetails.zoomPassword ||
    'No password required';


  // ====================================================
  // LOG ZOOM DETAILS
  // ====================================================

  console.log(
    '\n========================================'
  );

  console.log(
    'WHATSAPP REGISTRATION DETAILS'
  );

  console.log(
    '========================================'
  );

  console.log(
    'Participant:',
    customerName
  );

  console.log(
    'Webinar:',
    webinarTitle
  );

  console.log(
    'Date:',
    webinarDate
  );

  console.log(
    'Time:',
    webinarTime
  );

  console.log(
    'Duration:',
    duration
  );

  console.log(
    'Platform:',
    platform
  );

  console.log(
    'Zoom Meeting ID:',
    zoomMeetingId
  );

  console.log(
    'Zoom Join URL:',
    zoomJoinUrl
  );

  console.log(
    'Zoom Password:',
    zoomPassword
  );

  console.log(
    '========================================\n'
  );


  // ====================================================
  // TEMPLATE PARAMETERS
  // ====================================================
  //
  // IMPORTANT:
  // The order here MUST match the order
  // configured inside the Meta WhatsApp template.
  //
  // Current expected template:
  //
  // {{1}} Customer Name
  // {{2}} Webinar Name
  // {{3}} Webinar Date
  // {{4}} Webinar Time
  // {{5}} Duration
  // {{6}} Platform
  // {{7}} Zoom Join URL
  // {{8}} Meeting ID
  // {{9}} Password
  //
  // ====================================================

  const parameters = [

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
          process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
          'en_US',

        parameters

      });


    // ================================================
    // MARK AS SENT
    // ================================================

    await WhatsAppLogModel.markAsSent(

      whatsappLog.id,

      result.messageId

    );


    console.log(
      'WhatsApp registration confirmation sent successfully.'
    );


    console.log(
      'Phone:',
      result.phone
    );


    console.log(
      'Message ID:',
      result.messageId
    );


    console.log(
      'Zoom Join URL included:',
      Boolean(
        zoomDetails.zoomJoinUrl
      )
    );


    return {

      success: true,

      alreadySent: false,

      mock:
        result.mock || false,

      messageId:
        result.messageId,

      whatsappLogId:
        whatsappLog.id,

      phone:
        result.phone,

      templateName:
        result.templateName,

      parameters,

      webinar: {

        title:
          webinarTitle,

        date:
          webinarDate,

        time:
          webinarTime,

        duration,

        platform

      },

      zoom: {

        meetingId:
          zoomDetails.zoomMeetingId,

        joinUrl:
          zoomDetails.zoomJoinUrl,

        startUrl:
          zoomDetails.zoomStartUrl,

        password:
          zoomDetails.zoomPassword,

        createdAt:
          zoomDetails.zoomCreatedAt

      }

    };


  }

  catch (error) {

    // ================================================
    // MARK AS FAILED
    // ================================================

    await WhatsAppLogModel.markAsFailed(

      whatsappLog.id,

      error.message

    );


    console.error(
      'WhatsApp registration confirmation failed:',
      error.message
    );


    throw error;

  }

};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {

  normalizeIndianPhone,

  sendWhatsAppTemplate,

  sendWhatsAppRegistrationConfirmation,

  getZoomDetailsForRegistration

};