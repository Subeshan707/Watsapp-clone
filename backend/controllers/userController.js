const User = require('../models/User');
const { getAiBotUsername } = require('../utils/aiBot');

// In-memory OTP store (in production, use Redis or similar)
const otpStore = new Map();

// Send OTP to phone number
const sendOtp = async (req, res) => {
  const { phoneNumber, countryCode } = req.body;

  if (!phoneNumber || phoneNumber.trim() === '') {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
  const code = countryCode?.trim() || '+91';
  const fullNumber = `${code}${cleanPhone}`;

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP with 5 min expiry
  otpStore.set(fullNumber, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  });

  console.log(`[OTP] ${fullNumber} => ${otp}`);

  // In production, send via SMS (Twilio, etc.)
  // For demo, return the OTP in the response
  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    // Remove this in production — only for demo purposes
    otp: otp
  });
};

// Verify OTP and authenticate/register
const verifyOtp = async (req, res) => {
  const { phoneNumber, countryCode, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
  const code = countryCode?.trim() || '+91';
  const fullNumber = `${code}${cleanPhone}`;

  const stored = otpStore.get(fullNumber);

  if (!stored) {
    return res.status(400).json({ error: 'No OTP was sent to this number. Please request a new one.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(fullNumber);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  stored.attempts += 1;
  if (stored.attempts > 5) {
    otpStore.delete(fullNumber);
    return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
  }

  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
  }

  // OTP is valid — clean up
  otpStore.delete(fullNumber);

  try {
    let user = await User.findOne({ phoneNumber: cleanPhone, countryCode: code });

    if (user) {
      // Existing user — return their profile
      user.isVerified = true;
      await user.save();
      return res.status(200).json({
        _id: user._id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        countryCode: user.countryCode,
        about: user.about,
        isNewUser: false
      });
    }

    // New user — mark as needing profile setup
    return res.status(200).json({
      phoneNumber: cleanPhone,
      countryCode: code,
      isNewUser: true
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Complete profile setup for new user
const setupProfile = async (req, res) => {
  const { phoneNumber, countryCode, username, about } = req.body;

  if (!phoneNumber || !username || username.trim() === '') {
    return res.status(400).json({ error: 'Phone number and name are required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
  const code = countryCode?.trim() || '+91';
  const trimmedName = username.trim();

  if (trimmedName.toLowerCase() === getAiBotUsername().toLowerCase()) {
    return res.status(400).json({ error: 'This name is reserved' });
  }

  try {
    // Check if user already exists with this phone
    let user = await User.findOne({ phoneNumber: cleanPhone, countryCode: code });
    if (user) {
      // Update name if changed
      user.username = trimmedName;
      if (about) user.about = about.trim();
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        phoneNumber: cleanPhone,
        countryCode: code,
        username: trimmedName,
        about: about?.trim() || 'Hey there! I am using WhatsApp.',
        isVerified: true
      });
    }

    res.status(200).json({
      _id: user._id,
      username: user.username,
      phoneNumber: user.phoneNumber,
      countryCode: user.countryCode,
      about: user.about
    });
  } catch (err) {
    console.error('Setup profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Legacy authenticate (fallback) — now redirects to phone flow
const authenticateUser = async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Username is required' });
  }

  if (username.trim().toLowerCase() === getAiBotUsername().toLowerCase()) {
    return res.status(400).json({ error: 'This username is reserved' });
  }

  try {
    let user = await User.findOne({ username: username.trim() });
    if (!user) {
      user = await User.create({
        username: username.trim(),
        phoneNumber: `demo_${Date.now()}`,
        countryCode: '+00'
      });
    }
    res.status(200).json({ _id: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all users except the current user
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('_id username phoneNumber countryCode about');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

module.exports = { authenticateUser, getAllUsers, sendOtp, verifyOtp, setupProfile };
