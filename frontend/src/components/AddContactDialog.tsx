import { useState, useRef, useEffect, type FormEvent } from 'react'

type Props = {
  open: boolean
  defaultCountryCode: string
  onAdd: (phoneNumber: string, countryCode: string, name: string) => Promise<void>
  onSyncFromPhone: () => Promise<void>
  onClose: () => void
}

export default function AddContactDialog({ open, defaultCountryCode, onAdd, onSyncFromPhone, onClose }: Props) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState(defaultCountryCode || '+91')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const phoneRef = useRef<HTMLInputElement>(null)

  // Check if Contact Picker API is supported
  const hasContactPicker = typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window

  useEffect(() => {
    if (open) {
      setPhone('')
      setName('')
      setError(null)
      setSuccess(null)
      setTimeout(() => phoneRef.current?.focus(), 100)
    }
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 6) {
      setError('Please enter a valid phone number')
      return
    }
    if (!name.trim()) {
      setError('Please enter a contact name')
      return
    }
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      await onAdd(cleanPhone, countryCode, name.trim())
      setSuccess(`${name.trim()} added!`)
      setPhone('')
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncFromPhone() {
    setSyncing(true)
    setError(null)
    setSuccess(null)
    try {
      await onSyncFromPhone()
      setSuccess('Contacts synced from your phone!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync contacts')
    } finally {
      setSyncing(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1f2c33] rounded-xl shadow-2xl w-full max-w-[400px] mx-4 overflow-hidden animate-in">
        {/* Header */}
        <div className="bg-[#202c33] px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#e9edef] text-lg font-medium">New Contact</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-[#374851] flex items-center justify-center text-[#aebac1] transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Sync from phone button */}
          {hasContactPicker && (
            <button
              type="button"
              onClick={handleSyncFromPhone}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 bg-[#00a884]/10 hover:bg-[#00a884]/20 border border-[#00a884]/30 text-[#00a884] py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.045 15.045 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
                </svg>
              )}
              {syncing ? 'Syncing…' : 'Import from Phone Contacts'}
            </button>
          )}

          {hasContactPicker && (
            <div className="flex items-center gap-3 text-xs text-[#8696a0]">
              <div className="flex-1 h-px bg-[#2a3942]" />
              <span>or add manually</span>
              <div className="flex-1 h-px bg-[#2a3942]" />
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="px-3 py-2 rounded-lg bg-[#00a884]/10 border border-[#00a884]/20 text-[#00a884] text-sm">
              ✓ {success}
            </div>
          )}

          {/* Manual form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[#8696a0] mb-1 uppercase tracking-wider">Phone Number</label>
              <div className="flex items-center bg-[#2a3942] rounded-lg border-b-2 border-[#2a3942] focus-within:border-[#00a884] transition-colors">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-transparent text-[#8696a0] text-sm pl-3 pr-1 py-2.5 outline-none border-r border-[#3b4a54] cursor-pointer"
                >
                  <option value="+91">🇮🇳 +91</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+61">🇦🇺 +61</option>
                  <option value="+81">🇯🇵 +81</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+971">🇦🇪 +971</option>
                  <option value="+65">🇸🇬 +65</option>
                  <option value="+86">🇨🇳 +86</option>
                </select>
                <input
                  ref={phoneRef}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  className="flex-1 bg-transparent px-3 py-2.5 text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#8696a0] mb-1 uppercase tracking-wider">Contact Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
                maxLength={30}
                className="w-full bg-[#2a3942] rounded-lg border-b-2 border-[#2a3942] focus:border-[#00a884] px-3 py-2.5 text-[#d1d7db] placeholder:text-[#8696a0] text-sm outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phone.trim() || !name.trim()}
              className="w-full bg-[#00a884] hover:bg-[#06cf9c] disabled:opacity-40 disabled:cursor-not-allowed text-[#111b21] font-medium py-2.5 rounded-lg text-sm transition-all"
            >
              {loading ? 'Adding…' : 'Add Contact'}
            </button>
          </form>

          <p className="text-center text-xs text-[#8696a0]">
            Only contacts registered on WhatsApp will appear in your chat list
          </p>
        </div>
      </div>
    </div>
  )
}
