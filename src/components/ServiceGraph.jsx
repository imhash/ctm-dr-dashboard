import { useState, useEffect, useCallback, useRef } from 'react'
import { Monitor, Server, Cpu, ChevronLeft, Settings, Maximize2, RefreshCw, Activity, AlertTriangle, XCircle, CheckCircle, Wifi } from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

// ─── helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return `${Math.floor(diff / 3600000)}h ago`
}

function getAgentLive(agentName, agents) {
  const live = agents.find(
    (a) => a.name === agentName || a.host === agentName
  )
  if (!live) return { name: agentName, status: 'Unknown', lastPing: null, version: null, activeJobs: 0, platform: null }
  return { ...live }
}

function worstStatus(statuses) {
  if (statuses.includes('Disconnected')) return 'Disconnected'
  if (statuses.includes('Unknown')) return 'Unknown'
  if (statuses.includes('Warning')) return 'Warning'
  if (statuses.every((s) => s === 'Connected')) return 'Connected'
  return 'Unknown'
}

function statusColor(status) {
  if (status === 'Connected') return '#22c55e'
  if (status === 'Warning') return '#f59e0b'
  if (status === 'Disconnected') return '#ef4444'
  return '#6b7280'
}

function statusBg(status) {
  if (status === 'Connected') return 'bg-green-500/20 text-green-400'
  if (status === 'Warning') return 'bg-amber-500/20 text-amber-400'
  if (status === 'Disconnected') return 'bg-red-500/20 text-red-400'
  return 'bg-slate-500/20 text-slate-400'
}

function criticalityBadge(c) {
  if (c === 'Critical') return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (c === 'High') return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
  if (c === 'Medium') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  if (c === 'Low') return 'bg-green-500/20 text-green-400 border border-green-500/30'
  return 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
}

function platformLabel(platform) {
  if (!platform) return null
  const p = platform.toLowerCase()
  if (p.includes('linux') || p.includes('unix')) return '🐧 Linux'
  if (p.includes('win')) return '⊞ Windows'
  return platform
}

// ─── Connection line ─────────────────────────────────────────────────────────

function ConnectionLine({ status, direction }) {
  const color = statusColor(status)

  if (status === 'Warning') {
    return (
      <div
        className="flex-1 h-px self-center"
        style={{ borderTop: '1px dashed #f59e0b', minWidth: 8 }}
      />
    )
  }
  if (status === 'Disconnected' || status === 'Unknown') {
    return (
      <div
        className="flex-1 h-px self-center"
        style={{ borderTop: '1px dashed #ef444470', minWidth: 8 }}
      />
    )
  }
  // Connected
  const gradient =
    direction === 'prod'
      ? `linear-gradient(to right, transparent, ${color}80, transparent)`
      : `linear-gradient(to left, transparent, ${color}80, transparent)`
  return (
    <div
      className="flex-1 h-px self-center"
      style={{ background: gradient, minWidth: 8 }}
    />
  )
}

// ─── Status dot with pulse ────────────────────────────────────────────────────

function StatusDot({ status, size = 8 }) {
  const color = statusColor(status)
  const pulse = status === 'Connected'
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {pulse && (
        <span
          className="absolute inline-flex rounded-full opacity-75 animate-ping"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  )
}

// ─── Agent Node ───────────────────────────────────────────────────────────────

function AgentNode({ agentConfig, agents }) {
  const live = getAgentLive(agentConfig.name, agents)
  const status = live.status || 'Unknown'
  const color = statusColor(status)
  const plat = platformLabel(live.platform)

  return (
    <div
      className="rounded border flex flex-col gap-1 p-2"
      style={{
        width: 148,
        background: '#0d1118',
        borderColor: `${color}40`,
        borderLeftColor: color,
        borderLeftWidth: 2,
      }}
    >
      {/* Name row */}
      <div className="flex items-center gap-1.5 min-w-0">
        <StatusDot status={status} size={7} />
        <span
          className="font-bold text-white truncate"
          style={{ fontSize: '0.72rem' }}
          title={agentConfig.name}
        >
          {agentConfig.name}
        </span>
      </div>

      {/* IP */}
      {agentConfig.ip && (
        <span className="text-slate-500 font-mono" style={{ fontSize: '0.62rem' }}>
          {agentConfig.ip}
        </span>
      )}

      {/* Status label */}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-sm self-start font-medium ${statusBg(status)}`}
      >
        {status}
      </span>

      {/* Platform */}
      {plat && (
        <span className="text-slate-500" style={{ fontSize: '0.62rem' }}>
          {plat}
        </span>
      )}

      {/* Active jobs */}
      {live.activeJobs > 0 && (
        <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded-sm px-1.5 py-0.5 self-start">
          {live.activeJobs} job{live.activeJobs !== 1 ? 's' : ''}
        </span>
      )}

      {/* Last ping */}
      <span className="text-slate-600" style={{ fontSize: '0.6rem' }}>
        {live.lastPing ? relativeTime(live.lastPing) : '—'}
      </span>

      {/* Version */}
      {live.version && (
        <span className="text-slate-600 font-mono" style={{ fontSize: '0.58rem' }}>
          v{live.version}
        </span>
      )}
    </div>
  )
}

// ─── Server Node ──────────────────────────────────────────────────────────────

function ServerNode({ server, agents, zone }) {
  const agentStatuses = (server.agents || []).map((a) => {
    const live = getAgentLive(a.name, agents)
    return live.status || 'Unknown'
  })
  const worst = worstStatus(agentStatuses.length ? agentStatuses : ['Unknown'])
  const accentColor = zone === 'prod' ? '#22c55e' : '#22d3ee'
  const statusC = statusColor(worst)

  return (
    <div
      className="rounded-lg border flex flex-col gap-2 p-3"
      style={{
        background: '#111827',
        borderColor: '#2a2d3a',
        borderLeftColor: accentColor,
        borderLeftWidth: 3,
        minWidth: 172,
      }}
    >
      {/* Server header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Server size={12} className="text-slate-400 flex-shrink-0" />
          <span
            className="text-white font-mono font-semibold truncate"
            style={{ fontSize: '0.72rem' }}
            title={server.server}
          >
            {server.server}
          </span>
        </div>
        <StatusDot status={worst} size={8} />
      </div>

      {/* IP */}
      {server.ip && (
        <span className="text-slate-500 font-mono" style={{ fontSize: '0.63rem' }}>
          {server.ip}
        </span>
      )}

      {/* Datacenter */}
      {server.datacenter && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded self-start font-medium"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          {server.datacenter}
        </span>
      )}

      {/* Agent count badge */}
      {server.agents && server.agents.length > 0 && (
        <span className="text-[10px] text-slate-500">
          {server.agents.length} agent{server.agents.length !== 1 ? 's' : ''}
        </span>
      )}

      {/* Agent nodes */}
      {server.agents && server.agents.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-0.5">
          {server.agents.map((a) => (
            <AgentNode key={a.name} agentConfig={a} agents={agents} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Server + connection line row ────────────────────────────────────────────

function ServerWithLine({ server, agents, zone, serviceStatus }) {
  const agentStatuses = (server.agents || []).map((a) => {
    const live = getAgentLive(a.name, agents)
    return live.status || 'Unknown'
  })
  const worst = worstStatus(agentStatuses.length ? agentStatuses : ['Unknown'])

  if (zone === 'prod') {
    return (
      <div className="flex items-center">
        <ServerNode server={server} agents={agents} zone={zone} />
        <ConnectionLine status={worst} direction="prod" />
      </div>
    )
  }
  // DR: line on left, server on right
  return (
    <div className="flex items-center">
      <ConnectionLine status={worst} direction="dr" />
      <ServerNode server={server} agents={agents} zone={zone} />
    </div>
  )
}

// ─── Service Hub ──────────────────────────────────────────────────────────────

function ServiceHub({ service, agents }) {
  const allAgents = [
    ...(service.prod || []).flatMap((s) => s.agents || []),
    ...(service.dr || []).flatMap((s) => s.agents || []),
  ]
  const allStatuses = allAgents.map((a) => {
    const live = getAgentLive(a.name, agents)
    return live.status || 'Unknown'
  })
  const health = worstStatus(allStatuses.length ? allStatuses : ['Unknown'])
  const hColor = statusColor(health)
  const prodCount = (service.prod || []).length
  const drCount = (service.dr || []).length

  return (
    <div
      className="rounded-xl border flex flex-col items-center text-center gap-2 p-3 mx-auto relative"
      style={{
        minWidth: 160,
        maxWidth: 200,
        background: '#0d1118',
        borderColor: '#2a2d3a',
        borderTopColor: service.color || '#6366f1',
        borderTopWidth: 3,
      }}
    >
      {/* Service icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: `${service.color || '#6366f1'}22` }}
      >
        <Activity size={16} style={{ color: service.color || '#6366f1' }} />
      </div>

      {/* Name */}
      <span
        className="font-bold text-white leading-tight"
        style={{ fontSize: '1rem' }}
      >
        {service.name}
      </span>

      {/* Criticality */}
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${criticalityBadge(service.criticality)}`}
      >
        {service.criticality || 'Unknown'}
      </span>

      {/* Health */}
      <div className="flex items-center gap-1.5">
        <StatusDot status={health} size={8} />
        <span className="text-xs" style={{ color: hColor }}>
          {health}
        </span>
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 border-t border-slate-700/50 pt-2 w-full justify-center">
        <span className="text-green-400 font-mono font-semibold">{prodCount} PROD</span>
        <span className="text-slate-600">|</span>
        <span className="text-cyan-400 font-mono font-semibold">{drCount} DR</span>
      </div>

      {/* Description */}
      {service.description && (
        <p className="text-slate-600 text-[10px] leading-tight mt-0.5 line-clamp-2">
          {service.description}
        </p>
      )}
    </div>
  )
}

// ─── Service Row ──────────────────────────────────────────────────────────────

function ServiceRow({ service, agents, isLast }) {
  const prodServers = service.prod || []
  const drServers = service.dr || []

  return (
    <div>
      <div className="grid gap-4 py-5 px-4" style={{ gridTemplateColumns: '1fr 200px 1fr' }}>
        {/* PROD column */}
        <div className="flex flex-col gap-3 justify-center">
          {prodServers.length === 0 ? (
            <div className="flex items-center text-slate-600 text-xs italic gap-2">
              <div className="flex-1 h-px bg-slate-800" />
              <span>No PROD servers</span>
            </div>
          ) : (
            prodServers.map((srv) => (
              <ServerWithLine key={srv.id || srv.server} server={srv} agents={agents} zone="prod" />
            ))
          )}
        </div>

        {/* Center: service hub */}
        <div className="flex items-center justify-center">
          <ServiceHub service={service} agents={agents} />
        </div>

        {/* DR column */}
        <div className="flex flex-col gap-3 justify-center">
          {drServers.length === 0 ? (
            <div className="flex items-center text-slate-600 text-xs italic gap-2">
              <span>No DR servers</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
          ) : (
            drServers.map((srv) => (
              <ServerWithLine key={srv.id || srv.server} server={srv} agents={agents} zone="dr" />
            ))
          )}
        </div>
      </div>

      {!isLast && <div className="h-px mx-4" style={{ background: 'linear-gradient(to right, transparent, #2a2d3a, transparent)' }} />}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onConfig }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 py-24">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
        <Monitor size={28} className="text-slate-500" />
      </div>
      <div className="text-center">
        <p className="text-white text-lg font-semibold mb-1">No services configured yet</p>
        <p className="text-slate-500 text-sm">Add business services to visualise your PROD/DR topology.</p>
      </div>
      <button
        onClick={onConfig}
        className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
      >
        Configure Services →
      </button>
    </div>
  )
}

// ─── Page header ──────────────────────────────────────────────────────────────

function GraphHeader({ onClose, onConfig, agents, services, countdown }) {
  const connectedCount = agents.filter((a) => a.status === 'Connected').length

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
      style={{ background: '#0a0e17', borderColor: '#1e2330' }}
    >
      {/* Back */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
      >
        <ChevronLeft size={16} />
        <span>Dashboard</span>
      </button>

      <div className="h-4 w-px bg-slate-700" />

      {/* Title */}
      <div className="flex items-center gap-2">
        <Monitor size={16} className="text-indigo-400" />
        <span className="text-white font-semibold text-sm">Service Graph</span>
        <span className="text-slate-600 text-sm">— NOC View</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>
          <span className="text-white font-semibold">{services.length}</span> services
        </span>
        <span>
          <span className="text-white font-semibold">{agents.length}</span> agents
        </span>
        <span>
          <span className="text-green-400 font-semibold">{connectedCount}</span> connected
        </span>
      </div>

      <div className="h-4 w-px bg-slate-700" />

      {/* Live badge */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="text-green-400 font-semibold">Live</span>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <RefreshCw size={11} className={countdown <= 3 ? 'animate-spin text-slate-400' : ''} />
        <span>{countdown}s</span>
      </div>

      <div className="h-4 w-px bg-slate-700" />

      {/* Configure */}
      <button
        onClick={onConfig}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs"
      >
        <Settings size={12} />
        <span>Configure</span>
      </button>

      {/* Fullscreen */}
      <button
        onClick={handleFullscreen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs"
        title="Toggle fullscreen"
      >
        <Maximize2 size={12} />
        <span>Fullscreen</span>
      </button>
    </div>
  )
}

// ─── Zone labels ──────────────────────────────────────────────────────────────

function ZoneLabels() {
  return (
    <div className="grid gap-4 px-4 pb-1 pt-3" style={{ gridTemplateColumns: '1fr 200px 1fr' }}>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-green-500/20" />
        <span className="text-[10px] font-bold tracking-widest text-green-500/70 uppercase px-2 py-0.5 rounded border border-green-500/20">
          Production Zone
        </span>
        <div className="h-px flex-1 bg-green-500/20" />
      </div>
      <div />
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-cyan-500/20" />
        <span className="text-[10px] font-bold tracking-widest text-cyan-500/70 uppercase px-2 py-0.5 rounded border border-cyan-500/20">
          Disaster Recovery
        </span>
        <div className="h-px flex-1 bg-cyan-500/20" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServiceGraph({ agents = [], onClose, onConfig }) {
  const { settings } = useSettings()
  const services = settings.businessServices || []

  const REFRESH_SECS = 30
  const [countdown, setCountdown] = useState(REFRESH_SECS)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTick((t) => t + 1)
          return REFRESH_SECS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: '#060b14', fontFamily: 'system-ui, sans-serif' }}
    >
      <GraphHeader
        onClose={onClose}
        onConfig={onConfig}
        agents={agents}
        services={services}
        countdown={countdown}
      />

      {services.length === 0 ? (
        <EmptyState onConfig={onConfig} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ZoneLabels />
          {services.map((svc, idx) => (
            <ServiceRow
              key={svc.id || svc.name}
              service={svc}
              agents={agents}
              isLast={idx === services.length - 1}
            />
          ))}
          <div className="h-8" />
        </div>
      )}
    </div>
  )
}
