const axios = require('axios');


// ==================================================
// ZOOM CONFIGURATION
// ==================================================

const ZOOM_MOCK_MODE =
  String(
    process.env.ZOOM_MOCK_MODE || 'true'
  ).toLowerCase() === 'true';


const ZOOM_ACCOUNT_ID =
  process.env.ZOOM_ACCOUNT_ID || '';


const ZOOM_CLIENT_ID =
  process.env.ZOOM_CLIENT_ID || '';


const ZOOM_CLIENT_SECRET =
  process.env.ZOOM_CLIENT_SECRET || '';


// ==================================================
// GET ZOOM ACCESS TOKEN
// ==================================================

const getZoomAccessToken = async () => {

  try {

    if (!ZOOM_ACCOUNT_ID) {
      throw new Error(
        'ZOOM_ACCOUNT_ID is not configured.'
      );
    }

    if (!ZOOM_CLIENT_ID) {
      throw new Error(
        'ZOOM_CLIENT_ID is not configured.'
      );
    }

    if (!ZOOM_CLIENT_SECRET) {
      throw new Error(
        'ZOOM_CLIENT_SECRET is not configured.'
      );
    }


    const credentials =
      Buffer
        .from(
          `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`
        )
        .toString('base64');


    const response =
      await axios.post(

        'https://zoom.us/oauth/token',

        null,

        {
          params: {
            grant_type:
              'account_credentials',

            account_id:
              ZOOM_ACCOUNT_ID
          },

          headers: {
            Authorization:
              `Basic ${credentials}`
          }
        }

      );


    if (
      !response.data ||
      !response.data.access_token
    ) {

      throw new Error(
        'Zoom access token was not returned.'
      );
    }


    return response.data.access_token;


  } catch (error) {

    console.error(
      'Zoom access token error:',
      error.response?.data ||
      error.message
    );


    throw error;
  }
};


// ==================================================
// CREATE ZOOM MEETING
// ==================================================

const createZoomMeeting = async ({

  topic,

  startTime,

  duration = 120,

  timezone = 'Asia/Kolkata',

  agenda = '',

  password = null

}) => {

  try {

    // ------------------------------------------------
    // BASIC VALIDATION
    // ------------------------------------------------

    if (!topic) {

      throw new Error(
        'Zoom meeting topic is required.'
      );
    }


    if (!startTime) {

      throw new Error(
        'Zoom meeting start time is required.'
      );
    }


    // =================================================
    // MOCK MODE
    // =================================================

    if (ZOOM_MOCK_MODE) {

      console.log(
        '\n========================================'
      );

      console.log(
        'ZOOM MOCK MODE'
      );

      console.log(
        '========================================'
      );


      const mockMeetingId =
        `mock-${Date.now()}`;


      const mockPassword =
        password ||
        'ABC123';


      const mockJoinUrl =
        `https://zoom.us/j/${mockMeetingId}`;


      const mockStartUrl =
        `https://zoom.us/s/${mockMeetingId}`;


      console.log(
        'Topic:',
        topic
      );

      console.log(
        'Start Time:',
        startTime
      );

      console.log(
        'Duration:',
        duration
      );

      console.log(
        'Timezone:',
        timezone
      );

      console.log(
        'Join URL:',
        mockJoinUrl
      );

      console.log(
        'Password:',
        mockPassword
      );


      console.log(
        '========================================\n'
      );


      return {

        success: true,

        mock: true,

        meetingId:
          mockMeetingId,

        joinUrl:
          mockJoinUrl,

        startUrl:
          mockStartUrl,

        password:
          mockPassword,

        topic,

        startTime,

        duration,

        timezone,

        agenda

      };
    }


    // =================================================
    // REAL ZOOM MODE
    // =================================================

    const accessToken =
      await getZoomAccessToken();


    const response =
      await axios.post(

        'https://api.zoom.us/v2/users/me/meetings',

        {

          topic,

          type: 2,

          start_time: startTime,

          duration,

          timezone,

          agenda,

          password

        },

        {

          headers: {

            Authorization:
              `Bearer ${accessToken}`,

            'Content-Type':
              'application/json'

          }

        }

      );


    if (
      !response.data
    ) {

      throw new Error(
        'Zoom meeting creation returned empty response.'
      );
    }


    return {

      success: true,

      mock: false,

      meetingId:
        response.data.id,

      joinUrl:
        response.data.join_url,

      startUrl:
        response.data.start_url,

      password:
        response.data.password || null,

      topic:
        response.data.topic,

      startTime:
        response.data.start_time,

      duration:
        response.data.duration,

      timezone:
        response.data.timezone,

      agenda:
        response.data.agenda || ''

    };


  } catch (error) {

    console.error(
      'Zoom meeting creation failed:',
      error.response?.data ||
      error.message
    );


    throw error;
  }
};


// ==================================================
// GET ZOOM MEETING
// ==================================================

const getZoomMeeting = async (
  meetingId
) => {

  try {

    if (!meetingId) {

      throw new Error(
        'Zoom meeting ID is required.'
      );
    }


    // ------------------------------------------------
    // MOCK MODE
    // ------------------------------------------------

    if (ZOOM_MOCK_MODE) {

      return {

        success: true,

        mock: true,

        meetingId,

        joinUrl:
          `https://zoom.us/j/${meetingId}`,

        startUrl:
          `https://zoom.us/s/${meetingId}`,

        password:
          'ABC123'

      };
    }


    // ------------------------------------------------
    // REAL MODE
    // ------------------------------------------------

    const accessToken =
      await getZoomAccessToken();


    const response =
      await axios.get(

        `https://api.zoom.us/v2/meetings/${meetingId}`,

        {

          headers: {

            Authorization:
              `Bearer ${accessToken}`

          }

        }

      );


    return {

      success: true,

      mock: false,

      meetingId:
        response.data.id,

      joinUrl:
        response.data.join_url,

      startUrl:
        response.data.start_url,

      password:
        response.data.password || null,

      topic:
        response.data.topic,

      startTime:
        response.data.start_time,

      duration:
        response.data.duration,

      timezone:
        response.data.timezone

    };


  } catch (error) {

    console.error(
      'Zoom meeting fetch failed:',
      error.response?.data ||
      error.message
    );


    throw error;
  }
};


// ==================================================
// DELETE ZOOM MEETING
// ==================================================

const deleteZoomMeeting = async (
  meetingId
) => {

  try {

    if (!meetingId) {

      throw new Error(
        'Zoom meeting ID is required.'
      );
    }


    // ------------------------------------------------
    // MOCK MODE
    // ------------------------------------------------

    if (ZOOM_MOCK_MODE) {

      console.log(
        `Mock Zoom meeting deleted: ${meetingId}`
      );


      return {

        success: true,

        mock: true,

        meetingId

      };
    }


    // ------------------------------------------------
    // REAL MODE
    // ------------------------------------------------

    const accessToken =
      await getZoomAccessToken();


    await axios.delete(

      `https://api.zoom.us/v2/meetings/${meetingId}`,

      {

        headers: {

          Authorization:
            `Bearer ${accessToken}`

        }

      }

    );


    return {

      success: true,

      mock: false,

      meetingId

    };


  } catch (error) {

    console.error(
      'Zoom meeting deletion failed:',
      error.response?.data ||
      error.message
    );


    throw error;
  }
};


// ==================================================
// EXPORT
// ==================================================

module.exports = {

  getZoomAccessToken,

  createZoomMeeting,

  getZoomMeeting,

  deleteZoomMeeting

};