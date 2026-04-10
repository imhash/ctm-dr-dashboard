import { CheckCircle2, Clock, PlayCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

function statusConfig(status) {
  switch (status) {
    case 'In Progress': return { color: 'text-cyan-400',   bg: 'bg-cyan-500/10   border-cyan-500/30',   icon: PlayCircle,    bar: 'bg-cyan-500'  }
    case 'Completed':   return { color: 'text-green-400',  bg: 'bg-green-500/10  border-green-500/30',  icon: CheckCircle2,  bar: 'bg-green-500' }
    case 'Scheduled':   return { color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', icon: Clock,         bar: 'bg-purple-500'}
    default:            return { color: 'text-slate-400',  bg: 'bg-slate-500/10  border-slate-500/30',  icon: AlertTriangle, bar: 'bg-slate-500' }
  }
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DrillRow({ drill }) {
  const [expanded, setExpanded] = useState(drill.status === 'In Progress')
  const cfg = statusConfig(drill.status)
  const Icon = cfg.icon

  const successRate =
    drill.totalJobs > 0
      ? (((drill.completedJobs - drill.failedJobs) / drill.totalJobs) * 100).toFixed(1)
      : 0

  return (
    <div className="border border-[#2a2d3a] rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-[#1f2233] hover:bg-[#242738] transition-colors text-left"
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white truncate">{drill.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
              {drill.status}
            </span>
            <span className="text-xs text-slate-500 px-2 py-0.5 rounded-full bg-slate-700/50">
              {drill.severity}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                style={{ width: `${drill.progress}%` }}
              />
            </div>
            <span className="text-xs font-mono text-slate-300 w-8 text-right">{drill.progress}%</span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 bg-[#161926] border-t border-[#2a2d3a]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
            <Metric label="Total Jobs"     value={drill.totalJobs} />
            <Metric label="Completed"      value={drill.completedJobs} color="text-green-400" />
            <Metric label="Failed"         value={drill.failedJobs}    color={drill.failedJobs > 0 ? 'text-red-400' : 'text-slate-300'} />
            <Metric label="Success Rate"   value={`${successRate}%`}   color={successRate >= 98 ? 'text-green-400' : successRate >= 90 ? 'text-amber-400' : 'text-red-400'} />
            <Metric label="Datacenter"     value={drill.datacenter} />
            <Metric label="RTO Target"     value={drill.rto} />
            <Metric label="RPO Target"     value={drill.rpo} />
            <Metric label="Owner"          value={drill.owner} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#2a2d3a] pt-3">
            <div>
              <span className="text-slate-500">Scheduled: </span>
              <span className="text-slate-300">{formatDate(drill.scheduledDate)}</span>
            </div>
            <div>
              <span className="text-slate-500">Started: </span>
              <span className="text-slate-300">{formatDate(drill.startTime)}</span>
            </div>
            {drill.endTime && (
              <div>
                <span className="text-slate-500">Ended: </span>
                <span className="text-slate-300">{formatDate(drill.endTime)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">ID: </span>
              <span className="font-mono text-slate-400">{drill.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, color = 'text-slate-300' }) {
  return (
    <div>
      <p className="text-slate-500 mb-0.5">{label}</p>
      <p className={`font-medium ${color}`}>{value}</p>
    </div>
  )
}

export default function DRDrillStatus({ drills }) {
  const counts = {
    inProgress: drills.filter((d) => d.status === 'In Progress').length,
    completed:  drills.filter((d) => d.status === 'Completed').length,
    scheduled:  drills.filter((d) => d.status === 'Scheduled').length,
  }

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">DR Drill Status</h2>
          <p className="text-xs text-slate-500 mt-0.5">Progress · Completed · Scheduled</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Badge label={`${counts.inProgress} Active`}    color="bg-cyan-500/10 text-cyan-400 border-cyan-500/30" />
          <Badge label={`${counts.scheduled} Scheduled`}  color="bg-purple-500/10 text-purple-400 border-purple-500/30" />
          <Badge label={`${counts.completed} Done`}       color="bg-green-500/10 text-green-400 border-green-500/30" />
        </div>
      </div>

      {/* Drill rows */}
      <div className="flex flex-col gap-2">
        {drills.map((drill) => (
          <DrillRow key={drill.id} drill={drill} />
        ))}
      </div>
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs ${color}`}>{label}</span>
  )
}
