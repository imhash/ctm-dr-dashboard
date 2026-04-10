import { useState } from 'react'
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTheme, useT } from '../context/ThemeContext'

const DEFAULT_URL = 'https://se-preprod-aapi.us1.controlm.com/automation-api'

export default function LoginPage({ onLogin }) {
  const { dark, toggle } = useTheme()
  const t = useT()

  const [apiUrl,    setApiUrl]    = useState(DEFAULT_URL)
  const [apiKey,    setApiKey]    = useState('')
  const [showKey,   setShowKey]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(false)

  async function handleConnect(e) {
    e.preventDefault()
    if (!apiKey.trim()) { setError('API key is required.'); return }

    setLoading(true)
    setError(null)

    try {
      // Probe a lightweight endpoint to validate the key
      const res = await fetch(`/ctm-api/run/jobs/status?limit=1`, {
        headers: { 'x-api-key': apiKey.trim() },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.[0]?.message || `HTTP ${res.status}`)
      }

      setSuccess(true)
      setTimeout(() => onLogin({ apiKey: apiKey.trim(), apiUrl }), 800)
    } catch (err) {
      setError(`Authentication failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${t.pageBg}`}>
      {/* Theme toggle top-right */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggle}
          className={`p-2 rounded-lg border text-xs ${t.card} ${t.border} ${t.textMuted} hover:opacity-80`}
          title="Toggle theme"
        >
          {dark ? '☀ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Card */}
      <div className={`w-full max-w-md rounded-2xl border p-8 shadow-2xl ${t.card} ${t.border}`}>

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${t.text}`}>Control‑M DR Dashboard</h1>
            <p className={`text-xs ${t.textMuted}`}>Disaster Recovery Monitoring</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="flex flex-col gap-5">

          {/* Server URL */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${t.textSub}`}>
              Control‑M API URL
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://your-ctm-host/automation-api"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${t.inputBg} ${t.border} ${t.text} placeholder-slate-500`}
            />
            <p className={`text-xs mt-1 ${t.textFaint}`}>
              Requests are proxied via Vite to avoid CORS. Update <code className="font-mono">.env</code> for production.
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${t.textSub}`}>
              API Key <span className={t.textFaint}>(base64 token)</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(null) }}
                placeholder="Paste your base64 API key…"
                className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${t.inputBg} ${t.border} ${t.text} placeholder-slate-500`}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((p) => !p)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${t.textMuted} hover:opacity-70`}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className={`text-xs mt-1 ${t.textFaint}`}>
              Format: <code className="font-mono">username:apiKeyId:secret</code> (base64 encoded)
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Authenticated — loading dashboard…
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || success}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
              : success
              ? <><CheckCircle2 className="w-4 h-4" /> Connected</>
              : 'Connect & Authenticate'}
          </button>
        </form>

        {/* Footer note */}
        <p className={`text-xs text-center mt-6 ${t.textFaint}`}>
          Your API key is stored in session memory only and never persisted to disk.
        </p>
      </div>

      {/* Version */}
      <p className={`text-xs mt-6 ${t.textFaint}`}>Control‑M DR Dashboard · BMC Software</p>
    </div>
  )
}
