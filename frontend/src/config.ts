function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function getRequiredProductionUrl(envValue: string | undefined): string {
  const trimmed = envValue?.trim()
  if (trimmed) return normalizeUrl(trimmed)
  if (import.meta.env.DEV) return 'http://localhost:5000'
  return ''
}

export const API_BASE_URL = getRequiredProductionUrl(import.meta.env.VITE_API_BASE_URL)

export const SOCKET_URL = normalizeUrl(
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : ''),
)

// Parse optional ICE servers from env (VITE_ICE_SERVERS), fallback to public STUN
export const ICE_SERVERS: RTCIceServer[] = (() => {
  const raw = import.meta.env.VITE_ICE_SERVERS || ''
  if (!raw) return [{ urls: 'stun:stun.l.google.com:19302' }]
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as RTCIceServer[]
    return [{ urls: 'stun:stun.l.google.com:19302' }]
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }]
  }
})()
