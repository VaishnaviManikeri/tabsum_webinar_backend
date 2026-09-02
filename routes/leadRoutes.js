const express = require('express');

const LeadController = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();


// All CRM lead routes require admin authentication

router.get(
  '/',
  authMiddleware,
  LeadController.getLeads
);


router.get(
  '/stats',
  authMiddleware,
  LeadController.getStats
);


router.get(
  '/:id',
  authMiddleware,
  LeadController.getLead
);


router.put(
  '/:id/status',
  authMiddleware,
  LeadController.updateStatus
);


module.exports = router;