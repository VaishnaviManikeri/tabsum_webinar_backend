const db = require('../config/db');
const WebinarModel = require('../models/webinarModel');

const TEST_WEBINAR_ID = 1;

const runTest = async () => {
  console.log('');
  console.log('========================================');
  console.log('WEBINAR + ZOOM DATABASE INTEGRATION TEST');
  console.log('========================================');
  console.log('');

  try {
    // =====================================================
    // 1. Check webinar
    // =====================================================
    const webinar =
      await WebinarModel.getWebinarById(
        TEST_WEBINAR_ID
      );

    if (!webinar) {
      throw new Error(
        `Webinar ID ${TEST_WEBINAR_ID} not found.`
      );
    }

    console.log('WEBINAR FOUND');
    console.log({
      id: webinar.id,
      title: webinar.title,
      date: webinar.date,
      time: webinar.time,
      duration: webinar.duration,
      zoom_meeting_id: webinar.zoom_meeting_id
    });

    // =====================================================
    // 2. Check date
    // =====================================================
    if (!webinar.date) {
      throw new Error(
        'Webinar date is NULL. Set temporary date before running test.'
      );
    }

    // =====================================================
    // 3. Check time
    // =====================================================
    if (!webinar.time) {
      throw new Error(
        'Webinar time is NULL. Set temporary time before running test.'
      );
    }

    console.log('');
    console.log('DATE/TIME VALIDATION PASSED');

    // =====================================================
    // 4. Create Zoom meeting
    // =====================================================
    console.log('');
    console.log('CREATING ZOOM MEETING...');

    const createResult =
      await WebinarModel.createZoomMeetingForWebinar(
        TEST_WEBINAR_ID
      );

    console.log('');
    console.log('CREATE RESULT');
    console.log(createResult);

    // =====================================================
    // 5. Validate creation
    // =====================================================
    if (!createResult.success) {
      throw new Error(
        'Zoom meeting creation returned success=false.'
      );
    }

    if (!createResult.meetingId) {
      throw new Error(
        'Zoom meeting ID missing.'
      );
    }

    if (!createResult.joinUrl) {
      throw new Error(
        'Zoom join URL missing.'
      );
    }

    if (!createResult.startUrl) {
      throw new Error(
        'Zoom start URL missing.'
      );
    }

    if (!createResult.password) {
      throw new Error(
        'Zoom password missing.'
      );
    }

    console.log('');
    console.log('ZOOM MEETING CREATION PASSED');

    // =====================================================
    // 6. Read database again
    // =====================================================
    const updatedWebinar =
      await WebinarModel.getWebinarById(
        TEST_WEBINAR_ID
      );

    console.log('');
    console.log('DATABASE AFTER ZOOM CREATION');
    console.log({
      id: updatedWebinar.id,
      title: updatedWebinar.title,
      zoom_meeting_id:
        updatedWebinar.zoom_meeting_id,
      zoom_join_url:
        updatedWebinar.zoom_join_url,
      zoom_start_url:
        updatedWebinar.zoom_start_url,
      zoom_password:
        updatedWebinar.zoom_password,
      zoom_created_at:
        updatedWebinar.zoom_created_at
    });

    // =====================================================
    // 7. Validate DB fields
    // =====================================================
    if (!updatedWebinar.zoom_meeting_id) {
      throw new Error(
        'zoom_meeting_id was not saved in database.'
      );
    }

    if (!updatedWebinar.zoom_join_url) {
      throw new Error(
        'zoom_join_url was not saved in database.'
      );
    }

    if (!updatedWebinar.zoom_start_url) {
      throw new Error(
        'zoom_start_url was not saved in database.'
      );
    }

    if (!updatedWebinar.zoom_password) {
      throw new Error(
        'zoom_password was not saved in database.'
      );
    }

    if (!updatedWebinar.zoom_created_at) {
      throw new Error(
        'zoom_created_at was not saved in database.'
      );
    }

    console.log('');
    console.log('ZOOM DATA DATABASE SAVE PASSED');

    // =====================================================
    // 8. Test duplicate protection
    // =====================================================
    console.log('');
    console.log('TESTING DUPLICATE PROTECTION...');

    const secondResult =
      await WebinarModel.createZoomMeetingForWebinar(
        TEST_WEBINAR_ID
      );

    console.log('');
    console.log('SECOND CREATE RESULT');
    console.log(secondResult);

    if (!secondResult.success) {
      throw new Error(
        'Second Zoom request failed.'
      );
    }

    if (!secondResult.alreadyExists) {
      throw new Error(
        'Duplicate Zoom meeting protection failed.'
      );
    }

    if (
      secondResult.meetingId !==
      updatedWebinar.zoom_meeting_id
    ) {
      throw new Error(
        'Second request returned a different meeting ID.'
      );
    }

    console.log('');
    console.log(
      'DUPLICATE ZOOM MEETING PREVENTION PASSED'
    );

    // =====================================================
    // 9. Get Zoom meeting
    // =====================================================
    console.log('');
    console.log('TESTING GET ZOOM MEETING...');

    const getResult =
      await WebinarModel.getZoomMeetingForWebinar(
        TEST_WEBINAR_ID
      );

    console.log('');
    console.log('GET RESULT');
    console.log(getResult);

    if (!getResult.success) {
      throw new Error(
        'Get Zoom meeting failed.'
      );
    }

    if (!getResult.meetingId) {
      throw new Error(
        'Get Zoom meeting ID missing.'
      );
    }

    console.log('');
    console.log(
      'GET ZOOM MEETING PASSED'
    );

    // =====================================================
    // 10. Final result
    // =====================================================
    console.log('');
    console.log('========================================');
    console.log(
      'WEBINAR + ZOOM INTEGRATION TEST PASSED'
    );
    console.log('========================================');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error(
      'WEBINAR + ZOOM INTEGRATION TEST FAILED'
    );
    console.error('========================================');
    console.error('');
    console.error(error);
    console.error('');

    process.exitCode = 1;
  } finally {
    try {
      await db.end();
    } catch (error) {
      // Ignore DB close error
    }
  }
};

runTest();