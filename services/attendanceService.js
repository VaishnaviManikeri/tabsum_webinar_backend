const AttendanceModel = require('../models/attendanceModel');
const zoomService = require('./zoomService');
const {
  sendWebinarRecording
} = require('./emailService');

const normalizeEmail = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();

  return email.includes('@')
    ? email
    : null;
};

const toDateTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return null;
  }

  return new Date(value)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
};

const participantDurationMinutes = (participant) => {
  const directDuration = Number(participant.duration);

  if (Number.isFinite(directDuration) && directDuration > 0) {
    // Zoom report durations can be in seconds; live data is often minutes.
    return directDuration > 600
      ? Math.max(1, Math.round(directDuration / 60))
      : Math.round(directDuration);
  }

  const joinedAt = new Date(participant.join_time);
  const leftAt = new Date(participant.leave_time);

  if (
    !Number.isNaN(joinedAt.getTime()) &&
    !Number.isNaN(leftAt.getTime())
  ) {
    return Math.max(
      1,
      Math.round((leftAt - joinedAt) / 60000)
    );
  }

  return 0;
};

const aggregateMatchedParticipants = (
  participants,
  paidRegistrations
) => {
  const registrationsByEmail = new Map(
    paidRegistrations.map((registration) => [
      normalizeEmail(registration.email),
      registration
    ])
  );

  const matchesByRegistration = new Map();

  for (const participant of participants) {
    const email = normalizeEmail(
      participant.user_email ||
      participant.email ||
      participant.userEmail
    );

    const registration =
      email && registrationsByEmail.get(email);

    if (!registration) {
      continue;
    }

    const existing = matchesByRegistration.get(
      registration.id
    );

    const joinedAt = toDateTime(
      participant.join_time ||
      participant.joined_at
    );

    const leftAt = toDateTime(
      participant.leave_time ||
      participant.left_at
    );

    const durationMinutes =
      participantDurationMinutes(participant);

    matchesByRegistration.set(
      registration.id,
      {
        registrationId: registration.id,
        email,
        joinedAt:
          existing?.joinedAt &&
          (!joinedAt || existing.joinedAt <= joinedAt)
            ? existing.joinedAt
            : joinedAt,
        leftAt:
          existing?.leftAt &&
          (!leftAt || existing.leftAt >= leftAt)
            ? existing.leftAt
            : leftAt,
        durationMinutes:
          (existing?.durationMinutes || 0) +
          durationMinutes
      }
    );
  }

  return [...matchesByRegistration.values()];
};

const createConfigurationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const syncWebinarAttendance = async (
  webinarId,
  {
    live = false
  } = {}
) => {
  const webinar = await AttendanceModel.getWebinar(
    webinarId
  );

  if (!webinar) {
    const error = new Error('Webinar not found.');
    error.status = 404;
    throw error;
  }

  if (!webinar.zoom_meeting_id) {
    throw createConfigurationError(
      'Add the Zoom meeting ID before syncing attendance.'
    );
  }

  const zoomResponse =
    await zoomService.listMeetingParticipants(
      webinar.zoom_meeting_id,
      { live }
    );

  if (zoomResponse.mock) {
    throw createConfigurationError(
      'Attendance sync is unavailable while ZOOM_MOCK_MODE is enabled.'
    );
  }

  const paidRegistrations =
    await AttendanceModel.getPaidRegistrations(
      webinar.id
    );

  const matchedParticipants =
    aggregateMatchedParticipants(
      zoomResponse.participants,
      paidRegistrations
    );

  const participantsWithoutEmail =
    zoomResponse.participants.filter(
      (participant) => !normalizeEmail(
        participant.user_email ||
        participant.email ||
        participant.userEmail
      )
    ).length;

  // Do not infer absences if Zoom hid any participant email. Those people
  // cannot be safely matched to registrations, so they remain pending for
  // an administrator instead of receiving an incorrect recording email.
  const absencesFinalized =
    !live &&
    participantsWithoutEmail === 0;

  await AttendanceModel.applyZoomAttendance(
    webinar.id,
    matchedParticipants,
    { finalize: absencesFinalized }
  );

  return {
    webinar,
    live,
    participantsFound:
      zoomResponse.participants.length,
    matchedParticipants:
      matchedParticipants.length,
    participantsWithoutEmail,
    absencesFinalized
  };
};

const sendRecordingToAbsentees = async (
  webinarId,
  { recordingUrl: providedRecordingUrl } = {}
) => {
  const webinar = await AttendanceModel.getWebinar(
    webinarId
  );

  if (!webinar) {
    const error = new Error('Webinar not found.');
    error.status = 404;
    throw error;
  }

  let recording;

  if (providedRecordingUrl) {
    try {
      const url = new URL(providedRecordingUrl);

      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new Error('Invalid recording URL protocol.');
      }

      recording = {
        recordingUrl: url.toString(),
        source: 'admin'
      };
    } catch (error) {
      throw createConfigurationError(
        'Enter a valid HTTP or HTTPS recording link.'
      );
    }
  } else {
    if (!webinar.zoom_meeting_id) {
      throw createConfigurationError(
        'Add the Zoom meeting ID before sending a recording.'
      );
    }

    recording = await zoomService.getMeetingRecording(
      webinar.zoom_meeting_id
    );
  }

  if (!recording.recordingUrl) {
    throw createConfigurationError(
      'No recording is available yet. Upload the Zoom cloud recording or set WEBINAR_RECORDING_URL.'
    );
  }

  const recipients =
    await AttendanceModel.getRecordingRecipients(
      webinar.id
    );

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendWebinarRecording({
        recipient,
        webinar,
        recordingUrl: recording.recordingUrl
      });

      await AttendanceModel.markRecordingEmailSent(
        recipient.attendance_id,
        recording.recordingUrl,
        result.messageId || null
      );

      sent++;
    } catch (error) {
      await AttendanceModel.markRecordingEmailFailed(
        recipient.attendance_id,
        error.message || 'Recording email failed.'
      );

      failed++;
    }
  }

  return {
    webinar,
    recordingSource: recording.source,
    queued: recipients.length,
    sent,
    failed
  };
};

const processCompletedWebinarAttendance = async () => {
  const webinars =
    await AttendanceModel.getWebinarsReadyForAttendanceSync();

  const results = [];

  for (const webinar of webinars) {
    try {
      const syncResult =
        await syncWebinarAttendance(webinar.id);

      const recordingResult =
        await sendRecordingToAbsentees(webinar.id);

      results.push({
        webinarId: webinar.id,
        success: true,
        sync: syncResult,
        recording: recordingResult
      });
    } catch (error) {
      // A 404 is normal while a webinar is live or Zoom is still processing
      // its report. The worker will try again on its next run.
      results.push({
        webinarId: webinar.id,
        success: false,
        status: error.status || null,
        error: error.message
      });
    }
  }

  return {
    processed: webinars.length,
    results
  };
};

module.exports = {
  syncWebinarAttendance,
  sendRecordingToAbsentees,
  processCompletedWebinarAttendance
};
