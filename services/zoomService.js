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
// LIST ZOOM PARTICIPANTS
// ==================================================
//
// `live` uses Zoom's Dashboard API while a meeting is
// running. Completed meetings use the past-meeting API,
// which is the source used to determine absentees.
//
// ==================================================

const listMeetingParticipants = async (
  meetingId,
  {
    live = false
  } = {}
) => {
  if (!meetingId) {
    throw new Error(
      'Zoom meeting ID is required.'
    );
  }

  if (ZOOM_MOCK_MODE) {
    return {
      success: true,
      mock: true,
      live,
      participants: []
    };
  }

  try {
    const accessToken =
      await getZoomAccessToken();

    const participants = [];
    let nextPageToken = null;

    do {
      const endpoint = live
        ? `https://api.zoom.us/v2/metrics/meetings/${encodeURIComponent(meetingId)}/participants`
        : `https://api.zoom.us/v2/past_meetings/${encodeURIComponent(meetingId)}/participants`;

      const response = await axios.get(
        endpoint,
        {
          params: {
            page_size: 300,
            ...(live ? { type: 'live' } : {}),
            ...(nextPageToken
              ? { next_page_token: nextPageToken }
              : {})
          },
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );

      participants.push(
        ...(response.data?.participants || [])
      );

      nextPageToken =
        response.data?.next_page_token ||
        null;
    } while (nextPageToken);

    return {
      success: true,
      mock: false,
      live,
      participants
    };
  } catch (error) {
    const zoomError = new Error(
      error.response?.data?.message ||
      error.message ||
      'Unable to fetch Zoom participants.'
    );

    zoomError.status =
      error.response?.status ||
      null;

    zoomError.zoomCode =
      error.response?.data?.code ||
      null;

    throw zoomError;
  }
};


// ==================================================
// GET CLOUD RECORDING
// ==================================================

const getMeetingRecording = async (
  meetingId
) => {
  const configuredRecordingUrl =
    String(
      process.env.WEBINAR_RECORDING_URL ||
      ''
    ).trim();

  if (configuredRecordingUrl) {
    return {
      success: true,
      mock: ZOOM_MOCK_MODE,
      recordingUrl: configuredRecordingUrl,
      source: 'configured'
    };
  }

  if (!meetingId) {
    throw new Error(
      'Zoom meeting ID is required.'
    );
  }

  if (ZOOM_MOCK_MODE) {
    return {
      success: true,
      mock: true,
      recordingUrl: null,
      source: 'mock'
    };
  }

  try {
    const accessToken =
      await getZoomAccessToken();

    const response = await axios.get(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/recordings`,
      {
        headers: {
          Authorization:
            `Bearer ${accessToken}`
        }
      }
    );

    const recordingFiles =
      response.data?.recording_files ||
      [];

    const videoFile =
      recordingFiles.find(
        (file) => file.file_type === 'MP4'
      ) ||
      recordingFiles[0] ||
      null;

    return {
      success: true,
      mock: false,
      recordingUrl:
        response.data?.share_url ||
        videoFile?.play_url ||
        videoFile?.download_url ||
        null,
      source: 'zoom'
    };
  } catch (error) {
    const zoomError = new Error(
      error.response?.data?.message ||
      error.message ||
      'Unable to fetch the Zoom recording.'
    );

    zoomError.status =
      error.response?.status ||
      null;

    zoomError.zoomCode =
      error.response?.data?.code ||
      null;

    throw zoomError;
  }
};


// ==================================================
// EXPORT
// ==================================================

module.exports = {

  getZoomAccessToken,

  createZoomMeeting,

  // Backwards-compatible aliases used by WebinarModel.
  createMeeting: createZoomMeeting,

  getZoomMeeting,

  getMeeting: getZoomMeeting,

  deleteZoomMeeting,

  deleteMeeting: deleteZoomMeeting,

  listMeetingParticipants,

  getMeetingRecording

};
