const express = require('express');
const SectionController = require('../controllers/sectionController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();
router.get('/:slug', SectionController.get);
router.post('/:slug', authMiddleware, SectionController.create);
router.put('/:slug', authMiddleware, SectionController.update);
router.delete('/:slug', authMiddleware, SectionController.remove);
module.exports = router;
