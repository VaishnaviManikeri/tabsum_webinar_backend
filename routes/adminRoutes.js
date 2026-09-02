const express = require('express');
const AdminController = require('../controllers/adminController');
const router = express.Router();

// Admin login
router.post('/login', AdminController.login);

module.exports = router;