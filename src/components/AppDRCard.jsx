import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, Zap, Pin, PinOff,
  ArrowRightLeft, ArrowLeftRight, ShieldCheck,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'

// ─── Colour helpers ───────────────────────────────────────────────────────────

function rtoColors(status) {
  switch (status) {
    case 'On Track':  return { text: 'text-green-400',  bar: 'bg-green-500',  ring: 'border-green-500/30',  bg: 'bg-green-500/10'  }
    case 'At Risk':   return { text: 'text-amber-400',  bar: 'bg-amber-500',  ring: 'border-amber-500/30',  bg: 'bg-amber-500/10'  }
    case 'Breached':  return { text: 'text-red-400',    bar: 'bg-red-500',    ring: 'border-red-500/30',    bg: 'bg-red-500/10'    }
    case 'Met':       return { text: 'text-green-400',  bar: 'bg-green-500',  ring: 'border-green-500/30',  bg: 'bg-green-500/10'  }
    case 'Missed':    return { text: 'text-red-400',    bar: 'bg-red-500',    ring: 'border-red-500/30',    bg: 'bg-red-500/10'    }
    default:          return { text: 'text-slate-400',  bar: 'bg-slate-500',  ring: 'border-slate-500/30',  bg: 'bg-slate-500/10'  }
  }
}

function statusPill(status) {
  switch (status) {
    case 'Executing':    return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
    case 'Ended OK':     return 'bg-green-500/10 border-green-500/30 text-green-400'
    case 'Ended Not OK': return 'bg-red-500/10 border-red-500/30 text-red-400'
    default:             return 'bg-slate-500/10 border-slate-500/30 text-slate-400'
  }
}

function headerBadgeClass(status, health) {
  if (status === 'Completed')   return 'bg-green-500/10 border-green-500/30 text-green-400'
  if (status === 'Failed')      return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (health === 'Breached')    return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (health === 'At Risk')     return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
}

// ─── Live elapsed timer (updates every 15 s) ─────────────────────────────────

function useElapsed(startISO, isRunning) {
  const [mins, setMins] = useState(0)
  useEffect(() => {
    if (!startISO || !isRunning) return
    const t0 = new Date(startISO).getTime()
    const tick = () => setMins(Math.round((Date.now() - t0) / 60000))
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [startISO, isRunning])
  return mins
}

// ─── RTO progress bar ─────────────────────────────────────────────────────────

function RtoBar({ elapsed, target, rtoStatus }) {
  const pct = target > 0 ? Math.min(200, Math.round((elapsed / target) * 100)) : 0
  const c   = rtoColors(rtoStatus)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500">RTO Progress</span>
        <span className={c.text}>{rtoStatus}</span>
      </div>
      <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${c.bar} ${pct >= 100 ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        <div className="absolute right-0 top-0 h-full w-0.5 bg-white/20" title="SLA deadline" />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className="text-slate-500">Elapsed: <span className="font-mono text-slate-300">{elapsed}m</span></span>
        <span className="text-slate-500">SLA: <span className="font-mono text-slate-300">{target}m</span></span>
        <span className={`font-mono font-semibold ${c.text}`}>{pct}%</span>
      </div>
    </div>
  )
}

// ─── Phase card ───────────────────────────────────────────────────────────────

const PHASE_META = {
  switchover: { icon: ArrowRightLeft, label: 'Switchover', hasSla: true  },
  switchback: { icon: ArrowLeftRight, label: 'Switchback', hasSla: true  },
  readiness:  { icon: ShieldCheck,    label: 'Readiness',  hasSla: false },
}

function PhaseCard({ phase, data }) {
  const t           = useT()
  const { fmtTime } = useSettings()
  const isRunning   = data?.status === 'Executing'
  const liveElapsed = useElapsed(isRunning ? data?.startTimeISO : null, isRunning)
  const { icon: Icon, label, hasSla } = PHASE_META[phase]

  if (!data) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 border border-dashed rounded-lg p-4 opacity-30 ${t.borderDash}`}>
        <Icon className={`w-4 h-4 ${t.textFaint}`} />
        <span className={`text-xs ${t.textFaint} capitalize`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>Not configured</span>
      </div>
    )
  }

  const elapsed    = isRunning ? liveElapsed : (data.elapsedMins ?? 0)
  const target     = data.rtoTargetMins
  const pct        = hasSla && target > 0 ? Math.min(200, Math.round((elapsed / target) * 100)) : 0
  const rtoStatus  = data.rtoStatus || 'N/A'
  const c          = rtoColors(rtoStatus)

  // For readiness: use neutral border/bg
  const cardRing = hasSla ? c.ring : (data.status === 'Ended OK' ? 'border-green-500/30' : data.status === 'Ended Not OK' ? 'border-red-500/30' : 'border-emerald-500/20')
  const cardBg   = hasSla ? c.bg   : (data.status === 'Ended OK' ? 'bg-green-500/5' : data.status === 'Ended Not OK' ? 'bg-red-500/5' : 'bg-emerald-500/5')

  return (
    <div className={`flex flex-col gap-3 border rounded-lg p-3 ${cardRing} ${cardBg}`}>
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={hasSla ? c.text : 'text-emerald-400'}><Icon className="w-4 h-4" /></span>
          <span className={`text-xs font-semibold ${t.text}`}>{label}</span>
          {!hasSla && (
            <span className="text-xs px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              No SLA
            </span>
          )}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${statusPill(data.status)}`}>
          {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />}
          {data.status}
        </span>
      </div>

      {/* Folder */}
      <p className={`text-xs font-mono truncate ${t.textFaint}`} title={data.folder}>{data.folder}</p>

      {/* Times */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className={t.textMuted}>Started</p>
          <p className={`font-mono mt-0.5 ${t.textSub}`}>
            {fmtTime(data.startTimeISO, { second: undefined }) || '—'}
          </p>
        </div>
        {hasSla ? (
          <div>
            <p className={t.textMuted}>SLA Deadline</p>
            <p className={`font-mono mt-0.5 ${c.text}`}>
              {data.estEndISO
                ? fmtTime(data.estEndISO, { second: undefined })
                : target ? `+${target}m` : '—'}
            </p>
          </div>
        ) : (
          <div>
            <p className={t.textMuted}>Ended</p>
            <p className={`font-mono mt-0.5 ${t.textSub}`}>
              {data.endTimeISO ? fmtTime(data.endTimeISO, { second: undefined }) : isRunning ? 'Running…' : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Elapsed row (always shown) */}
      <div className="text-xs flex items-center justify-between">
        <span className={t.textMuted}>
          Duration: <span className={`font-mono ${t.textSub}`}>{elapsed}m</span>
        </span>
        {data.endTimeISO && (
          <span className="text-xs px-1.5 py-0.5 rounded border border-green-500/30 bg-green-500/10 text-green-400">
            Complete
          </span>
        )}
      </div>

      {/* RTO bar — only for SLA phases */}
      {hasSla && target && (
        <RtoBar elapsed={elapsed} target={target} rtoStatus={rtoStatus} />
      )}

      {/* Log */}
      {data.logURI && (
        <a href={data.logURI} target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
          <ExternalLink className="w-3 h-3" />View Log
        </a>
      )}
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function AppDRCard({ operation }) {
  const t = useT()
  const { settings, togglePin } = useSettings()
  const {
    app, server, phases, totalPhases, completedPhases, failedPhases,
    overallStatus, drillHealth, completionPct,
  } = operation

  const [expanded, setExpanded] = useState(true)
  const badge    = headerBadgeClass(overallStatus, drillHealth)
  const isPinned = settings.pinnedApps?.includes(app)

  const HealthIcon =
    drillHealth === 'Breached' || overallStatus === 'Failed' ? XCircle
    : drillHealth === 'At Risk'  ? AlertTriangle
    : overallStatus === 'Completed' ? CheckCircle2
    : Zap

  return (
    <div className={`${t.card} border ${t.border} rounded-xl overflow-hidden ${isPinned ? 'ring-1 ring-blue-500/40' : ''}`}>

      {/* Pinned indicator strip */}
      {isPinned && (
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-transparent" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        {/* Clickable area (expand/collapse) */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
            isPinned ? 'bg-blue-600/30 border-blue-500/40' : 'bg-blue-600/20 border-blue-500/30'
          }`}>
            {isPinned
              ? <Pin className="w-3.5 h-3.5 text-blue-400" />
              : <span className="text-xs font-bold text-blue-400">{app.slice(0, 2).toUpperCase()}</span>
            }
          </div>
          <div className="text-left">
            <p className={`text-sm font-semibold ${t.text}`}>{app}</p>
            <p className={`text-xs font-mono ${t.textFaint}`}>Server: {server}</p>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Phase status dots */}
          <div className="flex items-center gap-1">
            {['switchover', 'switchback', 'readiness'].map((ph) => {
              const p = phases[ph]
              if (!p) return <span key={ph} className="w-2 h-2 rounded-full bg-slate-700 opacity-30" title={`${ph}: N/A`} />
              const running  = p.status === 'Executing'
              const ok       = p.status === 'Ended OK'
              const fail     = p.status === 'Ended Not OK'
              return (
                <span key={ph} title={`${ph}: ${p.status}`}
                  className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : fail ? 'bg-red-500' : running ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`}
                />
              )
            })}
          </div>

          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${badge}`}>
            <HealthIcon className="w-3 h-3" />
            {drillHealth}
          </span>
          <span className={`text-xs font-mono ${t.textMuted}`}>{completedPhases}/{totalPhases}</span>

          {/* Pin toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(app) }}
            title={isPinned ? 'Unpin application' : 'Pin to top'}
            className={`p-1 rounded transition-colors ${
              isPinned ? 'text-blue-400 hover:text-blue-300' : `${t.textFaint} hover:text-blue-400`
            }`}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className={`${t.textFaint}`}
          >
            {expanded
              ? <ChevronUp className="w-4 h-4" />
              : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Completion bar */}
      <div className={`h-0.5 ${t.border}`}>
        <div
          className={`h-full transition-all duration-700 ${
            failedPhases > 0 ? 'bg-red-500' :
            completedPhases === totalPhases ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Phase grid */}
      {expanded && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <PhaseCard phase="switchover" data={phases.switchover} />
          <PhaseCard phase="switchback" data={phases.switchback} />
          <PhaseCard phase="readiness"  data={phases.readiness}  />
        </div>
      )}
    </div>
  )
}
