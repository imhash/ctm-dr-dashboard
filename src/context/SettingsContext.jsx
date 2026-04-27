/**
 * SettingsContext — global user-configurable settings persisted in JSON DB via /api/settings
 *
 * Settings:
 *   sla.switchover   — default SLA target for Switchover phase (minutes)
 *   sla.switchback   — default SLA target for Switchback phase (minutes)
 *   sla.perApp       — per-application overrides { [app]: { switchover, switchback } }
 *   timezone         — IANA timezone string (e.g. 'Asia/Dubai', 'UTC')
 *   pinnedApps       — array of app names that appear at the top of the grid
 *   customerLogo     — base64-encoded image string (data URL) or null
 *   customerName     — custom title shown in the header
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

export const DEFAULT_SETTINGS = {
  sla: {
    switchover: 30,
    switchback: 60,
    failover:   30,
    failback:   60,
    perApp: {},
  },
  timezone: (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  })(),
  pinnedApps:   [],
  customerLogo: null,
  customerName: '',
  agentGroups:      {},
  topology: { showUnassigned: true, refreshSecs: 30 },
  businessServices: [],
}

function mergeSettings(saved) {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    sla: {
      ...DEFAULT_SETTINGS.sla,
      ...(saved.sla || {}),
      perApp: saved.sla?.perApp || {},
    },
    pinnedApps:       saved.pinnedApps       || [],
    agentGroups:      saved.agentGroups      || {},
    topology:         { ...DEFAULT_SETTINGS.topology, ...(saved.topology || {}) },
    businessServices: saved.businessServices || [],
  }
}

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings')
    if (!res.ok) throw new Error('fetch failed')
    return mergeSettings(await res.json())
  } catch {
    return DEFAULT_SETTINGS
  }
}

async function persistSettings(obj) {
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    })
  } catch {}
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchSettings().then((s) => { setSettings(s); setLoaded(true) })
  }, [])

  /** Shallow-merge a patch into settings and persist */
  const save = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      persistSettings(next)
      return next
    })
  }, [])

  /** Deep-merge SLA patch */
  const saveSla = useCallback((slaPatch) => {
    setSettings((prev) => {
      const next = { ...prev, sla: { ...prev.sla, ...slaPatch } }
      persistSettings(next)
      return next
    })
  }, [])

  /**
   * Returns SLA target in minutes for a given app + phase.
   * Returns null for 'readiness' (no SLA) and when no config exists.
   */
  const getSLA = useCallback((app, phase) => {
    if (phase === 'readiness') return null
    const perApp = settings.sla?.perApp?.[app]
    if (perApp?.[phase] != null) return Number(perApp[phase])
    const global = settings.sla?.[phase]
    if (global != null) return Number(global)
    if (phase === 'switchover' || phase === 'failover')  return 30
    if (phase === 'switchback' || phase === 'failback')  return 60
    return 30
  }, [settings.sla])

  /** Toggle an app in the pinnedApps list */
  const togglePin = useCallback((app) => {
    setSettings((prev) => {
      const already = prev.pinnedApps.includes(app)
      const pinnedApps = already
        ? prev.pinnedApps.filter((a) => a !== app)
        : [...prev.pinnedApps, app]
      const next = { ...prev, pinnedApps }
      persistSettings(next)
      return next
    })
  }, [])

  /** Format an ISO string as a time using the configured timezone */
  const fmtTime = useCallback((iso, opts = {}) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: settings.timezone,
      ...opts,
    })
  }, [settings.timezone])

  /** Format an ISO string as a short date using the configured timezone */
  const fmtDate = useCallback((iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      timeZone: settings.timezone,
    })
  }, [settings.timezone])

  if (!loaded) return null

  return (
    <SettingsContext.Provider value={{ settings, save, saveSla, getSLA, togglePin, fmtTime, fmtDate }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
