const AttendanceModel = require('../models/attendanceModel');
const {
  syncWebinarAttendance,
  sendRecordingToAbsentees
} = require('../services/attendanceService');

const parseWebinarId = (value) => {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
};

const sendError = (res, error, fallback) => res.status(
  error.status || 500
).json({
  success: false,
  message: error.message || fallback
});

const getAttendanceDashboard = async (req, res) => {
  try {
    const webinarId = req.query.webinarId
      ? parseWebinarId(req.query.webinarId)
      : null;

    if (req.query.webinarId && !webinarId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webinar ID.'
      });
    }

    const dashboard =
      await AttendanceModel.getDashboard(webinarId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found.'
      });
    }

    return res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Get attendance dashboard error:', error);

    return sendError(
      res,
      error,
      'Unable to load webinar attendance.'
    );
  }
};

const syncAttendance = async (req, res) => {
  try {
    const webinarId = parseWebinarId(req.params.webinarId);

    if (!webinarId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webinar ID.'
      });
    }

    const live = req.query.live === 'true';

    const result = await syncWebinarAttendance(
      webinarId,
      { live }
    );

    const dashboard =
      await AttendanceModel.getDashboard(webinarId);

    return res.json({
      success: true,
      message: live
        ? 'Live attendance refreshed.'
        : result.absencesFinalized
        ? 'Completed attendance synchronized.'
        : 'Attendees synchronized. Absences need review because Zoom did not provide every participant email.',
      data: {
        ...result,
        dashboard
      }
    });
  } catch (error) {
    console.error('Sync attendance error:', error);

    return sendError(
      res,
      error,
      'Unable to synchronize webinar attendance.'
    );
  }
};

const updateAttendance = async (req, res) => {
  try {
    const registrationId = parseWebinarId(
      req.params.registrationId
    );

    const attendanceStatus =
      req.body?.attendanceStatus;

    if (!registrationId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration ID.'
      });
    }

    if (!['attended', 'absent'].includes(attendanceStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Attendance status must be attended or absent.'
      });
    }

    const registration =
      await AttendanceModel.setManualAttendance(
        registrationId,
        attendanceStatus
      );

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'A paid, active registration was not found.'
      });
    }

    const dashboard =
      await AttendanceModel.getDashboard(
        registration.webinar_id
      );

    return res.json({
      success: true,
      message: 'Attendance updated successfully.',
      data: dashboard
    });
  } catch (error) {
    console.error('Update attendance error:', error);

    return sendError(
      res,
      error,
      'Unable to update webinar attendance.'
    );
  }
};

const sendRecordings = async (req, res) => {
  try {
    const webinarId = parseWebinarId(req.params.webinarId);

    if (!webinarId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webinar ID.'
      });
    }

    const recordingUrl = req.file
      ? `${process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`}/uploads/${req.file.filename}`
      : req.body?.recordingUrl;

    if (!req.file && !recordingUrl) {
      return res.status(400).json({
        success: false,
        message: 'Provide a recording link or upload a video.'
      });
    }

    const result = await sendRecordingToAbsentees(
      webinarId,
      { recordingUrl }
    );

    const dashboard =
      await AttendanceModel.getDashboard(webinarId);

    return res.json({
      success: true,
      message: result.queued
        ? `Recording delivery completed: ${result.sent} sent, ${result.failed} failed.`
        : 'No unsent recording emails are waiting.',
      data: {
        ...result,
        dashboard
      }
    });
  } catch (error) {
    console.error('Send recording error:', error);

    return sendError(
      res,
      error,
      'Unable to send webinar recordings.'
    );
  }
};

module.exports = {
  getAttendanceDashboard,
  syncAttendance,
  updateAttendance,
  sendRecordings
};
