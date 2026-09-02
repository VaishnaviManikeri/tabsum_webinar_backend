const express = require('express');
const SettingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
router.get('/typography', SettingsController.getTypography);
router.put('/typography', authMiddleware, SettingsController.updateTypography);
module.exports = router;
