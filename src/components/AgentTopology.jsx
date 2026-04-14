import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Monitor, Server, Wifi, WifiOff, AlertTriangle, CheckCircle2, XCircle,
  Maximize2, Minimize2, Settings, ArrowLeft, Activity, Clock, Cpu, Layers,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

// ─── helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 10)    return 'just now'
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function worstStatus(agents) {
  if (agents.some((a) => a.status === 'Disconnected')) return 'Disconnected'
  if (agents.some((a) => a.status === 'Warning'))      return 'Warning'
  if (agents.length > 0)                               return 'Connected'
  return 'Unknown'
}

const STATUS_DOT = {
  Connected:    'bg-green-400',
  Warning:      'bg-amber-400',
  Disconnected: 'bg-red-400',
  Unknown:      'bg-slate-500',
}

const STATUS_GLOW = {
  Connected:    'shadow-green-500/20',
  Warning:      'shadow-amber-500/20',
  Disconnected: 'shadow-red-500/20',
  Unknown:      'shadow-slate-500/10',
}

const STATUS_BORDER = {
  Connected:    'border-green-500/30',
  Warning:      'border-amber-500/30',
  Disconnected: 'border-red-500/30',
  Unknown:      'border-slate-600/30',
}

const STATUS_TEXT = {
  Connected:    'text-green-400',
  Warning:      'text-amber-400',
  Disconnected: 'text-red-400',
  Unknown:      'text-slate-400',
}

const LINE_STYLE = {
  Connected:    { gradient: 'from-green-500/60 to-green-500/20', dashed: false,  opacity: 1   },
  Warning:      { gradient: 'from-amber-500/60 to-amber-500/20', dashed: true,   opacity: 0.9 },
  Disconnected: { gradient: 'from-red-500/50 to-red-500/10',     dashed: true,   opacity: 0.5 },
  Unknown:      { gradient: 'from-slate-500/30 to-slate-500/10', dashed: true,   opacity: 0.4 },
}

// Deterministic color per app name
const APP_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
]
function appColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return APP_COLORS[hash % APP_COLORS.length]
}

function initials(name) {
  const parts = name.trim().split(/[\s_\-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─── sub-components ─────────────────────────────────────────────────────────

function AgentCard({ agent, meta, tvMode, editMode, apps, onMetaChange }) {
  const PlatformIcon = agent.platform === 'Windows' ? Monitor : Server
  const status       = agent.status || 'Unknown'
  const dotClass     = STATUS_DOT[status]
  const borderClass  = STATUS_BORDER[status]
  const textClass    = STATUS_TEXT[status]

  const cardBase = [
    'relative flex flex-col gap-1.5 rounded-xl border p-3',
    'bg-[#0d1421]',
    borderClass,
    tvMode ? 'p-4 gap-2' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardBase} style={{ minWidth: tvMode ? 200 : 160 }}>
      {/* status dot */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={[
            'w-2 h-2 rounded-full flex-shrink-0',
            dotClass,
            status === 'Connected' ? 'animate-pulse' : '',
          ].join(' ')} />
          <span className={[
            'font-mono font-bold truncate',
            tvMode ? 'text-sm' : 'text-xs',
            'text-white',
          ].join(' ')}>
            {agent.name}
          </span>
        </div>
        <PlatformIcon className={['w-3.5 h-3.5 flex-shrink-0 text-slate-400', tvMode ? 'w-4 h-4' : ''].join(' ')} />
      </div>

      {/* host / IP */}
      <p className={['font-mono text-slate-400 truncate', tvMode ? 'text-xs' : 'text-[10px]'].join(' ')}>
        {meta?.ip || agent.host}
      </p>

      {/* status badge */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={['text-[10px] font-semibold uppercase tracking-wide', textClass].join(' ')}>
          {status}
        </span>
        {agent.datacenter && (
          <span className="text-[10px] text-slate-500 font-mono">· {agent.datacenter}</span>
        )}
      </div>

      {/* details row */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
        {agent.version && (
          <span className="flex items-center gap-0.5">
            <Layers className="w-2.5 h-2.5" /> v{agent.version}
          </span>
        )}
        {agent.activeJobs > 0 && (
          <span className="flex items-center gap-0.5 text-cyan-400">
            <Activity className="w-2.5 h-2.5" /> {agent.activeJobs} job{agent.activeJobs !== 1 ? 's' : ''}
          </span>
        )}
        <span className="flex items-center gap-0.5 ml-auto">
          <Clock className="w-2.5 h-2.5" /> {relativeTime(agent.lastPing)}
        </span>
      </div>

      {/* edit overlay */}
      {editMode && (
        <div className="mt-1 flex flex-col gap-1 border-t border-slate-700 pt-1.5">
          <select
            value={meta?.app || ''}
            onChange={(e) => onMetaChange(agent.name, 'app', e.target.value)}
            className="text-[10px] bg-[#161926] border border-slate-700 rounded px-1 py-0.5 text-white w-full"
          >
            <option value="">— unassigned —</option>
            {apps.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={meta?.zone || 'prod'}
            onChange={(e) => onMetaChange(agent.name, 'zone', e.target.value)}
            className="text-[10px] bg-[#161926] border border-slate-700 rounded px-1 py-0.5 text-white w-full"
          >
            <option value="prod">PROD</option>
            <option value="dr">DR</option>
          </select>
          <input
            type="text"
            placeholder="IP address"
            value={meta?.ip || ''}
            onChange={(e) => onMetaChange(agent.name, 'ip', e.target.value)}
            className="text-[10px] bg-[#161926] border border-slate-700 rounded px-1 py-0.5 text-white font-mono w-full placeholder-slate-600"
          />
        </div>
      )}
    </div>
  )
}

function ConnectionLine({ status, direction }) {
  const cfg   = LINE_STYLE[status] || LINE_STYLE.Unknown
  const style = {
    opacity: cfg.opacity,
    background: cfg.dashed
      ? undefined
      : `linear-gradient(${direction === 'right' ? 'to right' : 'to left'}, ${
          status === 'Connected'    ? 'rgba(34,197,94,0.6), rgba(34,197,94,0.1)'  :
          status === 'Warning'      ? 'rgba(245,158,11,0.6), rgba(245,158,11,0.1)' :
                                      'rgba(239,68,68,0.4), rgba(239,68,68,0.05)'
        })`,
  }

  if (cfg.dashed) {
    const color =
      status === 'Warning'      ? '#f59e0b' :
      status === 'Disconnected' ? '#ef4444' : '#64748b'
    return (
      <div className="flex-1 flex items-center" style={{ opacity: cfg.opacity, minWidth: 20 }}>
        <svg width="100%" height="2" preserveAspectRatio="none">
          <line
            x1="0" y1="1" x2="100%" y2="1"
            stroke={color} strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex-1 h-px" style={style} />
  )
}

function AppHubNode({ appName, prodAgents, drAgents, tvMode }) {
  const color       = appColor(appName)
  const allAgents   = [...prodAgents, ...drAgents]
  const worst       = worstStatus(allAgents)
  const glowClass   = STATUS_GLOW[worst]
  const borderClass = STATUS_BORDER[worst]
  const totalJobs   = allAgents.reduce((s, a) => s + (a.activeJobs || 0), 0)
  const hasJobs     = totalJobs > 0

  const healthIcon =
    worst === 'Connected'    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
    worst === 'Warning'      ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
    worst === 'Disconnected' ? <XCircle className="w-3.5 h-3.5 text-red-400" />        :
                               <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />

  const healthLabel =
    worst === 'Connected'    ? 'Healthy'       :
    worst === 'Warning'      ? 'Degraded'      :
    worst === 'Disconnected' ? 'Unhealthy'     : 'Unknown'

  return (
    <div className={[
      'relative flex flex-col items-center gap-2 rounded-2xl border p-3',
      'bg-[#0a1020]',
      borderClass,
      `shadow-lg ${glowClass}`,
      tvMode ? 'p-4 gap-3' : '',
    ].join(' ')} style={{ minWidth: tvMode ? 160 : 130 }}>

      {/* animated ring when jobs running */}
      {hasJobs && (
        <span
          className="absolute inset-0 rounded-2xl animate-ping opacity-10"
          style={{ border: `2px solid ${color}`, animationDuration: '2s' }}
        />
      )}

      {/* avatar circle */}
      <div
        className={['rounded-full flex items-center justify-center font-bold text-white shrink-0',
          tvMode ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm',
        ].join(' ')}
        style={{ background: color, boxShadow: `0 0 12px ${color}44` }}
      >
        {initials(appName)}
      </div>

      {/* app name */}
      <p className={['font-semibold text-white text-center leading-tight',
        tvMode ? 'text-sm' : 'text-xs',
      ].join(' ')}>
        {appName}
      </p>

      {/* counts */}
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-blue-400 font-mono">{prodAgents.length}P</span>
        <span className="text-slate-600">·</span>
        <span className="text-cyan-400 font-mono">{drAgents.length}DR</span>
      </div>

      {/* health */}
      <div className="flex items-center gap-1">
        {healthIcon}
        <span className={['text-[10px] font-medium', STATUS_TEXT[worst]].join(' ')}>
          {healthLabel}
        </span>
      </div>

      {/* active jobs */}
      {totalJobs > 0 && (
        <span className="text-[10px] text-cyan-400 flex items-center gap-0.5">
          <Activity className="w-2.5 h-2.5" /> {totalJobs} active
        </span>
      )}
    </div>
  )
}

function AppRow({ appName, prodAgents, drAgents, tvMode, editMode, agentGroups, apps, onMetaChange }) {
  const leftWorst  = worstStatus(prodAgents)
  const rightWorst = worstStatus(drAgents)

  return (
    <div className="flex items-center gap-0" style={{ minHeight: 80 }}>
      {/* PROD agents column */}
      <div className="flex flex-col gap-2 items-end" style={{ width: tvMode ? 220 : 180, flexShrink: 0 }}>
        {prodAgents.map((agent) => (
          <div key={agent.id} className="flex items-center w-full gap-1">
            <AgentCard
              agent={agent}
              meta={agentGroups[agent.name]}
              tvMode={tvMode}
              editMode={editMode}
              apps={apps}
              onMetaChange={onMetaChange}
            />
            <ConnectionLine status={agent.status} direction="right" />
          </div>
        ))}
        {prodAgents.length === 0 && (
          <div className="flex items-center w-full gap-1">
            <div className="flex-1 rounded-xl border border-slate-800 p-3 text-[10px] text-slate-700 text-center italic bg-[#0a0f1a]">
              no prod agent
            </div>
            <ConnectionLine status="Unknown" direction="right" />
          </div>
        )}
      </div>

      {/* App hub center */}
      <div className="flex items-center justify-center" style={{ width: tvMode ? 180 : 140, flexShrink: 0 }}>
        <AppHubNode
          appName={appName}
          prodAgents={prodAgents}
          drAgents={drAgents}
          tvMode={tvMode}
        />
      </div>

      {/* DR agents column */}
      <div className="flex flex-col gap-2 items-start" style={{ width: tvMode ? 220 : 180, flexShrink: 0 }}>
        {drAgents.map((agent) => (
          <div key={agent.id} className="flex items-center w-full gap-1">
            <ConnectionLine status={agent.status} direction="left" />
            <AgentCard
              agent={agent}
              meta={agentGroups[agent.name]}
              tvMode={tvMode}
              editMode={editMode}
              apps={apps}
              onMetaChange={onMetaChange}
            />
          </div>
        ))}
        {drAgents.length === 0 && (
          <div className="flex items-center w-full gap-1">
            <ConnectionLine status="Unknown" direction="left" />
            <div className="flex-1 rounded-xl border border-slate-800 p-3 text-[10px] text-slate-700 text-center italic bg-[#0a0f1a]">
              no dr agent
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CountdownRing({ seconds, total }) {
  const radius     = 10
  const circ       = 2 * Math.PI * radius
  const dashOffset = circ * (1 - seconds / total)

  return (
    <svg width="28" height="28" className="-rotate-90">
      <circle cx="14" cy="14" r={radius} fill="none" stroke="#1e293b" strokeWidth="2.5" />
      <circle
        cx="14" cy="14" r={radius}
        fill="none" stroke="#3b82f6" strokeWidth="2.5"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
      <text
        x="14" y="14"
        textAnchor="middle" dominantBaseline="central"
        fill="#94a3b8" fontSize="7" className="rotate-90"
        style={{ transform: 'rotate(90deg)', transformOrigin: '14px 14px' }}
      >
        {seconds}
      </text>
    </svg>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function AgentTopology({ agents = [], onClose }) {
  const { settings, save } = useSettings()
  const t = useT()

  const agentGroups   = settings.agentGroups || {}
  const topologyCfg   = settings.topology    || {}
  const showUnassigned = topologyCfg.showUnassigned !== false
  const refreshSecs    = topologyCfg.refreshSecs    || 30

  // Derive app list: prefer settings.appList, else derive from agentGroups
  const appList = (() => {
    if (settings.appList && settings.appList.length > 0) return settings.appList
    const names = new Set(Object.values(agentGroups).map((g) => g.app).filter(Boolean))
    return [...names].sort()
  })()

  const [tvMode,    setTvMode]    = useState(false)
  const [editMode,  setEditMode]  = useState(false)
  const [countdown, setCountdown] = useState(refreshSecs)
  const [localGroups, setLocalGroups] = useState(agentGroups)
  const [now, setNow] = useState(Date.now())

  // Keep now updated for relative time display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  // Countdown ring + refresh tick
  useEffect(() => {
    setCountdown(refreshSecs)
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setNow(Date.now())
          return refreshSecs
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [refreshSecs])

  // Fullscreen detection
  useEffect(() => {
    const handler = () => setTvMode(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }

  // Edit mode: sync localGroups when opening
  useEffect(() => {
    if (editMode) setLocalGroups(agentGroups)
  }, [editMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMetaChange = useCallback((agentName, field, value) => {
    setLocalGroups((prev) => ({
      ...prev,
      [agentName]: { ...(prev[agentName] || {}), [field]: value },
    }))
  }, [])

  const saveEdits = () => {
    save({ agentGroups: localGroups })
    setEditMode(false)
  }

  const cancelEdits = () => {
    setLocalGroups(agentGroups)
    setEditMode(false)
  }

  // groups to use: in edit mode use localGroups for preview
  const activeGroups = editMode ? localGroups : agentGroups

  // Bucket agents per app + zone
  const appRows = appList.map((appName) => {
    const prodAgents = agents.filter(
      (a) => activeGroups[a.name]?.app === appName && activeGroups[a.name]?.zone === 'prod'
    )
    const drAgents = agents.filter(
      (a) => activeGroups[a.name]?.app === appName && activeGroups[a.name]?.zone === 'dr'
    )
    return { appName, prodAgents, drAgents }
  })

  const unassigned = agents.filter((a) => !activeGroups[a.name]?.app)

  // Stats
  const connCount  = agents.filter((a) => a.status === 'Connected').length
  const warnCount  = agents.filter((a) => a.status === 'Warning').length
  const discCount  = agents.filter((a) => a.status === 'Disconnected').length
  const totalJobs  = agents.reduce((s, a) => s + (a.activeJobs || 0), 0)

  const isEmpty = Object.keys(agentGroups).length === 0 && appList.length === 0

  return (
    <div
      className={[
        'flex flex-col min-h-screen bg-[#060b14]',
        tvMode ? 'tv-mode' : '',
      ].join(' ')}
      style={{ fontFamily: "'Inter', 'JetBrains Mono', monospace" }}
    >
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[#080d18] flex-shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <h1 className={['font-bold text-white leading-tight', tvMode ? 'text-xl' : 'text-base'].join(' ')}>
              Agent Topology
            </h1>
            <p className="text-[10px] text-slate-500">Resiliency Dashboard · NOC View</p>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-2 ml-3 flex-wrap">
          <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/25 rounded-full px-2 py-0.5 text-[10px] text-green-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {connCount} ok
          </span>
          {warnCount > 0 && (
            <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 text-[10px] text-amber-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {warnCount} warn
            </span>
          )}
          {discCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500/10 border border-red-500/25 rounded-full px-2 py-0.5 text-[10px] text-red-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {discCount} down
            </span>
          )}
          {totalJobs > 0 && (
            <span className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/25 rounded-full px-2 py-0.5 text-[10px] text-cyan-400 font-mono">
              <Activity className="w-2.5 h-2.5" />
              {totalJobs} jobs
            </span>
          )}
        </div>

        {/* Live pulse */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-slate-500 hidden sm:inline">LIVE</span>
        </div>

        {/* Countdown ring */}
        <CountdownRing seconds={countdown} total={refreshSecs} />

        {/* Edit toggle */}
        <button
          onClick={() => { if (editMode) cancelEdits(); else setEditMode(true) }}
          title={editMode ? 'Cancel edits' : 'Edit agent mapping'}
          className={[
            'p-1.5 rounded-lg border transition-colors',
            editMode
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
              : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600',
          ].join(' ')}
        >
          <Settings className="w-4 h-4" />
        </button>

        {editMode && (
          <button
            onClick={saveEdits}
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Save
          </button>
        )}

        {/* TV / Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={tvMode ? 'Exit fullscreen' : 'Fullscreen (TV mode)'}
          className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          {tvMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Zone column headers ── */}
      <div className="flex items-center px-4 pt-4 pb-1 flex-shrink-0">
        <div
          className="flex items-center justify-center gap-2"
          style={{ width: tvMode ? 220 : 180, flexShrink: 0 }}
        >
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Production</span>
        </div>
        <div
          className="flex items-center justify-center gap-2"
          style={{ width: tvMode ? 180 : 140, flexShrink: 0 }}
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Apps</span>
        </div>
        <div
          className="flex items-center justify-center gap-2"
          style={{ width: tvMode ? 220 : 180, flexShrink: 0 }}
        >
          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">Disaster Recovery</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {isEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
              <Cpu className="w-7 h-7 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">No agents configured</p>
            <p className="text-slate-600 text-sm text-center max-w-xs">
              Open Edit mode and assign agents to applications and zones to see the topology.
            </p>
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" /> Configure Agents
            </button>
          </div>
        ) : appRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-slate-500 text-sm">No applications defined yet.</p>
            <p className="text-slate-600 text-xs">Use Edit mode to map agents to applications.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {appRows.map(({ appName, prodAgents, drAgents }) => (
              <AppRow
                key={appName}
                appName={appName}
                prodAgents={prodAgents}
                drAgents={drAgents}
                tvMode={tvMode}
                editMode={editMode}
                agentGroups={activeGroups}
                apps={appList}
                onMetaChange={handleMetaChange}
              />
            ))}
          </div>
        )}

        {/* ── Unassigned agents ── */}
        {showUnassigned && unassigned.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <WifiOff className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
                Unassigned ({unassigned.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {unassigned.map((agent) => (
                <div key={agent.id} style={{ width: tvMode ? 220 : 180 }}>
                  <AgentCard
                    agent={agent}
                    meta={activeGroups[agent.name]}
                    tvMode={tvMode}
                    editMode={editMode}
                    apps={appList}
                    onMetaChange={handleMetaChange}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
