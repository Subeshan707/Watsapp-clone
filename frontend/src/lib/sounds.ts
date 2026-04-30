// WhatsApp-style notification sound using Web Audio API
let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // First tone (higher pitch)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.12)
    gain1.gain.setValueAtTime(0.15, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.15)

    // Second tone (lower, slightly delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(660, now + 0.08)
    osc2.frequency.exponentialRampToValueAtTime(550, now + 0.22)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.25)
  } catch {
    // Audio not available, silently ignore
  }
}

export function playSentSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, now)
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.08)
  } catch {
    // Audio not available
  }
}

// --- Call sounds ---

type RingtoneHandle = {
  stop: () => void
}

/**
 * Plays a looping WhatsApp-style ringtone for incoming calls.
 * Returns a handle with a stop() method.
 */
export function playRingtone(): RingtoneHandle {
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentOscs: OscillatorNode[] = []

  function playBurst() {
    if (stopped) return
    try {
      const ctx = getAudioContext()
      const now = ctx.currentTime
      const oscs: OscillatorNode[] = []

      // WhatsApp-style two-tone ring: high-low-high pattern
      const notes = [
        { freq: 784, start: 0, dur: 0.15 },     // G5
        { freq: 659, start: 0.18, dur: 0.15 },   // E5
        { freq: 784, start: 0.36, dur: 0.15 },   // G5
        { freq: 880, start: 0.54, dur: 0.20 },   // A5
      ]

      for (const note of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(note.freq, now + note.start)
        gain.gain.setValueAtTime(0, now + note.start)
        gain.gain.linearRampToValueAtTime(0.12, now + note.start + 0.02)
        gain.gain.setValueAtTime(0.12, now + note.start + note.dur - 0.03)
        gain.gain.linearRampToValueAtTime(0.001, now + note.start + note.dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + note.start)
        osc.stop(now + note.start + note.dur)
        oscs.push(osc)
      }

      currentOscs = oscs

      // Repeat after pause
      timeoutId = setTimeout(playBurst, 1800)
    } catch {
      // ignore
    }
  }

  playBurst()

  return {
    stop() {
      stopped = true
      if (timeoutId != null) clearTimeout(timeoutId)
      for (const osc of currentOscs) {
        try { osc.stop() } catch { /* already stopped */ }
      }
      currentOscs = []
    },
  }
}

/**
 * Plays a looping outgoing call dialing tone (classic phone ring-back).
 * Returns a handle with a stop() method.
 */
export function playDialingTone(): RingtoneHandle {
  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let currentOsc: OscillatorNode | null = null

  function playTone() {
    if (stopped) return
    try {
      const ctx = getAudioContext()
      const now = ctx.currentTime

      // Standard ring-back tone: 440 Hz + 480 Hz (US standard)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.setValueAtTime(0.08, now + 1.8)
      gain.gain.linearRampToValueAtTime(0.001, now + 2.0)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 2.0)

      currentOsc = osc

      // 2s tone, 4s gap = 6s cycle (standard ring-back)
      timeoutId = setTimeout(playTone, 4000)
    } catch {
      // ignore
    }
  }

  playTone()

  return {
    stop() {
      stopped = true
      if (timeoutId != null) clearTimeout(timeoutId)
      try { currentOsc?.stop() } catch { /* already stopped */ }
      currentOsc = null
    },
  }
}

/**
 * Plays a short "call ended" beep.
 */
export function playCallEndSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(480, now)
    osc.frequency.setValueAtTime(400, now + 0.15)
    osc.frequency.setValueAtTime(350, now + 0.30)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.linearRampToValueAtTime(0.1, now + 0.35)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.5)
  } catch {
    // ignore
  }
}
