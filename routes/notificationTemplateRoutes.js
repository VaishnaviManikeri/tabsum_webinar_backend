const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const NotificationTemplateController = require('../controllers/notificationTemplateController');

const router = express.Router();

router.get('/', authMiddleware, NotificationTemplateController.getAll);
router.post('/', authMiddleware, NotificationTemplateController.create);
router.put('/:id', authMiddleware, NotificationTemplateController.update);
router.delete('/:id', authMiddleware, NotificationTemplateController.remove);

module.exports = router;