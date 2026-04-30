import { useState, type FormEvent } from 'react'

type Props = {
  onLogin: (username: string) => Promise<void>
}

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Please enter a username')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await onLogin(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111b21] relative overflow-hidden">
      {/* Decorative top bar */}
      <div className="absolute top-0 left-0 right-0 h-[222px] bg-[#00a884]" />

      <div className="relative z-10 w-full max-w-[460px] mx-4">
        <div className="bg-[#1f2c33] rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-10 pt-10 pb-6 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-[#00a884]/20 flex items-center justify-center">
              <svg viewBox="0 0 39 39" width="48" height="48" fill="#00a884">
                <path d="M10.7 32.8l.6.3c2.5 1.5 5.3 2.2 8.1 2.2 8.8 0 16-7.2 16-16 0-4.2-1.7-8.3-4.7-11.3s-7-4.7-11.3-4.7c-8.8 0-16 7.2-15.9 16.1 0 3 .9 5.9 2.4 8.4l.4.6-1.5 5.5 5.7-1.5z" />
                <path fill="#1f2c33" d="M32.4 6.4C29 2.9 24.3 1 19.5 1 9.3 1 1.1 9.3 1.2 19.4c0 3.2.9 6.3 2.4 9.1L1 38l9.7-2.5c2.7 1.5 5.7 2.2 8.7 2.2 10.1 0 18.3-8.3 18.3-18.4 0-4.9-1.9-9.5-5.3-12.9zM19.5 34.6c-2.7 0-5.4-.7-7.7-2.1l-.6-.3-5.8 1.5L6.9 28l-.4-.6c-4.4-7.1-2.3-16.5 4.9-20.9s16.5-2.3 20.9 4.9 2.3 16.5-4.9 20.9c-2.3 1.5-5.1 2.3-7.9 2.3zm8.8-11.1l-1.1-.5s-1.6-.7-2.6-1.2c-.1 0-.2-.1-.3-.1-.3 0-.5.1-.7.3 0 0-.1.1-1.5 1.7-.1.2-.3.3-.5.3h-.1c-.1 0-.3-.1-.4-.2l-.5-.2c-1.1-.5-2.1-1.1-2.9-1.9-.2-.2-.5-.4-.7-.6-.7-.7-1.4-1.5-1.9-2.4l-.1-.2c-.1-.1-.1-.2-.2-.4 0-.2 0-.4.1-.5 0 0 .4-.5.7-.8.2-.2.3-.5.5-.7.2-.3.3-.7.2-1-.1-.5-1.3-3.2-1.6-3.8-.2-.3-.4-.4-.7-.5h-1.1c-.2 0-.4.1-.6.1l-.1.1c-.2.1-.4.3-.6.4-.2.2-.3.4-.5.6-.7.9-1.1 2-1.1 3.1 0 .8.2 1.6.5 2.3l.1.3c.9 1.9 2.1 3.6 3.7 5.1l.4.4c.3.3.6.5.8.8 2.1 1.8 4.5 3.1 7.2 3.8.3.1.7.1 1 .2h1c.5 0 1.1-.2 1.5-.4.3-.2.5-.2.7-.4l.2-.2c.2-.2.4-.3.6-.5s.3-.4.5-.6c.2-.4.3-.9.4-1.4v-.7s-.1-.1-.3-.2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-light text-[#e9edef] tracking-tight mb-2">
              WhatsApp Web
            </h1>
            <p className="text-sm text-[#8696a0]">
              Sign in with your username to start messaging
            </p>
          </div>

          {/* Form */}
          <div className="px-10 pb-10">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[#00a884] mb-2 uppercase tracking-wider">
                  Username
                </label>
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-[#2a3942] border-b-2 border-[#00a884]/30 focus:border-[#00a884] px-4 py-3 rounded-t-lg text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none transition-colors duration-200"
                />
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
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-[#8696a0]">
              New users are automatically registered
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
