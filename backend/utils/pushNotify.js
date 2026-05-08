const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Configure web-push with VAPID keys
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@orbit.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('[Push] Web Push configured with VAPID keys');
} else {
  console.warn('[Push] VAPID keys not set — push notifications disabled');
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Automatically cleans up expired/invalid subscriptions.
 */
async function sendPushToUser(userId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn(`[Push] Skipping send (VAPID missing) for user ${userId}`);
    return { sent: 0, total: 0, skipped: 'missing_vapid' };
  }

  try {
    const subs = await PushSubscription.find({ userId });
    if (!subs || subs.length === 0) {
      console.warn(`[Push] No subscriptions for user ${userId}`);
      return { sent: 0, total: 0, skipped: 'no_subscriptions' };
    }

    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(sub.subscription, body).catch(async (err) => {
          // 410 Gone or 404 = subscription expired, remove it
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
            console.log(`[Push] Removed expired subscription for user ${userId}`);
          }
          throw err;
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    if (sent > 0) {
      console.log(`[Push] Sent ${sent}/${subs.length} notification(s) to user ${userId}`);
    }
    if (failed > 0) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason)
        .filter(Boolean);
      for (const err of errors) {
        const status = err?.statusCode ? ` status=${err.statusCode}` : '';
        console.warn(`[Push] Send failed for user ${userId}${status}: ${err?.message || 'unknown error'}`);
      }
    }

    return { sent, total: subs.length, failed };
  } catch (err) {
    // Best effort — don't crash the server
    console.error('[Push] Error sending push:', err.message);
    return { sent: 0, total: 0, failed: 1, error: err.message };
  }
}

module.exports = { sendPushToUser };
