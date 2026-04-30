const express = require('express');
const { authenticateUser, getAllUsers } = require('../controllers/userController');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.post('/authenticate', authenticateUser);
router.get('/', authenticate, getAllUsers);

module.exports = router;
