import { useEffect, useRef, useState, useCallback } from 'react'
import type { User } from '../types'
import { playRingtone, playDialingTone, playCallEndSound } from '../lib/sounds'

type CallType = 'audio' | 'video'
type CallPhase = 'incoming' | 'outgoing' | 'connecting' | 'in-call' | 'error'

export type CallViewState = {
  callId: string
  type: CallType
  phase: CallPhase
  otherUser: User
  isIncoming: boolean
  error?: string
}

type Props = {
  call: CallViewState
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  muted: boolean
  cameraOff: boolean
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
  onHangup: () => void
  onToggleMute: () => void
  onToggleCamera: () => void
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

const avatarGradients = [
  'linear-gradient(135deg, #00a884, #025144)',
  'linear-gradient(135deg, #53bdeb, #1a6985)',
  'linear-gradient(135deg, #7f66ff, #3d2d80)',
  'linear-gradient(135deg, #ff6b6b, #993333)',
  'linear-gradient(135deg, #ffa62b, #995f10)',
  'linear-gradient(135deg, #02c39a, #016b54)',
  'linear-gradient(135deg, #e056a0, #7a2d56)',
  'linear-gradient(135deg, #00b4d8, #006880)',
]

function getGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return avatarGradients[Math.abs(hash) % avatarGradients.length]
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// --- Icons as components ---
const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
)

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.55-.9l4.18 4.18L21 19.73 4.27 3z"/>
  </svg>
)

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
)

const CameraOffIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
  </svg>
)

const EndCallIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
  </svg>
)

const AcceptCallIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
  </svg>
)

const DeclineCallIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" style={{ transform: 'rotate(135deg)' }}>
    <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z"/>
  </svg>
)

export default function CallOverlay({
  call, localStream, remoteStream, muted, cameraOff,
  onAccept, onDecline, onCancel, onHangup, onToggleMute, onToggleCamera,
}: Props) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPhaseRef = useRef<CallPhase>(call.phase)

  // Attach streams to video/audio elements
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream
  }, [localStream, remoteStream])

  // Call timer
  useEffect(() => {
    if (call.phase === 'in-call') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [call.phase])

  // Ringtone / dialing tone
  useEffect(() => {
    if (call.phase === 'incoming') {
      const handle = playRingtone()
      return () => handle.stop()
    }
    if (call.phase === 'outgoing') {
      const handle = playDialingTone()
      return () => handle.stop()
    }
  }, [call.phase])

  // Call end sound
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = call.phase
    if ((prev === 'in-call' || prev === 'connecting') && (call.phase === 'error')) {
      playCallEndSound()
    }
  }, [call.phase])

  const handleEndCall = useCallback(() => {
    playCallEndSound()
    if (call.phase === 'incoming') onDecline()
    else if (call.phase === 'outgoing' || call.phase === 'error') onCancel()
    else onHangup()
  }, [call.phase, onDecline, onCancel, onHangup])

  const statusText = (() => {
    switch (call.phase) {
      case 'incoming': return call.type === 'video' ? 'Incoming video call…' : 'Incoming voice call…'
      case 'outgoing': return 'Ringing…'
      case 'connecting': return 'Connecting…'
      case 'in-call': return formatDuration(elapsed)
      case 'error': return call.error || 'Call failed'
    }
  })()

  const isVideo = call.type === 'video'
  const showControls = call.phase === 'connecting' || call.phase === 'in-call'
  const hasRemoteVideo = isVideo && remoteStream && remoteStream.getVideoTracks().length > 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(180deg, #1a2a32 0%, #0b141a 100%)' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-2 text-[#8696a0] text-xs">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 1a7 7 0 107 7A7 7 0 008 1zm0 12.8A5.8 5.8 0 1113.8 8 5.8 5.8 0 018 13.8zM7.4 4.6h1.2V9H7.4zm0 5.6h1.2v1.2H7.4z"/></svg>
          End-to-end encrypted
        </div>
        <button type="button" onClick={handleEndCall} className="text-[#aebac1] hover:text-white transition-colors p-1">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden min-h-0">
        {isVideo && hasRemoteVideo ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%)' }} />
            {/* Local PiP */}
            <video
              ref={localVideoRef} autoPlay playsInline muted
              className="absolute top-4 right-4 rounded-xl shadow-2xl border-2 border-white/20 z-10"
              style={{ width: '140px', aspectRatio: '3/4', objectFit: 'cover' }}
            />
            {/* Name + status overlay at top */}
            <div className="absolute top-4 left-4 z-10">
              <div className="text-white text-lg font-medium drop-shadow-lg">{call.otherUser.username}</div>
              <div className="text-white/70 text-sm drop-shadow-md">{statusText}</div>
            </div>
          </>
        ) : isVideo && !hasRemoteVideo ? (
          <>
            {localStream && <video ref={localVideoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md" />}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-28 h-28 rounded-full flex items-center justify-center text-white text-5xl font-semibold shadow-2xl" style={{ background: getGradient(call.otherUser._id) }}>
                  {getInitial(call.otherUser.username)}
                </div>
                {(call.phase === 'outgoing' || call.phase === 'incoming') && (
                  <>
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: getGradient(call.otherUser._id) }} />
                    <div className="absolute -inset-3 rounded-full animate-pulse opacity-10 border-2 border-white" />
                  </>
                )}
              </div>
              <div className="text-center mt-2">
                <div className="text-white text-2xl font-light">{call.otherUser.username}</div>
                <div className="text-[#8696a0] text-sm mt-1">{statusText}</div>
              </div>
            </div>
            <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
          </>
        ) : (
          <>
            {/* Audio call UI */}
            <audio ref={remoteAudioRef} autoPlay />
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full flex items-center justify-center text-white text-6xl font-semibold shadow-2xl" style={{ background: getGradient(call.otherUser._id) }}>
                  {getInitial(call.otherUser.username)}
                </div>
                {(call.phase === 'outgoing' || call.phase === 'incoming') && (
                  <>
                    <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: getGradient(call.otherUser._id) }} />
                    <div className="absolute -inset-4 rounded-full animate-pulse opacity-10 border-2 border-white" />
                  </>
                )}
              </div>
              <div className="text-center mt-3">
                <div className="text-white text-2xl font-light tracking-wide">{call.otherUser.username}</div>
                <div className={`text-sm mt-1.5 ${call.phase === 'in-call' ? 'text-[#00a884]' : 'text-[#8696a0]'}`}>
                  {statusText}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error banner */}
        {call.phase === 'error' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-[#1f2c33]/95 backdrop-blur-md px-5 py-2.5 rounded-xl text-sm text-[#ffd279] shadow-xl border border-[#2a3942]">
              {call.error || 'Call failed'}
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="shrink-0 pb-8 pt-4 px-6" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)' }}>
        {call.phase === 'incoming' ? (
          <div className="flex items-center justify-center gap-16">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={() => { playCallEndSound(); onDecline() }}
                className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:bg-[#ff5549] transition-all active:scale-95">
                <DeclineCallIcon />
              </button>
              <span className="text-[#8696a0] text-xs">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={onAccept}
                className="w-16 h-16 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-lg shadow-green-500/30 hover:bg-[#06cf9c] transition-all active:scale-95 animate-pulse">
                <AcceptCallIcon />
              </button>
              <span className="text-[#8696a0] text-xs">Accept</span>
            </div>
          </div>
        ) : call.phase === 'outgoing' ? (
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:bg-[#ff5549] transition-all active:scale-95">
                <EndCallIcon />
              </button>
              <span className="text-[#8696a0] text-xs">Cancel</span>
            </div>
          </div>
        ) : call.phase === 'error' ? (
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-[#2a3942] flex items-center justify-center text-white shadow-lg hover:bg-[#3a4f5c] transition-all active:scale-95">
                <EndCallIcon />
              </button>
              <span className="text-[#8696a0] text-xs">Close</span>
            </div>
          </div>
        ) : showControls ? (
          <div className="flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={onToggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${muted ? 'bg-white text-[#111b21]' : 'bg-[#2a3942] text-white hover:bg-[#3a4f5c]'}`}>
                {muted ? <MicOffIcon /> : <MicIcon />}
              </button>
              <span className="text-[#8696a0] text-xs">{muted ? 'Unmute' : 'Mute'}</span>
            </div>
            {isVideo && (
              <div className="flex flex-col items-center gap-2">
                <button type="button" onClick={onToggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 ${cameraOff ? 'bg-white text-[#111b21]' : 'bg-[#2a3942] text-white hover:bg-[#3a4f5c]'}`}>
                  {cameraOff ? <CameraOffIcon /> : <CameraIcon />}
                </button>
                <span className="text-[#8696a0] text-xs">{cameraOff ? 'Camera on' : 'Camera off'}</span>
              </div>
            )}
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={handleEndCall}
                className="w-16 h-16 rounded-full bg-[#ff3b30] flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:bg-[#ff5549] transition-all active:scale-95">
                <EndCallIcon />
              </button>
              <span className="text-[#8696a0] text-xs">End</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
