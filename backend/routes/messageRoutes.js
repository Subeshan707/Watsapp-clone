const express = require('express');
const { getMessages, sendMessage } = require('../controllers/messageController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.get('/:otherUserId', authenticate, getMessages);
router.post('/', authenticate, sendMessage);

module.exports = router;
