/**
 * SettingsContext — global user-configurable settings persisted in localStorage
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

import { createContext, useContext, useState, useCallback } from 'react'

const SETTINGS_KEY = 'ctm-resiliency-settings'

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
  agentGroups:      {},   // legacy — kept for compatibility
  topology: { showUnassigned: true, refreshSecs: 30 },
  businessServices: [],  // [{ id, name, criticality, color, description, prod:[{id,server,ip,datacenter,agents:[{name,ip}]}], dr:[...] }]
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      sla: {
        ...DEFAULT_SETTINGS.sla,
        ...(parsed.sla || {}),
        perApp: parsed.sla?.perApp || {},
      },
      pinnedApps:  parsed.pinnedApps  || [],
      agentGroups:      parsed.agentGroups      || {},
      topology:         { ...DEFAULT_SETTINGS.topology, ...(parsed.topology || {}) },
      businessServices: parsed.businessServices || [],
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function persist(obj) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(obj)) } catch {}
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  /** Shallow-merge a patch into settings and persist */
  const save = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      persist(next)
      return next
    })
  }, [])

  /** Deep-merge SLA patch */
  const saveSla = useCallback((slaPatch) => {
    setSettings((prev) => {
      const next = { ...prev, sla: { ...prev.sla, ...slaPatch } }
      persist(next)
      return next
    })
  }, [])

  /**
   * Returns SLA target in minutes for a given app + phase.
   * Returns null for 'readiness' (no SLA) and when no config exists.
   */
  const getSLA = useCallback((app, phase) => {
    if (phase === 'readiness') return null   // Readiness has NO SLA
    const perApp = settings.sla?.perApp?.[app]
    if (perApp?.[phase] != null) return Number(perApp[phase])
    const global = settings.sla?.[phase]
    if (global != null) return Number(global)
    // Defaults
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
      persist(next)
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

  return (
    <SettingsContext.Provider value={{ settings, save, saveSla, getSLA, togglePin, fmtTime, fmtDate }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
