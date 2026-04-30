export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(
  /\/+$/,
  '',
)

export const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL || window.location.origin
).replace(/\/+$/, '')

export const ICE_SERVERS: RTCIceServer[] = (() => {
  const raw = import.meta.env.VITE_ICE_SERVERS
  if (!raw) return [{ urls: 'stun:stun.l.google.com:19302' }]

  try {
    const parsed = JSON.parse(String(raw)) as unknown
    if (Array.isArray(parsed)) return parsed as RTCIceServer[]
    if (parsed && typeof parsed === 'object') return [parsed as RTCIceServer]
    return [{ urls: String(raw) }]
  } catch {
    return [{ urls: String(raw) }]
  }
})()
