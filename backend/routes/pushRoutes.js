const express = require('express');
const authenticate = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const { sendPushToUser } = require('../utils/pushNotify');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Save a push subscription
router.post('/subscribe', async (req, res) => {
  const userId = req.userId;
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid push subscription' });
  }

  try {
    await PushSubscription.findOneAndUpdate(
      { userId, 'subscription.endpoint': subscription.endpoint },
      { $set: { subscription } },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// Remove a push subscription
router.post('/unsubscribe', async (req, res) => {
  const userId = req.userId;
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  try {
    await PushSubscription.deleteOne({ userId, 'subscription.endpoint': endpoint });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Get VAPID public key (so frontend can subscribe)
router.get('/vapid-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(500).json({ error: 'VAPID key not configured' });
  }
  res.status(200).json({ publicKey: key });
});

// Send a test notification to the current user
router.post('/test', async (req, res) => {
  const userId = req.userId;
  const { title, body } = req.body || {};

  try {
    const result = await sendPushToUser(userId, {
      title: title || 'Orbit Test',
      body: body || 'This is a test notification.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `orbit-test-${Date.now()}`,
      data: { url: '/' },
    });

    return res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('[Push] Test send error:', err.message);
    return res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router;
