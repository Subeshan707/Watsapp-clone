import type { Message, User } from '../types'
import { API_BASE_URL } from '../config'

type Json = Record<string, unknown>

async function requestJson<T>(
  path: string,
  options: RequestInit & { userId?: string } = {},
): Promise<T> {
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
