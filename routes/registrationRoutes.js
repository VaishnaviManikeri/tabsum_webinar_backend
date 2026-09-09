const express = require('express');

const RegistrationController =
  require('../controllers/registrationController');

const authMiddleware =
  require('../middleware/authMiddleware');

const router = express.Router();


// ==================================================
// PUBLIC REGISTRATION
// ==================================================
//
// Website वरून user registration करू शकतो.
// यासाठी admin login आवश्यक नाही.
//

router.post(
  '/',
  RegistrationController.createRegistration
);


// ==================================================
// PROTECTED ADMIN ROUTES
// ==================================================
//
// खालील सर्व routes फक्त logged-in admin
// साठी available आहेत.
//

router.get(
  '/stats',
  authMiddleware,
  RegistrationController.getRegistrationStats
);


router.get(
  '/',
  authMiddleware,
  RegistrationController.getAllRegistrations
);


router.get(
  '/:id',
  authMiddleware,
  RegistrationController.getRegistrationById
);


router.put(
  '/:id/payment',
  authMiddleware,
  RegistrationController.updatePaymentStatus
);


router.put(
  '/:id/status',
  authMiddleware,
  RegistrationController.updateRegistrationStatus
);


module.exports = router;