require('dotenv').config({
  path: ['.env.local', '.env']
});


const {
  createZoomMeeting,
  getZoomMeeting,
  deleteZoomMeeting
} = require('../services/zoomService');


async function testZoomService() {

  try {

    console.log('\n========================================');

    console.log(
      'ZOOM SERVICE TEST'
    );

    console.log(
      '========================================\n'
    );


    // ==================================================
    // STEP 1: CREATE MEETING
    // ==================================================

    console.log(
      'Creating Zoom meeting...'
    );


    const createResult =
      await createZoomMeeting({

        topic:
          'The Abundance Crossroad™',

        startTime:
          '2026-10-15T10:00:00+05:30',

        duration:
          120,

        timezone:
          'Asia/Kolkata',

        agenda:
          'The 2-Day Experience That Will Transform the Way You Make Decisions About Money, Success, Leadership and Life.'

      });


    console.log(
      '\nCREATE MEETING RESULT:'
    );


    console.log(
      createResult
    );


    // ==================================================
    // STEP 2: VALIDATE CREATE
    // ==================================================

    if (
      createResult.success !== true
    ) {

      throw new Error(
        'Zoom meeting creation failed.'
      );
    }


    if (
      !createResult.meetingId
    ) {

      throw new Error(
        'Zoom meeting ID is missing.'
      );
    }


    if (
      !createResult.joinUrl
    ) {

      throw new Error(
        'Zoom join URL is missing.'
      );
    }


    if (
      !createResult.startUrl
    ) {

      throw new Error(
        'Zoom start URL is missing.'
      );
    }


    if (
      !createResult.password
    ) {

      throw new Error(
        'Zoom meeting password is missing.'
      );
    }


    console.log(
      '\nZOOM MEETING CREATION PASSED ✅'
    );


    // ==================================================
    // STEP 3: GET MEETING
    // ==================================================

    console.log(
      '\nFetching Zoom meeting...'
    );


    const getResult =
      await getZoomMeeting(
        createResult.meetingId
      );


    console.log(
      '\nGET MEETING RESULT:'
    );


    console.log(
      getResult
    );


    if (
      getResult.success !== true
    ) {

      throw new Error(
        'Zoom meeting fetch failed.'
      );
    }


    if (
      getResult.meetingId !==
      createResult.meetingId
    ) {

      throw new Error(
        'Fetched meeting ID does not match.'
      );
    }


    if (
      !getResult.joinUrl
    ) {

      throw new Error(
        'Fetched Zoom join URL is missing.'
      );
    }


    console.log(
      '\nZOOM MEETING FETCH PASSED ✅'
    );


    // ==================================================
    // STEP 4: DELETE MEETING
    // ==================================================

    console.log(
      '\nDeleting Zoom meeting...'
    );


    const deleteResult =
      await deleteZoomMeeting(
        createResult.meetingId
      );


    console.log(
      '\nDELETE MEETING RESULT:'
    );


    console.log(
      deleteResult
    );


    if (
      deleteResult.success !== true
    ) {

      throw new Error(
        'Zoom meeting deletion failed.'
      );
    }


    console.log(
      '\nZOOM MEETING DELETE PASSED ✅'
    );


    // ==================================================
    // FINAL RESULT
    // ==================================================

    console.log(
      '\n========================================'
    );


    console.log(
      'ZOOM SERVICE TEST PASSED ✅'
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
      'ZOOM SERVICE TEST FAILED ❌'
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


testZoomService();