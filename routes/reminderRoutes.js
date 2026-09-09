const express = require('express');

const router =
  express.Router();

const authMiddleware =
  require('../middleware/authMiddleware');

const {
  getAllReminders,
  getReminderById,
  getReminderStats,
  getPendingReminders,
  getUpcomingReminders,
  deleteReminder
} = require('../controllers/reminderController');


// ======================================================
// ADMIN REMINDER ROUTES
// ======================================================
//
// All reminder routes are protected.
// Valid JWT Bearer token is required.
//
// ======================================================


// ======================================================
// GET REMINDER STATISTICS
// ======================================================
//
// GET /api/reminders/stats
//
// ======================================================

router.get(
  '/stats',
  authMiddleware,
  getReminderStats
);


// ======================================================
// GET PENDING REMINDERS
// ======================================================
//
// GET /api/reminders/pending
//
// ======================================================

router.get(
  '/pending',
  authMiddleware,
  getPendingReminders
);


// ======================================================
// GET UPCOMING REMINDERS
// ======================================================
//
// GET /api/reminders/upcoming
//
// Example:
// /api/reminders/upcoming?minutes=60
//
// ======================================================

router.get(
  '/upcoming',
  authMiddleware,
  getUpcomingReminders
);


// ======================================================
// GET ALL REMINDER LOGS
// ======================================================
//
// GET /api/reminders
//
// Examples:
//
// /api/reminders
//
// /api/reminders?page=1&limit=20
//
// /api/reminders?reminderType=reminder_24h
//
// /api/reminders?emailStatus=sent
//
// /api/reminders?whatsappStatus=failed
//
// /api/reminders?search=vaishnavi
//
// ======================================================

router.get(
  '/',
  authMiddleware,
  getAllReminders
);


// ======================================================
// GET SINGLE REMINDER
// ======================================================
//
// GET /api/reminders/:id
//
// ======================================================

router.get(
  '/:id',
  authMiddleware,
  getReminderById
);


// ======================================================
// DELETE SINGLE REMINDER
// ======================================================
//
// DELETE /api/reminders/:id
//
// ======================================================

router.delete(
  '/:id',
  authMiddleware,
  deleteReminder
);


// ======================================================
// EXPORT
// ======================================================

module.exports =
  router;