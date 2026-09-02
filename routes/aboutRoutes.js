const express = require('express');
const AboutController = require('../controllers/aboutController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', AboutController.getAll);
router.post('/', authMiddleware, AboutController.create);
router.put('/:id', authMiddleware, AboutController.update);
router.delete('/:id', authMiddleware, AboutController.remove);

module.exports = router;
