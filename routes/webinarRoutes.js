const express = require('express');
const multer = require('multer');
const path = require('path');

const WebinarController = require('../controllers/webinarController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// =========================================================
// MULTER CONFIGURATION FOR BACKGROUND IMAGE
// =========================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(
      null,
      path.join(__dirname, '..', 'uploads')
    );
  },

  filename: (req, file, cb) => {
    const uniqueSuffix =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1E9);

    cb(
      null,
      'bg-' +
        uniqueSuffix +
        path.extname(file.originalname)
    );
  }
});

// =========================================================
// FILE FILTER
// =========================================================

const fileFilter = (req, file, cb) => {
  const allowedTypes =
    /jpeg|jpg|png|gif|webp/;

  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimetype = allowedTypes.test(
    file.mimetype
  );

  if (mimetype && extname) {
    return cb(null, true);
  }

  return cb(
    new Error('Only image files are allowed')
  );
};

// =========================================================
// MULTER INSTANCE
// =========================================================

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter
});

// =========================================================
// PUBLIC ROUTES
// =========================================================

// GET latest webinar
router.get(
  '/',
  WebinarController.getWebinar
);

// =========================================================
// PROTECTED WEBINAR ROUTES
// =========================================================

// Update webinar
router.put(
  '/',
  authMiddleware,
  upload.single('backgroundImage'),
  WebinarController.updateWebinar
);

// =========================================================
// ZOOM ROUTES
// =========================================================

// Create Zoom meeting
router.post(
  '/:id/create-zoom',
  authMiddleware,
  WebinarController.createZoomMeeting
);

// Get Zoom meeting
router.get(
  '/:id/zoom',
  authMiddleware,
  WebinarController.getZoomMeeting
);

// Delete Zoom meeting
router.delete(
  '/:id/zoom',
  authMiddleware,
  WebinarController.deleteZoomMeeting
);

module.exports = router;