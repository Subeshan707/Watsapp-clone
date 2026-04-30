const express = require('express');
const { authenticateUser, getAllUsers, sendOtp, verifyOtp, setupProfile } = require('../controllers/userController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// WhatsApp-style phone auth flow
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/setup-profile', setupProfile);

// Legacy
router.post('/authenticate', authenticateUser);
router.get('/', authenticate, getAllUsers);

module.exports = router;
