const express = require('express');
const multer = require('multer');
const path = require('path');

const authMiddleware = require('../middleware/authMiddleware');
const AttendanceController = require('../controllers/attendanceController');

const router = express.Router();

const allowedVideoExtensions = new Set([
  '.avi',
  '.m4v',
  '.mov',
  '.mp4',
  '.mpeg',
  '.webm'
]);

const recordingUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'uploads'),
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(
        null,
        `recording-${Date.now()}-${Math.round(Math.random() * 1E9)}${extension}`
      );
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (file.mimetype.startsWith('video/') && allowedVideoExtensions.has(extension)) {
      return callback(null, true);
    }

    return callback(new Error('Upload an MP4, WebM, MOV, M4V, AVI, or MPEG video.'));
  }
});

const uploadRecording = (req, res, next) => {
  recordingUpload.single('recording')(req, res, (error) => {
    if (!error) {
      return next();
    }

    const tooLarge =
      error instanceof multer.MulterError &&
      error.code === 'LIMIT_FILE_SIZE';

    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      message: tooLarge
        ? 'Video exceeds the 500 MB upload limit.'
        : error.message || 'Unable to upload the recording.'
    });
  });
};

router.use(authMiddleware);

router.get(
  '/',
  AttendanceController.getAttendanceDashboard
);

router.post(
  '/:webinarId/sync',
  AttendanceController.syncAttendance
);

router.put(
  '/registrations/:registrationId',
  AttendanceController.updateAttendance
);

router.post(
  '/:webinarId/send-recordings',
  uploadRecording,
  AttendanceController.sendRecordings
);

module.exports = router;
