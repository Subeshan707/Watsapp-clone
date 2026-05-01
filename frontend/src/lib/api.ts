import type { Message, User } from '../types'
import { API_BASE_URL } from '../config'

type Json = Record<string, unknown>

async function requestJson<T>(
  path: string,
  options: RequestInit & { userId?: string } = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'Frontend API base URL is not configured. Set VITE_API_BASE_URL to your deployed backend URL before deploying to production.',
    )
  }

  const url = `${API_BASE_URL}${path}`

  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (options.userId) headers.set('x-user-id', options.userId)

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const message =
      typeof data === 'object' && data && 'error' in data
        ? String((data as Json).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }

  return data as T
}

// WhatsApp-style phone auth
export async function sendOtp(phoneNumber: string, countryCode: string): Promise<{ success: boolean; otp?: string }> {
  return requestJson('/api/users/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, countryCode }),
  })
}

export async function verifyOtp(phoneNumber: string, countryCode: string, otp: string): Promise<{
  _id?: string
  username?: string
  phoneNumber: string
  countryCode: string
  about?: string
  isNewUser: boolean
}> {
  return requestJson('/api/users/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, countryCode, otp }),
  })
}

export async function setupProfile(phoneNumber: string, countryCode: string, username: string, about?: string): Promise<User> {
  return requestJson<User>('/api/users/setup-profile', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, countryCode, username, about }),
  })
}

// Legacy
export async function authenticateUser(username: string): Promise<User> {
  return requestJson<User>('/api/users/authenticate', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
}

export async function getUsers(currentUserId: string): Promise<User[]> {
  return requestJson<User[]>('/api/users', {
    method: 'GET',
    userId: currentUserId,
  })
}

export async function getMessages(
  currentUserId: string,
  otherUserId: string,
): Promise<Message[]> {
  return requestJson<Message[]>(`/api/messages/${otherUserId}`, {
    method: 'GET',
    userId: currentUserId,
  })
}

export async function sendMessage(
  currentUserId: string,
  receiverId: string,
  content: string,
): Promise<Message> {
  return requestJson<Message>('/api/messages', {
    method: 'POST',
    userId: currentUserId,
    body: JSON.stringify({ receiverId, content }),
  })
}

export async function getAiBot(currentUserId: string): Promise<User> {
  return requestJson<User>('/api/ai/bot', {
    method: 'GET',
    userId: currentUserId,
  })
}

// ── Contacts API ──

export type ContactEntry = {
  _id: string
  phoneNumber: string
  countryCode: string
  name: string
  isRegistered: boolean
  registeredUserId: string | null
}

export async function syncContacts(
  currentUserId: string,
  contacts: { phoneNumber: string; countryCode?: string; name: string }[],
): Promise<{ success: boolean; added: number; updated: number; total: number }> {
  return requestJson('/api/contacts/sync', {
    method: 'POST',
    userId: currentUserId,
    body: JSON.stringify({ contacts }),
  })
}

export async function addContact(
  currentUserId: string,
  phoneNumber: string,
  countryCode: string,
  name: string,
): Promise<{ success: boolean; contact: ContactEntry }> {
  return requestJson('/api/contacts/add', {
    method: 'POST',
    userId: currentUserId,
    body: JSON.stringify({ phoneNumber, countryCode, name }),
  })
}

export async function getContacts(
  currentUserId: string,
  all?: boolean,
): Promise<ContactEntry[]> {
  const query = all ? '?all=true' : ''
  return requestJson<ContactEntry[]>(`/api/contacts${query}`, {
    method: 'GET',
    userId: currentUserId,
  })
}

export async function deleteContactApi(
  currentUserId: string,
  contactId: string,
): Promise<{ success: boolean }> {
  return requestJson(`/api/contacts/${contactId}`, {
    method: 'DELETE',
    userId: currentUserId,
  })
}
