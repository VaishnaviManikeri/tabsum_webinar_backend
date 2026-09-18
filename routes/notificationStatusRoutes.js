const express = require('express');

const authMiddleware = require('../middleware/authMiddleware');
const {
  getNotificationStatuses
} = require('../controllers/notificationStatusController');

const router = express.Router();

router.get(
  '/',
  authMiddleware,
  getNotificationStatuses
);

module.exports = router;