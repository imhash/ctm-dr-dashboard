import { useState, useEffect, useCallback } from 'react'
import Header            from './components/Header'
import SummaryCards      from './components/SummaryCards'
import AppDRCard         from './components/AppDRCard'
import RTOValidation     from './components/RTOValidation'
import AgentConnectivity from './components/AgentConnectivity'
import LoginPage         from './components/LoginPage'
import DrillReportModal  from './components/DrillReportModal'
import { useT }          from './context/ThemeContext'
import { fetchDROperations, fetchAgents } from './services/controlmApi'

const REFRESH_MS = 30_000
const SESSION_KEY = 'ctm-session'

function Dashboard({ onLogout }) {
  const t = useT()
  const [loading,      setLoading]      = useState(true)
  const [operations,   setOperations]   = useState([])
  const [agents,       setAgents]       = useState([])
  const [lastRefresh,  setLastRefresh]  = useState(null)
  const [autoRefresh,  setAutoRefresh]  = useState(true)
  const [error,        setError]        = useState(null)
  const [showReport,   setShowReport]   = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ops, agt] = await Promise.all([fetchDROperations(), fetchAgents()])
      setOperations(ops)
      setAgents(agt)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(loadAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh, loadAll])

  return (
    <div className={`min-h-screen flex flex-col ${t.pageBg}`}>
      {showReport && (
        <DrillReportModal operations={operations} onClose={() => setShowReport(false)} />
      )}

      <Header
        lastRefresh={lastRefresh}
        autoRefresh={autoRefresh}
        onToggleAuto={() => setAutoRefresh((p) => !p)}
        onRefresh={loadAll}
        loading={loading}
        onLogout={onLogout}
        onReport={() => setShowReport(true)}
        hasData={operations.length > 0}
      />

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          ⚠ Failed to load DR operations: {error}
        </div>
      )}

      {loading && !operations.length ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-sm ${t.textMuted}`}>Loading DR operations from Control‑M…</p>
          </div>
        </div>
      ) : (
        <main className="flex-1 overflow-auto">

          {/* ── KPI Summary ── */}
          <SummaryCards operations={operations} />

          {/* ── Application DR Cards ── */}
          <section className="px-6 pb-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h2 className={`text-sm font-semibold ${t.text}`}>Application DR Status</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${t.border} ${t.textMuted}`}>
                Switchover · Switchback · Readiness — grouped by CTM Application
              </span>
            </div>

            {operations.length === 0 ? (
              <div className={`text-center py-16 text-sm ${t.textMuted}`}>
                No DR operations found.<br />
                <span className={`text-xs ${t.textFaint}`}>
                  Ensure jobs have <code className="font-mono">subApplication</code> = Switchover / Switchback / Readiness in Control‑M.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {operations.map((op) => <AppDRCard key={op.app} operation={op} />)}
              </div>
            )}
          </section>

          {/* ── RTO Validation ── */}
          {operations.length > 0 && (
            <section className="px-6 pb-4">
              <RTOValidation operations={operations} />
            </section>
          )}

          {/* ── Agent Connectivity ── */}
          <section className="px-6 pb-6">
            <AgentConnectivity agents={agents} />
          </section>

        </main>
      )}
    </div>
  )
}

export default function App() {
  // Auth state — persisted in sessionStorage (cleared on tab close)
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
  })

  function handleLogin(creds) {
    // Store only non-sensitive metadata; API key lives in env var (proxy handles it)
    const s = { apiUrl: creds.apiUrl, loggedInAt: new Date().toISOString() }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (!session) return <LoginPage onLogin={handleLogin} />
  return <Dashboard onLogout={handleLogout} />
}
