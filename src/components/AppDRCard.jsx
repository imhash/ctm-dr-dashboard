import { useState, useEffect } from 'react'
import {
  CheckCircle2, XCircle, AlertTriangle, Zap, Pin, PinOff,
  ArrowRightLeft, ArrowLeftRight, ShieldCheck, ArrowDown, ArrowUp,
  ChevronDown, ChevronUp, List,
} from 'lucide-react'
import { useT } from '../context/ThemeContext'
import { useSettings } from '../context/SettingsContext'
import PhaseStepReport from './PhaseStepReport'

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
  if (status === 'Completed' && health === 'On Track') return 'bg-green-500/10 border-green-500/30 text-green-400'
  if (status === 'Failed'  || health === 'Failed')     return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (health === 'Breached')                           return 'bg-red-500/10 border-red-500/30 text-red-400'
  if (health === 'At Risk')                            return 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
}

// ─── Live elapsed timer ───────────────────────────────────────────────────────

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

// ─── Phase metadata ───────────────────────────────────────────────────────────

const PHASE_META = {
  switchover: { icon: ArrowDown,       label: 'Switchover', hasSla: true,  color: 'text-sky-400'     },
  switchback: { icon: ArrowUp,         label: 'Switchback', hasSla: true,  color: 'text-violet-400'  },
  readiness:  { icon: ShieldCheck,     label: 'Readiness',  hasSla: false, color: 'text-emerald-400' },
  failover:   { icon: ArrowRightLeft,  label: 'Failover',   hasSla: true,  color: 'text-orange-400'  },
  failback:   { icon: ArrowLeftRight,  label: 'Failback',   hasSla: true,  color: 'text-pink-400'    },
}

// ─── Phase card ───────────────────────────────────────────────────────────────

function PhaseCard({ phase, data, app, onViewSteps }) {
  const t           = useT()
  const { fmtTime } = useSettings()
  const isRunning   = data?.status === 'Executing'
  const liveElapsed = useElapsed(isRunning ? data?.startTimeISO : null, isRunning)
  const { icon: Icon, label, hasSla, color } = PHASE_META[phase]

  if (!data) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 border border-dashed rounded-lg p-4 opacity-30 ${t.borderDash}`}>
        <Icon className={`w-4 h-4 ${t.textFaint}`} />
        <span className={`text-xs ${t.textFaint} capitalize`}>{label}</span>
        <span className={`text-xs ${t.textFaint}`}>Not configured</span>
      </div>
    )
  }

  const elapsed   = isRunning ? liveElapsed : (data.elapsedMins ?? 0)
  const target    = data.rtoTargetMins
  const rtoStatus = data.rtoStatus || 'N/A'
  const c         = rtoColors(rtoStatus)

  const hasFailed  = data.status === 'Ended Not OK' || (data.failedSteps ?? 0) > 0
  const cardRing   = hasSla ? c.ring : (data.status === 'Ended OK' ? 'border-emerald-500/30' : hasFailed ? 'border-red-500/30' : `border-${color.replace('text-', '')}/20`)
  const cardBg     = hasSla ? c.bg   : (data.status === 'Ended OK' ? 'bg-emerald-500/5' : hasFailed ? 'bg-red-500/5' : 'bg-slate-500/5')

  const totalSteps     = data.totalSteps     ?? 0
  const completedSteps = data.completedSteps ?? 0
  const failedSteps    = data.failedSteps    ?? 0

  return (
    <div className={`flex flex-col gap-3 border rounded-lg p-3 ${cardRing} ${cardBg}`}>
      {/* Phase header */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={color}><Icon className="w-4 h-4" /></span>
          <span className={`text-xs font-semibold ${t.text}`}>{label}</span>
          {!hasSla && (
            <span className="text-xs px-1 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 leading-none">
              No SLA
            </span>
          )}
          {hasFailed && (
            <span className="text-xs px-1 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 leading-none">
              ✕ Failed
            </span>
          )}
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${statusPill(data.status)} whitespace-nowrap`}>
          {isRunning && <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 align-middle" />}
          {data.status}
        </span>
      </div>

      {/* Folder */}
      <p className={`text-xs font-mono truncate ${t.textFaint}`} title={data.folder}>{data.folder}</p>

      {/* Step progress: X/N (workflow monitor style) */}
      {totalSteps > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={t.textMuted}>
              Steps:
              <span className={`font-mono font-semibold ml-1 ${
                failedSteps > 0 ? 'text-red-400' :
                completedSteps === totalSteps ? 'text-green-400' :
                isRunning ? 'text-cyan-400' : t.textSub
              }`}>
                {completedSteps}/{totalSteps}
              </span>
            </span>
            {failedSteps > 0 && (
              <span className="text-xs text-red-400">{failedSteps} failed</span>
            )}
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${t.inner} flex`}>
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${Math.round((completedSteps / totalSteps) * 100)}%` }}
            />
            {failedSteps > 0 && (
              <div
                className="h-full bg-red-500"
                style={{ width: `${Math.round((failedSteps / totalSteps) * 100)}%` }}
              />
            )}
          </div>
        </div>
      )}

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

      {/* Duration */}
      <div className="text-xs flex items-center justify-between">
        <span className={t.textMuted}>
          Duration: <span className={`font-mono ${t.textSub}`}>{elapsed}m</span>
        </span>
      </div>

      {/* RTO bar — SLA phases only */}
      {hasSla && target && (
        <RtoBar elapsed={elapsed} target={target} rtoStatus={rtoStatus} />
      )}

      {/* View Steps button */}
      {totalSteps > 0 && (
        <button
          onClick={() => onViewSteps(phase)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors w-full justify-center mt-1 ${
            failedSteps > 0
              ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : `${t.border} ${t.textMuted} hover:opacity-80`
          }`}
        >
          <List className="w-3.5 h-3.5" />
          View {totalSteps} Step{totalSteps !== 1 ? 's' : ''}
          {failedSteps > 0 && ` — ${failedSteps} failed`}
        </button>
      )}
    </div>
  )
}

// ─── Phase status dot ─────────────────────────────────────────────────────────

function PhaseDot({ phase, data }) {
  if (!data) return <span title={`${phase}: N/A`} className="w-2 h-2 rounded-full bg-slate-700 opacity-30" />
  const ok   = data.status === 'Ended OK'
  const fail = data.status === 'Ended Not OK' || (data.failedSteps ?? 0) > 0
  const run  = data.status === 'Executing'
  return (
    <span title={`${phase}: ${data.status}${data.totalSteps > 0 ? ` (${data.completedSteps}/${data.totalSteps})` : ''}`}
      className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : fail ? 'bg-red-500' : run ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`}
    />
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

// Phase keys in display order
const ALL_PHASES = ['switchover', 'switchback', 'readiness', 'failover', 'failback']

export default function AppDRCard({ operation }) {
  const t = useT()
  const { settings, togglePin } = useSettings()
  const {
    app, server, phases, totalPhases, completedPhases, failedPhases,
    overallStatus, drillHealth, completionPct,
  } = operation

  const [expanded,     setExpanded]     = useState(true)
  const [stepPhase,    setStepPhase]    = useState(null)   // which phase's modal is open

  const badge    = headerBadgeClass(overallStatus, drillHealth)
  const isPinned = settings.pinnedApps?.includes(app)

  const HealthIcon =
    drillHealth === 'Failed' || overallStatus === 'Failed'  ? XCircle
    : drillHealth === 'Breached'                            ? XCircle
    : drillHealth === 'At Risk'                             ? AlertTriangle
    : overallStatus === 'Completed'                         ? CheckCircle2
    : Zap

  // Only render columns for phases that exist in this operation
  const presentPhases = ALL_PHASES.filter((ph) => phases[ph])

  return (
    <>
      {/* Step detail modal */}
      {stepPhase && phases[stepPhase] && (
        <PhaseStepReport
          app={app}
          phase={stepPhase}
          phaseData={phases[stepPhase]}
          onClose={() => setStepPhase(null)}
        />
      )}

      <div className={`${t.card} border ${t.border} rounded-xl overflow-hidden ${isPinned ? 'ring-1 ring-blue-500/40' : ''}`}>
        {isPinned && <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-transparent" />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <button onClick={() => setExpanded((p) => !p)} className="flex items-center gap-3 flex-1 text-left">
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
              {ALL_PHASES.map((ph) => <PhaseDot key={ph} phase={ph} data={phases[ph]} />)}
            </div>

            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${badge}`}>
              <HealthIcon className="w-3 h-3" />
              {drillHealth}
            </span>
            <span className={`text-xs font-mono ${t.textMuted}`}>{completedPhases}/{totalPhases}</span>

            {/* Pin toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePin(app) }}
              title={isPinned ? 'Unpin' : 'Pin to top'}
              className={`p-1 rounded transition-colors ${isPinned ? 'text-blue-400 hover:text-blue-300' : `${t.textFaint} hover:text-blue-400`}`}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>

            <button onClick={() => setExpanded((p) => !p)} className={t.textFaint}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

        {/* Phase grid — responsive, only shows phases that exist */}
        {expanded && (
          <div className={`p-4 grid gap-3 ${
            presentPhases.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
            presentPhases.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
            'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          }`}>
            {ALL_PHASES.map((ph) => (
              <PhaseCard
                key={ph}
                phase={ph}
                data={phases[ph]}
                app={app}
                onViewSteps={(p) => setStepPhase(p)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
