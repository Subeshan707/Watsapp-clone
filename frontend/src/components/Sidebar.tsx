import { useState } from 'react'
import type { User, Message } from '../types'

type Props = {
  currentUser: User
  users: User[]
  selectedUserId: string | null
  messagesByUserId: Record<string, Message[]>
  unreadByUserId: Record<string, number>
  loading: boolean
  onSelectUser: (userId: string) => void
  onRefresh: () => void
  onLogout: () => void
}

function getLastMessage(messages: Message[] | undefined): Message | null {
  if (!messages || messages.length === 0) return null
  return messages[messages.length - 1]
}

function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

const avatarColors = [
  'bg-[#00a884]', 'bg-[#53bdeb]', 'bg-[#7f66ff]',
  'bg-[#ff6b6b]', 'bg-[#ffa62b]', 'bg-[#02c39a]',
  'bg-[#e056a0]', 'bg-[#00b4d8]',
]

function getAvatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export default function Sidebar({
  currentUser, users, selectedUserId, messagesByUserId,
  unreadByUserId,
  loading, onSelectUser, onRefresh, onLogout,
}: Props) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <div className="w-full h-full flex flex-col bg-[#111b21] border-0 md:border-r md:border-[#2a3942]">
      {/* Header */}
      <div className="h-[60px] bg-[#202c33] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${getAvatarColor(currentUser._id)} flex items-center justify-center text-white font-semibold text-sm`}>
            {getInitial(currentUser.username)}
          </div>
          <span className="text-[#e9edef] text-sm font-medium">{currentUser.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="sidebar-refresh"
            onClick={onRefresh}
            disabled={loading}
            className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#aebac1] transition-colors disabled:opacity-50"
            title="Refresh users"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className={loading ? 'animate-spin' : ''}>
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </button>
          <button
            id="sidebar-logout"
            onClick={onLogout}
            className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#aebac1] transition-colors"
            title="Log out"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#111b21] shrink-0">
        <div className="flex items-center bg-[#202c33] rounded-lg px-3 py-1.5 gap-3">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="#8696a0">
            <path d="M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 001.256-3.386 5.207 5.207 0 10-5.207 5.208 5.183 5.183 0 003.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 110-7.21 3.605 3.605 0 010 7.21z"/>
          </svg>
          <input
            id="sidebar-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="bg-transparent text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none flex-1 py-1"
          />
        </div>
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#8696a0]">
            {users.length === 0
              ? 'No other users yet. Open another browser to create a second user.'
              : 'No matching users found.'}
          </div>
        ) : (
          filtered.map((user) => {
            const lastMsg = getLastMessage(messagesByUserId[user._id])
            const isSelected = user._id === selectedUserId
            const unreadCount = unreadByUserId[user._id] ?? 0
            return (
              <button
                key={user._id}
                id={`user-${user._id}`}
                type="button"
                onClick={() => onSelectUser(user._id)}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-[#202c33] transition-colors cursor-pointer border-b border-[#2a3942]/50 ${
                  isSelected ? 'bg-[#2a3942]' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-full ${getAvatarColor(user._id)} flex items-center justify-center text-white font-semibold text-lg shrink-0`}>
                  {getInitial(user.username)}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[#e9edef] text-base font-normal truncate">
                      {user.username}
                    </span>
                    {(lastMsg || (unreadCount > 0 && !isSelected)) && (
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        {lastMsg && (
                          <span className="text-xs text-[#8696a0]">
                            {formatTime(lastMsg.timestamp)}
                          </span>
                        )}
                        {unreadCount > 0 && !isSelected && (
                          <span className="mt-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00a884] text-[#111b21] text-xs leading-5 text-center font-medium">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-[#8696a0] truncate mt-0.5">
                    {lastMsg ? lastMsg.content : 'Start a conversation'}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
