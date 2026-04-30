import { useState, useEffect, useRef, type FormEvent } from 'react'

type Step = 'phone' | 'otp' | 'profile'

type Props = {
  onLogin: (phoneNumber: string, countryCode: string, username: string) => Promise<void>
}

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
]

export default function LoginScreen({ onLogin }: Props) {
  const [step, setStep] = useState<Step>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [showDropdown, setShowDropdown] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [demoOtp, setDemoOtp] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendTimer, setResendTimer] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0]

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000)
    return () => clearTimeout(t)
  }, [resendTimer])

  // Auto-focus
  useEffect(() => {
    if (step === 'phone') phoneRef.current?.focus()
    if (step === 'otp') otpRefs.current[0]?.focus()
    if (step === 'profile') nameRef.current?.focus()
  }, [step])

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    const cleaned = phoneNumber.replace(/\D/g, '')
    if (cleaned.length < 6 || cleaned.length > 15) {
      setError('Please enter a valid phone number')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { sendOtp } = await import('../lib/api')
      const resp = await sendOtp(cleaned, countryCode)
      if (resp.otp) setDemoOtp(resp.otp)
      setStep('otp')
      setOtp(['', '', '', '', '', ''])
      setResendTimer(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) value = value.slice(-1)
    if (value && !/^\d$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...otp]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ''
    setOtp(next)
    const focusIdx = Math.min(pasted.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { verifyOtp } = await import('../lib/api')
      const cleaned = phoneNumber.replace(/\D/g, '')
      const resp = await verifyOtp(cleaned, countryCode, code)
      if (resp.isNewUser) {
        setStep('profile')
      } else if (resp._id && resp.username) {
        await onLogin(cleaned, countryCode, resp.username)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleSetupProfile(e: FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Please enter your name')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const cleaned = phoneNumber.replace(/\D/g, '')
      await onLogin(cleaned, countryCode, trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (resendTimer > 0) return
    setError(null)
    setLoading(true)
    try {
      const { sendOtp } = await import('../lib/api')
      const cleaned = phoneNumber.replace(/\D/g, '')
      const resp = await sendOtp(cleaned, countryCode)
      if (resp.otp) setDemoOtp(resp.otp)
      setOtp(['', '', '', '', '', ''])
      setResendTimer(30)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend')
    } finally {
      setLoading(false)
    }
  }

  // WhatsApp logo SVG
  const logo = (
    <svg viewBox="0 0 39 39" width="48" height="48" fill="#00a884">
      <path d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.5 5.5 5.7-1.5z" />
      <path fill="#111b21" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9zM19.5 34.6c-2.7 0-5.4-.7-7.7-2.1l-.6-.3-5.8 1.5L6.9 28l-.4-.6c-4.4-7.1-2.3-16.5 4.9-20.9s16.5-2.3 20.9 4.9 2.3 16.5-4.9 20.9c-2.3 1.5-5.1 2.3-7.9 2.3zm8.8-11.1l-1.1-.5s-1.6-.7-2.6-1.2c-.1 0-.2-.1-.3-.1-.3 0-.5.1-.7.3 0 0-.1.1-1.5 1.7-.1.2-.3.3-.5.3h-.1c-.1 0-.3-.1-.4-.2l-.5-.2c-1.1-.5-2.1-1.1-2.9-1.9-.2-.2-.5-.4-.7-.6-.7-.7-1.4-1.5-1.9-2.4l-.1-.2c-.1-.1-.1-.2-.2-.4 0-.2 0-.4.1-.5 0 0 .4-.5.7-.8.2-.2.3-.5.5-.7.2-.3.3-.7.2-1-.1-.5-1.3-3.2-1.6-3.8-.2-.3-.4-.4-.7-.5h-1.1c-.2 0-.4.1-.6.1l-.1.1c-.2.1-.4.3-.6.4-.2.2-.3.4-.5.6-.7.9-1.1 2-1.1 3.1 0 .8.2 1.6.5 2.3l.1.3c.9 1.9 2.1 3.6 3.7 5.1l.4.4c.3.3.6.5.8.8 2.1 1.8 4.5 3.1 7.2 3.8.3.1.7.1 1 .2h1c.5 0 1.1-.2 1.5-.4.3-.2.5-.2.7-.4l.2-.2c.2-.2.4-.3.6-.5s.3-.4.5-.6c.2-.4.3-.9.4-1.4v-.7s-.1-.1-.3-.2z" />
    </svg>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111b21] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-[#00a884]" />

      <div className="relative z-10 w-full max-w-[460px] mx-4">
        <div className="bg-[#1f2c33] rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-10 pt-10 pb-4 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#00a884]/20 flex items-center justify-center">
              {logo}
            </div>
            <h1 className="text-2xl font-light text-[#e9edef] tracking-tight mb-1">
              {step === 'phone' && 'Enter your phone number'}
              {step === 'otp' && 'Verify your number'}
              {step === 'profile' && 'Profile info'}
            </h1>
            <p className="text-sm text-[#8696a0] leading-relaxed">
              {step === 'phone' && 'WhatsApp will need to verify your phone number.'}
              {step === 'otp' && (
                <>
                  We've sent an SMS with a code to<br />
                  <span className="text-[#e9edef] font-medium">{countryCode} {phoneNumber}</span>
                  {demoOtp && (
                    <span className="block mt-2 text-[#00a884] text-xs font-mono bg-[#00a884]/10 rounded px-2 py-1 inline-block">
                      Demo OTP: {demoOtp}
                    </span>
                  )}
                </>
              )}
              {step === 'profile' && 'Please provide your name and an optional profile photo'}
            </p>
          </div>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 px-10 pb-4">
            {(['phone', 'otp', 'profile'] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= ['phone', 'otp', 'profile'].indexOf(step)
                    ? 'w-8 bg-[#00a884]'
                    : 'w-4 bg-[#2a3942]'
                }`}
              />
            ))}
          </div>

          {/* Error */}
          <div className="px-10">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Step: Phone Number */}
          {step === 'phone' && (
            <div className="px-10 pb-10">
              <form onSubmit={handleSendOtp} className="space-y-5">
                {/* Country code selector */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#00a884] mb-2 uppercase tracking-wider">
                    Country
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="w-full bg-[#2a3942] border-b-2 border-[#00a884]/30 focus:border-[#00a884] px-4 py-3 rounded-t-lg text-[#d1d7db] text-sm outline-none transition-colors duration-200 flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xl">{selectedCountry.flag}</span>
                      <span>{selectedCountry.country}</span>
                      <span className="text-[#8696a0]">{selectedCountry.code}</span>
                    </span>
                    <svg viewBox="0 0 10 6" width="10" height="6" fill="#8696a0">
                      <path d="M1 1l4 4 4-4" stroke="#8696a0" strokeWidth="1.5" fill="none" />
                    </svg>
                  </button>

                  {showDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 bg-[#2a3942] border border-[#3b4a54] rounded-b-lg max-h-[200px] overflow-y-auto shadow-xl">
                      {COUNTRY_CODES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountryCode(c.code); setShowDropdown(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#3b4a54] transition-colors ${
                            c.code === countryCode ? 'bg-[#3b4a54] text-[#00a884]' : 'text-[#d1d7db]'
                          }`}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1 text-left">{c.country}</span>
                          <span className="text-[#8696a0]">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone number input */}
                <div>
                  <label className="block text-xs font-medium text-[#00a884] mb-2 uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="flex items-center bg-[#2a3942] rounded-t-lg border-b-2 border-[#00a884]/30 focus-within:border-[#00a884] transition-colors duration-200">
                    <span className="text-[#8696a0] text-sm pl-4 pr-2 border-r border-[#3b4a54] py-3 select-none">
                      {countryCode}
                    </span>
                    <input
                      ref={phoneRef}
                      id="login-phone"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Phone number"
                      autoComplete="tel"
                      className="flex-1 bg-transparent px-4 py-3 text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 disabled:cursor-not-allowed text-[#111b21] font-medium py-3 px-4 rounded-lg text-sm transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </span>
                  ) : 'Next'}
                </button>
              </form>
            </div>
          )}

          {/* Step: OTP Verification */}
          {step === 'otp' && (
            <div className="px-10 pb-10">
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* OTP inputs */}
                <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-11 h-14 text-center text-xl font-semibold rounded-lg outline-none transition-all duration-200 ${
                        digit
                          ? 'bg-[#00a884]/15 border-2 border-[#00a884] text-[#e9edef]'
                          : 'bg-[#2a3942] border-2 border-[#2a3942] focus:border-[#00a884] text-[#d1d7db]'
                      }`}
                    />
                  ))}
                </div>

                {/* Resend */}
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-xs text-[#8696a0]">
                      Resend code in <span className="text-[#00a884] font-medium">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-xs text-[#00a884] hover:text-[#06cf9c] font-medium transition-colors"
                    >
                      Didn't receive code? Resend
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setError(null); setDemoOtp('') }}
                    className="flex-1 bg-[#2a3942] hover:bg-[#3b4a54] text-[#e9edef] font-medium py-3 px-4 rounded-lg text-sm transition-all duration-200"
                  >
                    Change number
                  </button>
                  <button
                    id="verify-otp"
                    type="submit"
                    disabled={loading || otp.join('').length !== 6}
                    className="flex-1 bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 disabled:cursor-not-allowed text-[#111b21] font-medium py-3 px-4 rounded-lg text-sm transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Verifying…
                      </span>
                    ) : 'Verify'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step: Profile Setup */}
          {step === 'profile' && (
            <div className="px-10 pb-10">
              <form onSubmit={handleSetupProfile} className="space-y-5">
                {/* Avatar placeholder */}
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#2a3942] flex items-center justify-center relative group cursor-pointer">
                    <svg viewBox="0 0 212 212" width="80" height="80">
                      <path fill="#6a7175" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
                      <path fill="#cfd4d6" d="M106 35c-24.3 0-44 19.7-44 44s19.7 44 44 44 44-19.7 44-44-19.7-44-44-44zM106 165c-27.6 0-52-13.8-66.5-34.8C54 113.5 80 104 106 104s52 9.5 66.5 26.2C158 151.2 133.6 165 106 165z" />
                    </svg>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#00a884] mb-2 uppercase tracking-wider">
                    Your Name
                  </label>
                  <input
                    ref={nameRef}
                    id="profile-name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Type your name here"
                    maxLength={25}
                    className="w-full bg-[#2a3942] border-b-2 border-[#00a884]/30 focus:border-[#00a884] px-4 py-3 rounded-t-lg text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none transition-colors duration-200"
                  />
                  <p className="text-right text-xs text-[#8696a0] mt-1">{username.length}/25</p>
                </div>

                <button
                  id="setup-profile"
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-50 disabled:cursor-not-allowed text-[#111b21] font-medium py-3 px-4 rounded-lg text-sm transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Setting up…
                    </span>
                  ) : 'Continue to WhatsApp'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-[#8696a0]/70">
            🔒 Your personal messages are end-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  )
}
