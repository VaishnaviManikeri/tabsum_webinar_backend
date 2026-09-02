const express = require('express');

const RegistrationController =
  require('../controllers/registrationController');

const authMiddleware =
  require('../middleware/authMiddleware');

const router = express.Router();


// =====================================================
// ADMIN REGISTRATION ROUTES
// =====================================================


// Get registration statistics
router.get(
  '/stats',
  authMiddleware,
  RegistrationController.getStats
);


// Get all registrations
router.get(
  '/',
  authMiddleware,
  RegistrationController.getRegistrations
);


// Get single registration
router.get(
  '/:id',
  authMiddleware,
  RegistrationController.getRegistration
);


// Update payment status
router.put(
  '/:id/payment',
  authMiddleware,
  RegistrationController.updatePaymentStatus
);


// Update registration status
router.put(
  '/:id/status',
  authMiddleware,
  RegistrationController.updateRegistrationStatus
);


module.exports = router;