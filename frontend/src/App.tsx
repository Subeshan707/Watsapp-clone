import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { Socket } from 'socket.io-client'
import LoginScreen from './components/LoginScreen'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import CallOverlay, { type CallViewState } from './components/CallOverlay'
import AddContactDialog from './components/AddContactDialog'
import { setupProfile, getAiBot, getMessages, getUsers, getContacts, addContact, syncContacts, type ContactEntry } from './lib/api'
import { createSocket } from './lib/socket'
import { playNotificationSound, playSentSound, playCallEndSound } from './lib/sounds'
import { ICE_SERVERS } from './config'
import type { Message, User } from './types'

const STORAGE_KEY = 'wa_user'

type Json = Record<string, unknown>

type CallType = 'audio' | 'video'

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false
  const maybe = value as Json
  return typeof maybe._id === 'string' && typeof maybe.username === 'string'
  // phoneNumber is optional for backward compatibility
}

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return existing
  const byId = new Map<string, Message>()
  for (const message of existing) byId.set(message._id, message)
  for (const message of incoming) byId.set(message._id, message)
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
}

function pinUserToTop(list: User[], pinnedId: string | null): User[] {
  if (!pinnedId) return list
  const idx = list.findIndex((u) => u._id === pinnedId)
  if (idx <= 0) return list
  const pinned = list[idx]
  return [pinned, ...list.slice(0, idx), ...list.slice(idx + 1)]
}

function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadStoredUser())
  const [users, setUsers] = useState<User[]>([])
  const [aiBotUserId, setAiBotUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [messagesByUserId, setMessagesByUserId] = useState<Record<string, Message[]>>({})
  const [unreadByUserId, setUnreadByUserId] = useState<Record<string, number>>({})
  const [call, setCall] = useState<CallViewState | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [contacts, setContacts] = useState<ContactEntry[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const currentUserRef = useRef<User | null>(currentUser)
  const selectedUserIdRef = useRef<string | null>(selectedUserId)
  const aiBotIdRef = useRef<string | null>(null)
  const callRef = useRef<CallViewState | null>(call)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const peerCallIdRef = useRef<string | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([])

  // Keep refs in sync
  useEffect(() => { currentUserRef.current = currentUser }, [currentUser])
  useEffect(() => { selectedUserIdRef.current = selectedUserId }, [selectedUserId])
  useEffect(() => { callRef.current = call }, [call])

  const selectedUser = useMemo(
    () => (selectedUserId ? users.find((u) => u._id === selectedUserId) ?? null : null),
    [users, selectedUserId],
  )

  const conversationMessages = useMemo(
    () => (selectedUserId ? messagesByUserId[selectedUserId] ?? [] : []),
    [messagesByUserId, selectedUserId],
  )

  const upsertUser = useCallback((user: User) => {
    setUsers((prev) => {
      const pinnedId = aiBotIdRef.current
      const exists = prev.some((u) => u._id === user._id)
      if (exists) return pinUserToTop(prev, pinnedId)

      if (!pinnedId) return [user, ...prev]
      if (user._id === pinnedId) return [user, ...prev]

      const pinned = prev.find((u) => u._id === pinnedId)
      if (!pinned) return [user, ...prev]
      const rest = prev.filter((u) => u._id !== pinnedId)
      return [pinned, user, ...rest]
    })
  }, [])

  const upsertMessage = useCallback((message: Message, isFromSelf: boolean = false) => {
    const user = currentUserRef.current
    if (!user) return

    const otherUser =
      message.sender._id === user._id ? message.receiver : message.sender
    upsertUser(otherUser)

    if (!isFromSelf) {
      const selectedId = selectedUserIdRef.current
      if (otherUser._id !== selectedId) {
        setUnreadByUserId((prev) => ({
          ...prev,
          [otherUser._id]: (prev[otherUser._id] ?? 0) + 1,
        }))
      }
    }

    setMessagesByUserId((prev) => {
      const otherId = otherUser._id
      const merged = mergeMessages(prev[otherId] ?? [], [message])
      return { ...prev, [otherId]: merged }
    })

    // Play sound: notification for incoming, blip for sent
    if (!isFromSelf) {
      playNotificationSound()
      // Browser notification if tab is not focused
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`${message.sender.username}`, {
          body: message.content,
          icon: '/favicon.svg',
          tag: message._id,
        })
      }
    } else {
      playSentSound()
    }
  }, [upsertUser])

  const mergeMessageUpdate = useCallback((message: Message) => {
    const user = currentUserRef.current
    if (!user) return

    const otherUser =
      message.sender._id === user._id ? message.receiver : message.sender
    upsertUser(otherUser)

    setMessagesByUserId((prev) => {
      const otherId = otherUser._id
      const merged = mergeMessages(prev[otherId] ?? [], [message])
      return { ...prev, [otherId]: merged }
    })
  }, [upsertUser])

  function stopStream(stream: MediaStream | null) {
    if (!stream) return
    for (const track of stream.getTracks()) {
      try {
        track.stop()
      } catch {
        // ignore
      }
    }
  }

  function cleanupPeerAndMedia() {
    try {
      peerRef.current?.close()
    } catch {
      // ignore
    }
    peerRef.current = null
    peerCallIdRef.current = null
    pendingIceRef.current = []

    stopStream(localStreamRef.current)
    stopStream(remoteStreamRef.current)
    localStreamRef.current = null
    remoteStreamRef.current = null

    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCameraOff(false)
  }

  function clearCallState() {
    setCall(null)
  }

  function ensurePeer(callId: string): RTCPeerConnection | null {
    const socket = socketRef.current
    if (!socket) return null

    if (peerRef.current && peerCallIdRef.current === callId) return peerRef.current

    try {
      peerRef.current?.close()
    } catch {
      // ignore
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerRef.current = pc
    peerCallIdRef.current = callId
    pendingIceRef.current = []

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtcIceCandidate', { callId, candidate: event.candidate })
      }
    }

    pc.ontrack = (event) => {
      const stream = event.streams?.[0]
      if (!stream) return
      remoteStreamRef.current = stream
      setRemoteStream(stream)
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') {
        setCall((prev) => (prev && prev.callId === callId ? { ...prev, phase: 'in-call' } : prev))
      }
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        // Best-effort: end call on server, then cleanup locally.
        socket.emit('endCall', { callId })
        cleanupPeerAndMedia()
        clearCallState()
      }
    }

    return pc
  }

  async function flushPendingIce(peer: RTCPeerConnection) {
    if (!peer.remoteDescription || !peer.remoteDescription.type) return
    const pending = pendingIceRef.current
    pendingIceRef.current = []
    for (const c of pending) {
      try {
        await peer.addIceCandidate(c)
      } catch {
        // ignore
      }
    }
  }

  async function getLocalMedia(type: CallType): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Your browser does not support audio/video calls. Please use a modern browser like Chrome or Firefox.')
    }

    const constraints: MediaStreamConstraints =
      type === 'video'
        ? { audio: true, video: { facingMode: 'user' } }
        : { audio: true, video: false }

    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      // If video call failed, try audio-only as fallback
      if (type === 'video') {
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        } catch {
          // fall through to friendly error below
        }
      }

      // Provide user-friendly error messages
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new Error(
          type === 'video'
            ? 'No microphone or camera found. Please connect a mic/camera and try again.'
            : 'No microphone found. Please connect a microphone and try again.',
        )
      }
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error('Microphone/camera permission was denied. Please allow access in your browser settings.')
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        throw new Error('Your microphone/camera is being used by another application. Please close it and try again.')
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to access microphone/camera')
    }
  }

  const startCall = useCallback(async (type: CallType) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    if (!selectedUser) return
    if (callRef.current) return

    setCall({
      callId: `pending_${Date.now()}`,
      type,
      phase: 'connecting',
      otherUser: selectedUser,
      isIncoming: false,
    })

    try {
      const stream = await getLocalMedia(type)
      localStreamRef.current = stream
      setLocalStream(stream)
      setMuted(false)
      setCameraOff(false)
    } catch (err) {
      setCall({
        callId: `error_${Date.now()}`,
        type,
        phase: 'error',
        otherUser: selectedUser,
        isIncoming: false,
        error: err instanceof Error ? err.message : 'Failed to access microphone/camera',
      })
      return
    }

    socket.emit('startCall', { calleeId: selectedUser._id, type }, (resp: { success?: boolean; callId?: string; error?: string }) => {
      if (resp?.callId) {
        setCall({
          callId: resp.callId,
          type,
          phase: 'outgoing',
          otherUser: selectedUser,
          isIncoming: false,
        })
      } else {
        stopStream(localStreamRef.current)
        localStreamRef.current = null
        setLocalStream(null)
        setCall({
          callId: `error_${Date.now()}`,
          type,
          phase: 'error',
          otherUser: selectedUser,
          isIncoming: false,
          error: resp?.error || 'Failed to start call',
        })
      }
    })
  }, [selectedUser])

  const cancelOutgoingCall = useCallback(() => {
    const c = callRef.current
    const socket = socketRef.current
    if (!c) return

    playCallEndSound()
    if (socket?.connected && !c.callId.startsWith('pending_') && !c.callId.startsWith('error_')) {
      socket.emit('cancelCall', { callId: c.callId })
    }
    cleanupPeerAndMedia()
    clearCallState()
  }, [])

  const declineIncomingCall = useCallback(() => {
    const c = callRef.current
    const socket = socketRef.current
    if (!c) return

    playCallEndSound()
    if (socket?.connected && !c.callId.startsWith('pending_') && !c.callId.startsWith('error_')) {
      socket.emit('answerCall', { callId: c.callId, accept: false })
    }
    cleanupPeerAndMedia()
    clearCallState()
  }, [])

  const hangupCall = useCallback(() => {
    const c = callRef.current
    const socket = socketRef.current
    if (!c) return

    playCallEndSound()
    if (socket?.connected && !c.callId.startsWith('pending_') && !c.callId.startsWith('error_')) {
      socket.emit('endCall', { callId: c.callId })
    }
    cleanupPeerAndMedia()
    clearCallState()
  }, [])

  const acceptIncomingCall = useCallback(async () => {
    const c = callRef.current
    const socket = socketRef.current
    if (!c || c.phase !== 'incoming') return
    if (!socket?.connected) return

    try {
      const stream = await getLocalMedia(c.type)
      localStreamRef.current = stream
      setLocalStream(stream)
      setMuted(false)
      setCameraOff(false)

      const peer = ensurePeer(c.callId)
      if (!peer) throw new Error('Failed to create peer connection')

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream)
      }

      setCall((prev) => (prev ? { ...prev, phase: 'connecting' } : prev))
      socket.emit('answerCall', { callId: c.callId, accept: true }, (resp: { success?: boolean; error?: string }) => {
        if (resp?.error) {
          setCall((prev) => (prev ? { ...prev, phase: 'error', error: resp.error } : prev))
        }
      })
    } catch (err) {
      setCall((prev) => (prev
        ? { ...prev, phase: 'error', error: err instanceof Error ? err.message : 'Failed to start call' }
        : prev))
    }
  }, [])

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !muted
    for (const t of stream.getAudioTracks()) t.enabled = !next
    setMuted(next)
  }, [muted])

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current
    if (!stream) return
    const next = !cameraOff
    for (const t of stream.getVideoTracks()) t.enabled = !next
    setCameraOff(next)
  }, [cameraOff])

  async function refreshUsers(userId: string) {
    setUsersLoading(true)
    try {
      let bot: User | null = null
      try {
        bot = await getAiBot(userId)
        aiBotIdRef.current = bot._id
        setAiBotUserId(bot._id)
      } catch {
        // ignore
        setAiBotUserId(null)
      }

      // Fetch saved contacts (for display names)
      try {
        const userContacts = await getContacts(userId, true)
        setContacts(userContacts)
      } catch {
        // ignore
      }

      // Show ALL registered users (like WhatsApp shows all contacts who have the app)
      const allUsers = await getUsers(userId)
      const merged = bot ? [bot, ...allUsers.filter((u) => u._id !== bot._id)] : allUsers
      setUsers(merged)
      setSelectedUserId((cur) => {
        if (!cur) return cur
        return merged.some((u) => u._id === cur) ? cur : null
      })
    } catch {
      // silently handle
    } finally {
      setUsersLoading(false)
    }
  }

  async function handleAddContact(phoneNumber: string, countryCode: string, name: string) {
    if (!currentUser) return
    await addContact(currentUser._id, phoneNumber, countryCode, name)
    await refreshUsers(currentUser._id)
    setShowAddContact(false)
    if (isMobileViewport()) {
      setSelectedUserId(null)
    }
  }

  async function handleSyncFromPhone() {
    if (!currentUser) return
    // Use Contact Picker API (Chrome Android)
    const nav = navigator as any
    if (!nav.contacts?.select) {
      throw new Error('Contact Picker API not supported in this browser. Please add contacts manually.')
    }
    const props = ['name', 'tel']
    const opts = { multiple: true }
    const selected = await nav.contacts.select(props, opts)
    if (!selected || selected.length === 0) return

    const parsed: { phoneNumber: string; countryCode?: string; name: string }[] = []
    for (const c of selected) {
      const name = c.name?.[0] || 'Unknown'
      const tels = c.tel || []
      for (const tel of tels) {
        const cleaned = tel.replace(/[\s\-()]/g, '')
        if (cleaned.length >= 6) {
          parsed.push({ phoneNumber: cleaned, name })
        }
      }
    }

    if (parsed.length === 0) throw new Error('No valid phone numbers found in selected contacts')

    await syncContacts(currentUser._id, parsed)
    await refreshUsers(currentUser._id)
    setShowAddContact(false)
    if (isMobileViewport()) {
      setSelectedUserId(null)
    }
  }

  async function openConversation(otherUserId: string) {
    if (!currentUser) return
    setSelectedUserId(otherUserId)
    setUnreadByUserId((prev) => {
      if (!prev[otherUserId]) return prev
      return { ...prev, [otherUserId]: 0 }
    })

    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit('markConversationRead', { otherUserId })
    }

    if (messagesByUserId[otherUserId]) return
    setMessagesLoading(true)
    try {
      const data = await getMessages(currentUser._id, otherUserId)
      setMessagesByUserId((prev) => ({
        ...prev,
        [otherUserId]: mergeMessages(prev[otherUserId] ?? [], data),
      }))
    } catch {
      // silently handle
    } finally {
      setMessagesLoading(false)
    }
  }

  async function handleLogin(phoneNumber: string, countryCode: string, username: string) {
    const user = await setupProfile(phoneNumber, countryCode, username)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setCurrentUser(user)
    setSelectedUserId(null)
    setMessagesByUserId({})
    setUnreadByUserId({})
    cleanupPeerAndMedia()
    clearCallState()
    // Request notification permission on login
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  function handleLogout() {
    hangupCall()
    aiBotIdRef.current = null
    setAiBotUserId(null)
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
    setUsers([])
    setSelectedUserId(null)
    setMessagesByUserId({})
    setUnreadByUserId({})
  }

  // Send message via Socket.IO with optimistic update (instant UI)
  async function handleSendMessage(content: string) {
    if (!currentUser || !selectedUserId) return
    const socket = socketRef.current
    if (!socket?.connected) return

    const receiverUser = users.find((u) => u._id === selectedUserId)
    if (!receiverUser) return

    // Optimistic: show message instantly with a temp ID
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const optimisticMsg: Message = {
      _id: tempId,
      sender: { _id: currentUser._id, username: currentUser.username },
      receiver: { _id: receiverUser._id, username: receiverUser.username },
      content,
      timestamp: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
    }

    // Add to UI immediately
    setMessagesByUserId((prev) => {
      const existing = prev[selectedUserId] ?? []
      return { ...prev, [selectedUserId]: [...existing, optimisticMsg] }
    })
    playSentSound()

    // Send to server in background (fire and forget, socket echo will reconcile)
    socket.emit('sendMessage', { receiverId: selectedUserId, content }, (response: { success?: boolean; message?: Message; error?: string }) => {
      if (response?.message) {
        // Replace temp message with real one from server
        setMessagesByUserId((prev) => {
          const msgs = prev[selectedUserId] ?? []
          const withoutTemp = msgs.filter((m) => m._id !== tempId)
          return { ...prev, [selectedUserId]: mergeMessages(withoutTemp, [response.message!]) }
        })
      }
    })
  }

  function handleDeleteMessage(messageId: string, scope: 'everyone' | 'me') {
    if (!currentUser) return
    const socket = socketRef.current
    if (!socket?.connected) return

    if (scope === 'me') {
      socket.emit('deleteMessageForMe', { messageId }, (_resp: { success?: boolean; error?: string }) => {
        // UI updates via the messageDeleted broadcast (to this user)
      })
      return
    }

    socket.emit('deleteMessage', { messageId }, (_resp: { success?: boolean; error?: string }) => {
      // UI updates via the messageDeleted broadcast (including for the sender)
    })
  }

  // Edit message (sender only)
  function handleEditMessage(messageId: string, newContent: string) {
    const socket = socketRef.current
    if (!socket?.connected) return
    if (!messageId || !newContent || newContent.trim() === '') return

    socket.emit('editMessage', { messageId, content: newContent }, (_resp: { success?: boolean; message?: Message; error?: string }) => {
      // server will emit 'messageUpdated' to reconcile; we don't need to update optimistically here
    })
  }

  // Fetch users on login
  useEffect(() => {
    if (!currentUser) return
    refreshUsers(currentUser._id)
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [currentUser])

  // Socket connection
  useEffect(() => {
    if (!currentUser) return

    const socket = createSocket(currentUser._id)
    socketRef.current = socket

    const onReceiveMessage = (message: Message) => {
      const user = currentUserRef.current
      // Only play notification for messages from others (not our own echo)
      const isFromSelf = user ? message.sender._id === user._id : false
      if (!isFromSelf) {
        upsertMessage(message, false)

        const selectedId = selectedUserIdRef.current
        if (!document.hidden && selectedId && message.sender._id === selectedId) {
          socket.emit('markConversationRead', { otherUserId: selectedId })
        }
      }
      // If it's our own message echoed back, we already added it via callback
    }

    const onMessageUpdated = (message: Message) => {
      mergeMessageUpdate(message)
    }

    const onMessageDeleted = (payload: { messageId: string; senderId: string; receiverId: string }) => {
      const user = currentUserRef.current
      if (!user) return

      const messageId = payload?.messageId
      const senderId = payload?.senderId
      const receiverId = payload?.receiverId
      if (!messageId || !senderId || !receiverId) return

      const otherUserId = senderId === user._id ? receiverId : senderId

      setMessagesByUserId((prev) => {
        const existing = prev[otherUserId] ?? []
        if (existing.length === 0) return prev

        const toDelete = existing.find((m) => m._id === messageId) || null
        const next = existing.filter((m) => m._id !== messageId)
        if (next.length === existing.length) return prev

        // If an unread incoming message gets deleted, decrement unread count.
        if (toDelete && toDelete.sender._id !== user._id && !toDelete.readAt) {
          const selectedId = selectedUserIdRef.current
          if (otherUserId !== selectedId) {
            setUnreadByUserId((uPrev) => {
              const cur = uPrev[otherUserId] ?? 0
              if (cur <= 0) return uPrev
              return { ...uPrev, [otherUserId]: cur - 1 }
            })
          }
        }

        return { ...prev, [otherUserId]: next }
      })
    }

    const onIncomingCall = (payload: { callId: string; from: User; type: CallType }) => {
      if (callRef.current) {
        socket.emit('answerCall', { callId: payload.callId, accept: false })
        return
      }
      upsertUser(payload.from)
      setCall({
        callId: payload.callId,
        type: payload.type,
        phase: 'incoming',
        otherUser: payload.from,
        isIncoming: true,
      })
    }

    const onCallAccepted = async (payload: { callId: string }) => {
      const c = callRef.current
      if (!c || c.isIncoming || c.callId !== payload.callId) return
      const stream = localStreamRef.current
      if (!stream) return

      setCall((prev) => (prev ? { ...prev, phase: 'connecting' } : prev))
      const peer = ensurePeer(payload.callId)
      if (!peer) return

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream)
      }

      try {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        socket.emit('webrtcOffer', { callId: payload.callId, sdp: peer.localDescription })
      } catch {
        setCall((prev) => (prev ? { ...prev, phase: 'error', error: 'Failed to create offer' } : prev))
      }
    }

    const onCallRejected = (payload: { callId: string }) => {
      const c = callRef.current
      if (!c || c.callId !== payload.callId) return
      playCallEndSound()
      cleanupPeerAndMedia()
      clearCallState()
    }

    const onCallCanceled = (payload: { callId: string }) => {
      const c = callRef.current
      if (!c || c.callId !== payload.callId) return
      playCallEndSound()
      cleanupPeerAndMedia()
      clearCallState()
    }

    const onCallEnded = (payload: { callId: string }) => {
      const c = callRef.current
      if (!c || c.callId !== payload.callId) return
      playCallEndSound()
      cleanupPeerAndMedia()
      clearCallState()
    }

    const onWebrtcOffer = async (payload: { callId: string; sdp: RTCSessionDescriptionInit }) => {
      const c = callRef.current
      if (!c || !c.isIncoming || c.callId !== payload.callId) return
      const peer = ensurePeer(payload.callId)
      if (!peer) return

      try {
        await peer.setRemoteDescription(payload.sdp)
        await flushPendingIce(peer)
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        socket.emit('webrtcAnswer', { callId: payload.callId, sdp: peer.localDescription })
      } catch {
        setCall((prev) => (prev ? { ...prev, phase: 'error', error: 'Failed to answer call' } : prev))
      }
    }

    const onWebrtcAnswer = async (payload: { callId: string; sdp: RTCSessionDescriptionInit }) => {
      const c = callRef.current
      if (!c || c.isIncoming || c.callId !== payload.callId) return
      const peer = peerRef.current
      if (!peer) return
      try {
        await peer.setRemoteDescription(payload.sdp)
        await flushPendingIce(peer)
      } catch {
        // ignore
      }
    }

    const onWebrtcIceCandidate = async (payload: { callId: string; candidate: RTCIceCandidateInit }) => {
      const c = callRef.current
      if (!c || c.callId !== payload.callId) return
      const peer = peerRef.current
      if (!peer) return

      if (peer.remoteDescription && peer.remoteDescription.type) {
        try {
          await peer.addIceCandidate(payload.candidate)
        } catch {
          // ignore
        }
      } else {
        pendingIceRef.current.push(payload.candidate)
      }
    }

    socket.on('receiveMessage', onReceiveMessage)
    socket.on('messageUpdated', onMessageUpdated)
    socket.on('messageDeleted', onMessageDeleted)
    socket.on('incomingCall', onIncomingCall)
    socket.on('callAccepted', onCallAccepted)
    socket.on('callRejected', onCallRejected)
    socket.on('callCanceled', onCallCanceled)
    socket.on('callEnded', onCallEnded)
    socket.on('webrtcOffer', onWebrtcOffer)
    socket.on('webrtcAnswer', onWebrtcAnswer)
    socket.on('webrtcIceCandidate', onWebrtcIceCandidate)

    return () => {
      socket.off('receiveMessage', onReceiveMessage)
      socket.off('messageUpdated', onMessageUpdated)
      socket.off('messageDeleted', onMessageDeleted)
      socket.off('incomingCall', onIncomingCall)
      socket.off('callAccepted', onCallAccepted)
      socket.off('callRejected', onCallRejected)
      socket.off('callCanceled', onCallCanceled)
      socket.off('callEnded', onCallEnded)
      socket.off('webrtcOffer', onWebrtcOffer)
      socket.off('webrtcAnswer', onWebrtcAnswer)
      socket.off('webrtcIceCandidate', onWebrtcIceCandidate)
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUser, upsertMessage, mergeMessageUpdate, upsertUser])

  // Login screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />
  }

  // Main chat layout
  return (
    <div className="h-screen w-screen bg-[#111b21] flex overflow-hidden">
      {/* Sidebar (mobile: list view, desktop: left panel) */}
      <div className={`h-full w-full md:w-[420px] md:shrink-0 ${selectedUserId ? 'hidden md:block' : 'block'}`}>
        <Sidebar
          currentUser={currentUser}
          users={users}
          contacts={contacts}
          aiBotUserId={aiBotUserId}
          selectedUserId={selectedUserId}
          messagesByUserId={messagesByUserId}
          unreadByUserId={unreadByUserId}
          loading={usersLoading}
          onSelectUser={openConversation}
          onRefresh={() => refreshUsers(currentUser._id)}
          onLogout={handleLogout}
          onAddContact={() => setShowAddContact(true)}
        />
      </div>

      {/* Chat view (mobile: only when selected, desktop: always) */}
      <div className={`h-full flex-1 ${selectedUserId ? 'flex' : 'hidden md:flex'}`}>
        <ChatWindow
          currentUser={currentUser}
          selectedUser={selectedUser}
          aiBotUserId={aiBotUserId}
          messages={conversationMessages}
          messagesLoading={messagesLoading}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onStartCall={startCall}
          onBack={() => setSelectedUserId(null)}
        />
      </div>

      {call && (
        <CallOverlay
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          muted={muted}
          cameraOff={cameraOff}
          onAccept={acceptIncomingCall}
          onDecline={declineIncomingCall}
          onCancel={cancelOutgoingCall}
          onHangup={hangupCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
        />
      )}

      <AddContactDialog
        open={showAddContact}
        defaultCountryCode={currentUser.countryCode || '+91'}
        onAdd={handleAddContact}
        onSyncFromPhone={handleSyncFromPhone}
        onClose={() => setShowAddContact(false)}
      />
    </div>
  )
}
