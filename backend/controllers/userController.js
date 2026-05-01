const User = require('../models/User');
const { getAiBotUsername } = require('../utils/aiBot');

// ─────────────────────────────────────────────────────────
//  SMS Provider Setup (Twilio)
//  Set USE_REAL_SMS=true in .env to send real SMS via Twilio
//  Otherwise it falls back to demo mode (OTP shown on screen)
// ─────────────────────────────────────────────────────────
const USE_REAL_SMS = (process.env.USE_REAL_SMS || '').trim().toLowerCase() === 'true';
console.log('[SMS] USE_REAL_SMS raw value:', JSON.stringify(process.env.USE_REAL_SMS), '→ parsed:', USE_REAL_SMS);

let twilioClient = null;
if (USE_REAL_SMS) {
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('[SMS] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when USE_REAL_SMS=true');
  } else {
    twilioClient = twilio(accountSid, authToken);
    console.log('[SMS] Twilio client initialized — real SMS mode ON');
  }
} else {
  console.log('[SMS] Running in DEMO mode — OTP will be shown on screen');
}

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || '';
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID || '';

// In-memory OTP store (used in demo mode or custom OTP mode)
// In production with Twilio Verify, OTP is managed by Twilio
const otpStore = new Map();

// ─────────────────────────────────────────────────────────
//  Send OTP
// ─────────────────────────────────────────────────────────
const sendOtp = async (req, res) => {
  const { phoneNumber, countryCode } = req.body;

  if (!phoneNumber || phoneNumber.trim() === '') {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
  const code = countryCode?.trim() || '+91';
  const fullNumber = `${code}${cleanPhone}`;

  // ── Option A: Twilio Verify Service (recommended) ──
  // Uses Twilio's managed OTP — they generate, send, and verify the code
  if (USE_REAL_SMS && twilioClient && TWILIO_VERIFY_SID) {
    try {
      await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SID)
        .verifications.create({
          to: fullNumber,
          channel: 'sms'
        });

      console.log(`[SMS] Twilio Verify sent to ${fullNumber}`);
      return res.status(200).json({
        success: true,
        message: 'OTP sent via SMS',
        mode: 'twilio_verify'
      });
    } catch (err) {
      console.error('[SMS] Twilio Verify failed, falling back to demo:', err.message);
      // Fall through to demo mode
    }
  }

  // ── Option B: Twilio SMS (manual OTP) ──
  if (USE_REAL_SMS && twilioClient && TWILIO_PHONE) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(fullNumber, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });

    try {
      await twilioClient.messages.create({
        body: `Your Orbit verification code is: ${otp}. Do not share this code with anyone.`,
        from: TWILIO_PHONE,
        to: fullNumber
      });

      console.log(`[SMS] OTP sent to ${fullNumber} via Twilio SMS`);
      return res.status(200).json({
        success: true,
        message: 'OTP sent via SMS',
        mode: 'twilio_sms'
      });
    } catch (err) {
      console.error('[SMS] Twilio SMS failed, falling back to demo:', err.message);
      otpStore.delete(fullNumber);
      // Fall through to demo mode
    }
  }

  // ── Fallback: Demo mode ──
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore.set(fullNumber, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  });

  console.log(`[OTP-DEMO] ${fullNumber} => ${otp}`);

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully',
    mode: 'demo',
    otp: otp
  });
};

// ─────────────────────────────────────────────────────────
//  Verify OTP
// ─────────────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  const { phoneNumber, countryCode, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: 'Phone number and OTP are required' });
  }

  const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
  const code = countryCode?.trim() || '+91';
  const fullNumber = `${code}${cleanPhone}`;

  // Check if OTP was stored locally (demo mode or Twilio fallback)
  const stored = otpStore.get(fullNumber);

  if (stored) {
    // ── Local OTP check (demo/fallback) ──
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

    // Valid — clean up
    otpStore.delete(fullNumber);
  } else if (USE_REAL_SMS && twilioClient && TWILIO_VERIFY_SID) {
    // ── Twilio Verify check (real SMS was sent) ──
    try {
      const check = await twilioClient.verify.v2
        .services(TWILIO_VERIFY_SID)
        .verificationChecks.create({
          to: fullNumber,
          code: otp.trim()
        });

      if (check.status !== 'approved') {
        return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
      }
    } catch (err) {
      console.error('[SMS] Twilio Verify check error:', err.message);
      return res.status(400).json({ error: 'Verification failed. Please request a new OTP.' });
    }
  } else {
    return res.status(400).json({ error: 'No OTP was sent to this number. Please request a new one.' });
  }

  // ── User lookup ──
  try {
    let user = await User.findOne({ phoneNumber: cleanPhone, countryCode: code });

    if (user) {
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

    // New user — needs profile setup
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

// ─────────────────────────────────────────────────────────
//  Profile Setup
// ─────────────────────────────────────────────────────────
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
    let user = await User.findOne({ phoneNumber: cleanPhone, countryCode: code });
    if (user) {
      user.username = trimmedName;
      if (about) user.about = about.trim();
      user.isVerified = true;
      await user.save();
    } else {
      user = await User.create({
        phoneNumber: cleanPhone,
        countryCode: code,
        username: trimmedName,
        about: about?.trim() || 'Hey there! I am using Orbit.',
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

// Legacy authenticate (fallback)
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
