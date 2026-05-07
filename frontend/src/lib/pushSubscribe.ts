import { API_BASE_URL } from '../config'

/**
 * Subscribe to Web Push notifications.
 * 1. Fetches the VAPID public key from the backend.
 * 2. Subscribes the service worker to push.
 * 3. Sends the subscription object to the backend.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    // Check support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Push notifications not supported in this browser')
      return false
    }

    // Wait for SW to be ready
    const registration = await navigator.serviceWorker.ready

    // Check if already subscribed
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      // Send to backend in case it's a new device/user
      await sendSubToBackend(userId, existing)
      return true
    }

    // Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied')
      return false
    }

    // Get VAPID public key from backend
    const res = await fetch(`${API_BASE_URL}/api/push/vapid-key`, {
      headers: { 'x-user-id': userId },
    })
    if (!res.ok) {
      console.error('[Push] Failed to fetch VAPID key')
      return false
    }
    const { publicKey } = await res.json()

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(publicKey)

    // Subscribe
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    // Send subscription to backend
    await sendSubToBackend(userId, subscription)
    console.log('[Push] Successfully subscribed to push notifications')
    return true
  } catch (err) {
    console.error('[Push] Subscription failed:', err)
    return false
  }
}

async function sendSubToBackend(userId: string, subscription: PushSubscription) {
  await fetch(`${API_BASE_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
