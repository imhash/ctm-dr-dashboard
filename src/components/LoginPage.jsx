import { useState } from 'react'
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTheme, useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

export default function LoginPage({ onLogin }) {
  const { dark, toggle } = useTheme()
  const t = useT()
  const { settings, save } = useSettings()

  const dashboardTitle = settings.customerName?.trim() || 'Resiliency Dashboard'

  const [serverUrl,  setServerUrl]  = useState(settings.ctmServerUrl  || '')
  const [ctmServer,  setCtmServer]  = useState(settings.ctmServer     || '')
  const [apiKey,     setApiKey]     = useState('')
  const [showKey,    setShowKey]    = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(false)

  async function handleConnect(e) {
    e.preventDefault()
    if (!serverUrl.trim()) { setError('Server URL is required.');  return }
    if (!ctmServer.trim()) { setError('Server name is required.'); return }
    if (!apiKey.trim())    { setError('API key is required.');     return }

    setLoading(true)
    setError(null)

    try {
      // Persist connection config before attempting auth
      await save({ ctmServerUrl: serverUrl.trim(), ctmServer: ctmServer.trim() })

      const res = await fetch(`/ctm-api/run/jobs/status?ctm=${encodeURIComponent(ctmServer.trim())}&limit=1`, {
        headers: { 'x-api-key': apiKey.trim() },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.errors?.[0]?.message || `HTTP ${res.status}`)
      }
      setSuccess(true)
      setTimeout(() => onLogin({ apiKey: apiKey.trim(), ctmServer: ctmServer.trim() }), 800)
    } catch (err) {
      setError(`Authentication failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${t.pageBg}`}>
      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggle}
          className={`p-2 rounded-lg border text-xs ${t.card} ${t.border} ${t.textMuted} hover:opacity-80`}
        >
          {dark ? '☀ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Card */}
      <div className={`w-full max-w-md rounded-2xl border p-8 shadow-2xl ${t.card} ${t.border}`}>

        {/* Logo / Title */}
        <div className="flex items-center gap-3 mb-8">
          {settings.customerLogo ? (
            <img src={settings.customerLogo} alt="logo" className="h-10 max-w-[100px] object-contain rounded" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
          )}
          <div>
            <h1 className={`text-xl font-bold ${t.text}`}>{dashboardTitle}</h1>
            <p className={`text-xs ${t.textMuted}`}>Disaster Recovery Monitoring</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="flex flex-col gap-5">

          {/* CTM API URL */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${t.textSub}`}>
              CTM API URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => { setServerUrl(e.target.value); setError(null) }}
              placeholder="https://your-ctm-server.com"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${t.inputBg} ${t.border} ${t.text} placeholder-slate-500`}
              autoComplete="off"
            />
          </div>

          {/* CTM Server Name */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${t.textSub}`}>
              CTM Server Name
            </label>
            <input
              type="text"
              value={ctmServer}
              onChange={(e) => { setCtmServer(e.target.value); setError(null) }}
              placeholder="e.g. PROD, IN01, DR01"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${t.inputBg} ${t.border} ${t.text} placeholder-slate-500`}
              autoComplete="off"
            />
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
                autoFocus
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

        <p className={`text-xs text-center mt-6 ${t.textFaint}`}>
          API key is stored in session memory only and never persisted to disk.
        </p>
      </div>

      <p className={`text-xs mt-6 ${t.textFaint}`}>{dashboardTitle} · BMC Software</p>
    </div>
  )
}
