const express = require('express');
const authenticate = require('../middleware/auth');
const { getAiBot } = require('../controllers/aiController');

const router = express.Router();

router.get('/bot', authenticate, getAiBot);

module.exports = router;
