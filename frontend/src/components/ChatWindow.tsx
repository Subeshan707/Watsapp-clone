import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type ChangeEvent } from 'react'
import type { User, Message } from '../types'
import aiBotAvatar from '../assets/ai-bot.png'
import EmojiPicker from 'emoji-picker-react'

function renderAttachment(attachment?: Message['attachment']) {
  if (!attachment) return null
  if (attachment.type === 'image') {
    return <img src={attachment.url} alt="attachment" className="max-w-full rounded-lg mb-1" style={{ maxHeight: '250px', objectFit: 'contain' }} />
  }
  if (attachment.type === 'video') {
    return <video src={attachment.url} controls className="max-w-full rounded-lg mb-1" style={{ maxHeight: '250px' }} />
  }
  if (attachment.type === 'audio') {
    return <audio src={attachment.url} controls className="w-[240px] mb-1" />
  }
  return (
    <a href={attachment.url} download={attachment.name} className="flex items-center gap-2 p-3 bg-black/20 rounded-lg mb-1 text-[#e9edef] hover:bg-black/30 transition-colors">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
      <div className="flex flex-col min-w-0">
        <span className="truncate text-sm font-medium">{attachment.name || 'Document'}</span>
        <span className="text-xs text-[#8696a0]">{(attachment.size ? (attachment.size / 1024).toFixed(1) + ' KB' : '')}</span>
      </div>
    </a>
  )
}

type Props = {
  currentUser: User
  selectedUser: User | null
  aiBotUserId: string | null
  messages: Message[]
  messagesLoading: boolean
  onSendMessage: (content: string) => Promise<void>
  onDeleteMessage: (messageId: string, scope: 'everyone' | 'me') => void
  onEditMessage?: (messageId: string, content: string) => void
  onStartCall: (type: 'audio' | 'video') => void
  onBack?: () => void
}

type ContextMenuState = {
  messageId: string
  text: string
  canDelete: boolean
  deleteScope: 'everyone' | 'me'
  x: number
  y: number
} | null

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDateLabel(iso: string): string {
  try {
    const date = new Date(iso)
    const now = new Date()
    if (date.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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

function groupMessagesByDate(messages: Message[]): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const d = new Date(msg.timestamp).toDateString()
    if (d !== currentDate) {
      currentDate = d
      groups.push({ date: msg.timestamp, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

function renderBoldEmphasis(text: string) {
  const out: ReactNode[] = []
  let idx = 0
  let key = 0

  while (idx < text.length) {
    const start = text.indexOf('**', idx)
    if (start === -1) {
      out.push(text.slice(idx))
      break
    }

    const end = text.indexOf('**', start + 2)
    if (end === -1) {
      out.push(text.slice(idx))
      break
    }

    if (start > idx) out.push(text.slice(idx, start))
    const boldText = text.slice(start + 2, end)
    out.push(
      <strong key={`b_${key++}`} className="font-semibold">
        {boldText}
      </strong>,
    )
    idx = end + 2
  }

  return out
}

export default function ChatWindow({ currentUser, selectedUser, aiBotUserId, messages, messagesLoading, onSendMessage, onDeleteMessage, onEditMessage, onStartCall, onBack }: Props) {
  const [draft, setDraft] = useState('')
  const [sending] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedUser?._id])

  useEffect(() => {
    if (selectedUser) inputRef.current?.focus()
  }, [selectedUser?._id])

  useEffect(() => {
    setContextMenu(null)
  }, [selectedUser?._id])

  useEffect(() => {
    if (!contextMenu) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [contextMenu])

  function openContextMenu(e: ReactMouseEvent, message: Message, deleteScope: 'everyone' | 'me') {
    e.preventDefault()

    const menuWidth = 160
    const canDelete = !message._id.startsWith('temp_')
    const menuHeight = canDelete ? 88 : 44
    const padding = 8
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - padding)
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - padding)
    setContextMenu({ messageId: message._id, text: message.content, canDelete, deleteScope, x, y })
  }

  function handleMessagesContextMenuCapture(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault()

    const target = e.target as Element | null
    if (!target) return

    const msgEl = target.closest('[data-message-id]') as HTMLElement | null
    if (!msgEl) return

    const messageId = msgEl.getAttribute('data-message-id')
    if (!messageId) return

    const message = messages.find((m) => m._id === messageId)
    if (!message) return

    const isMine = message.sender._id === currentUser._id
    const deleteScope: 'everyone' | 'me' = isMine ? 'everyone' : 'me'
    openContextMenu(e, message, deleteScope)
  }

  async function copyToClipboard(text: string) {
    const value = String(text)

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        return
      }
    } catch {
      // fall through
    }

    try {
      const ta = document.createElement('textarea')
      ta.value = value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      // ignore
    }
  }

  function handleSend(e?: React.SyntheticEvent) {
    if (e) e.preventDefault()
    const content = draft.trim()
    if (!content || !selectedUser) return
    // If editing, call edit handler instead
    if (editingMessageId) {
      setDraft('')
      const id = editingMessageId
      setEditingMessageId(null)
      if (typeof onEditMessage === 'function') onEditMessage(id, content)
      inputRef.current?.focus()
      return
    }

    setDraft('')
    onSendMessage(content)
    inputRef.current?.focus()
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        if (audioChunksRef.current.length > 0) {
          const reader = new FileReader()
          reader.onloadend = () => {
            const dataUrl = reader.result as string
            onSendMessage('', { url: dataUrl, type: 'audio', mimeType: 'audio/webm', size: blob.size })
          }
          reader.readAsDataURL(blob)
        }
        setRecording(false)
        setRecordingDuration(0)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }

      recorder.start()
      setRecording(true)
      setRecordingDuration(0)
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1)
      }, 1000)
    } catch (err) {
      console.error('Failed to start recording', err)
      alert('Could not access microphone.')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    setRecordingDuration(0)
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      alert('File size limit is 15MB')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      let type: 'image' | 'video' | 'audio' | 'document' = 'document'
      if (file.type.startsWith('image/')) type = 'image'
      else if (file.type.startsWith('video/')) type = 'video'
      else if (file.type.startsWith('audio/')) type = 'audio'

      onSendMessage('', { url: dataUrl, type, name: file.name, size: file.size, mimeType: file.type })
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Empty state — no chat selected
  if (!selectedUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35] border-b-[6px] border-[#00a884]">
        <div className="text-center max-w-md px-8">
          <div className="w-[320px] h-[188px] mx-auto mb-8 flex items-center justify-center">
            <svg viewBox="0 0 303 172" width="303" height="172" className="opacity-30">
              <path fill="#364147" d="M229.565 160.229c32.647-10.984 57.366-41.988 53.825-86.81-5.381-68.1-71.025-84.95-111.918-64.932-40.893 20.017-78.238 10.753-95.46 28.366C55.92 57.076 45.607 80.694 52.57 103.563c8.753 28.769 49.089 72.506 124.166 56.404l52.829.262z"/>
              <path fill="#4A5B64" d="M131.589 68.942a4.584 4.584 0 110-9.168 4.584 4.584 0 010 9.168zM151.5 68.942a4.584 4.584 0 110-9.168 4.584 4.584 0 010 9.168zM171.5 68.942a4.584 4.584 0 110-9.168 4.584 4.584 0 010 9.168z"/>
            </svg>
          </div>
          <h2 className="text-[32px] font-light text-[#e9edef] mb-3 tracking-tight">WhatsApp Web</h2>
          <p className="text-sm text-[#8696a0] leading-relaxed mb-8">
            Send and receive messages in real-time. Select a conversation from the sidebar to get started.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-[#8696a0]">
            <svg viewBox="0 0 10 12" width="10" height="12" fill="currentColor">
              <path d="M5.968 0H4.032L0 4.031V5.97l1.398-1.399v5.4c0 1.12.907 2.028 2.028 2.028h3.148a2.028 2.028 0 002.028-2.028v-5.4L10 5.97V4.032L5.968 0z"/>
            </svg>
            End-to-end encrypted
          </div>
        </div>
      </div>
    )
  }

  const dateGroups = groupMessagesByDate(messages)
  const isAiChat = Boolean(aiBotUserId && selectedUser._id === aiBotUserId)

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b141a]">
      {/* Chat header */}
      <div className="h-[60px] bg-[#202c33] flex items-center px-4 gap-2 md:gap-3 shrink-0 shadow-sm">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#aebac1] transition-colors shrink-0"
            title="Back"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M14.7 6.3a1 1 0 010 1.4L10.41 12l4.3 4.3a1 1 0 01-1.42 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.41 0z" />
            </svg>
          </button>
        )}
        <div className={`w-10 h-10 rounded-full ${isAiChat ? 'bg-[#2a3942]' : getAvatarColor(selectedUser._id)} flex items-center justify-center text-white font-semibold text-sm shrink-0 overflow-hidden`}>
          {isAiChat ? (
            <img src={aiBotAvatar} alt="AI" className="w-full h-full object-cover" />
          ) : (
            getInitial(selectedUser.username)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[#e9edef] text-base font-normal truncate">{selectedUser.username}</div>
          <div className="text-xs text-[#8696a0]">online</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            id="audio-call"
            onClick={() => onStartCall('audio')}
            className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#aebac1] transition-colors cursor-pointer relative z-10"
            title="Audio call"
          >
            <svg className="pointer-events-none" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
            </svg>
          </button>
          <button
            type="button"
            id="video-call"
            onClick={() => onStartCall('video')}
            className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#aebac1] transition-colors cursor-pointer relative z-10"
            title="Video call"
          >
            <svg className="pointer-events-none" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M17 10.5V6c0-1.1-.9-2-2-2H3C1.9 4 1 4.9 1 6v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4.5l4 4v-11l-4 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area with WhatsApp wallpaper pattern */}
      <div
        className="flex-1 overflow-y-auto px-3 md:px-[6%] py-3 relative"
        onContextMenuCapture={handleMessagesContextMenuCapture}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23111b21' fill-opacity='0.6'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundColor: '#0b141a',
        }}
      >
        {messagesLoading && (
          <div className="flex justify-center py-4">
            <div className="bg-[#1f2c33] px-4 py-2 rounded-lg text-sm text-[#8696a0] shadow-lg">
              Loading messages…
            </div>
          </div>
        )}

        {!messagesLoading && messages.length === 0 && (
          <div className="flex justify-center py-4">
            <div className="bg-[#1f2c33]/90 backdrop-blur-sm px-5 py-2.5 rounded-lg text-sm text-[#ffd279] shadow-lg flex items-center gap-2">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 107 7A7.008 7.008 0 008 1zm0 12.8A5.8 5.8 0 1113.8 8 5.806 5.806 0 018 13.8zM7.4 4.6h1.2V9H7.4zm0 5.6h1.2v1.2H7.4z"/>
              </svg>
              Messages are end-to-end encrypted. Say hello to start the conversation.
            </div>
          </div>
        )}

        {dateGroups.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex justify-center my-3">
              <div className="bg-[#182229] px-3 py-1 rounded-lg text-xs text-[#8696a0] shadow-md uppercase tracking-wide">
                {formatDateLabel(group.date)}
              </div>
            </div>

            {/* Messages */}
            {group.messages.map((m) => {
              const isMine = m.sender._id === currentUser._id
              const isRead = Boolean(m.readAt)
              const isDelivered = Boolean(m.deliveredAt)
              const deleteScope: 'everyone' | 'me' = isMine ? 'everyone' : 'me'
              return (
                <div key={m._id} className={`flex mb-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    data-message-id={m._id}
                    onContextMenu={(e) => openContextMenu(e, m, deleteScope)}
                    className={`max-w-[85%] md:max-w-[65%] rounded-lg px-2.5 py-1.5 shadow-md relative ${
                      isMine
                        ? 'bg-[#005c4b] text-[#e9edef]'
                        : 'bg-[#202c33] text-[#e9edef]'
                    }`}
                    style={{
                      borderTopLeftRadius: isMine ? '8px' : '0px',
                      borderTopRightRadius: isMine ? '0px' : '8px',
                    }}
                  >
                    <div className="grid grid-cols-[1fr_auto] items-end gap-x-2">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words min-w-0">
                        {renderAttachment(m.attachment)}
                        {m.content && renderBoldEmphasis(m.content)}
                      </div>
                      <div
                        className={`flex items-center gap-1 whitespace-nowrap ${
                          isMine ? 'text-[#ffffff99]' : 'text-[#ffffff66]'
                        }`}
                      >
                        <span className="text-[11px] leading-none">{formatTime(m.timestamp)}</span>
                        {isMine && (
                            <div className="flex items-center">
                          <svg
                            viewBox="0 0 16 11"
                            width="16"
                            height="11"
                            fill="currentColor"
                            className={isRead ? 'text-[#53bdeb]' : 'text-[#ffffff99]'}
                          >
                            <path d="M11.071.653a.457.457 0 00-.304-.102.493.493 0 00-.381.178l-6.19 7.636-2.011-2.095a.46.46 0 00-.327-.14.464.464 0 00-.336.156.477.477 0 00-.014.658l2.357 2.46a.454.454 0 00.312.15h.036a.467.467 0 00.34-.178l6.514-8.03a.45.45 0 00.004-.653z"/>
                            {(isDelivered || isRead) && (
                              <path d="M14.757.653a.457.457 0 00-.305-.102.493.493 0 00-.38.178l-6.19 7.636-0.613-.637.693.699 0-.001-0.072.089a.467.467 0 00.34-.178l6.514-8.03a.45.45 0 00.013-.654z"/>
                            )}
                          </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu(null)
            }}
          />
          <div
            className="fixed z-50 bg-[#202c33] border border-[#2a3942] rounded-lg overflow-hidden shadow-lg"
            style={{ top: contextMenu.y, left: contextMenu.x, width: '160px' }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                copyToClipboard(contextMenu.text)
                setContextMenu(null)
              }}
              className="w-full text-left px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
            >
              Copy
            </button>

            {/* Edit (only for user's own messages) */}
            {contextMenu.canDelete && (
              <button
                type="button"
                onClick={() => {
                  // Start editing: populate input with message text
                  setDraft(contextMenu.text)
                  setEditingMessageId(contextMenu.messageId)
                  setContextMenu(null)
                  // focus input next tick
                  setTimeout(() => inputRef.current?.focus(), 0)
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                Edit
              </button>
            )}

            {contextMenu.canDelete && (
              <button
                type="button"
                onClick={() => {
                  onDeleteMessage(contextMenu.messageId, contextMenu.deleteScope)
                  setContextMenu(null)
                }}
                className="w-full text-left px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}

      {/* Message input */}
      <div className="bg-[#202c33] px-4 py-2.5 shrink-0 relative z-20">
        {showEmojiPicker && (
          <div className="absolute bottom-[calc(100%+8px)] left-4 z-50 shadow-xl rounded-lg overflow-hidden">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                setDraft(d => d + emojiData.emoji)
                inputRef.current?.focus()
              }}
              theme="dark"
            />
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Emoji button */}
          <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center transition-colors shrink-0 cursor-pointer ${showEmojiPicker ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
            <svg className="pointer-events-none" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm5.694 0c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zM12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1.108-4.114c-1.263-.282-2.37-1.146-2.956-2.356-.095-.196-.31-.298-.513-.24a.476.476 0 00-.322.465c.052.937.418 1.856 1.048 2.583a5.023 5.023 0 002.286 1.543c.354.117.728.176 1.11.176h.91c.382 0 .755-.059 1.11-.176a5.018 5.018 0 002.286-1.543 4.94 4.94 0 001.047-2.583.476.476 0 00-.322-.465c-.203-.058-.418.044-.513.24-.587 1.21-1.693 2.074-2.956 2.356a4.196 4.196 0 01-1.215 0z"/>
            </svg>
          </button>

          {/* Attachment button */}
          <label className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] transition-colors shrink-0 cursor-pointer m-0">
            <svg className="pointer-events-none" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 003.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.111-.589 1.543l-9.547 9.549a3.97 3.97 0 01-2.829 1.171 3.975 3.975 0 01-2.83-1.171 3.973 3.973 0 01-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.606.606 0 00-.86.001l-7.21 7.209c-1.062 1.062-1.646 2.472-1.646 3.973l.032.013z"/>
            </svg>
            <input type="file" onChange={handleFileChange} className="hidden" />
          </label>

          {/* Text input or Recording UI */}
          {recording ? (
            <div className="flex-1 flex items-center gap-3 bg-[#2a3942] rounded-lg px-4 py-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-[#e9edef] text-sm shrink-0">
                {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
              <div className="flex-1" />
              <button type="button" onClick={cancelRecording} className="text-[#8696a0] hover:text-red-400 text-sm font-medium transition-colors shrink-0">Cancel</button>
            </div>
          ) : (
            <input
              ref={inputRef}
              id="message-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={sending}
              placeholder="Type a message"
              className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2.5 text-sm text-[#d1d7db] placeholder:text-[#8696a0] outline-none min-w-0"
            />
          )}

          {/* Send button or Mic button */}
          {draft.trim() || recording ? (
            <button
              id="send-button"
              type="button"
              onClick={recording ? stopRecording : handleSend}
              disabled={sending}
              className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] flex items-center justify-center text-white transition-colors shrink-0 cursor-pointer"
            >
              <svg className="pointer-events-none" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/>
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] transition-colors shrink-0 cursor-pointer"
            >
              <svg className="pointer-events-none" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M11.999 14.942c2.001 0 3.531-1.53 3.531-3.531V4.35c0-2.001-1.53-3.531-3.531-3.531S8.468 2.349 8.468 4.35v7.061c0 2.001 1.53 3.531 3.531 3.531zm6.238-3.531c0 3.531-2.942 6.002-6.238 6.002s-6.238-2.471-6.238-6.002H3.761c0 4.001 3.178 7.297 7.061 7.885v3.884h2.354v-3.884c3.884-.588 7.061-3.884 7.061-7.885h-2z"/>
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
